import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase, createPool } from './client';

/**
 * Applies the schema. Run against a database whose owner can create extensions — the
 * application role deliberately cannot.
 */
export async function runMigrations(connectionString: string): Promise<void> {
  const pool = createPool({ connectionString, maxConnections: 1 });
  const db = createDatabase(pool);
  try {
    // pgvector must exist before the first migration creates a `vector` column. This is the one
    // statement that cannot live in a migration file, because migration 0000 depends on it.
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    await migrate(db, {
      migrationsFolder: join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations'),
    });
  } finally {
    await pool.end();
  }
}

const isDirectInvocation = process.argv[1]?.endsWith('migrate.ts') === true;
if (isDirectInvocation) {
  const connectionString = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (connectionString === undefined) {
    console.error('Neither MIGRATION_DATABASE_URL nor DATABASE_URL is set');
    process.exit(1);
  }
  runMigrations(connectionString)
    .then(() => console.log('migrations applied'))
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
