import { ACCESS_COOKIE, REFRESH_COOKIE, revokeFamily } from '@/server/auth/session';
import { tables } from '@gi-compass/db';
import { eq } from 'drizzle-orm';
import { database } from '@/server/db';
import { route } from '@/server/api/route-handler';
import { ok } from '@/server/api/problem';

export const POST = route({ allowMfaPending: true }, async ({ session }) => {
  const [row] = await database()
    .select({ familyId: tables.sessions.familyId })
    .from(tables.sessions)
    .where(eq(tables.sessions.id, session.sessionId))
    .limit(1);
  if (row) await revokeFamily(row.familyId);

  const response = ok({ status: 'signed_out' });
  response.cookies.delete(ACCESS_COOKIE);
  // Deletion must match the path used when the refresh cookie was issued.
  response.cookies.set(REFRESH_COOKIE, '', { path: '/api/auth/refresh', maxAge: 0, httpOnly: true, sameSite: 'lax' });
  return response;
});
