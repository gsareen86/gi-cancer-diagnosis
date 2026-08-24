import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AuditWriteError,
  AuthorizationError,
  ConsentGateError,
  IllegalTransitionError,
  tables,
} from '@gi-compass/db';
import type { ConsentPurpose } from '@gi-compass/core';
import { database } from '../db';
import { ACCESS_COOKIE, isSessionLive, verifyAccessToken, type SessionRole } from '../auth/session';
import { problem, type ProblemBody } from './problem';
import { requestMetadata, type RequestMetadata } from './request-context';

/**
 * The API middleware chain: authenticate → authorize → (consent-gate → audit, inside the
 * repository).
 *
 * Composed here rather than left to each handler. A route declares the roles it serves and, when
 * it touches clinical data, the purpose it processes for; the chain refuses everything else.
 * Hiding an action in the interface is not an access control, so this runs regardless of which
 * client called.
 */

export interface Session {
  userId: string;
  role: SessionRole;
  sessionId: string;
  mfaPending: boolean;
}

export interface HandlerContext<Params = Record<string, string>> {
  request: NextRequest;
  params: Params;
  metadata: RequestMetadata;
}

export interface AuthenticatedContext<Params = Record<string, string>>
  extends HandlerContext<Params> {
  session: Session;
}

export interface RouteOptions {
  /** Roles permitted to call this route. Omit for a public route. */
  roles?: readonly SessionRole[];
  /**
   * Whether a session with an outstanding second factor may proceed. Only the MFA enrolment and
   * verification routes set this.
   */
  allowMfaPending?: boolean;
}

export type Handler<Params, Result> = (
  context: AuthenticatedContext<Params>,
) => Promise<NextResponse<Result | ProblemBody>>;

export type PublicHandler<Params, Result> = (
  context: HandlerContext<Params>,
) => Promise<NextResponse<Result | ProblemBody>>;

async function readSession(request: NextRequest): Promise<Session | null> {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (token === undefined) return null;
  const claims = await verifyAccessToken(token);
  if (claims === null) return null;

  // A signed token is not enough: the session row is the authority, so revoking a session ends
  // access immediately rather than whenever the access token happens to expire.
  if (claims.sid === '' || !(await isSessionLive(claims.sid))) return null;

  const [user] = await database()
    .select({ role: tables.users.role, status: tables.users.status })
    .from(tables.users)
    .where(eq(tables.users.id, claims.sub))
    .limit(1);
  if (!user || user.status !== 'active') return null;

  return {
    userId: claims.sub,
    // The role comes from the database, not the token: a role revoked mid-session takes effect
    // on the next request.
    role: user.role,
    sessionId: claims.sid,
    mfaPending: claims.mfaPending,
  };
}

function translateError(error: unknown): NextResponse<ProblemBody> {
  if (error instanceof AuthorizationError) {
    return error.notFound
      ? problem('not_found', 'error.not_found')
      : problem('forbidden', 'error.forbidden');
  }
  if (error instanceof ConsentGateError) {
    return problem('consent_required', 'error.consent_required', {
      purpose: error.purpose,
      reason: error.reason,
    });
  }
  if (error instanceof IllegalTransitionError) {
    return problem('illegal_transition', 'error.illegal_transition');
  }
  if (error instanceof AuditWriteError) {
    // The clinical write was rolled back, so the caller may safely retry.
    return problem('unavailable', 'error.audit_unavailable');
  }
  if (error instanceof z.ZodError) {
    return problem('invalid_request', 'error.invalid_request', {
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  // Never surface an unexpected error's message: it may quote clinical data.
  console.error('[api] unhandled error', error);
  return problem('internal', 'error.internal');
}

/** Wraps a route that requires a session. */
export function route<Params = Record<string, string>, Result = unknown>(
  options: RouteOptions,
  handler: Handler<Params, Result>,
) {
  return async (
    request: NextRequest,
    segment: { params: Promise<Params> },
  ): Promise<NextResponse<Result | ProblemBody>> => {
    try {
      const session = await readSession(request);
      if (session === null) return problem('unauthenticated', 'error.unauthenticated');

      if (session.mfaPending && options.allowMfaPending !== true) {
        // An enrolment-scoped session must reach the MFA endpoints and nothing else — in
        // particular no patient clinical data.
        return problem('forbidden', 'error.mfa_required');
      }

      if (options.roles !== undefined && !options.roles.includes(session.role)) {
        return problem('forbidden', 'error.forbidden');
      }

      return await handler({
        request,
        params: await segment.params,
        metadata: requestMetadata(request),
        session,
      });
    } catch (error) {
      return translateError(error);
    }
  };
}

/** Wraps a route that must work without a session: registration, login, verification. */
export function publicRoute<Params = Record<string, string>, Result = unknown>(
  handler: PublicHandler<Params, Result>,
) {
  return async (
    request: NextRequest,
    segment: { params: Promise<Params> },
  ): Promise<NextResponse<Result | ProblemBody>> => {
    try {
      return await handler({
        request,
        params: await segment.params,
        metadata: requestMetadata(request),
      });
    } catch (error) {
      return translateError(error);
    }
  };
}

/** Parses and validates a JSON body, or throws a ZodError the chain turns into a 400. */
export async function jsonBody<T extends z.ZodTypeAny>(
  request: NextRequest,
  parser: T,
): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new z.ZodError([
      { code: 'custom', path: [], message: 'Request body is not valid JSON' },
    ]);
  }
  return parser.parse(raw);
}

/**
 * Builds the AccessContext the repository requires. Passing the purpose explicitly at every
 * call site is deliberate: consent is per purpose, so a handler that has not decided why it is
 * processing this data has not finished thinking.
 */
export function accessContext(
  session: Session,
  subjectId: string,
  purpose: ConsentPurpose,
  metadata: RequestMetadata,
  elevationId?: string,
) {
  return {
    actor: { id: session.userId, role: session.role },
    subjectId,
    purpose,
    request: { ipHash: metadata.ipHash ?? undefined, userAgent: metadata.userAgent ?? undefined },
    ...(elevationId === undefined ? {} : { elevationId }),
  };
}
