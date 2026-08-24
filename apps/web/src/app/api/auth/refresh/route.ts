import {
  ACCESS_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
  rotateRefreshToken,
} from '@/server/auth/session';
import { publicRoute } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';
import { isProduction } from '@/server/env';

/**
 * Rotates the refresh token.
 *
 * Presenting a token that has already been rotated means two parties hold it, so the entire
 * session family is revoked rather than just the presented token.
 */
export const POST = publicRoute(async ({ request, metadata }) => {
  const presented = request.cookies.get(REFRESH_COOKIE)?.value;
  if (presented === undefined) return problem('unauthenticated', 'auth.refresh.missing');

  const outcome = await rotateRefreshToken(presented, metadata);

  if (outcome.status === 'replay_detected') {
    const response = problem('unauthenticated', 'auth.refresh.replay_detected');
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }
  if (outcome.status === 'unknown') {
    const response = problem('unauthenticated', 'auth.refresh.invalid');
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  const response = ok({ status: 'refreshed' });
  const secure = isProduction();
  response.cookies.set(ACCESS_COOKIE, outcome.session.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  response.cookies.set(REFRESH_COOKIE, outcome.session.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
  return response;
});
