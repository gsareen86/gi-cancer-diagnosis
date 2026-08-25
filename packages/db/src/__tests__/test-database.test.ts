import { describe, expect, it } from 'vitest';
import {
  assertTestDatabase,
  databaseNameOf,
  NotATestDatabaseError,
  testDatabaseUrl,
} from '../test-database';

/**
 * The guard that keeps the suite off a real database.
 *
 * Worth testing carefully, because it is the thing standing between a misconfigured run and
 * someone's data — and because it has already been needed. Pointing the tests at the project's
 * configured `DATABASE_URL` made them "just work" and truncated a developer's local accounts on
 * the next run.
 */

const DEV = 'postgres://postgres:postgres@localhost:5432/gi_compass';

describe('deriving a scratch database', () => {
  it('names a sibling of the configured one', () => {
    expect(testDatabaseUrl(DEV)).toBe('postgres://postgres:postgres@localhost:5432/gi_compass_test');
  });

  it('keeps host, port, and credentials, so it reaches the same server', () => {
    const derived = new URL(testDatabaseUrl(DEV));
    expect(derived.host).toBe('localhost:5432');
    expect(derived.username).toBe('postgres');
    expect(derived.password).toBe('postgres');
  });

  it('is idempotent, so an explicitly configured test URL passes through unchanged', () => {
    const already = 'postgres://postgres@localhost:5432/something_test';
    expect(testDatabaseUrl(already)).toBe(already);
    expect(testDatabaseUrl(testDatabaseUrl(DEV))).toBe(testDatabaseUrl(DEV));
  });

  it('refuses a connection string that names no database', () => {
    expect(() => testDatabaseUrl('postgres://postgres@localhost:5432')).toThrow(/names no database/i);
  });

  it('reads the database name back out', () => {
    expect(databaseNameOf(DEV)).toBe('gi_compass');
    expect(databaseNameOf(testDatabaseUrl(DEV))).toBe('gi_compass_test');
  });
});

describe('refusing a destructive run against a real database', () => {
  it.each([
    ['the configured development database', DEV],
    ['production', 'postgres://user:pw@db.example.internal:5432/gi_compass_production'],
    ['a name that merely contains "test"', 'postgres://postgres@localhost:5432/test_fixtures'],
  ])('refuses %s', (_name, url) => {
    expect(() => assertTestDatabase(url)).toThrow(NotATestDatabaseError);
  });

  it('names the database it refused, so the message is actionable', () => {
    expect(() => assertTestDatabase(DEV)).toThrow(/gi_compass/);
  });

  it('allows a database whose name ends in _test', () => {
    expect(() => assertTestDatabase(testDatabaseUrl(DEV))).not.toThrow();
  });

  it('refuses an empty connection string rather than treating it as safe', () => {
    expect(() => assertTestDatabase('')).toThrow();
  });
});
