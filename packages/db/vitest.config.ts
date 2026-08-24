import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // These tests exercise real database guarantees against one shared PostgreSQL and each
    // truncates between cases, so running files in parallel would have them clear each other's
    // fixtures. Correctness here is worth more than the second these tests save.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
