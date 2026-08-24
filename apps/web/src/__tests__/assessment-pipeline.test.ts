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
import {
  httpTransport,
  requestAssessment,
  setAiTransport,
  type AiTransport,
  type AssessmentRequestPayload,
} from '@/server/services/assessment-service';
import { systemContext } from '@gi-compass/db';
import { clinical } from '@/server/db';
import { POST as createCase } from '@/app/api/cases/route';
import { PUT as putAnswer } from '@/app/api/cases/[caseId]/answers/route';

beforeAll(ensureSeeded);
beforeEach(truncateAll);
afterEach(() => setAiTransport(httpTransport));
afterAll(truncateAll);

const ALL_CONSENTS = ['account_processing', 'ai_assisted_analysis', 'share_with_assigned_doctor'] as const;

/** Reads a nested path out of the generated JSON Schema without a tower of casts. */
function walk(value: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>(
    (current, key) =>
      current !== null && typeof current === 'object'
        ? (current as Record<string, unknown>)[key]
        : undefined,
    value,
  );
}

function conformingAssessment(caseId: string, overrides: Record<string, unknown> = {}) {
  return {
    case_id: caseId,
    model_version: 'test-model-1',
    prompt_version: 'assessment-v1',
    kb_version: 'kb-seed-1',
    generated_at: new Date().toISOString(),
    differential_assessment: [
      {
        condition: 'Peptic ulcer disease',
        likelihood: 'moderate',
        supporting_findings: ['Reported black tarry stool with lightheadedness'],
        contradicting_or_atypical_findings: ['No reported weight loss'],
        suggested_confirmatory_steps: ['Upper GI endoscopy'],
      },
    ],
    red_flags: [
      {
        flag: 'Reported pattern consistent with active upper GI bleeding',
        basis: 'Black tarry stool alongside lightheadedness',
        urgency: 'emergency',
      },
    ],
    recommended_next_steps: ['Urgent in-person assessment by a gastroenterologist'],
    clinician_summary:
      'Adult reporting melaena with lightheadedness. Pattern warrants urgent upper GI evaluation.',
    disclaimer: MANDATORY_DISCLAIMER,
    ...overrides,
  };
}

function transportReturning(
  responses: unknown[],
  onCall?: (payload: AssessmentRequestPayload) => void,
): { transport: AiTransport; payloads: AssessmentRequestPayload[] } {
  const payloads: AssessmentRequestPayload[] = [];
  let index = 0;
  const transport: AiTransport = {
    async generate(payload) {
      payloads.push(payload);
      onCall?.(payload);
      const assessment = responses[Math.min(index, responses.length - 1)];
      index += 1;
      return {
        assessment,
        modelVersion: 'test-model-1',
        kbVersion: 'kb-seed-1',
        retrievedChunkIds: ['chunk-a'],
        grounded: true,
      };
    },
  };
  return { transport, payloads };
}

async function submittedCase(
  consents: readonly (typeof ALL_CONSENTS)[number][] = ALL_CONSENTS,
): Promise<{ patient: TestUser; caseId: string }> {
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
    ['lightheaded', 'yes'],
  ] as const) {
    await call(putAnswer, {
      method: 'PUT',
      body: { questionId, value: { kind: 'single_select', optionId } },
      params: { caseId },
      accessToken: patient.accessToken,
    });
  }

  await clinical().transitionCase(
    systemContext(patient.id, 'account_processing'),
    caseId,
    'submitted',
    { submittedAt: new Date() },
  );
  return { patient, caseId };
}

describe('a conforming response', () => {
  it('is stored with its version pins and grounding', async () => {
    const { caseId } = await submittedCase();
    const { transport } = transportReturning([conformingAssessment(caseId)]);
    setAiTransport(transport);

    const outcome = await requestAssessment(caseId);
    expect(outcome.status).toBe('generated');

    const [stored] = await database().select().from(clinicalTables.aiAssessments);
    expect(stored?.outcome).toBe('generated');
    expect(stored?.modelVersion).toBe('test-model-1');
    expect(stored?.promptVersion).toBe('assessment-v1');
    expect(stored?.kbVersion).toBe('kb-seed-1');
    expect(stored?.retrievedChunkIds).toEqual(['chunk-a']);
  });

  it('always carries the mandatory disclaimer, whatever the model sent', async () => {
    const { caseId } = await submittedCase();
    const { transport } = transportReturning([conformingAssessment(caseId)]);
    setAiTransport(transport);
    await requestAssessment(caseId);

    const [stored] = await database().select().from(clinicalTables.aiAssessments);
    const payload = stored?.payload as { disclaimer: string };
    expect(payload.disclaimer).toBe(MANDATORY_DISCLAIMER);
    expect(payload.disclaimer).toContain('not a medical diagnosis');
  });

  it('moves the case to ai_processed', async () => {
    const { caseId } = await submittedCase();
    setAiTransport(transportReturning([conformingAssessment(caseId)]).transport);
    await requestAssessment(caseId);

    const [row] = await database().select().from(clinicalTables.cases);
    expect(row?.status).toBe('ai_processed');
  });
});

describe('what the model is told', () => {
  it('receives a deterministic clinical summary distinguishing denial from silence', async () => {
    const { caseId } = await submittedCase();
    const { transport, payloads } = transportReturning([conformingAssessment(caseId)]);
    setAiTransport(transport);
    await requestAssessment(caseId);

    const summary = payloads[0]!.clinicalSummary;
    expect(summary.presentFindings.join(' ')).toContain('Black, sticky and tar-like');
    expect(summary.narrative).toContain('unknown, not as absent');
  });

  it('is told the red flags are not its to raise, lower, or suppress', async () => {
    const { caseId } = await submittedCase();
    const { transport, payloads } = transportReturning([conformingAssessment(caseId)]);
    setAiTransport(transport);
    await requestAssessment(caseId);

    expect(payloads[0]!.clinicalSummary.narrative).toMatch(
      /not yours to raise, lower, or suppress/i,
    );
  });

  it('is given the exact permitted vocabulary as an enum, not left to guess', async () => {
    const { caseId } = await submittedCase();
    const { transport, payloads } = transportReturning([conformingAssessment(caseId)]);
    setAiTransport(transport);
    await requestAssessment(caseId);

    const conditions = walk(payloads[0]!.outputSchema, [
      'properties',
      'differential_assessment',
      'items',
      'properties',
      'condition',
      'enum',
    ]) as string[];
    expect(conditions).toContain('Peptic ulcer disease');
    expect(conditions).toContain('Features that require urgent specialist review to exclude GI malignancy');
    expect(conditions).not.toContain('Gastric carcinoma');
  });

  it('offers no field for a final diagnosis', async () => {
    const { caseId } = await submittedCase();
    const { transport, payloads } = transportReturning([conformingAssessment(caseId)]);
    setAiTransport(transport);
    await requestAssessment(caseId);

    const schema = payloads[0]!.outputSchema as { properties: Record<string, unknown> };
    expect(Object.keys(schema.properties).some((key) => key.includes('diagnosis'))).toBe(false);
  });
});

describe('a non-conforming response is retried, never repaired', () => {
  it.each([
    ['an extra final_diagnosis field', { final_diagnosis: 'Peptic ulcer disease' }],
    ['a missing required field', { kb_version: undefined }],
    ['an off-taxonomy condition', {
      differential_assessment: [
        {
          condition: 'Acute intermittent porphyria',
          likelihood: 'low',
          supporting_findings: ['Something the model invented'],
          contradicting_or_atypical_findings: [],
          suggested_confirmatory_steps: [],
        },
      ],
    }],
    ['a medication in the next steps', { recommended_next_steps: ['Start omeprazole 40 mg daily'] }],
    ['a reworded disclaimer', { disclaimer: 'AI generated, please see a doctor.' }],
  ])('rejects %s and retries', async (_name, override) => {
    const { caseId } = await submittedCase();
    const bad = conformingAssessment(caseId, override);
    if ('kb_version' in override) delete (bad as Record<string, unknown>).kb_version;

    const { transport, payloads } = transportReturning([bad, conformingAssessment(caseId)]);
    setAiTransport(transport);

    const outcome = await requestAssessment(caseId);
    expect(outcome.status).toBe('generated');
    expect(payloads.length).toBeGreaterThanOrEqual(2);
    // The retry carries the specific violations so the reminder can be precise.
    expect(payloads[1]!.previousRejections).toBeDefined();
  });

  it('never persists the rejected content', async () => {
    const { caseId } = await submittedCase();
    const bad = conformingAssessment(caseId, { final_diagnosis: 'Peptic ulcer disease' });
    setAiTransport(transportReturning([bad, conformingAssessment(caseId)]).transport);
    await requestAssessment(caseId);

    const rows = await database().select().from(clinicalTables.aiAssessments);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0]?.payload)).not.toContain('final_diagnosis');
  });

  it('routes to the doctor marked unavailable once the retry budget is spent', async () => {
    const { caseId } = await submittedCase();
    const bad = conformingAssessment(caseId, { final_diagnosis: 'anything' });
    const { transport, payloads } = transportReturning([bad, bad, bad, bad]);
    setAiTransport(transport);

    const outcome = await requestAssessment(caseId);
    expect(outcome.status).toBe('unavailable');
    expect(payloads).toHaveLength(3);

    const [stored] = await database().select().from(clinicalTables.aiAssessments);
    expect(stored?.outcome).toBe('unavailable');
    expect(stored?.payload).toBeNull();
    expect(stored?.failureReason).toBe('schema_violations_exhausted');

    // The case still reaches the doctor: a missing assessment is a worse review, not no review.
    const [row] = await database().select().from(clinicalTables.cases);
    expect(row?.status).toBe('ai_processed');
  });

  it('handles a provider outage the same way', async () => {
    const { caseId } = await submittedCase();
    setAiTransport({
      async generate() {
        throw new Error('provider unreachable');
      },
    });

    const outcome = await requestAssessment(caseId);
    expect(outcome.status).toBe('unavailable');

    const [stored] = await database().select().from(clinicalTables.aiAssessments);
    expect(stored?.failureReason).toBe('provider_error');
  });
});

describe('consent gates the egress', () => {
  it('sends nothing to the provider when AI consent was withdrawn after submission', async () => {
    const { patient, caseId } = await submittedCase();
    await withdrawConsent(patient.id, 'ai_assisted_analysis');

    const generate = vi.fn();
    setAiTransport({
      generate: async (payload) => {
        generate(payload);
        throw new Error('the transport must never be called');
      },
    });

    const outcome = await requestAssessment(caseId);
    expect(outcome.status).toBe('skipped');
    expect(generate).not.toHaveBeenCalled();

    const [row] = await database().select().from(clinicalTables.cases);
    expect(row?.status).toBe('ai_skipped');
    expect(row?.aiSkipReason).toContain('withdrawn');
  });

  it('leaves no assessment row behind when it skips', async () => {
    const { patient, caseId } = await submittedCase();
    await withdrawConsent(patient.id, 'ai_assisted_analysis');
    setAiTransport({
      async generate() {
        throw new Error('the transport must never be called');
      },
    });

    await requestAssessment(caseId);
    expect(await database().select().from(clinicalTables.aiAssessments)).toEqual([]);
  });
});

describe('audit', () => {
  it('records the generation with its versions and no clinical content', async () => {
    const { caseId } = await submittedCase();
    setAiTransport(transportReturning([conformingAssessment(caseId)]).transport);
    await requestAssessment(caseId);

    const { auditRows } = await import('./api-harness');
    const rows = await auditRows();
    const write = rows.find((row) => row.action === 'assessment.write');

    expect(write).toBeDefined();
    expect(write?.actorRole).toBe('system');
    expect((write?.metadata as Record<string, unknown>).modelVersion).toBe('test-model-1');
    expect(JSON.stringify(rows)).not.toContain('melaena with lightheadedness');
  });
});
