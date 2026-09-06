import { z } from 'zod';
import { clinical } from '@/server/db';
import { queueNotification } from '@/server/services/notification-service';
import { accessContext, jsonBody, route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';

const body = z.object({
  /** Echoed from confirmation, then compared against the finalized review. */
  confirmedContent: z.object({
    summary: z.string().min(20).max(6000),
    nextSteps: z.array(z.string().min(1).max(4000)).max(12),
    diagnosis: z.string().max(2000).optional(),
    dietaryAdvice: z.string().max(4000).optional(),
    precautions: z.string().max(4000).optional(),
    referralUrgency: z.enum(['emergency', 'within_week', 'routine', 'none']).optional(),
    followUpInterval: z.string().max(500).optional(),
    prescriptionInstructions: z.string().max(4000).optional(),
  }),
  confirm: z.literal(true),
});

/**
 * Releases the doctor-authored summary to the patient.
 *
 * Deliberate and confirmed, never automatic. There is no timer, no side effect of finalization,
 * and no other endpoint that makes clinical content patient-visible. The exact released text is
 * frozen here so what the patient saw stays recoverable even if the doctor later revises notes.
 */
export const POST = route<{ caseId: string }>({ roles: ['doctor'] }, async ({ request, params, session, metadata }) => {
  const input = await jsonBody(request, body);
  const repo = clinical();

  const resolved = await repo.resolveCaseForSystem(params.caseId);
  if (resolved === null) return problem('not_found', 'error.not_found');

  const context = accessContext(session, resolved.patientId, 'share_with_assigned_doctor', metadata);
  const review = await repo.getReview(context, params.caseId);

  if (!review) return problem('not_found', 'review.release.no_review');
  if (review.status === 'released') {
    return problem('conflict', 'review.release.already_released');
  }
  if (review.status !== 'finalized') {
    // Finalizing is where the physician approves the content. Releasing
    // before that would route around both.
    return problem('conflict', 'review.release.not_finalized');
  }

  const final = review.finalSummary as Record<string, unknown> | null;
  const confirmed = input.confirmedContent;
  const fields = ['diagnosis', 'dietaryAdvice', 'precautions', 'referralUrgency', 'followUpInterval', 'prescriptionInstructions'] as const;
  if (!final || confirmed.summary !== final.patientFacingSummary ||
      JSON.stringify(confirmed.nextSteps) !== JSON.stringify(final.recommendedNextSteps) ||
      fields.some((field) => (confirmed[field] ?? (field === 'referralUrgency' ? 'routine' : '')) !==
        (final[field] ?? (field === 'referralUrgency' ? 'routine' : '')))) {
    return problem('conflict', 'review.release.content_changed');
  }

  const released = await repo.releaseReview(context, {
    caseId: params.caseId,
    reviewId: review.id,
    expectedFinalSummary: review.finalSummary,
    releasedContent: {
      summary: input.confirmedContent.summary,
      nextSteps: input.confirmedContent.nextSteps,
      diagnosis: final.diagnosis ?? null,
      dietaryAdvice: final.dietaryAdvice ?? null,
      precautions: final.precautions ?? null,
      referralUrgency: final.referralUrgency ?? null,
      followUpInterval: final.followUpInterval ?? null,
      prescriptionInstructions: final.prescriptionInstructions ?? null,
      releasedBy: session.userId,
      releasedAt: new Date().toISOString(),
      // Shown to the patient beside the summary: this is a clinical impression from a doctor
      // who has not examined them in person, not a final diagnosis.
      standingNotice:
        'This is the clinical impression of the reviewing doctor based on the information you ' +
        'provided. It is not a final diagnosis and does not replace an in-person examination. ' +
        'If your symptoms change or worsen, seek care in person.',
    },
    releasedBy: session.userId,
  });

  await queueNotification({
    userId: resolved.patientId,
    type: 'case_released',
    reference: params.caseId,
  });

  return ok({ status: 'released', releasedAt: released?.releasedAt ?? null });
});
