import { clinical } from '@/server/db';
import { route } from '@/server/api/route-handler';
import { ok } from '@/server/api/problem';

/**
 * The doctor's review queue.
 *
 * Scoped to live assignments, and carrying nothing clinical beyond each case's highest red-flag
 * urgency — enough to triage the queue, not enough to make the list itself a clinical record.
 * Emergency-flagged cases sort first under the default ordering.
 */
export const GET = route({ roles: ['doctor'] }, async ({ session }) => {
  const cases = await clinical().listDoctorQueue(session.userId, 'doctor');

  const rank = (urgency: string | null): number =>
    urgency === 'emergency' ? 0 : urgency === 'urgent' ? 1 : urgency === 'routine-but-flagged' ? 2 : 3;

  const sorted = [...cases].sort((a, b) => {
    const byUrgency = rank(a.highestUrgency) - rank(b.highestUrgency);
    if (byUrgency !== 0) return byUrgency;
    const aTime = (a.submittedAt ?? a.createdAt).getTime();
    const bTime = (b.submittedAt ?? b.createdAt).getTime();
    return aTime - bTime;
  });

  return ok({
    cases: sorted.map((row) => ({
      id: row.id,
      status: row.status,
      entryPointId: row.entryPointId,
      createdAt: row.createdAt,
      submittedAt: row.submittedAt,
      highestUrgency: row.highestUrgency,
      flagCount: row.flagCount,
      aiSkipReason: row.aiSkipReason,
    })),
  });
});
