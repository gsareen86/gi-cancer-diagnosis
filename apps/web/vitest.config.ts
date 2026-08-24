import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/__tests__/setup.ts'],
    // The API tests drive real route handlers against one shared PostgreSQL and truncate
    // between cases, so parallel files would clear each other's fixtures.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
  resolve: {
    // `fileURLToPath`, not `URL.pathname`: on Windows the latter yields `/C:/AI%20Projects/...`
    // — a leading slash and percent-encoded spaces — so every `@/` import failed to resolve and
    // the whole suite errored out before running a single test. It looked fine on Linux CI.
    alias: { '@': fileURLToPath(new URL('./src/', import.meta.url)) },
  },
});
