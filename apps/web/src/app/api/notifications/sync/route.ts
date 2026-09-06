import { clinical } from '@/server/db';
import { route } from '@/server/api/route-handler';
import { ok } from '@/server/api/problem';
import { queueNotification } from '@/server/services/notification-service';
import { isBreached } from '@/lib/sla';

/** Invoked while the doctor workspace is active; stable keys prevent duplicate mail. */
export const POST = route({ roles: ['doctor'] }, async ({ session }) => {
  const rows = await clinical().listDoctorQueue(session.userId, 'doctor');
  const waiting = rows.filter((row) => !['reviewed', 'released', 'closed'].includes(row.status) && isBreached(row.submittedAt));
  for (const row of waiting) await queueNotification({ userId: session.userId, type: 'doctor_overdue_case', reference: row.id, dedupeKey: `overdue:${session.userId}:${row.id}` });
  return ok({ synced: true });
});
