'use client';

import { useFormatter, useTranslations } from 'next-intl';
import type { ApiProblem } from '@/lib/api-client';
import { Badge, Notice, Spinner, type Tone } from '@/components/primitives';
import { EmptyState, StatusChip } from '@/components/ui/feedback';
import { AlertIcon, PulseIcon } from '@/components/ui/icons';
import { assessmentFailureKey } from '@/lib/assessment-failure';
import type { AssessmentView, GenerateAssessment } from './types';

/**
 * The AI decision-support panel.
 *
 * The source assessment stays immutable. The adjacent review editor may use a labelled copy
 * as an editable draft, including suggested workup. Only physician-finalized and separately
 * confirmed content reaches the patient; prescriptions must be entered by the physician.
 */

const LIKELIHOOD_TONE: Record<string, Tone> = {
  high: 'urgent',
  moderate: 'accent',
  low: 'neutral',
};

const URGENCY_TONE: Record<string, Tone> = {
  emergency: 'emergency',
  urgent: 'urgent',
  'routine-but-flagged': 'caution',
};

const URGENCY_KEY: Record<string, string> = {
  emergency: 'urgencyEmergency',
  urgent: 'urgencyUrgent',
  'routine-but-flagged': 'urgencyFlagged',
};

export function CdsPanel({
  assessment,
  aiSkipReason,
  readOnly,
  running,
  problem,
  generate,
}: {
  assessment: AssessmentView | null;
  aiSkipReason: string | null;
  readOnly: boolean;
  running: boolean;
  problem: ApiProblem | null;
  generate: GenerateAssessment;
}) {
  const t = useTranslations('doctor');
  const tAll = useTranslations();
  const format = useFormatter();

  const payload = assessment?.payload ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-muted">{t('assessmentDisclaimerShort')}</p>
        {!readOnly && (
          <button
            type="button"
            className="gi-button-primary w-full gap-2"
            disabled={running}
            onClick={() => void generate()}
          >
            {running
              ? t('assessmentRunning')
              : payload === null
                ? t('assessmentGenerate')
                : t('assessmentRegenerate')}
          </button>
        )}
      </div>

      {running && (
        <p>
          <Spinner label={t('assessmentRunningHint')} />
        </p>
      )}

      {problem !== null && (
        <Notice tone="emergency" role="alert" title={t('assessmentFailed')}>
          {tAll(problem.messageKey as never)}
        </Notice>
      )}

      {payload === null ? problem === null && !running && (
        <EmptyState
          icon={<PulseIcon className="h-5 w-5" />}
          title={t('assessmentAbsentTitle')}
          // Says which of the possibilities actually happened. "No AI summary" alone left a
          // consent refusal and a service outage looking identical.
          body={
            aiSkipReason ??
            (assessment?.failureReason == null
              ? t('assessmentAbsent')
              : t('assessmentPreviouslyFailed', { reason: tAll(assessmentFailureKey(assessment.failureReason) as never) }))
          }
        />
      ) : (
        <div className="space-y-5">
          {assessment?.outcome === 'ungrounded' && (
            <Notice tone="urgent" role="note" title={t('assessmentUngroundedTitle')}>
              {t('assessmentUngrounded')}
            </Notice>
          )}

          <section className="rounded-xl border border-accent-line bg-accent-faint/30 p-4">
            <h3 className="gi-section-title">{t('assessmentSummaryHeading')}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
              {payload.clinician_summary}
            </p>
          </section>

          {/* --------------------------------------------------- Differential matrix --- */}
          <section>
            <h3 className="gi-section-title">{t('assessmentDifferentialHeading')}</h3>
            {/* Possibilities with a likelihood, never a conclusion. Only the doctor's finalised
                review may state one. */}
            <p className="mt-1 text-xs text-ink-muted">{t('assessmentDifferentialHint')}</p>

            <ul className="mt-3 space-y-2.5">
              {payload.differential_assessment.map((item, index) => (
                <li key={item.condition}>
                <details open={index === 0} className="gi-disclosure rounded-xl border border-line bg-surface">
                  <summary className="cursor-pointer p-3.5">
                  <span className="inline-flex w-[calc(100%-1.25rem)] flex-wrap items-center justify-between gap-2 align-middle">
                    <span className="flex items-center gap-2">
                      <span className="gi-numeric flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-faint text-xs font-semibold text-accent">
                        {index + 1}
                      </span>
                      <span className="font-medium">{item.condition}</span>
                    </span>
                    <Badge tone={LIKELIHOOD_TONE[item.likelihood] ?? 'neutral'}>
                      {t(likelihoodKey(item.likelihood))}
                    </Badge>
                  </span>
                  </summary>
                  <div className="border-t border-line p-3.5">

                  {/*
                    Supporting and contradicting findings side by side rather than stacked. A
                    differential item with three supporting findings and four contradicting ones
                    reads very differently from one with only the first list, and stacking them
                    lets the second get scrolled past.
                  */}
                  <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                    <FindingList
                      label={t('supporting')}
                      items={item.supporting_findings}
                      tone="ok"
                      emptyLabel={t('noneListed')}
                    />
                    <FindingList
                      label={t('contradicting')}
                      items={item.contradicting_or_atypical_findings}
                      tone="caution"
                      emptyLabel={t('noneListed')}
                    />
                  </div>

                  {item.suggested_confirmatory_steps.length > 0 && (
                    <div className="mt-2.5 border-t border-line pt-2.5">
                      <FindingList
                        label={t('confirmatory')}
                        items={item.suggested_confirmatory_steps}
                        tone="accent"
                        emptyLabel={t('noneListed')}
                      />
                    </div>
                  )}
                  </div>
                </details>
                </li>
              ))}
            </ul>
          </section>

          {/* ------------------------------------------------------------- Red flags --- */}
          {payload.red_flags.length > 0 && (
            <section>
              <h3 className="gi-section-title flex items-center gap-1.5">
                <AlertIcon className="h-3.5 w-3.5" />
                {t('assessmentRedFlagsHeading')}
              </h3>
              <p className="mt-1 text-xs text-ink-muted">{t('assessmentRedFlagsHint')}</p>
              <ul className="mt-2 space-y-2">
                {payload.red_flags.map((flag) => (
                  <li key={flag.flag} className="rounded-lg border border-line bg-surface p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={URGENCY_TONE[flag.urgency] ?? 'neutral'}>
                        {t((URGENCY_KEY[flag.urgency] ?? 'urgencyFlagged') as never)}
                      </Badge>
                      <span className="text-sm font-medium">{flag.flag}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">{flag.basis}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* --------------------------------------------------------- Suggested workup --- */}
          {payload.recommended_next_steps.length > 0 && (
            <section>
              <h3 className="gi-section-title">{t('assessmentWorkupHeading')}</h3>
              <ul className="mt-2 space-y-1.5">
                {payload.recommended_next_steps.map((step) => (
                  <li key={step} className="flex gap-2 text-sm">
                    <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent-bright" />
                    {step}
                  </li>
                ))}
              </ul>
              {/*
                Stated where the suggestions are, not in a footnote. These are for the doctor to
                act on in their own clinical system; nothing on this screen puts them in front of
                the patient.
              */}
              <div className="mt-3">
                <Notice tone="neutral" role="note">
                  {t('assessmentWorkupNotReleased')}
                </Notice>
              </div>
            </section>
          )}

          <footer className="border-t border-line pt-3 text-xs text-ink-faint">
            <div className="flex flex-wrap gap-1.5">
              <StatusChip tone="neutral" dot={false}>
                {t('versionModel', { model: assessment?.modelVersion ?? '' })}
              </StatusChip>
              <StatusChip tone="neutral" dot={false}>
                {t('versionPrompt', { prompt: assessment?.promptVersion ?? '' })}
              </StatusChip>
              <StatusChip tone="neutral" dot={false}>
                {t('versionKb', { kb: assessment?.kbVersion ?? '' })}
              </StatusChip>
              <StatusChip tone="neutral" dot={false}>
                {t('groundingChunks', { count: assessment?.groundingChunkCount ?? 0 })}
              </StatusChip>
            </div>
            {assessment?.generatedAt != null && (
              <p className="mt-2">
                {t('assessmentGeneratedAt', {
                  date: format.dateTime(new Date(assessment.generatedAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                })}
              </p>
            )}
            <p className="mt-2 leading-relaxed">{payload.disclaimer}</p>
          </footer>
        </div>
      )}
    </div>
  );
}

function FindingList({
  label,
  items,
  tone,
  emptyLabel,
}: {
  label: string;
  items: string[];
  tone: Tone;
  emptyLabel: string;
}) {
  const bullet: Record<string, string> = {
    ok: 'bg-ok-bright',
    caution: 'bg-caution-bright',
    accent: 'bg-accent-bright',
    neutral: 'bg-line-strong',
    urgent: 'bg-urgent-bright',
    emergency: 'bg-emergency-bright',
  };

  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-[0.04em] text-ink-faint">{label}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-ink-faint">{emptyLabel}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((item) => (
            <li key={item} className="flex gap-1.5 text-xs leading-relaxed">
              <span
                aria-hidden="true"
                className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${bullet[tone] ?? 'bg-line-strong'}`}
              />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function likelihoodKey(
  likelihood: 'high' | 'moderate' | 'low',
): 'likelihoodHigh' | 'likelihoodModerate' | 'likelihoodLow' {
  if (likelihood === 'high') return 'likelihoodHigh';
  if (likelihood === 'moderate') return 'likelihoodModerate';
  return 'likelihoodLow';
}
