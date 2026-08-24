import { loadProfile } from '@/server/auth/accounts';
import { decryptOptional } from '@/server/crypto';
import { route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';

/** The signed-in account. Direct identifiers are decrypted here and nowhere else. */
export const GET = route({ allowMfaPending: true }, async ({ session }) => {
  const profile = await loadProfile(session.userId);
  if (!profile) return problem('not_found', 'error.not_found');

  return ok({
    id: profile.id,
    email: profile.email,
    role: profile.role,
    status: profile.status,
    locale: profile.locale,
    fullName: decryptOptional(profile.fullNameEnc),
    phone: decryptOptional(profile.phoneEnc),
    dateOfBirth: profile.dateOfBirth,
    sex: profile.sex,
    mfaPending: session.mfaPending,
  });
});

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { tables } from '@gi-compass/db';
import { database } from '@/server/db';
import { encryptOptional } from '@/server/crypto';
import { jsonBody } from '@/server/api/route-handler';

const patchBody = z.object({
  fullName: z.string().min(1).max(200).optional(),
  phone: z.string().min(6).max(20).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sex: z.enum(['female', 'male', 'other', 'prefer_not_to_say']).optional(),
  locale: z.enum(['en', 'hi']).optional(),
  emergencyContactName: z.string().min(1).max(200).optional(),
  emergencyContactPhone: z.string().min(6).max(20).optional(),
});

/**
 * Completes or corrects the profile.
 *
 * A change to the date of birth is recorded as an amendment rather than an overwrite: it decides
 * whether the person may open a case at all, and whether age-dependent red-flag rules fire, so
 * the previous value has to remain visible to the reviewing doctor.
 */
export const PATCH = route({ roles: ['patient'] }, async ({ request, session }) => {
  const input = await jsonBody(request, patchBody);
  const db = database();

  const profile = await loadProfile(session.userId);
  if (!profile) return problem('not_found', 'error.not_found');

  if (input.dateOfBirth !== undefined && profile.dateOfBirth !== null && input.dateOfBirth !== profile.dateOfBirth) {
    await db.insert(tables.profileAmendments).values({
      userId: session.userId,
      field: 'dateOfBirth',
      previousValue: profile.dateOfBirth,
      newValue: input.dateOfBirth,
    });
  }

  const [updated] = await db
    .update(tables.users)
    .set({
      ...(input.fullName === undefined ? {} : { fullNameEnc: encryptOptional(input.fullName) }),
      ...(input.phone === undefined ? {} : { phoneEnc: encryptOptional(input.phone) }),
      ...(input.dateOfBirth === undefined ? {} : { dateOfBirth: input.dateOfBirth }),
      ...(input.sex === undefined ? {} : { sex: input.sex }),
      ...(input.locale === undefined ? {} : { locale: input.locale }),
      ...(input.emergencyContactName === undefined
        ? {}
        : { emergencyContactNameEnc: encryptOptional(input.emergencyContactName) }),
      ...(input.emergencyContactPhone === undefined
        ? {}
        : { emergencyContactPhoneEnc: encryptOptional(input.emergencyContactPhone) }),
      updatedAt: new Date(),
    })
    .where(eq(tables.users.id, session.userId))
    .returning({ id: tables.users.id });

  return ok({ status: 'updated', id: updated?.id ?? session.userId });
});
