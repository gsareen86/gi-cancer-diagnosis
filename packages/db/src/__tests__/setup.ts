import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import pg from 'pg';
import { runMigrations } from '../migrate';
import { databaseNameOf, testDatabaseUrl } from '../test-database';

/**
 * Prepares an isolated database for the data-layer tests.
 *
 * These tests truncate every table between cases, so they must never touch the database a
 * developer is actually working in. The suite therefore derives a sibling `*_test` database from
 * whatever `DATABASE_URL` is configured, creates it if it does not exist, and migrates it.
 *
 * `TEST_DATABASE_URL` overrides the derivation, but the destructive helpers still assert the name
 * ends in `_test` before running.
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

/** Creates the test database if it is missing. Connects to `postgres` to do it. */
async function ensureDatabaseExists(connectionString: string): Promise<void> {
  const name = databaseNameOf(connectionString);
  const adminUrl = new URL(connectionString);
  adminUrl.pathname = '/postgres';

  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (existing.rowCount === 0) {
      // The name comes from our own derivation, never from user input.
      await client.query(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await client.end();
  }
}

loadAncestorEnvFiles(import.meta.dirname);

const configured =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/gi_compass';
const testUrl = process.env.TEST_DATABASE_URL ?? testDatabaseUrl(configured);

process.env.TEST_DATABASE_URL = testUrl;
// Anything reaching for DATABASE_URL during a test run gets the scratch database too.
process.env.DATABASE_URL = testUrl;

await ensureDatabaseExists(testUrl);
// Idempotent: the migrator checks its journal, so running it per test file is cheap.
await runMigrations(testUrl);
