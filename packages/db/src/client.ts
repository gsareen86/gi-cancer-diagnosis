import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

/**
 * The database client.
 *
 * Importing this outside `packages/db` is a lint error: every read and write of patient
 * clinical data must go through `ClinicalRepository`, which requires an `AccessContext` and
 * writes the audit entry in the same transaction. A raw client in a route handler is exactly
 * the hole that makes consent gating and audit logging optional.
 */

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseConfig {
  connectionString: string;
  /** Keep this small: the app is not the bottleneck, and a runaway pool starves the migrator. */
  maxConnections?: number;
  ssl?: boolean;
}

export function createPool(config: DatabaseConfig): pg.Pool {
  return new pg.Pool({
    connectionString: config.connectionString,
    max: config.maxConnections ?? 10,
    ...(config.ssl === true ? { ssl: { rejectUnauthorized: true } } : {}),
  });
}

export function createDatabase(pool: pg.Pool): Database {
  return drizzle(pool, { schema });
}

export { schema };
export type { pg };
