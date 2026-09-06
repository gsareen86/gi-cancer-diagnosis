import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Pure UI/guard checks can run without PostgreSQL; the main suite keeps its real DB setup. */
export default defineConfig({
  test: { include: ['src/**/*.unit.test.ts', 'src/__tests__/no-hardcoded-strings.test.ts'] },
  resolve: { alias: { '@': fileURLToPath(new URL('./src/', import.meta.url)) } },
});
