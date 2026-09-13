import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  assessmentOutcomeEnum,
  caseStatusEnum,
  diffActionEnum,
  reviewStatusEnum,
  scanStatusEnum,
  urgencyEnum,
} from './enums';
import { users } from './identity';
import { redFlagRuleSets, templateVersions } from './content';

/** pgvector column. Stored as the extension's `vector` type; read and written as a float array. */
export const vector = (name: string, dimensions: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType: () => `vector(${dimensions})`,
    toDriver: (value) => `[${value.join(',')}]`,
    fromDriver: (value) => JSON.parse(value) as number[],
  })(name);

export const EMBEDDING_DIMENSIONS = 1024;

/* ------------------------------------------------------------------------------------------ */
/* Knowledge base                                                                              */
/* ------------------------------------------------------------------------------------------ */

/**
 * Doctor-authored clinical guidance. Editing creates a new version and supersedes the previous
 * one rather than overwriting it, so a past assessment's grounding stays reconstructable.
 * This table never holds patient data.
 */
export const knowledgeBaseEntries = pgTable(
  'knowledge_base_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryKey: text('entry_key').notNull(),
    version: integer('version').notNull().default(1),
    title: text('title').notNull(),
    content: text('content').notNull(),
    source: text('source'),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('kb_entries_key_version_key').on(table.entryKey, table.version),
    index('kb_entries_superseded_idx').on(table.supersededAt),
  ],
);

export const knowledgeBaseEntryTags = pgTable(
  'knowledge_base_entry_tags',
  {
    entryId: uuid('entry_id')
      .notNull()
      .references(() => knowledgeBaseEntries.id, { onDelete: 'cascade' }),
    taxonomyId: text('taxonomy_id').notNull(),
  },
  (table) => [uniqueIndex('kb_entry_tags_pk').on(table.entryId, table.taxonomyId)],
);

/** Regenerated whenever an entry version changes, so retrieval never matches stale content. */
export const knowledgeBaseChunks = pgTable(
  'knowledge_base_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => knowledgeBaseEntries.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    text: text('text').notNull(),
    clusters: text('clusters').array().notNull().default([]),
    embedding: vector('embedding', EMBEDDING_DIMENSIONS),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('kb_chunks_entry_ordinal_key').on(table.entryId, table.ordinal)],
);

/** Monotonic marker so an assessment can name exactly which state of the KB grounded it. */
export const knowledgeBaseSnapshots = pgTable(
  'knowledge_base_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    version: text('version').notNull(),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('kb_snapshots_version_key').on(table.version)],
);

/* ------------------------------------------------------------------------------------------ */
/* Cases                                                                                       */
/* ------------------------------------------------------------------------------------------ */

export const cases = pgTable(
  'cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicNumber: integer('public_number').generatedAlwaysAsIdentity({ startWith: 100001 }).notNull(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assignedDoctorId: uuid('assigned_doctor_id').references(() => users.id),
    templateVersionId: uuid('template_version_id')
      .notNull()
      .references(() => templateVersions.id),
    entryPointId: text('entry_point_id').notNull(),
    status: caseStatusEnum('status').notNull().default('in_progress'),
    /** Why the AI step was skipped, when it was. Shown to the reviewing doctor verbatim. */
    aiSkipReason: text('ai_skip_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (table) => [
    index('cases_patient_status_idx').on(table.patientId, table.status),
    uniqueIndex('cases_public_number_key').on(table.publicNumber),
    index('cases_doctor_status_idx').on(table.assignedDoctorId, table.status),
    index('cases_status_submitted_idx').on(table.status, table.submittedAt),
  ],
);

/** Assignment history. Ending an assignment ends access immediately, not at session expiry. */
export const caseAssignments = pgTable(
  'case_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => users.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    assignedBy: uuid('assigned_by').notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    index('case_assignments_case_idx').on(table.caseId, table.endedAt),
    index('case_assignments_doctor_idx').on(table.doctorId, table.endedAt),
  ],
);

/**
 * A retracted answer is marked inactive, never deleted — the path that produced the assessment
 * must stay reconstructable.
 */
export const responses = pgTable(
  'responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    questionId: text('question_id').notNull(),
    value: jsonb('value').notNull(),
    active: boolean('active').notNull().default(true),
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull().defaultNow(),
    retractedAt: timestamp('retracted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('responses_case_question_key').on(table.caseId, table.questionId),
    index('responses_case_active_idx').on(table.caseId, table.active),
  ],
);

/** A post-submission correction. The original stays readable; the assessment came from it. */
export const responseAmendments = pgTable(
  'response_amendments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    responseId: uuid('response_id')
      .notNull()
      .references(() => responses.id, { onDelete: 'cascade' }),
    newValue: jsonb('new_value').notNull(),
    reason: text('reason'),
    amendedAt: timestamp('amended_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('response_amendments_response_idx').on(table.responseId)],
);

export const uploadedDocuments = pgTable(
  'uploaded_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    originalFilename: text('original_filename').notNull(),
    contentType: text('content_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    /** Reference into encrypted object storage. Never a public URL. */
    storageKey: text('storage_key').notNull(),
    scanStatus: scanStatusEnum('scan_status').notNull().default('pending'),
    /** Patient-supplied classification, retained even when extraction fails. */
    patientTypeTag: text('patient_type_tag'),
    patientDateTag: date('patient_date_tag'),
    machineReadable: boolean('machine_readable'),
    /** AI-generated and unverified until a clinician confirms it. */
    extract: jsonb('extract'),
    extractVerifiedBy: uuid('extract_verified_by'),
    extractVerifiedAt: timestamp('extract_verified_at', { withTimezone: true }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('uploaded_documents_case_idx').on(table.caseId, table.deletedAt)],
);

/** Recorded with the rule-set version that produced it, so the decision is reconstructable. */
export const redFlagTriggers = pgTable(
  'red_flag_triggers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    ruleSetId: uuid('rule_set_id')
      .notNull()
      .references(() => redFlagRuleSets.id),
    ruleId: text('rule_id').notNull(),
    urgency: urgencyEnum('urgency').notNull(),
    basisKey: text('basis_key').notNull(),
    contributingQuestionIds: text('contributing_question_ids').array().notNull().default([]),
    triggeredAt: timestamp('triggered_at', { withTimezone: true }).notNull().defaultNow(),
    /** Recorded when the patient acknowledged the escalation and chose to continue. */
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('red_flag_triggers_case_rule_key').on(table.caseId, table.ruleId),
    index('red_flag_triggers_case_urgency_idx').on(table.caseId, table.urgency),
  ],
);

/* ------------------------------------------------------------------------------------------ */
/* Assessment and review                                                                       */
/* ------------------------------------------------------------------------------------------ */

/**
 * Stored exactly as the model produced it, after validation. Never edited — the doctor's
 * overrides live on `doctorReviews`, so the original stays auditable.
 */
export const aiAssessments = pgTable(
  'ai_assessments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    outcome: assessmentOutcomeEnum('outcome').notNull(),
    modelVersion: text('model_version').notNull(),
    promptVersion: text('prompt_version').notNull(),
    kbVersion: text('kb_version').notNull(),
    retrievedChunkIds: text('retrieved_chunk_ids').array().notNull().default([]),
    payload: jsonb('payload'),
    /** Why generation failed: retry exhaustion, consent withdrawn, provider unavailable. */
    failureReason: text('failure_reason'),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('ai_assessments_case_idx').on(table.caseId, table.generatedAt)],
);

export const doctorReviews = pgTable(
  'doctor_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    aiAssessmentId: uuid('ai_assessment_id').references(() => aiAssessments.id),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => users.id),
    status: reviewStatusEnum('status').notNull().default('pending'),
    /** The only artefact permitted to state a clinical conclusion. Doctor-authored. */
    finalSummary: jsonb('final_summary'),
    doctorNotes: text('doctor_notes'),
    draftRevision: integer('draft_revision').notNull().default(0),
    /** Exactly what the patient sees. Frozen at release. */
    releasedContent: jsonb('released_content'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    releasedBy: uuid('released_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('doctor_reviews_doctor_status_idx').on(table.doctorId, table.status),
    index('doctor_reviews_case_idx').on(table.caseId),
  ],
);

/**
 * Every doctor override of an AI-generated item, so systematic model error becomes visible in
 * review. Available for human curation of the knowledge base; never submitted for automated
 * model training.
 */
export const reviewDiffs = pgTable(
  'review_diffs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reviewId: uuid('review_id')
      .notNull()
      .references(() => doctorReviews.id, { onDelete: 'cascade' }),
    action: diffActionEnum('action').notNull(),
    conditionId: text('condition_id'),
    beforeValue: jsonb('before_value'),
    afterValue: jsonb('after_value'),
    rationale: text('rationale'),
    modelVersion: text('model_version').notNull(),
    promptVersion: text('prompt_version').notNull(),
    kbVersion: text('kb_version').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('review_diffs_review_idx').on(table.reviewId),
    index('review_diffs_condition_idx').on(table.conditionId),
  ],
);

export const caseMessages = pgTable(
  'case_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (table) => [index('case_messages_case_idx').on(table.caseId, table.sentAt)],
);

export type CaseRow = typeof cases.$inferSelect;
export type ResponseRow = typeof responses.$inferSelect;
export type UploadedDocumentRow = typeof uploadedDocuments.$inferSelect;
export type RedFlagTriggerRow = typeof redFlagTriggers.$inferSelect;
export type AiAssessmentRow = typeof aiAssessments.$inferSelect;
export type DoctorReviewRow = typeof doctorReviews.$inferSelect;
