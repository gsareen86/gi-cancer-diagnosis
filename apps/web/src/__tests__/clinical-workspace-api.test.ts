import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { systemContext } from '@gi-compass/db';
import { auditRows, call, clinicalTables, ensureSeeded, grantConsents, makeUser, truncateAll } from './api-harness';
import { clinical, database } from '@/server/db';
import { POST as createCase } from '@/app/api/cases/route';
import { GET as readHistory, PUT as saveHistory } from '@/app/api/cases/[caseId]/history/route';
import { GET as readFeed } from '@/app/api/notifications/route';
import { POST as markRead } from '@/app/api/notifications/read/route';
import { GET as metrics } from '@/app/api/doctor/metrics/route';
import { queueNotification, setEmailTransport } from '@/server/services/notification-service';

beforeAll(ensureSeeded);
beforeEach(async () => { await truncateAll(); setEmailTransport({ delivers: false, send: async () => {} }); });
afterAll(truncateAll);

async function draft() {
  const patient = await makeUser({ role: 'patient' });
  await grantConsents(patient.id, ['account_processing', 'share_with_assigned_doctor', 'ai_assisted_analysis']);
  const made = await call(createCase, { method: 'POST', accessToken: patient.accessToken, body: { entryPointId: 'ep_bowel' } });
  expect(made.status).toBe(201);
  return { patient, caseId: (made.body.case as { id: string }).id };
}

describe('clinical history', () => {
  it('audits saves and reads and refuses editing after submission', async () => {
    const { patient, caseId } = await draft();
    const body = { heightCm: null, weightKg: null, medications: [{ name: 'Patient-reported medicine', kind: 'otc' }], complete: true };
    expect((await call(saveHistory, { method: 'PUT', accessToken: patient.accessToken, params: { caseId }, body })).status).toBe(200);
    expect((await call(readHistory, { accessToken: patient.accessToken, params: { caseId } })).body.history).toMatchObject({ medications: body.medications });
    const actions = (await auditRows()).map((row) => row.action);
    expect(actions).toContain('clinical_history.write');
    expect(actions).toContain('clinical_history.read');
    await clinical().transitionCase(systemContext(patient.id, 'account_processing'), caseId, 'submitted');
    expect((await call(saveHistory, { method: 'PUT', accessToken: patient.accessToken, params: { caseId }, body })).status).toBe(409);
  });
  it('rejects malformed medication entries and cross-patient reads', async () => {
    const { patient, caseId } = await draft();
    const other = await makeUser({ role: 'patient' });
    await grantConsents(other.id, ['account_processing']);
    expect((await call(saveHistory, { method: 'PUT', accessToken: patient.accessToken, params: { caseId }, body: { medications: [{ name: 'x', kind: 'invalid' }] } })).status).toBe(400);
    expect((await call(readHistory, { accessToken: other.accessToken, params: { caseId } })).status).toBe(404);
  });
  it('removes a consent-withdrawn case from triage and the snapshot feed', async () => {
    const { patient, caseId } = await draft();
    const doctor = await makeUser({ role: 'doctor' });
    const context = systemContext(patient.id, 'share_with_assigned_doctor');
    await clinical().transitionCase(context, caseId, 'submitted');
    await clinical().assignDoctor(context, caseId, doctor.id, doctor.id);
    expect((await call(metrics, { accessToken: doctor.accessToken })).body.pending).toBe(1);
    await database().update(clinicalTables.consentRecords).set({ withdrawnAt: new Date() }).where(eq(clinicalTables.consentRecords.userId, patient.id));
    expect((await call(metrics, { accessToken: doctor.accessToken })).body.total).toBe(0);
    expect(await clinical().assessmentSnapshots(doctor.id, 'doctor', [caseId])).toEqual(new Map());
  });
});

describe('notification feed isolation', () => {
  it('scopes feed and read receipts, preserves delivery truth, and deduplicates events', async () => {
    const a = await makeUser({ role: 'patient' });
    const b = await makeUser({ role: 'patient' });
    await queueNotification({ userId: a.id, type: 'case_under_review', reference: a.id, dedupeKey: `test:${a.id}` });
    await queueNotification({ userId: a.id, type: 'case_under_review', reference: a.id, dedupeKey: `test:${a.id}` });
    const feed = await call(readFeed, { accessToken: a.accessToken });
    const entries = feed.body.entries as Array<{ id: string; outcome: string }>;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.outcome).toBe('logged_only');
    expect((await call(readFeed, { accessToken: b.accessToken })).body.entries).toEqual([]);
    expect((await call(markRead, { method: 'POST', accessToken: b.accessToken, body: { ids: [entries[0]?.id] } })).body.marked).toBe(0);
    expect((await call(markRead, { method: 'POST', accessToken: a.accessToken, body: { ids: [] } })).body.marked).toBe(0);
    expect((await call(markRead, { method: 'POST', accessToken: a.accessToken, body: { ids: [entries[0]?.id] } })).body.marked).toBe(1);
    expect((await call(readFeed, { accessToken: a.accessToken })).body.unread).toBe(0);
  });
});
