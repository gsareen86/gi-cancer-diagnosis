import { createDatabase, createPool, ClinicalRepository, type Database } from '@gi-compass/db';
import { env } from './env';

/**
 * One pool per process. Next.js reloads modules in development, so the pool is cached on
 * globalThis rather than recreated on every hot reload — a leaked pool per edit exhausts the
 * database's connection slots within minutes.
 */

declare global {
  // eslint-disable-next-line no-var
  var __giCompassDb: { db: Database; repo: ClinicalRepository } | undefined;
}

function build(): { db: Database; repo: ClinicalRepository } {
  const pool = createPool({
    connectionString: env().DATABASE_URL,
    maxConnections: 10,
  });
  const db = createDatabase(pool);
  return { db, repo: new ClinicalRepository(db) };
}

export function database(): Database {
  globalThis.__giCompassDb ??= build();
  return globalThis.__giCompassDb.db;
}

/**
 * The audited, consent-gated repository. Route handlers use this; nothing in `src/app` may
 * import `database()` for patient clinical data.
 */
export function clinical(): ClinicalRepository {
  globalThis.__giCompassDb ??= build();
  return globalThis.__giCompassDb.repo;
}
