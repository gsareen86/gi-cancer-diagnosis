import { z } from 'zod';
import { checkCredentials } from '@/server/auth/accounts';
import { createSession, ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_TOKEN_TTL_SECONDS, ACCESS_TOKEN_TTL_SECONDS } from '@/server/auth/session';
import { jsonBody, publicRoute } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';
import { isProduction } from '@/server/env';

const body = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(256),
});

export const POST = publicRoute(async ({ request, metadata }) => {
  const input = await jsonBody(request, body);
  const outcome = await checkCredentials(input.email, input.password, metadata.ipHash);

  if (outcome.status === 'rate_limited') {
    return problem('rate_limited', 'auth.login.rate_limited', undefined, {
      'Retry-After': String(outcome.retryAfterSeconds),
    });
  }
  if (outcome.status === 'invalid') {
    // One message for a wrong password and for an address with no account.
    return problem('unauthenticated', 'auth.login.invalid_credentials');
  }
  if (outcome.status === 'unverified') {
    return problem('forbidden', 'auth.login.unverified');
  }
  if (outcome.status === 'suspended') {
    return problem('forbidden', 'auth.login.suspended');
  }

  // A doctor or admin without a confirmed second factor gets an enrolment-scoped session: it
  // reaches the MFA endpoints and nothing else, and in particular no patient clinical data.
  const mfaPending = outcome.mfaRequired;

  const session = await createSession({
    userId: outcome.userId,
    role: outcome.role,
    mfaPending,
    ipHash: metadata.ipHash,
    userAgent: metadata.userAgent,
  });

  const response = ok({
    role: outcome.role,
    mfaPending,
    mfaEnrolled: outcome.mfaEnrolled,
  });

  const secure = isProduction();
  response.cookies.set(ACCESS_COOKIE, session.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  response.cookies.set(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    // Scoped to the refresh endpoint so it is not sent with every ordinary request.
    path: '/api/auth/refresh',
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
  return response;
});
