import { NextResponse, type NextRequest } from 'next/server';

/**
 * Two per-request concerns that cannot be static configuration.
 *
 * **The Content Security Policy.** It has to allow the framework's own bootstrap scripts, which
 * are inline. Two ways to do that: `'unsafe-inline'`, which allows *every* inline script and makes
 * the whole directive decorative, or a fresh nonce per request, which allows exactly the scripts
 * we emitted. For an application holding clinical records the nonce is the only defensible choice
 * — a cross-site scripting hole here exposes a patient's history, not a defaced page. Next.js
 * applies the nonce to its own scripts when it finds one in this header, so nothing else has to
 * know. A static header in `next.config.mjs` cannot carry a per-request value, which is why this
 * lives here.
 *
 * **Legacy paths.** The interface moved to role-isolated workspaces, and notification emails
 * already sent point at the old ones. Redirecting here costs one array scan on a request that is
 * already being intercepted, and keeps a dozen redirect-only files out of the `app` tree.
 *
 * **The requested path.** A server component cannot read its own URL, and the workspace guard
 * needs it to send an unauthenticated visitor back to what they were reaching for after they sign
 * in. Middleware is the only place that sees both.
 */

/**
 * Old path to new. Ordered longest-prefix first, because `/cases/{id}/interview` must be tested
 * before `/cases/{id}` or it would resolve to the case view and lose the questionnaire.
 */
const LEGACY_PATHS: ReadonlyArray<{ match: RegExp; to: (id: string) => string }> = [
  { match: /^\/cases\/([^/]+)\/interview\/?$/, to: (id) => `/patient/intake/${id}` },
  { match: /^\/cases\/([^/]+)\/documents\/?$/, to: (id) => `/patient/case/${id}/documents` },
  { match: /^\/cases\/([^/]+)\/?$/, to: (id) => `/patient/case/${id}` },
  { match: /^\/cases\/?$/, to: () => '/patient/records' },
  { match: /^\/start\/?$/, to: () => '/patient/intake' },
  { match: /^\/profile\/?$/, to: () => '/patient/profile' },
  { match: /^\/consent\/?$/, to: () => '/patient/consent' },
  { match: /^\/privacy\/?$/, to: () => '/patient/privacy' },
  { match: /^\/doctor\/cases\/([^/]+)\/?$/, to: (id) => `/doctor/case/${id}` },
  { match: /^\/doctor\/queue\/?$/, to: () => '/doctor/triage' },
];

function legacyTarget(pathname: string): string | null {
  for (const entry of LEGACY_PATHS) {
    const found = entry.match.exec(pathname);
    if (found !== null) return entry.to(found[1] ?? '');
  }
  return null;
}

export function middleware(request: NextRequest) {
  const target = legacyTarget(request.nextUrl.pathname);
  if (target !== null) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    // 307, not 308: these paths are being retired rather than permanently reassigned, and a
    // permanent redirect cached in a browser is unpickable if this ever needs revisiting.
    return NextResponse.redirect(url, 307);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Tailwind emits inline styles; styles cannot execute, so this is a far smaller surface.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    request.nextUrl.pathname.startsWith('/api/cases/') && request.nextUrl.searchParams.has('content') ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
    "frame-src 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    'upgrade-insecure-requests',
  ].join('; ');

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  // Next uses the request CSP to nonce its inline bootstrap scripts as well.
  headers.set('Content-Security-Policy', policy);
  // Read by `requireWorkspace` to build `/login?next=…`. Path and query only — never the origin,
  // so nothing downstream can be tricked into treating it as an absolute redirect target.
  headers.set('x-pathname', `${request.nextUrl.pathname}${request.nextUrl.search}`);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  if (request.nextUrl.pathname.startsWith('/patient') || request.nextUrl.pathname.startsWith('/doctor')) {
    response.headers.set('Cache-Control', 'private, no-store');
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and the favicon, which carry no script and no patient data.
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
