import { z } from 'zod';
import { listNotifications, markNotificationsRead } from '@/server/services/notification-service';
import { jsonBody, route } from '@/server/api/route-handler';
import { ok } from '@/server/api/problem';

/**
 * The caller's own notification feed.
 *
 * Scoped to `session.userId` in the query itself rather than filtered afterwards, so there is no
 * arrangement of parameters that reads somebody else's feed. Every role uses the same endpoint:
 * a doctor's alerts and a patient's case updates are rows in the same table, distinguished by
 * type, and giving them separate endpoints would only create a second place for the scope check
 * to be forgotten.
 *
 * The feed carries no clinical content — a type, a time, a delivery outcome and a case
 * reference — which is guaranteed upstream by `assertNoClinicalVariables` at the point the
 * notification is queued, not re-checked here.
 */
export const GET = route({}, async ({ session }) => {
  const feed = await listNotifications(session.userId);
  return ok(feed);
});

const readBody = z.object({
  /** Omit to mark everything read, which is what opening the panel does. */
  ids: z.array(z.string().uuid()).max(100).optional(),
});

export const POST = route({}, async ({ request, session }) => {
  const input = await jsonBody(request, readBody);
  const marked = await markNotificationsRead(session.userId, input.ids);
  return ok({ status: 'read', marked });
});
