import { NextResponse, type NextRequest } from 'next/server';

/**
 * Per-request Content Security Policy.
 *
 * The policy has to allow the framework's own bootstrap scripts, which are inline. Two ways to
 * do that: `'unsafe-inline'`, which allows *every* inline script and makes the whole directive
 * decorative, or a fresh nonce per request, which allows exactly the scripts we emitted.
 *
 * For an application holding clinical records the nonce is the only defensible choice — a
 * cross-site scripting hole here exposes a patient's history, not a defaced page. Next.js applies
 * the nonce to its own scripts when it finds one in this header, so nothing else has to know.
 *
 * This is also why the policy is set here rather than in `next.config.mjs`: a static header cannot
 * carry a per-request value.
 */
export function middleware(request: NextRequest) {
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
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    'upgrade-insecure-requests',
  ].join('; ');

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
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
