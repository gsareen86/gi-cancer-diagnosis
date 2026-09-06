import { cookies } from 'next/headers';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { tables } from '@gi-compass/db';
import { database } from '@/server/db';
import { ACCESS_COOKIE, liveSession, verifyAccessToken } from '@/server/auth/session';
import { decryptOptional } from '@/server/crypto';

/**
 * Reads the signed-in account for a server component.
 *
 * Returns null rather than redirecting, so each page decides what "not signed in" means for it —
 * the home page shows a sign-in link, a case page redirects.
 *
 * This is a convenience for rendering, never an authorization decision: every clinical read still
 * goes through the API and the repository, which check again.
 */

export interface CurrentUser {
  id: string;
  email: string;
  role: 'patient' | 'doctor' | 'clinical_admin' | 'platform_admin';
  status: string;
  locale: string;
  fullName: string | null;
  dateOfBirth: string | null;
  sex: string | null;
  hasEmergencyContact: boolean;
  mfaPending: boolean;
}

export const currentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (token === undefined) return null;

  const claims = await verifyAccessToken(token);
  if (claims === null || claims.sid === '') return null;
  const session = await liveSession(claims.sid);
  if (session === null) return null;

  const [row] = await database()
    .select()
    .from(tables.users)
    .where(eq(tables.users.id, claims.sub))
    .limit(1);
  if (!row || row.status !== 'active') return null;

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    locale: row.locale,
    fullName: decryptOptional(row.fullNameEnc),
    dateOfBirth: row.dateOfBirth,
    sex: row.sex,
    hasEmergencyContact: row.emergencyContactPhoneEnc !== null,
    mfaPending: session.mfaPending,
  };
});

export function profileComplete(user: CurrentUser): boolean {
  return user.dateOfBirth !== null && user.fullName !== null;
}
