'use client';

import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Panel, type Tone } from '@/components/primitives';
import { EmptyState, RiskBadge, StatusChip } from '@/components/ui/feedback';
import { ClipboardIcon, FilterIcon, SearchIcon, CloseIcon, ChevronRightIcon } from '@/components/ui/icons';
import { ClaimButton } from './claim-button';
import { RISK_LABEL_KEY, RISK_TONE, riskTier, type RiskTier } from '@/lib/risk';
import { slaState, SLA_LABEL_KEY } from '@/lib/sla';
import type { TriageRow } from '@/server/services/triage-service';
import { CLINICAL_CATEGORIES, type ClinicalCategory } from '@/lib/clinical-category';

/**
 * The triage queue.
 *
 * Filtering runs in the browser over rows the server already sent. A doctor's live assignment
 * list is tens of cases, not thousands, and doing it here means a filter change is instant and
 * costs no round trip — a queue that stalls for 300ms every time someone unticks "Routine" gets
 * used once.
 *
 * Two behaviours are load-bearing. The default ordering is risk tier, then longest waiting, so a
 * Critical case waiting two days sits above a Routine case waiting three; sorting by arrival
 * alone is how an emergency ends up on page two. And an empty result distinguishes "you have no
 * cases" from "your filters excluded everything", because the second is a dead end the reader
 * needs a way out of and the first is good news.
 */

const STATUS_TONE: Record<string, Tone> = {
  submitted: 'accent',
  ai_processing: 'neutral',
  ai_processed: 'accent',
  ai_skipped: 'caution',
  in_review: 'accent',
  reviewed: 'ok',
  released: 'ok',
  closed: 'neutral',
};

const STATUS_KEY: Record<string, string> = {
  submitted: 'statusSubmitted',
  ai_processing: 'statusAwaitingReview',
  ai_processed: 'statusAwaitingReview',
  ai_skipped: 'statusAwaitingReview',
  in_review: 'statusInReview',
  reviewed: 'statusReviewed',
  released: 'statusReleased',
  closed: 'statusClosed',
};

import { filterTriageRows, needsReview, type QueueFilter, type TriageFilters as Filters } from '@/lib/triage';
export type { QueueFilter } from '@/lib/triage';

export function TriageTable({
  rows,
  initialFilter = 'all',
}: {
  rows: TriageRow[];
  initialFilter?: QueueFilter;
}) {
  const t = useTranslations('doctor');
  const format = useFormatter();
  const now = useMemo(() => new Date(), [rows]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    query: '',
    risk: 'any',
    queue: initialFilter,
    area: 'any',
    category: 'any',
    sla: 'any',
    from: '',
    to: '',
  });

  const areas = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) seen.set(row.entryPointId, row.entryPoint);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  useEffect(() => setFilters((current) => ({ ...current, queue: initialFilter })), [initialFilter]);
  const filtered = useMemo(() => filterTriageRows(rows, filters, now), [rows, filters, now]);

  const active = [
    filters.risk !== 'any' ? ('risk' as const) : null,
    filters.queue !== 'all' ? ('queue' as const) : null,
    filters.area !== 'any' ? ('area' as const) : null,
    filters.category !== 'any' ? ('category' as const) : null,
    filters.sla !== 'any' ? ('sla' as const) : null,
    filters.query.trim() !== '' ? ('query' as const) : null,
    filters.from !== '' ? ('from' as const) : null,
    filters.to !== '' ? ('to' as const) : null,
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  function clear(which?: (typeof active)[number]) {
    setFilters((current) => ({
      query: which === undefined || which === 'query' ? '' : current.query,
      risk: which === undefined || which === 'risk' ? 'any' : current.risk,
      queue: which === undefined || which === 'queue' ? 'all' : current.queue,
      area: which === undefined || which === 'area' ? 'any' : current.area,
      category: which === undefined || which === 'category' ? 'any' : current.category,
      sla: which === undefined || which === 'sla' ? 'any' : current.sla,
      from: which === undefined || which === 'from' ? '' : current.from,
      to: which === undefined || which === 'to' ? '' : current.to,
    }));
  }

  const QUEUE_OPTIONS: Array<{ value: QueueFilter; label: string }> = [
    { value: 'all', label: t('filterQueueAll') },
    { value: 'pending', label: t('filterQueuePending') },
    { value: 'in_review', label: t('filterQueueInReview') },
    { value: 'released', label: t('filterQueueReleased') },
    { value: 'overdue', label: t('filterQueueOverdue') },
    { value: 'reviewed', label: t('metricReviewed') },
    { value: 'closed', label: t('metricClosed') },
  ];

  return (
    <Panel
      title={t('queueHeading')}
      actions={
        <span className="gi-numeric text-sm text-ink-muted">
          {t('queueCount', { shown: filtered.length, total: rows.length })}
        </span>
      }
      bodyClassName=""
    >
      <div className="px-4 py-3 md:hidden"><button className="gi-button-secondary" type="button" aria-expanded={filtersOpen} aria-controls="triage-filters" onClick={() => setFiltersOpen(!filtersOpen)}><FilterIcon className="h-4 w-4" />{t('filterControls')} ({active.length})</button></div>
      <div id="triage-filters" className={`${filtersOpen ? 'flex' : 'hidden'} flex-wrap items-center gap-2 border-b border-line px-4 py-3 md:flex`}>
        <div className="relative min-w-[14rem] flex-1">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          >
            <SearchIcon className="h-4 w-4" />
          </span>
          <label className="sr-only" htmlFor="triage-search">
            {t('filterSearch')}
          </label>
          <input
            id="triage-search"
            type="search"
            className="gi-input pl-9"
            placeholder={t('filterSearchPlaceholder')}
            value={filters.query}
            onChange={(event) =>
              setFilters((current) => ({ ...current, query: event.target.value }))
            }
          />
        </div>

        <span aria-hidden="true" className="text-ink-faint">
          <FilterIcon className="h-4 w-4" />
        </span>

        <label className="sr-only" htmlFor="triage-queue">
          {t('filterQueue')}
        </label>
        <select
          id="triage-queue"
          className="gi-select w-44 shrink-0"
          value={filters.queue}
          onChange={(event) =>
            setFilters((current) => ({ ...current, queue: event.target.value as QueueFilter }))
          }
        >
          {QUEUE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="triage-risk">
          {t('filterRisk')}
        </label>
        <select
          id="triage-risk"
          className="gi-select w-40 shrink-0"
          value={filters.risk}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              risk: event.target.value as RiskTier | 'any',
            }))
          }
        >
          <option value="any">{t('filterRiskAny')}</option>
          <option value="critical">{t('riskCritical')}</option>
          <option value="high">{t('riskHigh')}</option>
          <option value="moderate">{t('riskModerate')}</option>
          <option value="routine">{t('riskRoutine')}</option>
        </select>

        <label className="sr-only" htmlFor="triage-area">
          {t('filterArea')}
        </label>
        <select
          id="triage-area"
          className="gi-select w-52 shrink-0"
          value={filters.area}
          onChange={(event) => setFilters((current) => ({ ...current, area: event.target.value }))}
        >
          <option value="any">{t('filterAreaAny')}</option>
          {areas.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="triage-sla">
          {t('filterSla')}
        </label>
        <label className="sr-only" htmlFor="triage-category">{t('filterCategory')}</label>
        <select id="triage-category" className="gi-select w-52 shrink-0" value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value as ClinicalCategory | 'any' }))}>
          <option value="any">{t('filterCategoryAny')}</option>
          {CLINICAL_CATEGORIES.map((category) => <option key={category} value={category}>{t(`category_${category}` as never)}</option>)}
        </select>
        <select
          id="triage-sla"
          className="gi-select w-48 shrink-0"
          value={filters.sla}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              sla: event.target.value as Filters['sla'],
            }))
          }
        >
          <option value="any">{t('filterSlaAny')}</option>
          <option value="due_soon">{t('slaDueSoon')}</option>
          <option value="breached">{t('slaBreached')}</option>
        </select>
        <label className="flex items-center gap-2 text-xs text-ink-muted">{t('filterFrom')}<input type="date" className="gi-input w-40" value={filters.from} max={filters.to || undefined} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} /></label>
        <label className="flex items-center gap-2 text-xs text-ink-muted">{t('filterTo')}<input type="date" className="gi-input w-40" value={filters.to} min={filters.from || undefined} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} /></label>
      </div>

      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-sunken px-4 py-2">
          <span className="text-xs font-medium text-ink-muted">{t('filterActive')}</span>
          {active.map((which) => (
            <button
              key={which}
              type="button"
              onClick={() => clear(which)}
              className="inline-flex items-center gap-1 rounded-full border border-accent-line bg-accent-faint px-2.5 py-0.5 text-xs font-medium text-accent transition-colors hover:bg-accent-faint/70"
            >
              {which === 'from' ? t('filterFrom') : which === 'to' ? t('filterTo') : t(`filterChip_${which}` as never)}
              <CloseIcon className="h-3 w-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => clear()}
            className="text-xs font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            {t('filterClearAll')}
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardIcon className="h-5 w-5" />}
          title={rows.length === 0 ? t('queueEmptyTitle') : t('queueFilteredEmptyTitle')}
          body={rows.length === 0 ? t('queueEmptyBody') : t('queueFilteredEmptyBody')}
          action={
            rows.length === 0 ? undefined : (
              <button type="button" className="gi-button-secondary" onClick={() => clear()}>
                {t('filterClearAll')}
              </button>
            )
          }
        />
      ) : (
        <>
        <ul className="divide-y divide-line md:hidden">
          {filtered.map(row => <li key={row.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-sm font-semibold">{row.caseReference}</span><RiskBadge tone={RISK_TONE[riskTier(row.highestUrgency)]}>{t(RISK_LABEL_KEY[riskTier(row.highestUrgency)] as never)}</RiskBadge></div>
            <p className="text-sm font-semibold">{row.patientName ?? row.patientReference} · {row.entryPoint}</p>
            <p className="text-sm text-ink-muted">{row.snapshot ?? t('assessmentAbsent')}</p>
            <div className="flex flex-wrap items-center justify-between gap-2"><StatusChip tone={STATUS_TONE[row.status] ?? 'neutral'}>{t((STATUS_KEY[row.status] ?? 'statusSubmitted') as never)}</StatusChip><time className="text-xs text-ink-muted" dateTime={row.submittedAt ?? row.createdAt}>{format.dateTime(new Date(row.submittedAt ?? row.createdAt), { dateStyle: 'medium' })}</time></div>
            {row.assigned ? <Link href={`/doctor/case/${row.id}`} className="gi-button-primary w-full">{t(['released', 'closed'].includes(row.status) ? 'viewSummary' : 'openReview')}</Link> : <ClaimButton caseId={row.id} compact />}
          </li>)}
        </ul>
        <div className="gi-scroll hidden overflow-x-auto md:block">
          <table className="gi-table min-w-[68rem]">
            <caption className="sr-only">{t('queueTableCaption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('columnRisk')}</th>
                <th scope="col">{t('columnCase')}</th>
                <th scope="col">{t('columnPatient')}</th>
                <th scope="col">{t('columnArea')}</th>
                <th scope="col">{t('columnWaiting')}</th>
                <th scope="col">{t('columnSnapshot')}</th>
                <th scope="col">{t('columnStatus')}</th>
                <th scope="col">
                  <span className="sr-only">{t('columnAction')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const tier = riskTier(row.highestUrgency);
                const sla = slaState(row.submittedAt, now);
                const when = row.submittedAt ?? row.createdAt;
                return (
                  <tr
                    key={row.id}
                    className={`border-l-4 ${
                      tier === 'critical'
                        ? 'border-l-emergency-bright'
                        : tier === 'high'
                          ? 'border-l-urgent-bright'
                          : tier === 'moderate'
                            ? 'border-l-caution-bright'
                            : 'border-l-transparent'
                    }`}
                  >
                    <td>
                      <RiskBadge tone={RISK_TONE[tier]}>{t(RISK_LABEL_KEY[tier] as never)}</RiskBadge>
                      {row.flagCount > 0 && (
                        <p className="mt-1 text-2xs text-ink-faint">
                          {t('flagCount', { count: row.flagCount })}
                        </p>
                      )}
                    </td>

                    <td>
                      <span className="gi-numeric whitespace-nowrap font-mono text-sm font-semibold text-ink">
                        {row.caseReference}
                      </span>
                    </td>

                    <td>
                      {row.patientName === null ? (
                        <span className="text-ink-faint">{t('patientPseudonymous')}</span>
                      ) : (
                        <span className="font-medium">{row.patientName}</span>
                      )}
                      {row.patientReference && <p className="mt-1 font-mono text-xs text-ink-muted">{row.patientReference}</p>}
                      <p className="mt-1 text-xs text-ink-faint">
                        {t('patientLine', {
                          age: row.ageYears === null ? t('ageUnknown') : String(row.ageYears),
                          sex: row.sex === null ? t('sexUnknown') : t(`sex_${row.sex}` as never),
                        })}
                      </p>
                    </td>

                    <td className="max-w-[12rem]">
                      <span className="text-sm">{row.entryPoint}</span>
                    </td>

                    <td>
                      <time dateTime={when} className="gi-numeric text-sm" title={format.dateTime(new Date(when), { dateStyle: 'long', timeStyle: 'short' })}>
                        {format.dateTime(new Date(when), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </time>
                      {needsReview(row.status) && <p className="mt-1">
                        <StatusChip
                          tone={sla === 'breached' ? 'emergency' : sla === 'due_soon' ? 'urgent' : 'neutral'}
                          dot={false}
                        >
                          {t(SLA_LABEL_KEY[sla] as never)}
                        </StatusChip>
                      </p>}
                    </td>

                    <td className="max-w-[22rem]">
                      {row.snapshot === null ? (
                        <span className="text-sm text-ink-faint">
                          {row.aiSkipReason ?? t('assessmentAbsent')}
                        </span>
                      ) : (
                        <>
                          <span className="line-clamp-2 text-sm text-ink-muted" title={row.snapshot}>{row.snapshot}</span>
                          <span className="mt-1 block">
                            <Badge tone="neutral" className="text-2xs">
                              {t('snapshotLabel')}
                            </Badge>
                          </span>
                        </>
                      )}
                    </td>

                    <td>
                      <StatusChip tone={STATUS_TONE[row.status] ?? 'neutral'}>
                        {t((STATUS_KEY[row.status] ?? 'statusSubmitted') as never)}
                      </StatusChip>
                    </td>

                    <td className="w-[10rem] text-right">
                      {row.assigned ? (
                        <Link href={`/doctor/case/${row.id}`} className="gi-review-action group" aria-label={`${t('openReview')} · ${row.caseReference}`}>
                          {t(['released', 'closed'].includes(row.status) ? 'viewSummary' : 'openReview')}
                          <ChevronRightIcon className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      ) : (
                        // A case nobody owns: taking it is the action, not opening it.
                        <ClaimButton caseId={row.id} compact />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </Panel>
  );
}
