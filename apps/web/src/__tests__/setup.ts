import pg from 'pg';
import { databaseNameOf, runMigrations, testDatabaseUrl } from '@gi-compass/db';
import { loadAncestorEnvFiles } from '../../load-root-env.mjs';

/**
 * Test environment.
 *
 * The repository's own `.env` is loaded so the suite runs against the configured PostgreSQL
 * server rather than a hardcoded guess — but never against the configured *database*. These tests
 * truncate every table between cases, so they use a derived `*_test` sibling, created and
 * migrated here if it does not exist.
 *
 * That distinction is not theoretical: pointing the suite at `DATABASE_URL` made it "just work"
 * and wiped a developer's local accounts on the next run.
 */
loadAncestorEnvFiles(import.meta.dirname);

const configured =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/gi_compass';
const testUrl = process.env.TEST_DATABASE_URL ?? testDatabaseUrl(configured);

process.env.DATABASE_URL = testUrl;
process.env.TEST_DATABASE_URL = testUrl;
process.env.SESSION_SECRET ??= 'test-session-secret-value-at-least-32-chars';
process.env.FIELD_ENCRYPTION_KEY ??= 'test-field-encryption-key-at-least-32-chars';
(process.env as Record<string, string>).NODE_ENV ??= 'test';
process.env.APP_BASE_URL ??= 'http://localhost:3000';
// Never reach a real mail server from a test run.
process.env.SMTP_URL = '';

/** Creates the scratch database if it is missing, connecting to `postgres` to do it. */
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

await ensureDatabaseExists(testUrl);
// Idempotent: the migrator checks its journal, so running it per test file is cheap.
await runMigrations(testUrl);
