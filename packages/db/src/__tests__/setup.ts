import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

/**
 * Loads the repository's `.env` before the data-layer tests run.
 *
 * These tests talk to a real PostgreSQL, so they need the same connection string the rest of the
 * project uses. Reading it from `.env` rather than hardcoding one keeps a fresh checkout working
 * without anyone having to discover which port the tests happen to assume.
 *
 * `process.loadEnvFile` never overwrites a variable that is already set, so a CI job supplying
 * `TEST_DATABASE_URL` in the real environment still wins.
 */
function loadAncestorEnvFiles(startDir: string): void {
  const { root } = parse(startDir);
  let current = startDir;

  for (;;) {
    const candidate = join(current, '.env');
    if (existsSync(candidate)) {
      try {
        process.loadEnvFile(candidate);
      } catch {
        // A malformed .env should not take the suite down; the connection error that follows
        // will be clear enough.
      }
    }
    if (current === root) break;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

loadAncestorEnvFiles(import.meta.dirname);
