import { buildInterviewView } from '@/server/services/interview-service';
import { loadProfile } from '@/server/auth/accounts';
import { ageInYears } from '@/server/services/age';
import { clinical } from '@/server/db';
import { accessContext, route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';

/**
 * The interview as it currently stands: what has been answered, what comes next, how far along,
 * and any emergency advisory that is in force.
 */
export const GET = route<{ caseId: string }>({ roles: ['patient'] }, async ({ params, session, metadata }) => {
  const context = accessContext(session, session.userId, 'account_processing', metadata);
  const caseRecord = await clinical().getCase(context, params.caseId);
  if (!caseRecord) return problem('not_found', 'error.not_found');

  const profile = await loadProfile(session.userId);
  const view = await buildInterviewView({
    context,
    caseRecord: {
      id: caseRecord.id,
      status: caseRecord.status,
      templateVersionId: caseRecord.templateVersionId,
      entryPointId: caseRecord.entryPointId,
      patientId: caseRecord.patientId,
    },
    locale: profile?.locale ?? 'en',
    ageYears: ageInYears(profile?.dateOfBirth ?? null),
  });

  return ok(view);
});
