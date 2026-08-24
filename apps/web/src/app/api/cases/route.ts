import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { tables } from '@gi-compass/db';
import { loadProfile } from '@/server/auth/accounts';
import { clinical, database } from '@/server/db';
import { currentPublishedTemplate } from '@/server/services/content-service';
import { accessContext, jsonBody, route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';
import { ageInYears } from '@/server/services/age';

const createBody = z.object({ entryPointId: z.string().min(1).max(64) });

/** The patient's own cases: state and timestamps only, never clinical content. */
export const GET = route({ roles: ['patient'] }, async ({ session, metadata }) => {
  const context = accessContext(session, session.userId, 'account_processing', metadata);
  return ok({ cases: await clinical().listPatientCases(context) });
});

/**
 * Opens a case.
 *
 * Two gates before anything is written. The account must be verified, because an unverified
 * account may be someone else's address. And the patient must be an adult: DPDP requires
 * verifiable parental consent to process a child's data, and Phase 1 has no guardian flow.
 *
 * TODO(confirm): Decision E — whether minors can use the platform, and the guardian-consent flow.
 */
export const POST = route({ roles: ['patient'] }, async ({ request, session, metadata }) => {
  const { entryPointId } = await jsonBody(request, createBody);

  const profile = await loadProfile(session.userId);
  if (!profile) return problem('not_found', 'error.not_found');
  if (profile.status !== 'active') {
    return problem('forbidden', 'case.create.unverified_account');
  }

  const age = ageInYears(profile.dateOfBirth);
  if (age === null) {
    return problem('invalid_request', 'case.create.date_of_birth_required');
  }
  if (age < 18) {
    return problem('forbidden', 'case.create.adults_only');
  }

  const template = await currentPublishedTemplate();
  const entryPoint = template.index.entryPointById.get(entryPointId);
  if (!entryPoint) {
    return problem('invalid_request', 'case.create.unknown_entry_point');
  }

  const existing = await database()
    .select({ id: tables.users.id })
    .from(tables.users)
    .where(eq(tables.users.id, session.userId))
    .limit(1);
  if (existing.length === 0) return problem('not_found', 'error.not_found');

  const context = accessContext(session, session.userId, 'account_processing', metadata);
  try {
    const created = await clinical().createCase(context, {
      patientId: session.userId,
      templateVersionId: template.versionId,
      entryPointId,
    });
    return ok({ case: created }, 201);
  } catch (error) {
    // The partial unique index enforces one draft per patient at the database level, so a race
    // surfaces here rather than producing a second draft.
    if (error instanceof Error && /duplicate key|unique/i.test(error.message)) {
      return problem('conflict', 'case.create.draft_already_open');
    }
    throw error;
  }
});
