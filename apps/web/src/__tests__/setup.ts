import { loadAncestorEnvFiles } from '../../load-root-env.mjs';

/**
 * Test environment.
 *
 * The repository's own `.env` is loaded first, so the suite runs against whatever database the
 * developer already configured rather than a hardcoded guess. Without this the tests reached for
 * a port that only existed on the machine they were written on, and every API test failed with a
 * connection refusal that said nothing about the real cause.
 *
 * The fallbacks below are only for a checkout with no `.env` at all — a CI job, for instance,
 * which supplies its own environment.
 */
loadAncestorEnvFiles(import.meta.dirname);

process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/gi_compass';
process.env.TEST_DATABASE_URL ??= process.env.DATABASE_URL;
process.env.SESSION_SECRET ??= 'test-session-secret-value-at-least-32-chars';
process.env.FIELD_ENCRYPTION_KEY ??= 'test-field-encryption-key-at-least-32-chars';
(process.env as Record<string, string>).NODE_ENV ??= 'test';
process.env.APP_BASE_URL ??= 'http://localhost:3000';
