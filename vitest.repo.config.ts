import { defineConfig } from 'vitest/config';

/**
 * Repository-wide checks that belong to no single workspace — see `tools/repo-hygiene.test.ts`.
 */
export default defineConfig({
  test: { include: ['tools/**/*.test.ts'] },
});
