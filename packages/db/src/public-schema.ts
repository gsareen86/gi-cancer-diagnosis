/**
 * The schema surface application code may touch directly.
 *
 * Identity, consent, content, and notification tables are exported: they carry no clinical
 * findings, and the app must be able to register a user, record a consent grant, or publish a
 * question without a clinical access context.
 *
 * The clinical tables — cases, responses, uploaded documents, red-flag triggers, AI assessments,
 * doctor reviews, review diffs, case messages — are deliberately NOT exported. They are
 * reachable only through `ClinicalRepository`, which requires an `AccessContext`, applies the
 * consent gate, and writes the audit entry in the same transaction. Making them unimportable is
 * a stronger guarantee than a lint rule, because it fails at compile time in every editor.
 */

export {
  users,
  externalIdentities,
  sessions,
  oneTimeTokens,
  totpFactors,
  loginAttempts,
  adminElevations,
} from './schema/identity';

export {
  consentPolicyVersions,
  consentRecords,
  dataSubjectRequests,
  profileAmendments,
  retentionPolicies,
  auditLogEntries,
} from './schema/privacy';

export {
  questionnaireTemplates,
  templateVersions,
  redFlagRuleSets,
  referenceImages,
  diseaseTaxonomyEntries,
  contentAuditEntries,
} from './schema/content';

export { knowledgeBaseEntries, knowledgeBaseEntryTags, knowledgeBaseChunks, knowledgeBaseSnapshots } from './schema/clinical';

export { notificationDeliveries } from './schema/notifications';

export {
  roleEnum,
  accountStatusEnum,
  tokenPurposeEnum,
  consentPurposeEnum,
  dsrTypeEnum,
  dsrStatusEnum,
  contentStatusEnum,
  caseStatusEnum,
  scanStatusEnum,
  assessmentOutcomeEnum,
  reviewStatusEnum,
  diffActionEnum,
  urgencyEnum,
  notificationTypeEnum,
  deliveryOutcomeEnum,
} from './schema/enums';
