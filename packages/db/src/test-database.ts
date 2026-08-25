/**
 * Keeping the test suite away from a real database.
 *
 * The tests truncate every table between cases. That is fine against a scratch database and
 * catastrophic against anything else — and the mistake is easy to make, because pointing the
 * suite at the project's configured `DATABASE_URL` is exactly what makes it "just work". It did,
 * once, and destroyed a developer's local accounts.
 *
 * So the suite never uses the configured database directly. It derives a sibling whose name ends
 * in `_test`, and every destructive helper asserts that is where it is pointed before it runs.
 */

export const TEST_DATABASE_SUFFIX = '_test';

/**
 * Turns a connection string into one naming a sibling `*_test` database.
 *
 * Already-suffixed URLs are returned unchanged, so an explicitly configured `TEST_DATABASE_URL`
 * passes through untouched.
 */
export function testDatabaseUrl(connectionString: string): string {
  const url = new URL(connectionString);
  const name = url.pathname.replace(/^\//, '');

  if (name === '') {
    throw new Error('Connection string names no database, so no test database can be derived');
  }
  if (name.endsWith(TEST_DATABASE_SUFFIX)) return connectionString;

  url.pathname = `/${name}${TEST_DATABASE_SUFFIX}`;
  return url.toString();
}

export function databaseNameOf(connectionString: string): string {
  return new URL(connectionString).pathname.replace(/^\//, '');
}

export class NotATestDatabaseError extends Error {
  constructor(name: string) {
    super(
      `Refusing to run a destructive test helper against "${name}". The test suite truncates ` +
        `every table, so it may only point at a database whose name ends in ` +
        `"${TEST_DATABASE_SUFFIX}". Set TEST_DATABASE_URL, or let the setup derive one.`,
    );
    this.name = 'NotATestDatabaseError';
  }
}

/**
 * Throws unless the connection string names a test database.
 *
 * Called by every helper that truncates or deletes. Cheap, and the one thing standing between a
 * misconfigured run and someone's data.
 */
export function assertTestDatabase(connectionString: string): void {
  const name = databaseNameOf(connectionString);
  if (!name.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new NotATestDatabaseError(name);
  }
}
