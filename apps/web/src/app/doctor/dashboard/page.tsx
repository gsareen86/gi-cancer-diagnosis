import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { PageHeading, Panel } from '@/components/primitives';
import { EmptyState, MetricCard, RiskBadge, StatusChip } from '@/components/ui/feedback';
import {
  AlertIcon,
  CheckIcon,
  ClipboardIcon,
  ClockIcon,
  InboxIcon,
} from '@/components/ui/icons';
import { RISK_LABEL_KEY, RISK_TONE, RISK_ORDER, riskTier } from '@/lib/risk';
import { REVIEW_SLA_HOURS, isBreached, slaState, SLA_LABEL_KEY } from '@/lib/sla';
import { requireWorkspace } from '@/lib/guard';
import { loadTriageQueue, triageMetrics } from '@/server/services/triage-service';
import { LiveRefresh } from '@/components/ui/live-refresh';
import { needsReview } from '@/lib/triage';

/**
 * The clinician's landing screen.
 *
 * Four counts and the work at the top of the pile. Every count links into the queue already
 * filtered to exactly the cases it described, which is the only thing that makes a metric card
 * worth its space — a number nobody can act on is decoration.
 *
 * The overdue card is neutral at zero and emergency-toned above it. A permanently red "Overdue: 0"
 * trains the reader to ignore the colour, which costs exactly the case it existed to catch.
 */
export default async function DoctorDashboardPage() {
  const user = await requireWorkspace('doctor');
  const t = await getTranslations('doctor');
  const format = await getFormatter();

  const queue = await loadTriageQueue(user.id, user.locale);
  const now = new Date();
  const metrics = triageMetrics(queue, (at) => isBreached(at, now));

  // The five most pressing: risk tier first, then longest waiting.
  const attention = [...queue.assigned]
    .filter((row) => !['released', 'closed'].includes(row.status))
    .sort((a, b) => {
      const byRisk = RISK_ORDER[riskTier(a.highestUrgency)] - RISK_ORDER[riskTier(b.highestUrgency)];
      if (byRisk !== 0) return byRisk;
      const at = new Date(a.submittedAt ?? a.createdAt).getTime();
      const bt = new Date(b.submittedAt ?? b.createdAt).getTime();
      return at - bt;
    })
    .slice(0, 5);

  return (
    <div>
      <LiveRefresh />
      <PageHeading lead={t('dashboardLead', { name: user.fullName ?? user.email })}>
        {t('dashboardHeading')}
      </PageHeading>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t('metricPending')}
          value={metrics.pending}
          caption={t('metricPendingCaption')}
          icon={<ClipboardIcon className="h-4 w-4" />}
          href="/doctor/triage?filter=pending"
        />
        <MetricCard
          label={t('metricReviewed')}
          value={metrics.reviewed}
          caption={t('metricReviewedCaption')}
          icon={<ClockIcon className="h-4 w-4" />}
          href="/doctor/triage?filter=reviewed"
        />
        <MetricCard
          label={t('metricClosed')}
          value={metrics.closed}
          caption={t('metricClosedCaption')}
          icon={<CheckIcon className="h-4 w-4" />}
          href="/doctor/triage?filter=closed"
        />
        <MetricCard
          label={t('metricOverdue')}
          value={metrics.overdue}
          caption={
            metrics.overdue === 0
              ? t('metricOverdueClear', { hours: REVIEW_SLA_HOURS })
              : t('metricOverdueCaption', { count: metrics.overdue, hours: REVIEW_SLA_HOURS })
          }
          tone="emergency"
          emphasise={metrics.overdue > 0}
          icon={<AlertIcon className="h-4 w-4" />}
          href="/doctor/triage?filter=overdue"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel
            title={t('attentionHeading')}
            actions={
              <Link href="/doctor/triage" className="gi-button-sm gi-button-secondary">
                {t('viewFullQueue')}
              </Link>
            }
            bodyClassName=""
          >
            {attention.length === 0 ? (
              <EmptyState
                icon={<CheckIcon className="h-5 w-5" />}
                tone="ok"
                title={t('attentionEmptyTitle')}
                body={t('attentionEmptyBody')}
              />
            ) : (
              <ul className="divide-y divide-line">
                {attention.map((row) => {
                  const tier = riskTier(row.highestUrgency);
                  const sla = slaState(row.submittedAt, now);
                  const when = row.submittedAt ?? row.createdAt;
                  return (
                    <li key={row.id}>
                      <Link
                        href={`/doctor/case/${row.id}`}
                        className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-surface-inset"
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-1 w-1 shrink-0 self-stretch rounded-full ${
                            tier === 'critical'
                              ? 'bg-emergency-bright'
                              : tier === 'high'
                                ? 'bg-urgent-bright'
                                : tier === 'moderate'
                                  ? 'bg-caution-bright'
                                  : 'bg-line-strong'
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <RiskBadge tone={RISK_TONE[tier]}>
                              {t(RISK_LABEL_KEY[tier] as never)}
                            </RiskBadge>
                            <span className="font-medium text-ink">
                              {row.patientName ?? t('patientPseudonymous')}
                            </span>
                            <span className="text-xs text-ink-faint">
                              {t('patientLine', {
                                age: row.ageYears === null ? t('ageUnknown') : String(row.ageYears),
                                sex:
                                  row.sex === null
                                    ? t('sexUnknown')
                                    : t(`sex_${row.sex}` as never),
                              })}
                            </span>
                          </span>

                          <span className="mt-1 block truncate text-sm text-ink-muted">
                            {row.snapshot ?? row.aiSkipReason ?? t('assessmentAbsent')}
                          </span>

                          <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                            <span>{row.entryPoint}</span>
                            <span aria-hidden="true">·</span>
                            <span>{format.relativeTime(new Date(when), now)}</span>
                            {needsReview(row.status) && sla !== 'within' && (
                              <StatusChip
                                tone={sla === 'breached' ? 'emergency' : 'urgent'}
                                dot={false}
                              >
                                {t(SLA_LABEL_KEY[sla] as never)}
                              </StatusChip>
                            )}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <Panel
          title={t('unassignedHeading')}
          actions={
            <span className="gi-numeric text-sm text-ink-muted">{metrics.claimable}</span>
          }
          bodyClassName=""
        >
          {queue.claimable.length === 0 ? (
            <EmptyState
              icon={<InboxIcon className="h-5 w-5" />}
              title={t('unassignedEmptyTitle')}
              body={t('unassignedEmptyBody')}
            />
          ) : (
            <>
              <p className="border-b border-line bg-urgent-faint px-4 py-2.5 text-sm text-urgent">
                {t('unassignedIntro')}
              </p>
              <ul className="divide-y divide-line">
                {queue.claimable.slice(0, 6).map((row) => {
                  const tier = riskTier(row.highestUrgency);
                  return (
                    <li key={row.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <RiskBadge tone={RISK_TONE[tier]}>
                          {t(RISK_LABEL_KEY[tier] as never)}
                        </RiskBadge>
                        <span className="text-xs text-ink-faint">{row.entryPoint}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink-faint">
                        {format.relativeTime(new Date(row.submittedAt ?? row.createdAt), now)}
                      </p>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-line px-4 py-3">
                <Link href="/doctor/triage" className="gi-button-sm gi-button-secondary">
                  {t('viewFullQueue')}
                </Link>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
