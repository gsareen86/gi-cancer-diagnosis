import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:55432/gi_compass',
  },
  // Every generated migration is reviewed before it runs — this is a clinical database and a
  // silent column drop is a data-loss event, not a schema tidy-up.
  verbose: true,
  strict: true,
});
