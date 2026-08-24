import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { createDatabase, createPool } from '../client';
import * as schema from '../schema';
import type { Database } from '../client';

/**
 * These tests run against a real PostgreSQL. The behaviours under test — transactional audit,
 * privilege-level append-only enforcement, unique partial indexes — are database behaviours, and
 * a mock would assert only that we wrote the mock correctly.
 */

/**
 * The database these tests run against.
 *
 * Prefers the repository's own configuration over a hardcoded guess: the previous default named
 * a port that existed only on the machine these tests were written on, so a fresh checkout failed
 * with a connection refusal that said nothing about why.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/gi_compass';

export interface TestContext {
  db: Database;
  close: () => Promise<void>;
}

export function openDatabase(): TestContext {
  const pool = createPool({ connectionString: TEST_DATABASE_URL, maxConnections: 4 });
  return { db: createDatabase(pool), close: () => pool.end() };
}

/** Wipes clinical and identity data between tests, leaving the schema in place. */
export async function truncateAll(db: Database): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE
      response_amendments, responses, red_flag_triggers, uploaded_documents,
      review_diffs, doctor_reviews, ai_assessments, case_messages, case_assignments, cases,
      knowledge_base_entry_tags, knowledge_base_chunks, knowledge_base_entries,
      knowledge_base_snapshots, notification_deliveries, profile_amendments,
      data_subject_requests, consent_records, consent_policy_versions,
      template_versions, questionnaire_templates, red_flag_rule_sets, reference_images,
      content_audit_entries, one_time_tokens, totp_factors, sessions, external_identities,
      admin_elevations, login_attempts, users
    RESTART IDENTITY CASCADE
  `);
  // The audit table resists deletion even from the table owner: the append-only trigger fires
  // for anyone. Clearing it between tests therefore takes an explicit, deliberate disable —
  // which is itself evidence the guard bites. Nothing in the application may do this.
  await db.execute(sql`ALTER TABLE audit_log_entries DISABLE TRIGGER audit_log_append_only`);
  try {
    await db.execute(sql`DELETE FROM audit_log_entries`);
  } finally {
    await db.execute(sql`ALTER TABLE audit_log_entries ENABLE TRIGGER audit_log_append_only`);
  }
}

export const POLICY_VERSION = 'privacy-policy-test-1';

export async function seedPolicy(db: Database): Promise<string> {
  const [row] = await db
    .insert(schema.consentPolicyVersions)
    .values({
      version: POLICY_VERSION,
      bodyByLocale: { en: 'Test policy body.' },
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      dataFiduciaryName: 'TODO(confirm): Decision G — data fiduciary',
      grievanceContact: 'grievance@example.invalid',
    })
    .returning();
  if (!row) throw new Error('policy seed failed');
  return row.id;
}

export async function createUser(
  db: Database,
  role: 'patient' | 'doctor' | 'clinical_admin' | 'platform_admin',
  overrides: Partial<typeof schema.users.$inferInsert> = {},
): Promise<string> {
  const [row] = await db
    .insert(schema.users)
    .values({
      email: `${role}-${randomUUID()}@example.invalid`,
      passwordHash: 'argon2id$test',
      role,
      status: 'active',
      dateOfBirth: '1974-05-02',
      ...overrides,
    })
    .returning({ id: schema.users.id });
  if (!row) throw new Error('user seed failed');
  return row.id;
}

export async function grantConsent(
  db: Database,
  userId: string,
  policyId: string,
  purposes: ReadonlyArray<'account_processing' | 'ai_assisted_analysis' | 'share_with_assigned_doctor'>,
): Promise<void> {
  if (purposes.length === 0) return;
  await db.insert(schema.consentRecords).values(
    purposes.map((purpose) => ({
      userId,
      purpose,
      policyVersion: POLICY_VERSION,
      policyId,
    })),
  );
}

export async function withdrawConsent(
  db: Database,
  userId: string,
  purpose: 'account_processing' | 'ai_assisted_analysis' | 'share_with_assigned_doctor',
): Promise<void> {
  await db.execute(sql`
    UPDATE consent_records SET withdrawn_at = now()
    WHERE user_id = ${userId}::uuid AND purpose = ${purpose}::consent_purpose AND withdrawn_at IS NULL
  `);
}

export interface SeededCase {
  caseId: string;
  patientId: string;
  doctorId: string;
  policyId: string;
  ruleSetId: string;
}

export async function seedCase(
  db: Database,
  options: {
    patientConsents?: ReadonlyArray<
      'account_processing' | 'ai_assisted_analysis' | 'share_with_assigned_doctor'
    >;
    assignDoctor?: boolean;
  } = {},
): Promise<SeededCase> {
  const policyId = await seedPolicy(db);
  const patientId = await createUser(db, 'patient');
  const doctorId = await createUser(db, 'doctor');
  const adminId = await createUser(db, 'clinical_admin');

  await grantConsent(
    db,
    patientId,
    policyId,
    options.patientConsents ?? ['account_processing', 'ai_assisted_analysis', 'share_with_assigned_doctor'],
  );

  const [template] = await db
    .insert(schema.questionnaireTemplates)
    .values({ key: `test-${randomUUID()}`, name: 'Test intake' })
    .returning({ id: schema.questionnaireTemplates.id });
  if (!template) throw new Error('template seed failed');

  const [templateVersion] = await db
    .insert(schema.templateVersions)
    .values({
      templateId: template.id,
      version: 1,
      status: 'published',
      content: { templateId: 'test', version: 1 },
      createdBy: adminId,
      publishedBy: adminId,
      publishedAt: new Date(),
    })
    .returning({ id: schema.templateVersions.id });
  if (!templateVersion) throw new Error('template version seed failed');

  const [ruleSet] = await db
    .insert(schema.redFlagRuleSets)
    .values({
      version: Math.floor(Math.random() * 1_000_000),
      status: 'published',
      content: { version: 1, rules: [] },
      createdBy: adminId,
      publishedAt: new Date(),
    })
    .returning({ id: schema.redFlagRuleSets.id });
  if (!ruleSet) throw new Error('rule set seed failed');

  const [row] = await db
    .insert(schema.cases)
    .values({
      patientId,
      templateVersionId: templateVersion.id,
      entryPointId: 'ep_bleeding',
      status: 'in_progress',
    })
    .returning({ id: schema.cases.id });
  if (!row) throw new Error('case seed failed');

  if (options.assignDoctor !== false) {
    await db
      .insert(schema.caseAssignments)
      .values({ caseId: row.id, doctorId, assignedBy: adminId });
    await db
      .update(schema.cases)
      .set({ assignedDoctorId: doctorId })
      .where(sql`id = ${row.id}::uuid`);
  }

  return { caseId: row.id, patientId, doctorId, policyId, ruleSetId: ruleSet.id };
}

export async function auditEntries(db: Database, subjectId?: string) {
  const rows = await db.select().from(schema.auditLogEntries);
  return subjectId === undefined ? rows : rows.filter((row) => row.subjectId === subjectId);
}

export { schema };
