import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The domain core and data layer are plain TypeScript workspaces, not prebuilt packages.
  transpilePackages: ['@gi-compass/core', '@gi-compass/db'],
  serverExternalPackages: ['@node-rs/argon2', 'pg'],
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Patient health data: nothing about a case should reach an embedding page, a
          // referrer log, or a third-party script.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // The Content-Security-Policy is set per request in src/middleware.ts, because it
          // carries a fresh nonce for the framework's inline bootstrap scripts. A static header
          // here could only use 'unsafe-inline', which would make the directive decorative.
        ],
      },
      {
        // A signed document URL must never be cached by a shared proxy.
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
