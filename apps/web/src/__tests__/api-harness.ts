import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { assertTestDatabase, tables } from '@gi-compass/db';
import { database } from '@/server/db';
import { hashPassword } from '@/server/crypto';
import { ACCESS_COOKIE, createSession, type SessionRole } from '@/server/auth/session';
import { seed } from '../../../../packages/db/src/seed/index';
/**
 * Test-only direct access to the clinical tables.
 *
 * Application code cannot import these — `@gi-compass/db` deliberately does not export them, so
 * the only way to reach a case or a response at runtime is through `ClinicalRepository`. Tests
 * reach past that on purpose: verifying that the repository actually wrote what it claimed
 * requires reading the row it wrote, and doing so through the repository would make the
 * assertion circular.
 */
import * as clinicalTables from '../../../../packages/db/src/schema';

/**
 * Drives the real route handlers.
 *
 * These tests call the exported handlers directly with a real `NextRequest` rather than going
 * through HTTP. That exercises the actual middleware chain — authentication, role checks,
 * consent gating, and the transactional audit write — which is what these tests are for. A
 * mocked chain would prove only that the mock was written correctly.
 */

export type Json = Record<string, unknown>;

/**
 * A route handler as Next.js calls it. Deliberately loose about the params shape: the harness
 * passes whatever the test supplies, and a handler typed for `{ caseId }` is still called the
 * same way at runtime.
 */
export type Handler = (
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  segment: { params: Promise<any> },
) => Promise<Response>;

export async function call(
  handler: Handler,
  options: {
    method?: string;
    path?: string;
    body?: unknown;
    formData?: FormData;
    params?: Record<string, string>;
    accessToken?: string;
  } = {},
): Promise<{ status: number; body: Json }> {
  const method = options.method ?? 'GET';
  const url = `http://localhost:3000${options.path ?? '/api/test'}`;

  const init: RequestInit & { duplex?: string } = { method };
  if (options.formData !== undefined) {
    init.body = options.formData;
  } else if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    init.headers = { 'content-type': 'application/json' };
  }

  const request = new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]);
  if (options.accessToken !== undefined) {
    request.cookies.set(ACCESS_COOKIE, options.accessToken);
  }

  const response = await handler(request, { params: Promise.resolve(options.params ?? {}) });
  const text = await response.text();
  return {
    status: response.status,
    body: text === '' ? {} : (JSON.parse(text) as Json),
  };
}

export async function truncateAll(): Promise<void> {
  // Last line of defence. The setup points the suite at a `*_test` database, but a stray
  // TEST_DATABASE_URL or a reordered import could undo that, and this helper deletes every row
  // in the schema. Refusing here costs nothing and has already been needed once.
  assertTestDatabase(process.env.DATABASE_URL ?? '');

  const db = database();
  await db.execute(sql`
    TRUNCATE TABLE
      response_amendments, responses, red_flag_triggers, uploaded_documents,
      review_diffs, doctor_reviews, ai_assessments, case_messages, case_assignments, cases,
      notification_deliveries, profile_amendments, data_subject_requests, consent_records,
      one_time_tokens, totp_factors, sessions, external_identities, admin_elevations,
      login_attempts, users
    RESTART IDENTITY CASCADE
  `);
  await db.execute(sql`ALTER TABLE audit_log_entries DISABLE TRIGGER audit_log_append_only`);
  try {
    await db.execute(sql`DELETE FROM audit_log_entries`);
  } finally {
    await db.execute(sql`ALTER TABLE audit_log_entries ENABLE TRIGGER audit_log_append_only`);
  }
}

/** Applies the seeded clinical content once, so the tests run against the real question bank. */
export async function ensureSeeded(): Promise<void> {
  const db = database();
  const existing = await db.select().from(tables.questionnaireTemplates).limit(1);
  if (existing.length === 0) await seed(db);

  const policy = await db.select().from(tables.consentPolicyVersions).limit(1);
  if (policy.length === 0) await seed(db);
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  accessToken: string;
  role: SessionRole;
}

export async function makeUser(options: {
  role: SessionRole;
  status?: 'unverified' | 'active';
  dateOfBirth?: string | null;
  mfaPending?: boolean;
}): Promise<TestUser> {
  const db = database();
  const email = `${options.role}-${randomUUID()}@example.invalid`;
  const password = 'a-perfectly-fine-passphrase';

  const [row] = await db
    .insert(tables.users)
    .values({
      email,
      passwordHash: await hashPassword(password),
      role: options.role,
      status: options.status ?? 'active',
      dateOfBirth: options.dateOfBirth === undefined ? '1974-05-02' : options.dateOfBirth,
      sex: 'female',
    })
    .returning({ id: tables.users.id });
  if (!row) throw new Error('user creation failed');

  const session = await createSession({
    userId: row.id,
    role: options.role,
    mfaPending: options.mfaPending ?? false,
  });

  return { id: row.id, email, password, accessToken: session.accessToken, role: options.role };
}

export async function grantConsents(
  userId: string,
  purposes: ReadonlyArray<'account_processing' | 'ai_assisted_analysis' | 'share_with_assigned_doctor'>,
): Promise<void> {
  if (purposes.length === 0) return;
  const db = database();
  const [policy] = await db.select().from(tables.consentPolicyVersions).limit(1);
  if (!policy) throw new Error('no consent policy seeded');
  await db.insert(tables.consentRecords).values(
    purposes.map((purpose) => ({
      userId,
      purpose,
      policyVersion: policy.version,
      policyId: policy.id,
    })),
  );
}

export async function withdrawConsent(
  userId: string,
  purpose: 'account_processing' | 'ai_assisted_analysis' | 'share_with_assigned_doctor',
): Promise<void> {
  await database()
    .update(tables.consentRecords)
    .set({ withdrawnAt: new Date() })
    .where(and(eq(tables.consentRecords.userId, userId), eq(tables.consentRecords.purpose, purpose)));
}

export async function auditActions(): Promise<string[]> {
  const rows = await database().select().from(tables.auditLogEntries);
  return rows.map((row) => row.action);
}

export async function auditRows() {
  return database().select().from(tables.auditLogEntries);
}

export { tables, clinicalTables };
