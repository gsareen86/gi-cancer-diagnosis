import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { tables } from '@gi-compass/db';
import { database } from '@/server/db';
import { decryptField } from '@/server/crypto';
import { verifyCode } from '@/server/auth/totp';
import {
  ACCESS_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  markMfaSatisfied,
  signAccessToken,
} from '@/server/auth/session';
import { loadProfile } from '@/server/auth/accounts';
import { jsonBody, route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';
import { isProduction } from '@/server/env';

const body = z.object({ code: z.string().min(6).max(9) });

/**
 * Completes second-factor enrolment, or satisfies the factor on a later sign-in.
 *
 * A correct code does two things: it confirms the factor if this was an enrolment, and it clears
 * `mfaPending` on the session row. The row is what the API reads on every request, so access
 * opens on the very next call rather than whenever the access token happens to expire — and a
 * fresh token is issued here so the client is not carrying a stale claim either.
 */
export const POST = route({ allowMfaPending: true }, async ({ request, session }) => {
  const { code } = await jsonBody(request, body);

  const db = database();
  const [factor] = await db
    .select()
    .from(tables.totpFactors)
    .where(eq(tables.totpFactors.userId, session.userId))
    .limit(1);

  if (!factor) return problem('invalid_request', 'auth.mfa.not_enrolled');

  let secret: string;
  try {
    secret = decryptField(factor.secretEnc);
  } catch {
    // Written under a different FIELD_ENCRYPTION_KEY, so it can never verify again.
    return problem('unavailable', 'auth.mfa.secret_unreadable');
  }

  if (!verifyCode(secret, code)) {
    return problem('unauthenticated', 'auth.mfa.invalid_code');
  }

  if (factor.confirmedAt === null) {
    await db
      .update(tables.totpFactors)
      .set({ confirmedAt: new Date() })
      .where(eq(tables.totpFactors.id, factor.id));
  }

  await markMfaSatisfied(session.sessionId);

  const profile = await loadProfile(session.userId);
  const response = ok({ status: 'verified', role: profile?.role ?? session.role });

  response.cookies.set(
    ACCESS_COOKIE,
    await signAccessToken({
      sub: session.userId,
      role: profile?.role ?? session.role,
      sid: session.sessionId,
      mfaPending: false,
    }),
    {
      httpOnly: true,
      secure: isProduction(),
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_TOKEN_TTL_SECONDS,
    },
  );

  return response;
});
