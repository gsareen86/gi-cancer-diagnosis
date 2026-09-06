import { clinical } from '@/server/db';
import { accessContext, route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';
import { queueNotification } from '@/server/services/notification-service';

export const POST = route<{ caseId: string }>({ roles: ['doctor'] }, async ({ params, session, metadata }) => {
  const repo = clinical();
  const identity = await repo.resolveCaseForSystem(params.caseId);
  if (!identity) return problem('not_found', 'error.not_found');
  const context = accessContext(session, identity.patientId, 'share_with_assigned_doctor', metadata);
  const record = await repo.getCase(context, params.caseId);
  if (!record) return problem('not_found', 'error.not_found');
  if (['reviewed', 'released', 'closed'].includes(record.status)) return ok({ status: record.status });
  const assessment = await repo.getLatestAssessment(context, params.caseId);
  await repo.openReview(context, params.caseId, session.userId, assessment?.id ?? null);
  await queueNotification({ userId: identity.patientId, type: 'case_under_review', reference: params.caseId, dedupeKey: `review:${params.caseId}` });
  return ok({ status: 'in_review' });
});
