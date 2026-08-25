'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, type ApiProblem } from '@/lib/api-client';
import { Badge, Card, Notice, Spinner, type Tone } from '@/components/primitives';

/**
 * The AI decision-support panel.
 *
 * Read-only, and beside the doctor's own review rather than inside it. Nothing here is copied
 * into what the patient sees: the released summary must be the doctor's own words, and the
 * finalisation check refuses a pass-through of the model's summary.
 *
 * The one exception is the suggested investigations, which the doctor can adopt into their own
 * next steps. Those are procedures, not conclusions, and adopting "upper GI endoscopy" is
 * ordinary clinical practice rather than deferring judgement to a model.
 */

export interface AssessmentPayload {
  differential_assessment: Array<{
    condition: string;
    likelihood: 'high' | 'moderate' | 'low';
    supporting_findings: string[];
    contradicting_or_atypical_findings: string[];
    suggested_confirmatory_steps: string[];
  }>;
  red_flags: Array<{ flag: string; basis: string; urgency: string }>;
  recommended_next_steps: string[];
  clinician_summary: string;
  disclaimer: string;
}

export interface AssessmentView {
  id: string;
  outcome: string;
  modelVersion: string;
  promptVersion: string;
  kbVersion: string;
  groundingChunkCount: number;
  generatedAt: string | null;
  failureReason: string | null;
  payload: AssessmentPayload | null;
}

const LIKELIHOOD_TONE: Record<string, Tone> = {
  high: 'urgent',
  moderate: 'accent',
  low: 'neutral',
};

const URGENCY_TONE: Record<string, Tone> = {
  emergency: 'emergency',
  urgent: 'urgent',
  'routine-but-flagged': 'neutral',
};

export function AiAnalysis({
  caseId,
  assessment,
  aiSkipReason,
  onAdoptNextSteps,
  readOnly,
}: {
  caseId: string;
  assessment: AssessmentView | null;
  aiSkipReason: string | null;
  onAdoptNextSteps: (steps: string[]) => void;
  readOnly: boolean;
}) {
  const t = useTranslations('doctor');
  const tAll = useTranslations();
  const format = useFormatter();
  const router = useRouter();

  const [running, setRunning] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);

  const payload = assessment?.payload ?? null;

  async function generate() {
    setRunning(true);
    setProblem(null);

    const result = await api.post<{ status: string }>(`/api/doctor/cases/${caseId}/assessment`);
    setRunning(false);

    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg">{t('assessmentHeading')}</h2>
        {!readOnly && (
          <button
            type="button"
            className="gi-button-secondary"
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
        <p className="mt-3">
          <Spinner label={t('assessmentRunningHint')} />
        </p>
      )}

      {problem !== null && (
        <div className="mt-3">
          <Notice tone="urgent" role="alert" title={t('assessmentFailed')}>
            {tAll(problem.messageKey as never)}
          </Notice>
        </div>
      )}

      {payload === null ? (
        <div className="mt-3">
          <Notice tone="neutral" role="note">
            {/* Says which of the possibilities actually happened. "No AI summary" alone left a
                consent refusal and a service outage looking identical. */}
            {aiSkipReason ??
              (assessment?.failureReason == null
                ? t('assessmentAbsent')
                : t('assessmentPreviouslyFailed', { reason: assessment.failureReason }))}
          </Notice>
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          {assessment?.outcome === 'ungrounded' && (
            <Notice tone="urgent" role="note">
              {t('assessmentUngrounded')}
            </Notice>
          )}

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
              {t('assessmentSummaryHeading')}
            </h3>
            <p className="mt-2 whitespace-pre-wrap">{payload.clinician_summary}</p>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
              {t('assessmentDifferentialHeading')}
            </h3>
            {/* Possibilities with a likelihood, never a conclusion. Only the doctor's finalised
                review may state one. */}
            <p className="gi-hint">{t('assessmentDifferentialHint')}</p>

            <ul className="mt-3 space-y-3">
              {payload.differential_assessment.map((item) => (
                <li key={item.condition} className="rounded-lg border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{item.condition}</span>
                    <Badge tone={LIKELIHOOD_TONE[item.likelihood] ?? 'neutral'}>
                      {t('likelihood')}: {t(likelihoodKey(item.likelihood))}
                    </Badge>
                  </div>
                  <FindingList label={t('supporting')} items={item.supporting_findings} />
                  <FindingList
                    label={t('contradicting')}
                    items={item.contradicting_or_atypical_findings}
                  />
                  <FindingList label={t('confirmatory')} items={item.suggested_confirmatory_steps} />
                </li>
              ))}
            </ul>
          </section>

          {payload.red_flags.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
                {t('assessmentRedFlagsHeading')}
              </h3>
              <p className="gi-hint">{t('assessmentRedFlagsHint')}</p>
              <ul className="mt-2 space-y-2">
                {payload.red_flags.map((flag) => (
                  <li key={flag.flag} className="rounded-lg border border-line p-3">
                    <Badge tone={URGENCY_TONE[flag.urgency] ?? 'neutral'}>{flag.urgency}</Badge>
                    <p className="mt-1.5 font-medium">{flag.flag}</p>
                    <p className="text-sm text-ink-muted">{flag.basis}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {payload.recommended_next_steps.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
                {t('assessmentNextStepsHeading')}
              </h3>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {payload.recommended_next_steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              {!readOnly && (
                <button
                  type="button"
                  className="gi-button-secondary mt-3"
                  onClick={() => onAdoptNextSteps(payload.recommended_next_steps)}
                >
                  {t('assessmentAdoptSteps')}
                </button>
              )}
              <p className="gi-hint">{t('assessmentAdoptStepsHint')}</p>
            </section>
          )}

          <div className="border-t border-line pt-3 text-sm text-ink-faint">
            <p>
              {t('assessmentVersions', {
                model: assessment?.modelVersion ?? '',
                prompt: assessment?.promptVersion ?? '',
                kb: assessment?.kbVersion ?? '',
              })}
            </p>
            {assessment?.generatedAt != null && (
              <p>
                {t('assessmentGeneratedAt', {
                  date: format.dateTime(new Date(assessment.generatedAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                })}
              </p>
            )}
            <p className="mt-2">{payload.disclaimer}</p>
          </div>
        </div>
      )}
    </Card>
  );
}

function FindingList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <ul className="list-inside list-disc text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
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
