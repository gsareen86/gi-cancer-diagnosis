import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  call,
  clinicalTables,
  ensureSeeded,
  grantConsents,
  makeUser,
  truncateAll,
  withdrawConsent,
  type TestUser,
} from './api-harness';
import { database } from '@/server/db';
import { MANDATORY_DISCLAIMER } from '@gi-compass/core';
import { systemContext } from '@gi-compass/db';
import { clinical } from '@/server/db';
import {
  httpTransport,
  requestAssessment,
  setAiTransport,
  type AiTransport,
} from '@/server/services/assessment-service';
import { POST as generateAssessment } from '@/app/api/doctor/cases/[caseId]/assessment/route';
import { POST as createCase } from '@/app/api/cases/route';
import { PUT as putAnswer } from '@/app/api/cases/[caseId]/answers/route';

/**
 * Asking for an AI analysis from the review screen.
 *
 * The automatic run after submission is fire-and-forget. When it failed — most often because the
 * AI service was not running — the doctor was left with an empty panel, no way to ask again, and
 * nothing distinguishing "the service was down" from "the patient declined AI analysis". Both
 * halves of that are covered here.
 */

beforeAll(ensureSeeded);
beforeEach(truncateAll);
afterEach(() => {
  setAiTransport(httpTransport);
  vi.unstubAllEnvs();
});
afterAll(truncateAll);

const ALL_CONSENTS = ['account_processing', 'ai_assisted_analysis', 'share_with_assigned_doctor'] as const;

function conforming(caseId: string) {
  return {
    case_id: caseId,
    model_version: 'test-model',
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
    clinician_summary: 'Adult reporting melaena. Warrants urgent upper GI evaluation.',
    disclaimer: MANDATORY_DISCLAIMER,
  };
}

function transportReturning(assessment: unknown): AiTransport {
  return {
    async generate() {
      return {
        assessment,
        modelVersion: 'test-model',
        kbVersion: 'kb-seed-1',
        retrievedChunkIds: [],
        grounded: false,
      };
    },
  };
}

/** A case sitting in review, exactly where a doctor would press the button. */
async function caseInReview(
  consents: readonly (typeof ALL_CONSENTS)[number][] = ALL_CONSENTS,
): Promise<{ patient: TestUser; doctor: TestUser; caseId: string }> {
  const doctor = await makeUser({ role: 'doctor' });
  const patient = await makeUser({ role: 'patient' });
  await grantConsents(patient.id, consents);

  const created = await call(createCase, {
    method: 'POST',
    body: { entryPointId: 'ep_bleeding' },
    accessToken: patient.accessToken,
  });
  const caseId = (created.body.case as { id: string }).id;

  for (const [questionId, optionId] of [
    ['blood_in_stool', 'yes'],
    ['blood_appearance', 'black_tarry'],
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
  await repo.transitionCase(context, caseId, 'in_review');

  return { patient, doctor, caseId };
}

describe('generating an analysis on demand', () => {
  it('produces one for a case already in review, without disturbing its status', async () => {
    const { doctor, caseId } = await caseInReview();
    setAiTransport(transportReturning(conforming(caseId)));

    const response = await call(generateAssessment, {
      method: 'POST',
      params: { caseId },
      accessToken: doctor.accessToken,
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('generated');

    const [stored] = await database().select().from(clinicalTables.aiAssessments);
    expect(stored?.outcome).toBe('ungrounded');

    // The case is where the doctor left it. How many times the model ran is not a fact about
    // where a case sits in its lifecycle, and `in_review -> ai_processing` is not a legal move.
    const [caseRow] = await database().select().from(clinicalTables.cases);
    expect(caseRow?.status).toBe('in_review');
  });

  it('can be run again, keeping every attempt', async () => {
    const { doctor, caseId } = await caseInReview();
    setAiTransport(transportReturning(conforming(caseId)));

    await call(generateAssessment, { method: 'POST', params: { caseId }, accessToken: doctor.accessToken });
    await call(generateAssessment, { method: 'POST', params: { caseId }, accessToken: doctor.accessToken });

    const stored = await database().select().from(clinicalTables.aiAssessments);
    expect(stored).toHaveLength(2);
  });

  it('still refuses a response that breaks the schema, and saves nothing', async () => {
    const { doctor, caseId } = await caseInReview();
    // Every guarantee of the automatic run applies, because it is the same code path.
    setAiTransport(transportReturning({ ...conforming(caseId), final_diagnosis: 'Peptic ulcer disease' }));

    const response = await call(generateAssessment, {
      method: 'POST',
      params: { caseId },
      accessToken: doctor.accessToken,
    });

    expect(response.status).toBe(503);
    const stored = await database().select().from(clinicalTables.aiAssessments);
    expect(stored.every((row) => row.payload === null)).toBe(true);
  });
});

describe('who may ask', () => {
  it('refuses a doctor who is not assigned to the case', async () => {
    const { caseId } = await caseInReview();
    const other = await makeUser({ role: 'doctor' });
    setAiTransport(transportReturning(conforming(caseId)));

    const response = await call(generateAssessment, {
      method: 'POST',
      params: { caseId },
      accessToken: other.accessToken,
    });
    expect(response.status).toBe(404);
  });

  it('refuses a patient asking for their own case', async () => {
    const { patient, caseId } = await caseInReview();
    const response = await call(generateAssessment, {
      method: 'POST',
      params: { caseId },
      accessToken: patient.accessToken,
    });
    expect(response.status).toBe(403);
  });
});

describe('when it cannot be produced', () => {
  it('says the patient did not consent, rather than reporting a failure', async () => {
    const { patient, doctor, caseId } = await caseInReview();
    await withdrawConsent(patient.id, 'ai_assisted_analysis');

    const generate = vi.fn();
    setAiTransport({
      generate: async (payload) => {
        generate(payload);
        throw new Error('the transport must never be called');
      },
    });

    const response = await call(generateAssessment, {
      method: 'POST',
      params: { caseId },
      accessToken: doctor.accessToken,
    });

    expect(response.body.messageKey).toBe('doctor.assessment.not_consented');
    // No clinical content left the platform.
    expect(generate).not.toHaveBeenCalled();
  });

  it('names an unreachable AI service, so the doctor knows it is worth retrying', async () => {
    const { doctor, caseId } = await caseInReview();
    setAiTransport({
      async generate() {
        throw new Error('fetch failed');
      },
    });

    const response = await call(generateAssessment, {
      method: 'POST',
      params: { caseId },
      accessToken: doctor.accessToken,
    });

    expect(response.status).toBe(503);
    expect(response.body.messageKey).toBe('doctor.assessment.ai_service_unreachable');

    const [stored] = await database().select().from(clinicalTables.aiAssessments);
    // Recorded, so the reason survives a page reload instead of living only in a toast.
    expect(stored?.failureReason).toBe('ai_service_unreachable');
  });

  it.each([
    ['AI_SERVICE_URL is not configured', 'ai_service_not_configured'],
    ['AI service responded 401', 'ai_service_unauthorised'],
    ['AI service responded 502', 'model_unavailable'],
  ])('distinguishes %s', async (message, expected) => {
    const { doctor, caseId } = await caseInReview();
    setAiTransport({
      async generate() {
        throw new Error(message);
      },
    });

    const response = await call(generateAssessment, {
      method: 'POST',
      params: { caseId },
      accessToken: doctor.accessToken,
    });
    expect(response.body.messageKey).toBe(`doctor.assessment.${expected}`);
  });
});

describe('the automatic run after submission still drives the case forward', () => {
  it('moves a submitted case to ai_processed', async () => {
    const doctor = await makeUser({ role: 'doctor' });
    void doctor;
    const patient = await makeUser({ role: 'patient' });
    await grantConsents(patient.id, ALL_CONSENTS);

    const created = await call(createCase, {
      method: 'POST',
      body: { entryPointId: 'ep_bleeding' },
      accessToken: patient.accessToken,
    });
    const caseId = (created.body.case as { id: string }).id;

    await clinical().transitionCase(
      systemContext(patient.id, 'account_processing'),
      caseId,
      'submitted',
      { submittedAt: new Date() },
    );

    setAiTransport(transportReturning(conforming(caseId)));
    await requestAssessment(caseId);

    const [caseRow] = await database().select().from(clinicalTables.cases);
    expect(caseRow?.status).toBe('ai_processed');
  });
});
