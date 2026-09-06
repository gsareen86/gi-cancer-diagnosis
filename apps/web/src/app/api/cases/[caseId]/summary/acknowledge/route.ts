import { clinical } from '@/server/db';
import { route, accessContext } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';

export const POST = route<{ caseId: string }>({ roles: ['patient'] }, async ({ params, session, metadata }) => {
  const repo = clinical();
  const context = accessContext(session, session.userId, 'account_processing', metadata);
  const record = await repo.getCase(context, params.caseId);
  if (!record) return problem('not_found', 'error.not_found');
  if (!await repo.getReleasedSummary(context, params.caseId)) return problem('conflict', 'review.release.not_finalized');
  if (record.status === 'closed') return ok({ status: 'closed' });
  if (record.status !== 'released') return problem('conflict', 'error.illegal_transition');
  await repo.transitionCase(context, params.caseId, 'closed');
  return ok({ status: 'closed' });
});
