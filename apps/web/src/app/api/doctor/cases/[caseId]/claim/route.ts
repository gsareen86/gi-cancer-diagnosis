import { clinical } from '@/server/db';
import { queueNotification } from '@/server/services/notification-service';
import { accessContext, route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';

/**
 * Takes responsibility for an unassigned case.
 *
 * Assignment normally happens at submission, but a case submitted when no doctor account existed
 * found nobody — and because a doctor only ever sees cases assigned to them, it became invisible
 * to everyone. Claiming is how such a case gets an owner.
 *
 * Refused if another doctor already holds it, so two people opening the queue at the same moment
 * cannot both come away believing the case is theirs.
 */
export const POST = route<{ caseId: string }>(
  { roles: ['doctor'] },
  async ({ params, session, metadata }) => {
    const repo = clinical();

    const resolved = await repo.resolveCaseForSystem(params.caseId);
    if (resolved === null) return problem('not_found', 'error.not_found');

    const context = accessContext(
      session,
      resolved.patientId,
      'share_with_assigned_doctor',
      metadata,
    );

    const assignment = await repo.claimCase(context, params.caseId, session.userId);
    if (assignment === null) return problem('conflict', 'doctor.claim.already_assigned');

    await queueNotification({
      userId: session.userId,
      type: 'doctor_case_queued',
      reference: params.caseId,
    });

    return ok({ status: 'claimed', caseId: params.caseId });
  },
);
