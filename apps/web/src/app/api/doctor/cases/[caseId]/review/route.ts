import { z } from 'zod';
import { clinical } from '@/server/db';
import { accessContext, jsonBody, route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';

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
  origin: z.enum(['ai', 'doctor']),
  rejected: z.boolean().default(false),
  rejectionReason: z.string().max(1000).optional(),
});

const diff = z.object({
  action: z.enum(['likelihood_changed', 'item_added', 'item_removed', 'item_rejected', 'next_steps_changed']),
  conditionId: z.string().max(200).optional(),
  beforeValue: z.unknown().optional(),
  afterValue: z.unknown().optional(),
  rationale: z.string().max(2000).optional(),
});

const referralUrgency = z.enum(['emergency', 'within_week', 'routine', 'none']);

const body = z.object({
  expectedRevision: z.number().int().nonnegative().default(0),
  differential: z.array(differentialItem).max(12),
  /** Physician-approved guidance released with the finalized summary. */
  recommendedNextSteps: z.array(z.string().min(1).max(4000)).max(12),
  clinicalImpression: z.string().max(6000),
  doctorNotes: z.string().max(6000).optional(),
  patientFacingSummary: z.string().max(6000),
  /** The doctor's own conclusion — the only artefact in this system permitted to state one. */
  diagnosis: z.string().max(2000).default(''),
  dietaryAdvice: z.string().max(4000).default(''),
  precautions: z.string().max(4000).default(''),
  referralUrgency: referralUrgency.default('routine'),
  followUpInterval: z.string().max(500).default(''),
  prescriptionInstructions: z.string().max(4000).default(''),
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
    const guard = finalizationGuard(input);
    if (guard !== null) return guard;
  }

  const finalSummary = {
    differential: input.differential,
    recommendedNextSteps: input.recommendedNextSteps,
    clinicalImpression: input.clinicalImpression,
    patientFacingSummary: input.patientFacingSummary,
    diagnosis: input.diagnosis,
    dietaryAdvice: input.dietaryAdvice,
    precautions: input.precautions,
    referralUrgency: input.referralUrgency,
    followUpInterval: input.followUpInterval,
    prescriptionInstructions: input.prescriptionInstructions,
  };

  const updated = await repo.saveReviewDraft(context, {
    caseId: params.caseId,
    reviewId: review.id,
    expectedRevision: input.expectedRevision,
    finalSummary,
    doctorNotes: input.doctorNotes ?? null,
    finalize: input.finalize,
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

  // Draft content and its approval are written together: a concurrent browser tab cannot
  // replace the notes between a save and a separate finalization transaction.
  return ok({ status: input.finalize ? 'finalized' : 'saved', reviewId: review.id, draftRevision: updated?.draftRevision });
});

/** A physician must finalize substantive content before the separate release action. */
function finalizationGuard(
  input: z.infer<typeof body>,
): ReturnType<typeof problem> | null {
  const impression = input.clinicalImpression.trim();
  const patientFacing = input.patientFacingSummary.trim();

  if (impression.length < 20 || patientFacing.length < 20) {
    return problem('invalid_request', 'review.finalize.doctor_content_required');
  }

  // The authenticated physician may adopt an AI draft and author prescriptions. Finalization
  // records their approval; only a separate, content-matched release exposes it to the patient.
  return null;
}
