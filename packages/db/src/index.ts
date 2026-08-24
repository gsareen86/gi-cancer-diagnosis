/**
 * @gi-compass/db — schema, migrations, and the audited, consent-gated data-access layer.
 *
 * Application code imports `ClinicalRepository` and the access types from here. Importing the
 * raw client or the schema tables outside this package is a lint error: a raw query in a route
 * handler is exactly the hole that makes consent gating and audit logging optional.
 */

export { ClinicalRepository, CASE_TRANSITIONS, canTransition } from './repositories/clinical-repository';
export type { CaseStatus, ClinicalRepositoryOptions } from './repositories/clinical-repository';

export type { AccessContext, AccessDescriptor, ActorRole } from './access/context';
export { systemContext } from './access/context';

export {
  assertConsent,
  currentPolicyVersion,
  hasConsentFor,
  loadConsentRecords,
} from './access/consent';

export {
  authorizeAuditRead,
  authorizeCaseAccess,
  authorizeRoleGrant,
  loadCaseIdentity,
} from './access/authorize';

export {
  assertNonClinicalMetadata,
  ClinicalMetadataInAuditError,
  databaseAuditWriter,
} from './access/audit';
export type { AuditOutcome, AuditWriter } from './access/audit';

export {
  AuditWriteError,
  AuthorizationError,
  ConsentGateError,
  IllegalTransitionError,
} from './errors';

/**
 * The tables application code may query directly. Clinical tables are absent on purpose — see
 * `public-schema.ts`.
 */
export * as tables from './public-schema';

export { createDatabase, createPool } from './client';
export type { Database, DatabaseConfig } from './client';
export { runMigrations } from './migrate';
