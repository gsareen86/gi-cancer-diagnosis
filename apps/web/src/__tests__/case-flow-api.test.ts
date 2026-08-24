import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  auditRows,
  call,
  ensureSeeded,
  grantConsents,
  makeUser,
  clinicalTables,
  tables,
  truncateAll,
  withdrawConsent,
  type TestUser,
} from './api-harness';
import { database } from '@/server/db';
import { GET as listCases, POST as createCase } from '@/app/api/cases/route';
import { GET as getCase } from '@/app/api/cases/[caseId]/route';
import { PUT as putAnswer } from '@/app/api/cases/[caseId]/answers/route';
import { POST as submitCase } from '@/app/api/cases/[caseId]/submit/route';
import { GET as caseSummary } from '@/app/api/cases/[caseId]/summary/route';
import { POST as acknowledge } from '@/app/api/cases/[caseId]/acknowledge/route';
import { GET as consentState, POST as grantConsentRoute, DELETE as withdrawRoute } from '@/app/api/consent/route';

beforeAll(ensureSeeded);
beforeEach(truncateAll);
afterAll(truncateAll);

const ALL_CONSENTS = [
  'account_processing',
  'ai_assisted_analysis',
  'share_with_assigned_doctor',
] as const;

async function patientWithCase(
  consents: readonly (typeof ALL_CONSENTS)[number][] = ALL_CONSENTS,
  entryPointId = 'ep_bleeding',
): Promise<{ patient: TestUser; caseId: string }> {
  const patient = await makeUser({ role: 'patient' });
  await grantConsents(patient.id, consents);
  const created = await call(createCase, {
    method: 'POST',
    body: { entryPointId },
    accessToken: patient.accessToken,
  });
  if (created.status !== 201) {
    throw new Error(`case creation failed: ${JSON.stringify(created.body)}`);
  }
  return { patient, caseId: (created.body.case as { id: string }).id };
}

const answer = async (
  patient: TestUser,
  caseId: string,
  questionId: string,
  value: unknown,
) =>
  call(putAnswer, {
    method: 'PUT',
    body: { questionId, value },
    params: { caseId },
    accessToken: patient.accessToken,
  });

const select = (optionId: string) => ({ kind: 'single_select', optionId });

describe('opening a case', () => {
  it('starts the interview at the chosen symptom area', async () => {
    const { patient, caseId } = await patientWithCase();
    const view = await call(getCase, { params: { caseId }, accessToken: patient.accessToken });

    expect(view.status).toBe(200);
    expect(view.body.status).toBe('in_progress');
    expect((view.body.nextQuestion as { id: string }).id).toBe('blood_in_stool');
    expect(view.body.emergency).toBeNull();
  });

  it('refuses a patient under 18, because Phase 1 has no guardian-consent flow', async () => {
    const minor = await makeUser({ role: 'patient', dateOfBirth: '2012-01-01' });
    await grantConsents(minor.id, ALL_CONSENTS);
    const response = await call(createCase, {
      method: 'POST',
      body: { entryPointId: 'ep_bleeding' },
      accessToken: minor.accessToken,
    });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('case.create.adults_only');
  });

  it('refuses an unverified account', async () => {
    const unverified = await makeUser({ role: 'patient', status: 'unverified' });
    const response = await call(createCase, {
      method: 'POST',
      body: { entryPointId: 'ep_bleeding' },
      accessToken: unverified.accessToken,
    });
    // An unverified account has no live session at all, so it is refused before role checks.
    expect([401, 403]).toContain(response.status);
  });

  it('requires a date of birth before a case can be opened', async () => {
    const patient = await makeUser({ role: 'patient', dateOfBirth: null });
    await grantConsents(patient.id, ALL_CONSENTS);
    const response = await call(createCase, {
      method: 'POST',
      body: { entryPointId: 'ep_bleeding' },
      accessToken: patient.accessToken,
    });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('case.create.date_of_birth_required');
  });

  it('refuses a second draft, offering resume or discard instead', async () => {
    const { patient } = await patientWithCase();
    const second = await call(createCase, {
      method: 'POST',
      body: { entryPointId: 'ep_pain' },
      accessToken: patient.accessToken,
    });
    expect(second.status).toBe(409);
    expect(second.body.messageKey).toBe('case.create.draft_already_open');
  });

  it('refuses an unknown symptom area', async () => {
    const patient = await makeUser({ role: 'patient' });
    await grantConsents(patient.id, ALL_CONSENTS);
    const response = await call(createCase, {
      method: 'POST',
      body: { entryPointId: 'ep_not_a_thing' },
      accessToken: patient.accessToken,
    });
    expect(response.status).toBe(400);
  });
});

describe('answering', () => {
  it('advances the interview and reveals the follow-up', async () => {
    const { patient, caseId } = await patientWithCase();
    const response = await answer(patient, caseId, 'blood_in_stool', select('yes'));

    expect(response.status).toBe(200);
    expect((response.body.nextQuestion as { id: string }).id).toBe('blood_appearance');
    expect((response.body.progress as { total: number }).total).toBeGreaterThan(1);
  });

  it('rejects an answer outside the declared range, naming the range', async () => {
    const { patient, caseId } = await patientWithCase('ep_bowel' === 'ep_bowel' ? ALL_CONSENTS : ALL_CONSENTS, 'ep_bowel');
    await answer(patient, caseId, 'bowel_change', select('yes'));
    await answer(patient, caseId, 'bowel_change_direction', {
      kind: 'multi_select',
      optionIds: ['looser'],
    });

    const response = await answer(patient, caseId, 'stool_frequency', {
      kind: 'numeric',
      value: 90,
      unit: 'times per day',
    });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('case.answers.rejected');
    expect((response.body.details as { code: string }).code).toBe('out_of_range');
    expect((response.body.details as { detail: { max: number } }).detail.max).toBe(30);
  });

  it('rejects an option the question does not define', async () => {
    const { patient, caseId } = await patientWithCase();
    const response = await answer(patient, caseId, 'blood_in_stool', select('maybe'));
    expect(response.status).toBe(400);
    expect((response.body.details as { code: string }).code).toBe('unknown_option');
  });

  it('rejects an answer to a question not on this template version', async () => {
    const { patient, caseId } = await patientWithCase();
    const response = await answer(patient, caseId, 'question_that_does_not_exist', select('yes'));
    expect(response.status).toBe(400);
  });

  it('retracts stranded answers when an earlier answer changes', async () => {
    const { patient, caseId } = await patientWithCase();
    await answer(patient, caseId, 'blood_in_stool', select('yes'));
    await answer(patient, caseId, 'blood_appearance', select('bright_red'));
    await answer(patient, caseId, 'blood_position', select('mixed_in'));

    const changed = await answer(patient, caseId, 'blood_appearance', select('black_tarry'));
    expect(changed.status).toBe(200);

    const answered = (changed.body.answeredQuestions as Array<{ question: { id: string } }>).map(
      (entry) => entry.question.id,
    );
    expect(answered).not.toContain('blood_position');

    // Retracted, not deleted: the path that produced the assessment stays reconstructable.
    const rows = await database().select().from(clinicalTables.responses);
    const stranded = rows.find((row) => row.questionId === 'blood_position');
    expect(stranded).toBeDefined();
    expect(stranded?.active).toBe(false);
  });

  it('records the question identifier in the audit trail but never the answer value', async () => {
    const { patient, caseId } = await patientWithCase();
    await answer(patient, caseId, 'blood_in_stool', select('yes'));
    await answer(patient, caseId, 'blood_appearance', select('black_tarry'));

    const serialized = JSON.stringify(await auditRows());
    expect(serialized).toContain('blood_appearance');
    expect(serialized).not.toContain('black_tarry');
  });
});

describe('emergency escalation', () => {
  it('interrupts the interview the moment the pattern completes', async () => {
    const { patient, caseId } = await patientWithCase();
    await answer(patient, caseId, 'blood_in_stool', select('yes'));

    const beforeCompletion = await answer(patient, caseId, 'blood_appearance', select('black_tarry'));
    expect(beforeCompletion.body.emergency).toBeNull();

    const triggering = await answer(patient, caseId, 'lightheaded', select('yes'));
    const emergency = triggering.body.emergency as { messages: string[]; contacts: Array<{ number: string }> };

    expect(emergency).not.toBeNull();
    expect(emergency.contacts.map((contact) => contact.number)).toEqual(['112', '108']);
    expect(triggering.body.newlyTriggeredRuleIds).toContain('rf_upper_gi_bleed_with_hypovolaemia');
  });

  it('describes the pattern without naming a condition', async () => {
    const { patient, caseId } = await patientWithCase();
    await answer(patient, caseId, 'blood_in_stool', select('yes'));
    await answer(patient, caseId, 'blood_appearance', select('black_tarry'));
    const triggering = await answer(patient, caseId, 'lightheaded', select('yes'));

    const messages = (triggering.body.emergency as { messages: string[] }).messages.join(' ').toLowerCase();
    expect(messages).toContain('urgent in-person care');
    for (const term of ['cancer', 'ulcer', 'perforation', 'malignancy', 'crohn']) {
      expect(messages).not.toContain(term);
    }
  });

  it('keeps every answer, including the triggering one', async () => {
    const { patient, caseId } = await patientWithCase();
    await answer(patient, caseId, 'blood_in_stool', select('yes'));
    await answer(patient, caseId, 'blood_appearance', select('black_tarry'));
    await answer(patient, caseId, 'lightheaded', select('yes'));

    const rows = await database().select().from(clinicalTables.responses);
    expect(rows.map((row) => row.questionId).sort()).toEqual(
      ['blood_appearance', 'blood_in_stool', 'lightheaded'].sort(),
    );
  });

  it('records an acknowledgement without clearing the flag', async () => {
    const { patient, caseId } = await patientWithCase();
    await answer(patient, caseId, 'blood_in_stool', select('yes'));
    await answer(patient, caseId, 'blood_appearance', select('black_tarry'));
    await answer(patient, caseId, 'lightheaded', select('yes'));

    const acked = await call(acknowledge, {
      method: 'POST',
      params: { caseId },
      accessToken: patient.accessToken,
    });
    expect(acked.status).toBe(200);
    expect(acked.body.acknowledged).toBeGreaterThan(0);

    const stillFlagged = await call(getCase, { params: { caseId }, accessToken: patient.accessToken });
    expect(stillFlagged.body.emergency).not.toBeNull();

    const flags = await database().select().from(clinicalTables.redFlagTriggers);
    expect(flags[0]?.acknowledgedAt).not.toBeNull();
  });
});

describe('consent gating', () => {
  it('lists each purpose separately with nothing pre-selected', async () => {
    const patient = await makeUser({ role: 'patient' });
    const state = await call(consentState, { accessToken: patient.accessToken });

    const purposes = state.body.purposes as Array<{ purpose: string; granted: boolean; required: boolean }>;
    expect(purposes).toHaveLength(3);
    expect(purposes.every((entry) => entry.granted === false)).toBe(true);
    expect(purposes.find((entry) => entry.purpose === 'ai_assisted_analysis')?.required).toBe(false);
  });

  it('grants only the purposes explicitly named', async () => {
    const patient = await makeUser({ role: 'patient' });
    const granted = await call(grantConsentRoute, {
      method: 'POST',
      body: { purposes: ['account_processing', 'share_with_assigned_doctor'] },
      accessToken: patient.accessToken,
    });

    const purposes = granted.body.purposes as Array<{ purpose: string; granted: boolean }>;
    expect(purposes.find((entry) => entry.purpose === 'account_processing')?.granted).toBe(true);
    expect(purposes.find((entry) => entry.purpose === 'ai_assisted_analysis')?.granted).toBe(false);
  });

  it('blocks every clinical read once account processing is withdrawn', async () => {
    const { patient, caseId } = await patientWithCase();
    await withdrawConsent(patient.id, 'account_processing');

    const view = await call(getCase, { params: { caseId }, accessToken: patient.accessToken });
    expect(view.status).toBe(403);
    expect(view.body.messageKey).toBe('error.consent_required');
  });

  it('records the withdrawal without destroying the original grant', async () => {
    const patient = await makeUser({ role: 'patient' });
    await call(grantConsentRoute, {
      method: 'POST',
      body: { purposes: ['ai_assisted_analysis'] },
      accessToken: patient.accessToken,
    });
    await call(withdrawRoute, {
      method: 'DELETE',
      body: { purpose: 'ai_assisted_analysis' },
      accessToken: patient.accessToken,
    });

    const rows = await database()
      .select()
      .from(tables.consentRecords)
      .where(eq(tables.consentRecords.userId, patient.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.grantedAt).toBeInstanceOf(Date);
    expect(rows[0]?.withdrawnAt).not.toBeNull();
  });
});

describe('submission', () => {
  async function completeBleedingInterview(patient: TestUser, caseId: string): Promise<void> {
    // Walk the interview to completion, answering whatever it asks next.
    for (let step = 0; step < 40; step += 1) {
      const view = await call(getCase, { params: { caseId }, accessToken: patient.accessToken });
      const next = view.body.nextQuestion as
        | { id: string; type: string; options: Array<{ id: string }>; numeric: { min: number; unit: string } | null }
        | null;
      if (next === null) return;

      const value =
        next.type === 'single_select'
          ? { kind: 'single_select', optionId: next.options[0]?.id ?? 'no' }
          : next.type === 'multi_select'
            ? { kind: 'multi_select', optionIds: [next.options[0]?.id ?? 'none'] }
            : next.type === 'numeric'
              ? { kind: 'numeric', value: next.numeric?.min ?? 0, unit: next.numeric?.unit ?? '' }
              : next.type === 'duration'
                ? { kind: 'duration', days: 3 }
                : next.type === 'scale'
                  ? { kind: 'scale', value: 1 }
                  : next.type === 'date'
                    ? { kind: 'date', value: '2026-01-01' }
                    : next.type === 'body_map'
                      ? { kind: 'body_map', regionIds: ['epigastrium'] }
                      : { kind: 'text', value: '' };

      const saved = await answer(patient, caseId, next.id, value);
      if (saved.status !== 200) throw new Error(`answer rejected: ${JSON.stringify(saved.body)}`);
    }
    throw new Error('interview did not complete within 40 steps');
  }

  it('refuses submission while a required question is unanswered, and says where to resume', async () => {
    const { patient, caseId } = await patientWithCase();
    await answer(patient, caseId, 'blood_in_stool', select('yes'));

    const response = await call(submitCase, {
      method: 'POST',
      params: { caseId },
      accessToken: patient.accessToken,
    });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('case.submit.incomplete');
    expect((response.body.details as { resumeAt: string }).resumeAt).toBeTruthy();
  });

  it('refuses submission without doctor-sharing consent', async () => {
    const { patient, caseId } = await patientWithCase(['account_processing', 'ai_assisted_analysis']);
    await completeBleedingInterview(patient, caseId);

    const response = await call(submitCase, {
      method: 'POST',
      params: { caseId },
      accessToken: patient.accessToken,
    });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('case.submit.doctor_sharing_required');

    const [row] = await database().select().from(clinicalTables.cases);
    expect(row?.status).toBe('in_progress');
  });

  it('submits without AI when that consent is absent, recording the reason for the doctor', async () => {
    await makeUser({ role: 'doctor' });
    const { patient, caseId } = await patientWithCase([
      'account_processing',
      'share_with_assigned_doctor',
    ]);
    await completeBleedingInterview(patient, caseId);

    const response = await call(submitCase, {
      method: 'POST',
      params: { caseId },
      accessToken: patient.accessToken,
    });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('submitted_without_ai');

    const [row] = await database().select().from(clinicalTables.cases);
    expect(row?.status).toBe('ai_skipped');
    expect(row?.aiSkipReason).toContain('did not consent');

    // Nothing was sent anywhere: no assessment row exists at all.
    expect(await database().select().from(clinicalTables.aiAssessments)).toEqual([]);
  });

  it('assigns a reviewing doctor on submission', async () => {
    const doctor = await makeUser({ role: 'doctor' });
    const { patient, caseId } = await patientWithCase([
      'account_processing',
      'share_with_assigned_doctor',
    ]);
    await completeBleedingInterview(patient, caseId);
    await call(submitCase, { method: 'POST', params: { caseId }, accessToken: patient.accessToken });

    const assignments = await database().select().from(clinicalTables.caseAssignments);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.doctorId).toBe(doctor.id);
  });

  it('refuses to edit an answer once the case is submitted', async () => {
    await makeUser({ role: 'doctor' });
    const { patient, caseId } = await patientWithCase([
      'account_processing',
      'share_with_assigned_doctor',
    ]);
    await completeBleedingInterview(patient, caseId);
    await call(submitCase, { method: 'POST', params: { caseId }, accessToken: patient.accessToken });

    const response = await answer(patient, caseId, 'blood_in_stool', select('no'));
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('case.answers.not_editable');
  });
});

describe('what the patient may read', () => {
  it('returns state only before a doctor has released anything', async () => {
    const { patient, caseId } = await patientWithCase();
    const summary = await call(caseSummary, { params: { caseId }, accessToken: patient.accessToken });

    expect(summary.status).toBe(200);
    expect(summary.body.released).toBe(false);
    expect(summary.body).not.toHaveProperty('content');
    expect(JSON.stringify(summary.body)).not.toContain('differential');
  });

  it('lists the patient’s own cases with no clinical content', async () => {
    const { patient } = await patientWithCase();
    const list = await call(listCases, { accessToken: patient.accessToken });
    const cases = list.body.cases as Array<Record<string, unknown>>;

    expect(cases).toHaveLength(1);
    expect(Object.keys(cases[0]!).sort()).toEqual(
      ['createdAt', 'entryPointId', 'id', 'releasedAt', 'status', 'submittedAt', 'templateVersionId', 'updatedAt'].sort(),
    );
  });
});

describe('cross-patient access', () => {
  it('is refused as not-found, so case identifiers cannot be enumerated', async () => {
    const { caseId } = await patientWithCase();
    const other = await makeUser({ role: 'patient' });
    await grantConsents(other.id, ALL_CONSENTS);

    const response = await call(getCase, { params: { caseId }, accessToken: other.accessToken });
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('error.not_found');
  });

  it('logs the denial with the actor and the requested target', async () => {
    const { caseId } = await patientWithCase();
    const other = await makeUser({ role: 'patient' });
    await grantConsents(other.id, ALL_CONSENTS);
    await call(getCase, { params: { caseId }, accessToken: other.accessToken });

    const denial = (await auditRows()).find((row) => row.action === 'authz.denied');
    expect(denial?.actorId).toBe(other.id);
    expect(denial?.targetId).toBe(caseId);
  });

  it('refuses a clinical admin outright', async () => {
    const { caseId } = await patientWithCase();
    const admin = await makeUser({ role: 'clinical_admin' });
    const response = await call(getCase, { params: { caseId }, accessToken: admin.accessToken });
    // The route serves patients only, so the role check refuses before anything is read.
    expect(response.status).toBe(403);
  });
});
