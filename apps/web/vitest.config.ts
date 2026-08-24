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
  resolve: { alias: { '@': new URL('./src/', import.meta.url).pathname } },
});
