import { clinical } from '@/server/db';
import { assessmentFailureKey } from '@/lib/assessment-failure';
import { requestAssessment } from '@/server/services/assessment-service';
import { accessContext, route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';

/**
 * Runs the AI analysis on demand, from the review screen.
 *
 * The pipeline already runs once automatically after submission, but that run is fire-and-forget:
 * if the AI service was down, the doctor was left with no analysis, no way to ask for one, and
 * nothing on screen explaining which of those had happened. This is the retry.
 *
 * It does not move the case through its lifecycle. The case is already in review; how many times
 * the model has run is not a fact about where it sits.
 *
 * Every guarantee the automatic run has still applies, because it is the same code path: the
 * consent check immediately before any clinical content leaves the platform, the fixed schema
 * validated server-side, the bounded retry, and the version pins stored with the result.
 */
export const POST = route<{ caseId: string }>(
  { roles: ['doctor'] },
  async ({ params, session, metadata }) => {
    const repo = clinical();

    const resolved = await repo.resolveCaseForSystem(params.caseId);
    if (resolved === null) return problem('not_found', 'error.not_found');

    // Authorization before anything else: only the assigned doctor may ask for this, and reading
    // the case through the repository is what enforces that.
    const context = accessContext(
      session,
      resolved.patientId,
      'share_with_assigned_doctor',
      metadata,
    );
    const caseRecord = await repo.getCase(context, params.caseId);
    if (caseRecord === null) return problem('not_found', 'error.not_found');

    const outcome = await requestAssessment(params.caseId, { driveCaseStatus: false });

    if (outcome.status === 'skipped') {
      // The patient did not consent, or withdrew. Not an error, and not something a doctor can
      // resolve by trying again.
      return problem('consent_required', 'doctor.assessment.not_consented', {
        reason: outcome.reason,
      });
    }

    if (outcome.status === 'unavailable') {
      return problem('unavailable', assessmentFailureKey(outcome.reason), {
        reason: outcome.reason,
        ...(outcome.rejections === undefined ? {} : { rejections: outcome.rejections }),
      });
    }

    return ok({ status: 'generated', grounded: outcome.grounded });
  },
);
