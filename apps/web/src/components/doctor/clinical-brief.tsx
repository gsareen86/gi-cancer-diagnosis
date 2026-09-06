'use client';

import { useTranslations } from 'next-intl';
import type { CaseWorkspaceData } from './types';

/** Factual overview remains available without reports or model output. Originals stay below. */
export function ClinicalBrief({ data }: { data: CaseWorkspaceData }) {
  const t = useTranslations('doctor');
  if (!data.brief) return null;
  const symptoms = data.brief.facts.filter(f => f.source?.type !== 'history' && f.presence !== 'absent' && f.presence !== 'indeterminate');
  const history = data.brief.facts.filter(f => f.source?.type === 'history' && f.presence !== 'indeterminate');
  const unknown = data.brief.facts.filter(f => f.presence === 'indeterminate');
  return (
    <section aria-label={t('briefTitle')} className="mb-6 rounded-2xl border border-accent/25 bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-semibold">{t('briefTitle')}</h2><p className="mt-1 text-sm text-ink-muted">{t('briefHint')}</p></div>
        <span className="rounded-full bg-surface-inset px-3 py-1 text-xs font-medium text-ink-muted">{t('briefReports', { count: data.documents.length })}</span>
      </div>
      {data.redFlags.length > 0 && <div className="mt-4 rounded-xl border border-emergency/30 bg-emergency-faint p-4"><h3 className="font-semibold text-emergency">{t('briefAttention')}</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{data.redFlags.map(flag => <li key={flag.ruleId}>{flag.basis}</li>)}</ul></div>}
      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div><h3 className="text-sm font-semibold">{t('briefSymptoms')}</h3>{symptoms.length === 0 ? <p className="mt-2 text-sm text-ink-muted">{t('briefNotRecorded')}</p> : <dl className="mt-3 space-y-3">{symptoms.slice(0, 8).map(f => <div key={f.questionId}><dt className="text-xs text-ink-muted">{f.question}</dt><dd className="mt-0.5 text-sm font-medium">{f.answer}</dd></div>)}</dl>}</div>
        <div><h3 className="text-sm font-semibold">{t('briefHistory')}</h3>{history.length === 0 ? <p className="mt-2 text-sm text-ink-muted">{t('briefNotRecorded')}</p> : <dl className="mt-3 space-y-3">{history.map(f => <div key={f.questionId}><dt className="text-xs text-ink-muted">{f.question}</dt><dd className="mt-0.5 text-sm">{f.answer}</dd></div>)}</dl>}
          {unknown.length > 0 && <div className="mt-4 rounded-lg bg-surface-inset p-3"><p className="text-xs font-semibold">{t('briefUnknown')}</p><p className="mt-1 text-sm text-ink-muted">{unknown.map(f => f.question).join(' · ')}</p></div>}
          {data.documents.length === 0 && <p className="mt-4 text-sm text-ink-muted">{t('briefNoReports')}</p>}
        </div>
      </div>
      <p className="mt-5 border-t border-line pt-3 text-xs text-ink-muted">{t('briefSourceHint')}</p>
    </section>
  );
}
