import { date, integer, jsonb, numeric, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { cases } from './clinical';

/**
 * The clinical history behind a presenting complaint.
 *
 * Attached to the case, not the patient, and that is the whole design. A patient-level record
 * would mutate under a case a doctor has already signed — the review would then no longer
 * describe the record it was made against, which is precisely what the audit and consent
 * architecture exists to prevent. A new case pre-fills from the previous one and stores its own
 * copy; editing the new one changes nothing the earlier reviewer saw.
 *
 * JSONB arrays rather than child tables. Nothing queries across them, the questionnaire's own
 * answers already establish JSONB as how clinical values are stored here, and the alternative is
 * six join tables to render one panel.
 *
 * Every read and write goes through `ClinicalRepository`, so consent gating and audit logging
 * apply exactly as they do to responses. Nothing reads this table directly.
 */
export const caseClinicalHistory = pgTable('case_clinical_history', {
  caseId: uuid('case_id')
    .primaryKey()
    .references(() => cases.id, { onDelete: 'cascade' }),

  /**
   * Anthropometry. BMI is deliberately absent: it is computed at render, because a stored BMI
   * can disagree with the height and weight printed beside it.
   */
  heightCm: integer('height_cm'),
  weightKg: numeric('weight_kg', { precision: 5, scale: 2 }),

  /** `[{ code, label, sinceYear?, notes? }]` — `code` from a closed list, `label` free text. */
  conditions: jsonb('conditions').notNull().default([]),
  /** `[{ label, year?, notes? }]` — prior GI and abdominal surgery. */
  surgeries: jsonb('surgeries').notNull().default([]),
  /**
   * `[{ name, kind: 'prescription' | 'otc', frequency?, notes? }]`.
   *
   * Patient-reported, and not prescribing. The prohibited-treatment guard screens the *doctor's
   * review*; refusing to record that a patient takes ibuprofen — the single most load-bearing
   * fact in an upper-GI history — to satisfy a rule aimed at something else would be a safety
   * regression dressed as compliance.
   */
  medications: jsonb('medications').notNull().default([]),
  /** `[{ substance, reaction? }]` */
  allergies: jsonb('allergies').notNull().default([]),
  /** `[{ relation, condition, ageAtDiagnosis? }]` — first-degree GI and malignancy history. */
  familyHistory: jsonb('family_history').notNull().default([]),
  /** `{ smoking, alcohol, diet? }` — each a closed-list value, not free text. */
  lifestyle: jsonb('lifestyle'),

  /** The patient's own note about anything the structured fields did not capture. */
  additionalNotes: jsonb('additional_notes'),

  /** Last menstrual period, where relevant and offered. Nullable and never required. */
  lastMenstrualPeriod: date('last_menstrual_period'),

  /**
   * Null until the patient finishes the step. Distinguishes "reported nothing" from "never
   * asked", which the doctor's panel renders as two different things because they are.
   */
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type CaseClinicalHistoryRow = typeof caseClinicalHistory.$inferSelect;
