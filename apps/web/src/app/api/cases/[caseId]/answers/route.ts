import { z } from 'zod';
import { submitAnswer } from '@/server/services/interview-service';
import { loadProfile } from '@/server/auth/accounts';
import { ageInYears } from '@/server/services/age';
import { clinical } from '@/server/db';
import { accessContext, jsonBody, route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';

const body = z.object({
  questionId: z.string().min(1).max(128),
  value: z.unknown(),
});

/**
 * Records one answer.
 *
 * Validation, persistence, red-flag evaluation, and the next question all happen in this one
 * request. The response carries any emergency advisory directly, so the interface can interrupt
 * the interview without a second round trip — and without waiting on the AI pipeline, which is
 * not involved here at all.
 */
export const PUT = route<{ caseId: string }>({ roles: ['patient'] }, async ({ request, params, session, metadata }) => {
  const input = await jsonBody(request, body);
  const context = accessContext(session, session.userId, 'account_processing', metadata);

  const caseRecord = await clinical().getCase(context, params.caseId);
  if (!caseRecord) return problem('not_found', 'error.not_found');
  if (caseRecord.status !== 'in_progress') {
    // Once submitted, the answers are a clinical record. Changing one goes through the
    // data-subject correction process, which preserves the original.
    return problem('conflict', 'case.answers.not_editable');
  }

  const profile = await loadProfile(session.userId);
  const result = await submitAnswer({
    context,
    caseRecord: {
      id: caseRecord.id,
      status: caseRecord.status,
      templateVersionId: caseRecord.templateVersionId,
      entryPointId: caseRecord.entryPointId,
      patientId: caseRecord.patientId,
    },
    questionId: input.questionId,
    rawValue: input.value,
    locale: profile?.locale ?? 'en',
    ageYears: ageInYears(profile?.dateOfBirth ?? null),
  });

  if (result.status === 'rejected') {
    const rejection = result.rejection.ok ? null : result.rejection.rejection;
    return problem('invalid_request', 'case.answers.rejected', rejection);
  }

  return ok({
    ...result.view,
    newlyTriggeredRuleIds: result.newlyTriggered.map((flag) => flag.ruleId),
  });
});
