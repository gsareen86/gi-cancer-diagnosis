import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  auditRows,
  call,
  clinicalTables,
  ensureSeeded,
  grantConsents,
  makeUser,
  truncateAll,
  type TestUser,
} from './api-harness';
import { database } from '@/server/db';
import { MANDATORY_DISCLAIMER } from '@gi-compass/core';
import { systemContext } from '@gi-compass/db';
import { clinical } from '@/server/db';
import { GET as doctorQueue } from '@/app/api/doctor/queue/route';
import { GET as doctorCase } from '@/app/api/doctor/cases/[caseId]/route';
import { PUT as saveReview } from '@/app/api/doctor/cases/[caseId]/review/route';
import { POST as releaseReview } from '@/app/api/doctor/cases/[caseId]/release/route';
import { GET as patientSummary } from '@/app/api/cases/[caseId]/summary/route';
import { POST as createCase } from '@/app/api/cases/route';
import { PUT as putAnswer } from '@/app/api/cases/[caseId]/answers/route';

beforeAll(ensureSeeded);
beforeEach(truncateAll);
afterAll(truncateAll);

const ALL_CONSENTS = ['account_processing', 'ai_assisted_analysis', 'share_with_assigned_doctor'] as const;

const AI_CLINICIAN_SUMMARY =
  'Adult reporting melaena with lightheadedness. Pattern warrants urgent upper GI evaluation.';

interface Fixture {
  patient: TestUser;
  doctor: TestUser;
  caseId: string;
}

async function submittedCase(options: { withAssessment?: boolean } = {}): Promise<Fixture> {
  const doctor = await makeUser({ role: 'doctor' });
  const patient = await makeUser({ role: 'patient' });
  await grantConsents(patient.id, ALL_CONSENTS);

  const created = await call(createCase, {
    method: 'POST',
    body: { entryPointId: 'ep_bleeding' },
    accessToken: patient.accessToken,
  });
  const caseId = (created.body.case as { id: string }).id;

  for (const [questionId, optionId] of [
    ['blood_in_stool', 'yes'],
    ['blood_appearance', 'black_tarry'],
    ['lightheaded', 'yes'],
  ] as const) {
    await call(putAnswer, {
      method: 'PUT',
      body: { questionId, value: { kind: 'single_select', optionId } },
      params: { caseId },
      accessToken: patient.accessToken,
    });
  }

  const repo = clinical();
  const context = systemContext(patient.id, 'share_with_assigned_doctor');
  await repo.transitionCase(context, caseId, 'submitted', { submittedAt: new Date() });
  await repo.assignDoctor(
    { actor: { id: null, role: 'system' }, subjectId: patient.id, purpose: 'share_with_assigned_doctor' },
    caseId,
    doctor.id,
    doctor.id,
  );

  if (options.withAssessment !== false) {
    const aiContext = systemContext(patient.id, 'ai_assisted_analysis');
    // The real sequence: submitted → ai_processing → ai_processed. The state machine refuses to
    // skip a step, which is the point of having one.
    await repo.transitionCase(aiContext, caseId, 'ai_processing');
    await repo.recordAssessment(systemContext(patient.id, 'ai_assisted_analysis'), {
      caseId,
      outcome: 'generated',
      modelVersion: 'test-model-1',
      promptVersion: 'assessment-v1',
      kbVersion: 'kb-seed-1',
      retrievedChunkIds: ['chunk-a', 'chunk-b'],
      payload: {
        case_id: caseId,
        model_version: 'test-model-1',
        prompt_version: 'assessment-v1',
        kb_version: 'kb-seed-1',
        generated_at: new Date().toISOString(),
        differential_assessment: [
          {
            condition: 'Peptic ulcer disease',
            likelihood: 'moderate',
            supporting_findings: ['Reported black tarry stool'],
            contradicting_or_atypical_findings: [],
            suggested_confirmatory_steps: ['Upper GI endoscopy'],
          },
        ],
        red_flags: [],
        recommended_next_steps: ['Urgent in-person assessment'],
        clinician_summary: AI_CLINICIAN_SUMMARY,
        disclaimer: MANDATORY_DISCLAIMER,
      },
    });
    await repo.transitionCase(aiContext, caseId, 'ai_processed');
  }
  await repo.transitionCase(context, caseId, 'in_review');

  return { patient, doctor, caseId };
}

const validReview = (overrides: Record<string, unknown> = {}) => ({
  differential: [
    {
      condition: 'Peptic ulcer disease',
      likelihood: 'high',
      origin: 'ai',
      rejected: false,
      rationale: 'Consistent with the reported pattern and the painkiller history.',
    },
  ],
  recommendedNextSteps: ['Upper GI endoscopy within one week', 'Full blood count and iron studies'],
  clinicalImpression:
    'My impression is upper GI bleeding requiring urgent endoscopic assessment. This is a clinical impression pending in-person examination.',
  patientFacingSummary:
    'Based on what you told us, you need to be seen urgently for a camera test of your stomach. Please attend as arranged.',
  doctorNotes: 'Discussed by phone. Patient aware of urgency.',
  diffs: [
    {
      action: 'likelihood_changed',
      conditionId: 'peptic_ulcer_disease',
      beforeValue: 'moderate',
      afterValue: 'high',
      rationale: 'Painkiller history raises this above the model estimate.',
    },
  ],
  finalize: false,
  ...overrides,
});

describe('the review queue', () => {
  it('shows assigned cases with their highest urgency, emergencies first', async () => {
    const { doctor } = await submittedCase();
    const response = await call(doctorQueue as never, { accessToken: doctor.accessToken });

    expect(response.status).toBe(200);
    const cases = response.body.cases as Array<{ highestUrgency: string; flagCount: number }>;
    expect(cases).toHaveLength(1);
    expect(cases[0]?.highestUrgency).toBe('emergency');
    expect(cases[0]?.flagCount).toBeGreaterThan(0);
  });

  it('shows nothing to an unassigned doctor', async () => {
    await submittedCase();
    const other = await makeUser({ role: 'doctor' });
    const response = await call(doctorQueue as never, { accessToken: other.accessToken });
    expect(response.body.cases).toEqual([]);
  });

  it('is refused to a patient', async () => {
    const { patient } = await submittedCase();
    const response = await call(doctorQueue as never, { accessToken: patient.accessToken });
    expect(response.status).toBe(403);
  });
});

describe('the case view', () => {
  it('assembles answers, red flags, and the assessment in one response', async () => {
    const { doctor, caseId } = await submittedCase();
    const response = await call(doctorCase, { params: { caseId }, accessToken: doctor.accessToken });

    expect(response.status).toBe(200);
    expect(response.body.answersByCluster).toBeDefined();
    expect(response.body.redFlags).toBeDefined();
    expect((response.body.assessment as { modelVersion: string }).modelVersion).toBe('test-model-1');
  });

  it('shows why each follow-up question was asked', async () => {
    const { doctor, caseId } = await submittedCase();
    const response = await call(doctorCase, { params: { caseId }, accessToken: doctor.accessToken });

    const clusters = response.body.answersByCluster as Array<{
      answers: Array<{ questionId: string; askedBecause: string | null }>;
    }>;
    const all = clusters.flatMap((cluster) => cluster.answers);
    const followUp = all.find((entry) => entry.questionId === 'blood_appearance');
    expect(followUp?.askedBecause).toContain('blood');
  });

  it('pins the model, prompt, and knowledge-base versions that produced the assessment', async () => {
    const { doctor, caseId } = await submittedCase();
    const response = await call(doctorCase, { params: { caseId }, accessToken: doctor.accessToken });
    const assessment = response.body.assessment as Record<string, unknown>;

    expect(assessment.promptVersion).toBe('assessment-v1');
    expect(assessment.kbVersion).toBe('kb-seed-1');
    expect(assessment.groundingChunkCount).toBe(2);
  });

  it('states plainly when there is no assessment', async () => {
    const { doctor, caseId } = await submittedCase({ withAssessment: false });
    const response = await call(doctorCase, { params: { caseId }, accessToken: doctor.accessToken });
    expect(response.body.assessment).toBeNull();
  });

  it('refuses an unassigned doctor and logs the denial', async () => {
    const { caseId } = await submittedCase();
    const other = await makeUser({ role: 'doctor' });
    const response = await call(doctorCase, { params: { caseId }, accessToken: other.accessToken });

    expect(response.status).toBe(404);
    const denial = (await auditRows()).find(
      (row) => row.action === 'authz.denied' && row.actorId === other.id,
    );
    expect(denial).toBeDefined();
  });

  it('records a separate audit entry for each panel it loads', async () => {
    const { doctor, caseId } = await submittedCase();
    await call(doctorCase, { params: { caseId }, accessToken: doctor.accessToken });

    const actions = (await auditRows())
      .filter((row) => row.actorId === doctor.id)
      .map((row) => row.action);
    expect(actions).toContain('case.read');
    expect(actions).toContain('response.read');
    expect(actions).toContain('document.read');
    expect(actions).toContain('assessment.read');
  });
});

describe('overriding the assessment', () => {
  it('saves the doctor’s version while leaving the original untouched', async () => {
    const { doctor, caseId } = await submittedCase();
    const response = await call(saveReview, {
      method: 'PUT',
      body: validReview(),
      params: { caseId },
      accessToken: doctor.accessToken,
    });
    expect(response.status).toBe(200);

    const [assessment] = await database().select().from(clinicalTables.aiAssessments);
    const payload = assessment?.payload as { differential_assessment: Array<{ likelihood: string }> };
    expect(payload.differential_assessment[0]?.likelihood).toBe('moderate');

    const [review] = await database().select().from(clinicalTables.doctorReviews);
    const summary = review?.finalSummary as { differential: Array<{ likelihood: string }> };
    expect(summary.differential[0]?.likelihood).toBe('high');
  });

  it('records each override as a diff with the versions in force', async () => {
    const { doctor, caseId } = await submittedCase();
    await call(saveReview, {
      method: 'PUT',
      body: validReview(),
      params: { caseId },
      accessToken: doctor.accessToken,
    });

    const diffs = await database().select().from(clinicalTables.reviewDiffs);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.action).toBe('likelihood_changed');
    expect(diffs[0]?.beforeValue).toBe('moderate');
    expect(diffs[0]?.afterValue).toBe('high');
    expect(diffs[0]?.modelVersion).toBe('test-model-1');
    expect(diffs[0]?.rationale).toContain('Painkiller history');
  });
});

describe('finalization refuses work that is not the doctor’s own', () => {
  it('refuses the AI summary passed through untouched', async () => {
    const { doctor, caseId } = await submittedCase();
    const response = await call(saveReview, {
      method: 'PUT',
      body: validReview({
        clinicalImpression: AI_CLINICIAN_SUMMARY,
        finalize: true,
      }),
      params: { caseId },
      accessToken: doctor.accessToken,
    });

    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('review.finalize.ai_summary_passthrough');
  });

  it('refuses the AI summary even with whitespace and case changed', async () => {
    const { doctor, caseId } = await submittedCase();
    const response = await call(saveReview, {
      method: 'PUT',
      body: validReview({
        patientFacingSummary: `  ${AI_CLINICIAN_SUMMARY.toUpperCase()}  `,
        finalize: true,
      }),
      params: { caseId },
      accessToken: doctor.accessToken,
    });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('review.finalize.ai_summary_passthrough');
  });

  it('refuses an empty impression', async () => {
    const { doctor, caseId } = await submittedCase();
    const response = await call(saveReview, {
      method: 'PUT',
      body: validReview({ clinicalImpression: 'ok', finalize: true }),
      params: { caseId },
      accessToken: doctor.accessToken,
    });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('review.finalize.doctor_content_required');
  });

  it.each([
    ['a drug name', { recommendedNextSteps: ['Start omeprazole and review in four weeks'] }],
    ['a dose', { patientFacingSummary: 'Please take an acid tablet 40 mg each morning before food.' }],
    ['a regimen', { clinicalImpression: 'Upper GI bleeding. Commence triple therapy after endoscopy today.' }],
  ])('refuses %s anywhere in the release', async (_name, overrides) => {
    const { doctor, caseId } = await submittedCase();
    const response = await call(saveReview, {
      method: 'PUT',
      body: validReview({ ...overrides, finalize: true }),
      params: { caseId },
      accessToken: doctor.accessToken,
    });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('review.finalize.contains_treatment');
  });

  it('accepts a genuinely doctor-authored finalization', async () => {
    const { doctor, caseId } = await submittedCase();
    const response = await call(saveReview, {
      method: 'PUT',
      body: validReview({ finalize: true }),
      params: { caseId },
      accessToken: doctor.accessToken,
    });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('finalized');
  });
});

describe('release', () => {
  const confirmedContent = {
    summary:
      'Based on what you told us, you need to be seen urgently for a camera test of your stomach.',
    nextSteps: ['Attend the endoscopy appointment we arrange', 'Return sooner if you feel faint'],
  };

  it('refuses before the review is finalized', async () => {
    const { doctor, caseId } = await submittedCase();
    await call(saveReview, {
      method: 'PUT',
      body: validReview(),
      params: { caseId },
      accessToken: doctor.accessToken,
    });

    const response = await call(releaseReview, {
      method: 'POST',
      body: { confirmedContent, confirm: true },
      params: { caseId },
      accessToken: doctor.accessToken,
    });
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('review.release.not_finalized');
  });

  it('refuses without the explicit confirmation flag', async () => {
    const { doctor, caseId } = await submittedCase();
    await call(saveReview, {
      method: 'PUT',
      body: validReview({ finalize: true }),
      params: { caseId },
      accessToken: doctor.accessToken,
    });

    const response = await call(releaseReview, {
      method: 'POST',
      body: { confirmedContent, confirm: false },
      params: { caseId },
      accessToken: doctor.accessToken,
    });
    expect(response.status).toBe(400);
  });

  it('does not release as a side effect of finalizing', async () => {
    const { patient, doctor, caseId } = await submittedCase();
    await call(saveReview, {
      method: 'PUT',
      body: validReview({ finalize: true }),
      params: { caseId },
      accessToken: doctor.accessToken,
    });

    const summary = await call(patientSummary, { params: { caseId }, accessToken: patient.accessToken });
    expect(summary.body.released).toBe(false);
    expect(summary.body).not.toHaveProperty('content');
  });

  it('releases the confirmed content and makes it readable to the patient', async () => {
    const { patient, doctor, caseId } = await submittedCase();
    await call(saveReview, {
      method: 'PUT',
      body: validReview({ finalize: true }),
      params: { caseId },
      accessToken: doctor.accessToken,
    });

    const released = await call(releaseReview, {
      method: 'POST',
      body: { confirmedContent, confirm: true },
      params: { caseId },
      accessToken: doctor.accessToken,
    });
    expect(released.status).toBe(200);

    const summary = await call(patientSummary, { params: { caseId }, accessToken: patient.accessToken });
    expect(summary.body.released).toBe(true);
    const content = summary.body.content as { summary: string; standingNotice: string };
    expect(content.summary).toBe(confirmedContent.summary);
    expect(content.standingNotice).toContain('not a final diagnosis');
  });

  it('freezes exactly what was confirmed, not whatever the draft later says', async () => {
    const { doctor, caseId } = await submittedCase();
    await call(saveReview, {
      method: 'PUT',
      body: validReview({ finalize: true }),
      params: { caseId },
      accessToken: doctor.accessToken,
    });
    await call(releaseReview, {
      method: 'POST',
      body: { confirmedContent, confirm: true },
      params: { caseId },
      accessToken: doctor.accessToken,
    });

    const [review] = await database().select().from(clinicalTables.doctorReviews);
    const stored = review?.releasedContent as { summary: string };
    expect(stored.summary).toBe(confirmedContent.summary);
    expect(review?.releasedBy).toBe(doctor.id);
    expect(review?.releasedAt).not.toBeNull();
  });

  it('refuses a second release', async () => {
    const { doctor, caseId } = await submittedCase();
    await call(saveReview, {
      method: 'PUT',
      body: validReview({ finalize: true }),
      params: { caseId },
      accessToken: doctor.accessToken,
    });
    await call(releaseReview, {
      method: 'POST',
      body: { confirmedContent, confirm: true },
      params: { caseId },
      accessToken: doctor.accessToken,
    });

    const second = await call(releaseReview, {
      method: 'POST',
      body: { confirmedContent, confirm: true },
      params: { caseId },
      accessToken: doctor.accessToken,
    });
    expect(second.status).toBe(409);
    expect(second.body.messageKey).toBe('review.release.already_released');
  });

  it('notifies the patient without putting anything clinical in the message', async () => {
    const { patient, doctor, caseId } = await submittedCase();
    await call(saveReview, {
      method: 'PUT',
      body: validReview({ finalize: true }),
      params: { caseId },
      accessToken: doctor.accessToken,
    });
    await call(releaseReview, {
      method: 'POST',
      body: { confirmedContent, confirm: true },
      params: { caseId },
      accessToken: doctor.accessToken,
    });

    const { tables } = await import('./api-harness');
    const deliveries = await database()
      .select()
      .from(tables.notificationDeliveries)
      .where(eq(tables.notificationDeliveries.userId, patient.id));
    const release = deliveries.find((row) => row.type === 'case_released');

    expect(release).toBeDefined();
    expect(JSON.stringify(release)).not.toContain('endoscopy');
    expect(JSON.stringify(release)).not.toContain('ulcer');
  });
});

describe('the AI assessment never reaches the patient', () => {
  it('is absent from the patient summary even after release', async () => {
    const { patient, doctor, caseId } = await submittedCase();
    await call(saveReview, {
      method: 'PUT',
      body: validReview({ finalize: true }),
      params: { caseId },
      accessToken: doctor.accessToken,
    });
    await call(releaseReview, {
      method: 'POST',
      body: {
        confirmedContent: {
          summary: 'You need to be seen urgently for a camera test of your stomach.',
          nextSteps: ['Attend the appointment we arrange'],
        },
        confirm: true,
      },
      params: { caseId },
      accessToken: doctor.accessToken,
    });

    const summary = await call(patientSummary, { params: { caseId }, accessToken: patient.accessToken });
    const serialized = JSON.stringify(summary.body);

    expect(serialized).not.toContain(AI_CLINICIAN_SUMMARY);
    expect(serialized).not.toContain('differential_assessment');
    expect(serialized).not.toContain('model_version');
  });

  it('is refused outright when a patient asks for the doctor case view', async () => {
    const { patient, caseId } = await submittedCase();
    const response = await call(doctorCase, { params: { caseId }, accessToken: patient.accessToken });
    expect(response.status).toBe(403);
  });
});
