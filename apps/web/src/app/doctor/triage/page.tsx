import { getTranslations } from 'next-intl/server';
import { PageHeading } from '@/components/primitives';
import { TriageTable, type QueueFilter } from '@/components/doctor/triage-table';
import { requireWorkspace } from '@/lib/guard';
import { loadTriageQueue } from '@/server/services/triage-service';
import { LiveRefresh } from '@/components/ui/live-refresh';

/**
 * The full queue: the doctor's assigned cases and the unclaimed ones, in one table.
 *
 * They are one list rather than two sections because a doctor triaging does not think in terms of
 * ownership — they think in terms of what is most urgent and least attended. An unclaimed
 * Critical case belongs above an assigned Routine one, and two separate lists make that ordering
 * impossible to see. The action column is what differs: claim, or open.
 *
 * The unclaimed rows stay pseudonymous. Identity appears only once a doctor has taken
 * responsibility for the case — see `triage-service.ts`.
 */
export default async function DoctorTriagePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireWorkspace('doctor');
  const t = await getTranslations('doctor');
  const { filter } = await searchParams;

  const queue = await loadTriageQueue(user.id, user.locale);

  const allowed: QueueFilter[] = ['all', 'pending', 'in_review', 'released', 'overdue', 'reviewed', 'closed'];
  const initial = allowed.includes(filter as QueueFilter) ? (filter as QueueFilter) : 'all';

  return (
    <div>
      <LiveRefresh />
      <PageHeading lead={t('triageLead')}>{t('triageHeading')}</PageHeading>
      <TriageTable rows={[...queue.assigned, ...queue.claimable]} initialFilter={initial} />
    </div>
  );
}
