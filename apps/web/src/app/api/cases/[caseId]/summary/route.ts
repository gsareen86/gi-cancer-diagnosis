import { clinical } from '@/server/db';
import { accessContext, route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';

/**
 * What the patient may read about their case.
 *
 * Before a doctor releases anything, this returns the case state and nothing else — no
 * differential, no red-flag list, no clinician summary. The AI assessment has no patient-facing
 * route at all; the repository refuses it outright for a patient actor and logs the attempt.
 *
 * TODO(confirm): Decision A — whether a patient may ever see raw AI output. The default here is
 * doctor-released only, which is the safer reading of the Telemedicine Practice Guidelines.
 */
export const GET = route<{ caseId: string }>({ roles: ['patient'] }, async ({ params, session, metadata }) => {
  const context = accessContext(session, session.userId, 'account_processing', metadata);
  const repo = clinical();

  const caseRecord = await repo.getCase(context, params.caseId);
  if (!caseRecord) return problem('not_found', 'error.not_found');

  if (caseRecord.status !== 'released') {
    return ok({
      caseId: caseRecord.id,
      status: caseRecord.status,
      released: false,
      submittedAt: caseRecord.submittedAt,
      // Deliberately nothing else. A case that has been through the AI pipeline looks, from
      // here, exactly like one that has not.
    });
  }

  const released = await repo.getReleasedSummary(context, params.caseId);
  return ok({
    caseId: caseRecord.id,
    status: caseRecord.status,
    released: true,
    releasedAt: released?.releasedAt ?? null,
    content: released?.releasedContent ?? null,
  });
});
