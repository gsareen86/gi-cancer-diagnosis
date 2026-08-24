'use client';

/**
 * Talking to the API from the browser.
 *
 * Two things every caller needs and should not have to remember. Errors come back as a code plus
 * a catalogue key, so this returns them structured rather than throwing a string nobody can
 * localize. And a 401 mid-session usually means the access token aged out, so one silent refresh
 * is attempted before giving up — a patient part-way through an interview should not be thrown
 * back to a sign-in page because fifteen minutes passed.
 */

export interface ApiProblem {
  code: string;
  messageKey: string;
  details?: unknown;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; problem: ApiProblem };

const NETWORK_PROBLEM: ApiProblem = { code: 'network', messageKey: 'error.network' };

async function parse<T>(response: Response): Promise<ApiResult<T>> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (response.ok) return { ok: true, data: body as T };

  const problem = body as Partial<ApiProblem> | undefined;
  return {
    ok: false,
    problem: {
      code: problem?.code ?? 'internal',
      messageKey: problem?.messageKey ?? 'error.generic',
      ...(problem?.details === undefined ? {} : { details: problem.details }),
    },
  };
}

async function send<T>(
  path: string,
  init: RequestInit,
  allowRefresh = true,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, credentials: 'same-origin' });
  } catch {
    return { ok: false, problem: NETWORK_PROBLEM };
  }

  if (response.status === 401 && allowRefresh) {
    const refreshed = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
    }).catch(() => null);
    if (refreshed?.ok === true) return send<T>(path, init, false);
  }

  return parse<T>(response);
}

export const api = {
  get: <T>(path: string) => send<T>(path, { method: 'GET' }),

  post: <T>(path: string, body?: unknown) =>
    send<T>(path, {
      method: 'POST',
      ...(body === undefined
        ? {}
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    }),

  put: <T>(path: string, body: unknown) =>
    send<T>(path, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),

  patch: <T>(path: string, body: unknown) =>
    send<T>(path, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),

  del: <T>(path: string, body?: unknown) =>
    send<T>(path, {
      method: 'DELETE',
      ...(body === undefined
        ? {}
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    }),

  upload: <T>(path: string, form: FormData) => send<T>(path, { method: 'POST', body: form }),
};

/**
 * Resolves a problem to a catalogue key. The server sends either a namespaced key it chose, or a
 * generic one; either way the interface localizes it rather than printing server prose.
 */
export function problemKey(problem: ApiProblem): string {
  return problem.messageKey;
}
