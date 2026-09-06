import { getFormatter, getTranslations } from 'next-intl/server';
import { PageHeading, Panel } from '@/components/primitives';
import { EmptyState, MetricCard, RiskBadge } from '@/components/ui/feedback';
import { ChartIcon, CheckIcon, ClockIcon, PulseIcon } from '@/components/ui/icons';
import { RISK_LABEL_KEY, RISK_TONE, riskTier } from '@/lib/risk';
import { REVIEW_SLA_HOURS } from '@/lib/sla';
import { requireWorkspace } from '@/lib/guard';
import { loadDoctorAnalytics } from '@/server/services/analytics-service';

/**
 * The reviewing doctor's own numbers.
 *
 * Every figure is a count or a duration over cases assigned to them; nothing here identifies a
 * patient. The override panel is the interesting one — it is the only place a clinician can see
 * how often they disagree with the model and in which direction, which is what makes the feedback
 * diffs worth recording in the first place.
 *
 * Charts are drawn with CSS, not a charting library: two bar charts do not justify shipping
 * 90kB of JavaScript to a clinic on mobile data, and every bar carries its number as text so the
 * shape is never the only way to read it.
 */
export default async function DoctorAnalyticsPage() {
  const user = await requireWorkspace('doctor');
  const t = await getTranslations('analytics');
  const tDoctor = await getTranslations('doctor');
  const format = await getFormatter();

  const data = await loadDoctorAnalytics(user.id);
  const peakWeek = Math.max(1, ...data.weekly.map((point) => point.released));
  const totalCases = data.riskDistribution.reduce((sum, entry) => sum + entry.count, 0);

  const OVERRIDE_KEY: Record<string, string> = {
    likelihood_changed: 'overrideLikelihoodChanged',
    item_added: 'overrideItemAdded',
    item_removed: 'overrideItemRemoved',
    item_rejected: 'overrideItemRejected',
    next_steps_changed: 'overrideNextStepsChanged',
  };

  return (
    <div>
      <PageHeading lead={t('lead')}>{t('heading')}</PageHeading>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t('metricReviewed')}
          value={data.reviewed}
          caption={t('metricReviewedCaption')}
          icon={<CheckIcon className="h-4 w-4" />}
        />
        <MetricCard
          label={t('metricReleased')}
          value={data.released}
          caption={t('metricReleasedCaption')}
          icon={<PulseIcon className="h-4 w-4" />}
        />
        <MetricCard
          label={t('metricTurnaround')}
          value={
            data.medianHoursToRelease === null
              ? t('noData')
              : t('hours', { value: data.medianHoursToRelease })
          }
          caption={t('metricTurnaroundCaption', { hours: REVIEW_SLA_HOURS })}
          tone={
            data.medianHoursToRelease !== null && data.medianHoursToRelease > REVIEW_SLA_HOURS
              ? 'urgent'
              : 'neutral'
          }
          emphasise={
            data.medianHoursToRelease !== null && data.medianHoursToRelease > REVIEW_SLA_HOURS
          }
          icon={<ClockIcon className="h-4 w-4" />}
        />
        <MetricCard
          label={t('metricOverrides')}
          value={data.totalDifferentialItems}
          caption={t('metricOverridesCaption')}
          icon={<ChartIcon className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title={t('throughputHeading')}>
          {data.released === 0 ? (
            <EmptyState
              icon={<ChartIcon className="h-5 w-5" />}
              title={t('throughputEmptyTitle')}
              body={t('throughputEmptyBody')}
            />
          ) : (
            <>
              <p className="text-xs text-ink-muted">{t('throughputHint')}</p>
              <ol className="mt-4 flex h-40 items-end gap-2">
                {data.weekly.map((point) => (
                  <li key={point.weekStart} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="gi-numeric text-2xs font-semibold text-ink-muted">
                      {point.released}
                    </span>
                    <span
                      className="w-full rounded-t bg-accent-bright transition-[height]"
                      style={{
                        height: `${Math.max(2, (point.released / peakWeek) * 100)}%`,
                      }}
                      aria-hidden="true"
                    />
                    <span className="text-2xs text-ink-faint">
                      {format.dateTime(new Date(point.weekStart), {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </Panel>

        <Panel title={t('riskHeading')}>
          {totalCases === 0 ? (
            <EmptyState
              icon={<PulseIcon className="h-5 w-5" />}
              title={t('riskEmptyTitle')}
              body={t('riskEmptyBody')}
            />
          ) : (
            <ul className="space-y-3">
              {data.riskDistribution.map((entry) => {
                const tier = riskTier(entry.urgency);
                const share = Math.round((entry.count / totalCases) * 100);
                return (
                  <li key={tier}>
                    <div className="flex items-center justify-between gap-3">
                      <RiskBadge tone={RISK_TONE[tier]}>
                        {tDoctor(RISK_LABEL_KEY[tier] as never)}
                      </RiskBadge>
                      <span className="gi-numeric text-sm text-ink-muted">
                        {t('countAndShare', { count: entry.count, share })}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line">
                      <div
                        aria-hidden="true"
                        className={`h-full rounded-full ${
                          tier === 'critical'
                            ? 'bg-emergency-bright'
                            : tier === 'high'
                              ? 'bg-urgent-bright'
                              : tier === 'moderate'
                                ? 'bg-caution-bright'
                                : 'bg-ok-bright'
                        }`}
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title={t('overridesHeading')}>
          <p className="text-xs text-ink-muted">{t('overridesHint')}</p>
          {data.overrides.length === 0 ? (
            <div className="mt-2">
              <EmptyState
                icon={<ChartIcon className="h-5 w-5" />}
                title={t('overridesEmptyTitle')}
                body={t('overridesEmptyBody')}
              />
            </div>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.overrides.map((entry) => (
                <li
                  key={entry.action}
                  className="rounded-lg border border-line bg-surface-sunken p-3"
                >
                  <p className="gi-section-title">
                    {t((OVERRIDE_KEY[entry.action] ?? 'overrideOther') as never)}
                  </p>
                  <p className="gi-numeric mt-1 text-2xl font-semibold">{entry.count}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
