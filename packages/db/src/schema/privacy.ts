import {
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
import { consentPurposeEnum, dsrStatusEnum, dsrTypeEnum } from './enums';
import { users } from './identity';

/**
 * The privacy policy document a consent was given against. A grant made under a superseded
 * version does not carry forward — the patient consented to what that version said.
 *
 * TODO(confirm): Decision G — which legal entity is the Data Fiduciary under the DPDP Act.
 * `dataFiduciaryName` and `grievanceContact` are placeholders until counsel settles it.
 */
export const consentPolicyVersions = pgTable(
  'consent_policy_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    version: text('version').notNull(),
    /** Full policy text per locale, so the exact wording a patient saw is recoverable. */
    bodyByLocale: jsonb('body_by_locale').notNull(),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    dataFiduciaryName: text('data_fiduciary_name').notNull(),
    grievanceContact: text('grievance_contact').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('consent_policy_versions_version_key').on(table.version)],
);

/**
 * Immutable. Withdrawal stamps `withdrawnAt`; re-granting writes a new row. Nothing here is
 * ever updated in place except that single stamp, so a withdraw-and-regrant cycle leaves all
 * three facts independently readable.
 */
export const consentRecords = pgTable(
  'consent_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: consentPurposeEnum('purpose').notNull(),
    policyVersion: text('policy_version').notNull(),
    policyId: uuid('policy_id')
      .notNull()
      .references(() => consentPolicyVersions.id),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
  },
  (table) => [index('consent_records_user_purpose_idx').on(table.userId, table.purpose)],
);

export const dataSubjectRequests = pgTable(
  'data_subject_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: dsrTypeEnum('type').notNull(),
    status: dsrStatusEnum('status').notNull().default('received'),
    detail: text('detail'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    dueBy: timestamp('due_by', { withTimezone: true }).notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
    /** What was retained and why, when erasure could not remove everything. */
    retentionNote: text('retention_note'),
  },
  (table) => [index('dsr_user_status_idx').on(table.userId, table.status)],
);

/** A correction never rewrites history: the original stays readable beside the amendment. */
export const profileAmendments = pgTable(
  'profile_amendments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    field: text('field').notNull(),
    previousValue: text('previous_value').notNull(),
    newValue: text('new_value').notNull(),
    amendedAt: timestamp('amended_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('profile_amendments_user_idx').on(table.userId)],
);

/**
 * Retention periods are configuration, not code constants, so counsel can set them without a
 * deploy. A category whose `retentionDays` is null makes the retention job alert rather than
 * delete — the safe direction when nobody has decided yet.
 *
 * TODO(confirm): Decision F — the actual periods per category.
 */
export const retentionPolicies = pgTable(
  'retention_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    category: text('category').notNull(),
    retentionDays: integer('retention_days'),
    action: text('action').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid('updated_by'),
  },
  (table) => [uniqueIndex('retention_policies_category_key').on(table.category)],
);

/**
 * Append-only. The application database role holds INSERT and SELECT here and nothing else, so
 * an application bug cannot rewrite the trail. Entries name what was accessed and never copy the
 * clinical content itself — otherwise the audit store becomes a second uncontrolled copy of
 * patient health data.
 *
 * `subjectId` survives the erasure of the subject's clinical data, so "who accessed this
 * person's record" stays answerable afterwards.
 */
export const auditLogEntries = pgTable(
  'audit_log_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id'),
    actorRole: text('actor_role'),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    subjectId: uuid('subject_id'),
    outcome: text('outcome').notNull().default('allowed'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    /** Non-clinical context only: rule ids, model versions, denial reasons. Never answer values. */
    metadata: jsonb('metadata'),
  },
  (table) => [
    index('audit_actor_time_idx').on(table.actorId, table.occurredAt),
    index('audit_subject_time_idx').on(table.subjectId, table.occurredAt),
    index('audit_target_idx').on(table.targetType, table.targetId),
  ],
);

export type NewAuditLogEntry = typeof auditLogEntries.$inferInsert;
export type AuditLogEntryRow = typeof auditLogEntries.$inferSelect;
export type ConsentRecordRow = typeof consentRecords.$inferSelect;
export type RetentionPolicyRow = typeof retentionPolicies.$inferSelect;
export type { date };
