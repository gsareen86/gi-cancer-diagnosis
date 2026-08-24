import { clinical } from '@/server/db';
import { accessContext, route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';

/**
 * Records that the patient saw the emergency advisory and chose to continue the interview.
 *
 * The acknowledgement is stored with its timestamp. It does not clear the flag, and it does not
 * stop the case being marked urgent for the doctor — the patient deciding to keep answering is
 * not the same as the pattern going away.
 */
export const POST = route<{ caseId: string }>({ roles: ['patient'] }, async ({ params, session, metadata }) => {
  const context = accessContext(session, session.userId, 'account_processing', metadata);
  const caseRecord = await clinical().getCase(context, params.caseId);
  if (!caseRecord) return problem('not_found', 'error.not_found');

  const acknowledged = await clinical().acknowledgeRedFlags(context, params.caseId);
  return ok({ acknowledged: acknowledged.length });
});
