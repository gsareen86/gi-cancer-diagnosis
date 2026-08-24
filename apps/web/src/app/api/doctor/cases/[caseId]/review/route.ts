import { z } from 'zod';
import { clinical } from '@/server/db';
import { accessContext, jsonBody, route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';
import { findProhibitedTreatmentContent } from '@gi-compass/core';

/**
 * The doctor's working review.
 *
 * The AI assessment is never edited: the doctor's version lives here beside it, and every
 * override is recorded as a diff so systematic model error becomes visible when the clinical
 * team reviews disagreements.
 */

const differentialItem = z.object({
  condition: z.string().min(1).max(200),
  likelihood: z.enum(['high', 'moderate', 'low']),
  rationale: z.string().max(2000).optional(),
  /** Distinguishes what the doctor added from what they kept. */
  origin: z.enum(['ai', 'doctor']),
  rejected: z.boolean().default(false),
  rejectionReason: z.string().max(1000).optional(),
});

const diff = z.object({
  action: z.enum([
    'likelihood_changed',
    'item_added',
    'item_removed',
    'item_rejected',
    'next_steps_changed',
  ]),
  conditionId: z.string().max(200).optional(),
  beforeValue: z.unknown().optional(),
  afterValue: z.unknown().optional(),
  rationale: z.string().max(2000).optional(),
});

const body = z.object({
  differential: z.array(differentialItem).max(12),
  /** Investigations, referral urgency, whether an in-person visit is needed. */
  recommendedNextSteps: z.array(z.string().min(1).max(500)).max(12),
  clinicalImpression: z.string().max(6000),
  doctorNotes: z.string().max(6000).optional(),
  patientFacingSummary: z.string().max(6000),
  diffs: z.array(diff).max(50).default([]),
  modelVersion: z.string().default('none'),
  promptVersion: z.string().default('none'),
  kbVersion: z.string().default('none'),
  finalize: z.boolean().default(false),
});

export const PUT = route<{ caseId: string }>({ roles: ['doctor'] }, async ({ request, params, session, metadata }) => {
  const input = await jsonBody(request, body);
  const repo = clinical();

  const resolved = await repo.resolveCaseForSystem(params.caseId);
  if (resolved === null) return problem('not_found', 'error.not_found');

  const context = accessContext(session, resolved.patientId, 'share_with_assigned_doctor', metadata);
  const assessment = await repo.getLatestAssessment(context, params.caseId);
  const review = await repo.openReview(context, params.caseId, session.userId, assessment?.id ?? null);
  if (!review) return problem('internal', 'error.internal');

  if (input.finalize) {
    const guard = finalizationGuard(input, assessment?.payload ?? null);
    if (guard !== null) return guard;
  }

  const finalSummary = {
    differential: input.differential,
    recommendedNextSteps: input.recommendedNextSteps,
    clinicalImpression: input.clinicalImpression,
    patientFacingSummary: input.patientFacingSummary,
  };

  await repo.saveReviewDraft(context, {
    caseId: params.caseId,
    reviewId: review.id,
    finalSummary,
    doctorNotes: input.doctorNotes ?? null,
    diffs: input.diffs.map((entry) => ({
      action: entry.action,
      conditionId: entry.conditionId ?? null,
      beforeValue: entry.beforeValue ?? null,
      afterValue: entry.afterValue ?? null,
      rationale: entry.rationale ?? null,
      modelVersion: assessment?.modelVersion ?? input.modelVersion,
      promptVersion: assessment?.promptVersion ?? input.promptVersion,
      kbVersion: assessment?.kbVersion ?? input.kbVersion,
    })),
  });

  if (input.finalize) {
    const finalized = await repo.finalizeReview(context, params.caseId, review.id);
    return ok({ status: 'finalized', reviewId: finalized?.id ?? review.id });
  }

  return ok({ status: 'saved', reviewId: review.id });
});

/**
 * Refuses a finalization that is not actually the doctor's own work.
 *
 * Two checks. The released summary may not be the AI's `clinician_summary` passed through
 * untouched — the whole point of the review gate is that a person read the case and formed a
 * view. And no medication or dose may appear anywhere in it: prescribing is entirely outside
 * this path, authored by the doctor in their own system.
 */
function finalizationGuard(
  input: z.infer<typeof body>,
  assessmentPayload: unknown,
): ReturnType<typeof problem> | null {
  const impression = input.clinicalImpression.trim();
  const patientFacing = input.patientFacingSummary.trim();

  if (impression.length < 20 || patientFacing.length < 20) {
    return problem('invalid_request', 'review.finalize.doctor_content_required');
  }

  const aiSummary =
    assessmentPayload !== null && typeof assessmentPayload === 'object'
      ? String((assessmentPayload as Record<string, unknown>).clinician_summary ?? '')
      : '';

  if (aiSummary.length > 0) {
    const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();
    if (normalize(impression) === normalize(aiSummary) || normalize(patientFacing) === normalize(aiSummary)) {
      return problem('invalid_request', 'review.finalize.ai_summary_passthrough');
    }
  }

  const prohibited = findProhibitedTreatmentContent({
    clinicalImpression: input.clinicalImpression,
    patientFacingSummary: input.patientFacingSummary,
    recommendedNextSteps: input.recommendedNextSteps,
  });
  if (prohibited.length > 0) {
    return problem('invalid_request', 'review.finalize.contains_treatment', {
      findings: prohibited,
    });
  }

  return null;
}
