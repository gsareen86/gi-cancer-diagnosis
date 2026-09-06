import { route } from '@/server/api/route-handler';
import { ok } from '@/server/api/problem';
import { loadTriageQueue, triageMetrics } from '@/server/services/triage-service';
import { isBreached } from '@/lib/sla';

export const GET = route({ roles: ['doctor'] }, async ({ session }) => {
  const now = new Date();
  return ok(triageMetrics(await loadTriageQueue(session.userId), (at) => isBreached(at, now)));
});
