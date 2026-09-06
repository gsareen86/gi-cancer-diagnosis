import { clinical } from '@/server/db';
import { accessContext, jsonBody, route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';
import { clinicalHistoryInput } from '@/lib/clinical-history';

/**
 * The patient's clinical history for one case.
 *
 * Attached to the case rather than the patient so a signed review always describes the record it
 * was made against — see `openspec/changes/elevate-clinical-workspace/design.md`, decision D6.
 * The repository refuses a write once the case leaves `in_progress`, by the same rule that
 * freezes answers.
 *
 * Both verbs route through the clinical funnel, so both are consent-gated and audited exactly as
 * questionnaire responses are.
 */

export const GET = route<{ caseId: string }>({ roles: ['patient'] }, async ({ params, session, metadata }) => {
  const repo = clinical();
  const context = accessContext(session, session.userId, 'account_processing', metadata);

  const caseRecord = await repo.getCase(context, params.caseId);
  if (caseRecord === null) return problem('not_found', 'error.not_found');

  const history = await repo.getClinicalHistory(context, params.caseId);

  if (history === null) {
    /*
     * Nothing recorded for this case yet. Offer the patient's most recent completed history as a
     * starting point rather than an empty form — someone who declared four comorbidities two
     * months ago should not retype them, and a form that is tedious gets abandoned halfway,
     * which reaches the doctor as an absence rather than as a partial answer.
     *
     * Copied, never linked: `prefill` is a suggestion the patient edits and saves onto *this*
     * case, so the earlier case's record is untouched.
     */
    const prefill = await repo.latestCompletedHistoryFor(context, params.caseId);
    return ok({ history: null, prefill, editable: caseRecord.status === 'in_progress' });
  }

  return ok({
    history: {
      heightCm: history.heightCm,
      weightKg: history.weightKg,
      conditions: history.conditions,
      surgeries: history.surgeries,
      medications: history.medications,
      allergies: history.allergies,
      familyHistory: history.familyHistory,
      lifestyle: history.lifestyle,
      additionalNotes: history.additionalNotes,
      lastMenstrualPeriod: history.lastMenstrualPeriod,
      completedAt: history.completedAt,
    },
    prefill: null,
    editable: caseRecord.status === 'in_progress',
  });
});

export const PUT = route<{ caseId: string }>({ roles: ['patient'] }, async ({ request, params, session, metadata }) => {
  const input = await jsonBody(request, clinicalHistoryInput);
  const repo = clinical();
  const context = accessContext(session, session.userId, 'account_processing', metadata);

  const caseRecord = await repo.getCase(context, params.caseId);
  if (caseRecord === null) return problem('not_found', 'error.not_found');

  const saved = await repo.saveClinicalHistory(context, {
    caseId: params.caseId,
    heightCm: input.heightCm,
    // The column is `numeric`, which the driver reads and writes as a string. Fixing the scale
    // here keeps "70" and "70.00" from round-tripping as different values.
    weightKg: input.weightKg === null ? null : input.weightKg.toFixed(2),
    conditions: input.conditions,
    surgeries: input.surgeries,
    medications: input.medications,
    allergies: input.allergies,
    familyHistory: input.familyHistory,
    lifestyle: input.lifestyle,
    additionalNotes: input.additionalNotes,
    lastMenstrualPeriod: input.lastMenstrualPeriod,
    complete: input.complete,
  });

  return ok({ status: 'saved', completedAt: saved?.completedAt ?? null });
});
