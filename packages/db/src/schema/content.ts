import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { contentStatusEnum } from './enums';

/**
 * Clinical content is data, not code. A published version is immutable — `content` is frozen at
 * publication and validated against the core template schema before the status flips — and a
 * case pins the version it started on, so a patient mid-interview never has the ground shift
 * under answers already given.
 */
export const questionnaireTemplates = pgTable(
  'questionnaire_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('questionnaire_templates_key_key').on(table.key)],
);

export const templateVersions = pgTable(
  'template_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => questionnaireTemplates.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    status: contentStatusEnum('status').notNull().default('draft'),
    /** The whole template document: entry points, groups, questions, branching rules. */
    content: jsonb('content').notNull(),
    /** Locales whose clinical text a clinician has approved for this version. */
    approvedLocales: text('approved_locales').array().notNull().default(['en']),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    publishedBy: uuid('published_by'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('template_versions_template_version_key').on(table.templateId, table.version),
    index('template_versions_status_idx').on(table.status),
  ],
);

/**
 * Red-flag rules are versioned separately from the question bank so triage can be tightened
 * without republishing the whole interview.
 */
export const redFlagRuleSets = pgTable(
  'red_flag_rule_sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    version: integer('version').notNull(),
    status: contentStatusEnum('status').notNull().default('draft'),
    content: jsonb('content').notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('red_flag_rule_sets_version_key').on(table.version)],
);

/**
 * Licensed illustration or clinician-supplied original. Publication is refused without a recorded
 * source and licence. Patient-supplied images never live here — they go to encrypted case storage.
 */
export const referenceImages = pgTable(
  'reference_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    version: integer('version').notNull().default(1),
    status: contentStatusEnum('status').notNull().default('draft'),
    captionKey: text('caption_key').notNull(),
    altTextKey: text('alt_text_key').notNull(),
    source: text('source').notNull(),
    licence: text('licence').notNull(),
    storageKey: text('storage_key').notNull(),
    /** Rendered widths available on the CDN, smallest first. */
    widths: integer('widths').array().notNull().default([320, 640, 1024]),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('reference_images_key_version_key').on(table.key, table.version),
    index('reference_images_status_idx').on(table.status),
  ],
);

/**
 * The set of conditions the platform screens for, explicit and reviewable rather than implied by
 * prompt text. Malignancy is one urgent-referral entry, never subtypes.
 *
 * TODO(confirm): Decision C — the Phase 1 taxonomy and its priority order.
 */
export const diseaseTaxonomyEntries = pgTable('disease_taxonomy_entries', {
  id: text('id').primaryKey(),
  label: text('label').notNull().unique(),
  clusters: text('clusters').array().notNull(),
  urgentReferralOnly: boolean('urgent_referral_only').notNull().default(false),
  active: boolean('active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Every content change is attributed, with the before and after retained. */
export const contentAuditEntries = pgTable(
  'content_audit_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('content_audit_entity_idx').on(table.entityType, table.entityId)],
);

export type TemplateVersionRow = typeof templateVersions.$inferSelect;
export type RedFlagRuleSetRow = typeof redFlagRuleSets.$inferSelect;
export type ReferenceImageRow = typeof referenceImages.$inferSelect;
export type TaxonomyRow = typeof diseaseTaxonomyEntries.$inferSelect;
