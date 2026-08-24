import { NextResponse } from 'next/server';

/**
 * Error responses.
 *
 * Two rules shape these. First, a refusal to read someone else's record must be
 * indistinguishable from a resource that does not exist, or the identifier space becomes an
 * enumeration oracle. Second, nothing here leaks clinical detail: the body carries a code and a
 * catalogue key, and the interface localizes it.
 */

export type ProblemCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'consent_required'
  | 'invalid_request'
  | 'illegal_transition'
  | 'rate_limited'
  | 'conflict'
  | 'unavailable'
  | 'internal';

const STATUS: Record<ProblemCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  consent_required: 403,
  invalid_request: 400,
  illegal_transition: 409,
  rate_limited: 429,
  conflict: 409,
  unavailable: 503,
  internal: 500,
};

export interface ProblemBody {
  code: ProblemCode;
  /** i18n catalogue key. The server never sends display prose. */
  messageKey: string;
  details?: unknown;
}

export function problem(
  code: ProblemCode,
  messageKey: string,
  details?: unknown,
  headers?: Record<string, string>,
): NextResponse<ProblemBody> {
  const body: ProblemBody = details === undefined ? { code, messageKey } : { code, messageKey, details };
  return NextResponse.json(body, headers === undefined ? { status: STATUS[code] } : { status: STATUS[code], headers });
}

export function ok<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}
