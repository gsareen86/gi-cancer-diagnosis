'use client';

import { useTranslations } from 'next-intl';
import { Drawer } from '@/components/ui/navigation';
import { Badge, Notice, Spinner } from '@/components/primitives';
import { SparklesIcon } from '@/components/ui/icons';
import { addAiDraft, type DraftField } from '@/lib/ai-draft';
import type { ApiProblem } from '@/lib/api-client';
import type { AssessmentView, GenerateAssessment } from './types';

/** Source preview only. Adoption is deliberate and never writes to the server. */
export function AiDraftDrawer({ open, onClose, assessment, running, problem, generate, disabled,
  summary, workup, onApply,
}: {
  open: boolean; onClose: () => void; assessment: AssessmentView | null;
  running: boolean; problem: ApiProblem | null; generate: GenerateAssessment; disabled: boolean;
  summary: string; workup: string; onApply: (field: DraftField, suggestion: string) => void;
}) {
  const t = useTranslations('doctor');
  const tAll = useTranslations();
  const payload = assessment?.payload;
  const candidates = [
    { field: 'summary' as const, title: t('aiSummaryDraft'), source: payload?.clinician_summary ?? '', current: summary },
    { field: 'workup' as const, title: t('aiWorkupDraft'), source: payload?.recommended_next_steps.join('\n') ?? '', current: workup },
  ];
  return <Drawer open={open} onClose={onClose} title={t('aiAssistTitle')} closeLabel={tAll('app.close')} width="max-w-2xl">
    <div className="space-y-5 p-5 sm:p-6">
      <div className="rounded-xl border border-accent-line bg-accent-faint/40 p-4">
        <div className="flex items-center gap-2 font-semibold text-accent"><SparklesIcon />{t('aiAssistTitle')}</div>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t('aiAssistHint')}</p>
        <button type="button" className="gi-button-primary mt-4 w-full" disabled={disabled || running} onClick={() => void generate()}>
          <SparklesIcon />{running ? t('assessmentRunning') : payload ? t('assessmentRegenerate') : t('assessmentGenerate')}
        </button>
      </div>
      {running && <Spinner label={t('assessmentRunningHint')} />}
      {problem && <Notice tone="emergency" role="alert" title={t('assessmentFailed')}>{tAll(problem.messageKey as never)}</Notice>}
      {assessment?.outcome === 'ungrounded' && <Notice tone="urgent" role="note" title={t('assessmentUngroundedTitle')}>{t('assessmentUngrounded')}</Notice>}
      {!payload && !running && <p className="text-sm text-ink-muted">{t('aiAssistEmpty')}</p>}
      {payload && candidates.map(candidate => {
        const result = addAiDraft(candidate.current, candidate.source, candidate.field);
        return <section key={candidate.field} className="overflow-hidden rounded-xl border border-line">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-sunken px-4 py-3">
            <h3 className="font-semibold">{candidate.title}</h3><Badge tone="accent">{t('originAi')}</Badge>
          </header>
          <div className="p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{candidate.source || t('noneListed')}</p>
            <p className="mt-4 text-xs text-ink-muted">{candidate.current.trim() ? t('aiAppendHint') : t('aiFillHint')}</p>
            <button type="button" className="gi-button-secondary mt-3 w-full" disabled={disabled || running || !result.ok}
              onClick={() => onApply(candidate.field, candidate.source)}>
              {t(candidate.field === 'summary' ? (candidate.current ? 'aiAppendSummary' : 'aiUseSummary') : (candidate.current ? 'aiAppendWorkup' : 'aiUseWorkup'))}
            </button>
            {!result.ok && <p className="mt-2 text-xs text-ink-muted" role="status">{t(`aiDraft_${result.reason}`)}</p>}
          </div>
        </section>;
      })}
      {assessment && <p className="break-words text-xs text-ink-faint">{t('versionModel', { model: assessment.modelVersion })}</p>}
      <Notice tone="neutral" role="note">{t('aiManualFields')}</Notice>
    </div>
  </Drawer>;
}
