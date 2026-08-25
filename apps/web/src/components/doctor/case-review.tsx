'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api, type ApiProblem } from '@/lib/api-client';
import { Badge, Card, Notice, type Tone } from '@/components/primitives';
import { ReleaseDialog } from './release-dialog';
import { AiAnalysis, type AssessmentPayload } from './ai-analysis';

/**
 * Everything the doctor needs on one screen: the answers grouped by symptom cluster with the
 * branching context that produced them, the uploaded reports, the red flags with their basis, and
 * the AI assessment beside — never inside — the doctor's own review.
 *
 * The AI assessment panel is read-only. Overrides go into the doctor's version, which is a
 * separate object, so the original stays exactly as the model produced it and every disagreement
 * is recorded as a diff.
 */

export interface CaseReviewData {
  case: {
    id: string;
    status: string;
    entryPoint: string;
    submittedAt: string | null;
    aiSkipReason: string | null;
  };
  patient: { ageYears: number | null; sex: string | null; locale: string };
  answersByCluster: Array<{
    cluster: string;
    answers: Array<{
      questionId: string;
      prompt: string;
      value: unknown;
      askedBecause: string | null;
      options: Array<{ id: string; label: string }>;
      type: string;
    }>;
  }>;
  documents: Array<{
    id: string;
    originalFilename: string;
    scanStatus: string;
    patientTypeTag: string | null;
    machineReadable: boolean | null;
    extract: unknown;
    extractVerified: boolean;
  }>;
  redFlags: Array<{
    ruleId: string;
    urgency: string;
    basis: string;
    contributingQuestionIds: string[];
    acknowledgedByPatient: boolean;
  }>;
  assessment: {
    id: string;
    outcome: string;
    modelVersion: string;
    promptVersion: string;
    kbVersion: string;
    groundingChunkCount: number;
    generatedAt?: string | null;
    failureReason: string | null;
    payload: AssessmentPayload | null;
  } | null;
  review: {
    id: string;
    status: string;
    finalSummary: unknown;
    doctorNotes: string | null;
  } | null;
}

interface DifferentialDraft {
  condition: string;
  likelihood: 'high' | 'moderate' | 'low';
  origin: 'ai' | 'doctor';
  rejected: boolean;
  rationale?: string;
}

const URGENCY_TONE: Record<string, Tone> = {
  emergency: 'emergency',
  urgent: 'urgent',
  'routine-but-flagged': 'neutral',
};

export function CaseReview({ caseId, data }: { caseId: string; data: CaseReviewData }) {
  const t = useTranslations('doctor');
  const tAll = useTranslations();

  const payload = data.assessment?.payload ?? null;

  const [differential, setDifferential] = useState<DifferentialDraft[]>(
    payload?.differential_assessment.map((item) => ({
      condition: item.condition,
      likelihood: item.likelihood,
      origin: 'ai' as const,
      rejected: false,
    })) ?? [],
  );
  const [nextSteps, setNextSteps] = useState<string>(
    (payload?.recommended_next_steps ?? []).join('\n'),
  );
  // Deliberately empty rather than pre-filled from the AI summary: the finalization check refuses
  // a pass-through, and pre-filling would be inviting exactly that.
  const [impression, setImpression] = useState('');
  const [patientSummary, setPatientSummary] = useState('');
  const [notes, setNotes] = useState(data.review?.doctorNotes ?? '');

  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [finalized, setFinalized] = useState(data.review?.status === 'finalized');
  const [released, setReleased] = useState(data.review?.status === 'released');
  const [confirming, setConfirming] = useState(false);

  function diffsFrom(): Array<Record<string, unknown>> {
    const original = payload?.differential_assessment ?? [];
    const diffs: Array<Record<string, unknown>> = [];

    for (const item of differential) {
      const source = original.find((entry) => entry.condition === item.condition);
      if (source === undefined) {
        diffs.push({ action: 'item_added', conditionId: item.condition, afterValue: item.likelihood, rationale: item.rationale });
      } else if (item.rejected) {
        diffs.push({ action: 'item_rejected', conditionId: item.condition, beforeValue: source.likelihood, rationale: item.rationale });
      } else if (source.likelihood !== item.likelihood) {
        diffs.push({
          action: 'likelihood_changed',
          conditionId: item.condition,
          beforeValue: source.likelihood,
          afterValue: item.likelihood,
          rationale: item.rationale,
        });
      }
    }
    for (const source of original) {
      if (!differential.some((item) => item.condition === source.condition)) {
        diffs.push({ action: 'item_removed', conditionId: source.condition, beforeValue: source.likelihood });
      }
    }
    return diffs;
  }

  async function save(finalize: boolean) {
    setPending(true);
    setProblem(null);

    const result = await api.put<{ status: string }>(`/api/doctor/cases/${caseId}/review`, {
      differential,
      recommendedNextSteps: nextSteps.split('\n').map((line) => line.trim()).filter(Boolean),
      clinicalImpression: impression,
      patientFacingSummary: patientSummary,
      doctorNotes: notes,
      diffs: diffsFrom(),
      finalize,
    });
    setPending(false);

    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    if (finalize) setFinalized(true);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left column: what the patient reported. */}
      <div className="space-y-5">
        <Card>
          <p className="text-sm text-ink-muted">
            {t('patientLine', {
              age: data.patient.ageYears === null ? t('ageUnknown') : String(data.patient.ageYears),
              sex: data.patient.sex ?? t('sexUnknown'),
            })}
          </p>
          <p className="mt-1 font-medium">{data.case.entryPoint}</p>
        </Card>

        {data.redFlags.length > 0 && (
          <Card>
            <h2 className="text-lg">{t('redFlagsHeading')}</h2>
            <p className="gi-hint">{t('redFlagsIntro')}</p>
            <ul className="mt-3 space-y-3">
              {data.redFlags.map((flag) => (
                <li key={flag.ruleId} className="rounded-lg border border-line p-3">
                  <Badge tone={URGENCY_TONE[flag.urgency] ?? 'neutral'}>{flag.urgency}</Badge>
                  <p className="mt-2">{flag.basis}</p>
                  <p className="mt-1 text-sm text-ink-faint">
                    {flag.contributingQuestionIds.join(', ')}
                  </p>
                  {flag.acknowledgedByPatient && (
                    <p className="mt-1 text-sm text-ink-muted">{t('acknowledgedByPatient')}</p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <h2 className="text-lg">{t('answersHeading')}</h2>
          {data.answersByCluster.map((group) => (
            <section key={group.cluster} className="mt-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
                {group.cluster.replace(/_/g, ' ')}
              </h3>
              <dl className="mt-2 space-y-3">
                {group.answers.map((answer) => (
                  <div key={answer.questionId}>
                    <dt className="text-sm text-ink-muted">{answer.prompt}</dt>
                    <dd className="font-medium">{renderAnswer(answer)}</dd>
                    {answer.askedBecause !== null && (
                      <p className="text-sm text-ink-faint">↳ {answer.askedBecause}</p>
                    )}
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </Card>

        <Card>
          <h2 className="text-lg">{t('documentsHeading')}</h2>
          {data.documents.length === 0 ? (
            <p className="mt-2 text-ink-muted">—</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {data.documents.map((document) => (
                <li key={document.id} className="rounded-lg border border-line p-3">
                  <p className="font-medium">{document.originalFilename}</p>
                  {document.patientTypeTag !== null && (
                    <p className="text-sm text-ink-muted">{document.patientTypeTag}</p>
                  )}
                  {document.machineReadable === false ? (
                    <p className="mt-1 text-sm text-urgent">{t('documentUnreadable')}</p>
                  ) : (
                    !document.extractVerified && (
                      <p className="mt-1 text-sm text-urgent">{t('documentUnverified')}</p>
                    )
                  )}
                  <a
                    href={`/api/cases/${caseId}/documents/${document.id}`}
                    className="mt-2 inline-block text-sm font-medium text-accent underline underline-offset-4"
                  >
                    {t('openOriginal')}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Right column: the AI summary, then the doctor's own review. */}
      <div className="space-y-5">
        <AiAnalysis
          caseId={caseId}
          assessment={
            data.assessment === null
              ? null
              : { ...data.assessment, generatedAt: data.assessment.generatedAt ?? null }
          }
          aiSkipReason={data.case.aiSkipReason}
          // Investigations may be adopted; the model's prose may not. The finalisation check
          // refuses a pass-through of its summary either way.
          onAdoptNextSteps={(steps) => setNextSteps(steps.join('\n'))}
          readOnly={released}
        />

        <Card>
          <h2 className="text-lg">{t('yourReviewHeading')}</h2>

          <DifferentialEditor
            items={differential}
            onChange={setDifferential}
            disabled={released}
          />

          <label className="gi-label mt-6" htmlFor="next-steps">
            {t('nextStepsLabel')}
          </label>
          <textarea
            id="next-steps"
            className="gi-input min-h-[6rem]"
            value={nextSteps}
            disabled={released}
            onChange={(event) => setNextSteps(event.target.value)}
          />
          <p className="gi-hint">{t('noPrescribing')}</p>

          <label className="gi-label mt-5" htmlFor="impression">
            {t('impression')}
          </label>
          <textarea
            id="impression"
            className="gi-input min-h-[8rem]"
            value={impression}
            disabled={released}
            onChange={(event) => setImpression(event.target.value)}
          />
          <p className="gi-hint">{t('impressionHint')}</p>

          <label className="gi-label mt-5" htmlFor="patient-summary">
            {t('patientSummary')}
          </label>
          <textarea
            id="patient-summary"
            className="gi-input min-h-[8rem]"
            value={patientSummary}
            disabled={released}
            onChange={(event) => setPatientSummary(event.target.value)}
          />
          <p className="gi-hint">{t('patientSummaryHint')}</p>

          <label className="gi-label mt-5" htmlFor="notes">
            {t('notes')}
          </label>
          <textarea
            id="notes"
            className="gi-input min-h-[6rem]"
            value={notes}
            disabled={released}
            onChange={(event) => setNotes(event.target.value)}
          />
          <p className="gi-hint">{t('notesHint')}</p>

          {problem !== null && (
            <div className="mt-4">
              <Notice tone="emergency" role="alert">
                {tAll(problem.messageKey as never)}
              </Notice>
            </div>
          )}

          {released ? (
            <Notice tone="ok" role="status">
              {t('released')}
            </Notice>
          ) : (
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="gi-button-secondary"
                disabled={pending}
                onClick={() => void save(false)}
              >
                {t('save')}
              </button>
              <button
                type="button"
                className="gi-button-secondary"
                disabled={pending}
                onClick={() => void save(true)}
              >
                {t('finalize')}
              </button>
              <button
                type="button"
                className="gi-button-primary"
                disabled={pending || !finalized}
                onClick={() => setConfirming(true)}
              >
                {t('release')}
              </button>
            </div>
          )}
        </Card>
      </div>

      {confirming && (
        <ReleaseDialog
          caseId={caseId}
          summary={patientSummary}
          nextSteps={nextSteps.split('\n').map((line) => line.trim()).filter(Boolean)}
          onCancel={() => setConfirming(false)}
          onReleased={() => {
            setConfirming(false);
            setReleased(true);
          }}
        />
      )}
    </div>
  );
}

function DifferentialEditor({
  items,
  onChange,
  disabled,
}: {
  items: DifferentialDraft[];
  onChange: (items: DifferentialDraft[]) => void;
  disabled: boolean;
}) {
  const t = useTranslations('doctor');
  const [newCondition, setNewCondition] = useState('');

  return (
    <div className="mt-4">
      <ul className="space-y-3">
        {items.map((item, index) => (
          <li key={item.condition} className="rounded-lg border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={item.rejected ? 'line-through text-ink-faint' : 'font-medium'}>
                {item.condition}
              </span>
              <Badge tone={item.origin === 'doctor' ? 'accent' : 'neutral'}>{item.origin}</Badge>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`likelihood-${index}`}>
                {t('likelihood')}
              </label>
              <select
                id={`likelihood-${index}`}
                className="gi-input max-w-[9rem]"
                value={item.likelihood}
                disabled={disabled || item.rejected}
                onChange={(event) => {
                  const next = [...items];
                  next[index] = {
                    ...item,
                    likelihood: event.target.value as DifferentialDraft['likelihood'],
                  };
                  onChange(next);
                }}
              >
                <option value="high">{t('likelihoodHigh')}</option>
                <option value="moderate">{t('likelihoodModerate')}</option>
                <option value="low">{t('likelihoodLow')}</option>
              </select>

              <button
                type="button"
                className="text-sm font-medium text-urgent underline underline-offset-4"
                disabled={disabled}
                onClick={() => {
                  const next = [...items];
                  next[index] = { ...item, rejected: !item.rejected };
                  onChange(next);
                }}
              >
                {t('rejectItem')}
              </button>

              <button
                type="button"
                className="text-sm font-medium text-emergency underline underline-offset-4"
                disabled={disabled}
                onClick={() => onChange(items.filter((_, position) => position !== index))}
              >
                {t('removeItem')}
              </button>
            </div>

            <label className="sr-only" htmlFor={`rationale-${index}`}>
              {t('rationale')}
            </label>
            <input
              id={`rationale-${index}`}
              className="gi-input mt-2"
              placeholder={t('rationale')}
              value={item.rationale ?? ''}
              disabled={disabled}
              onChange={(event) => {
                const next = [...items];
                next[index] = { ...item, rationale: event.target.value };
                onChange(next);
              }}
            />
          </li>
        ))}
      </ul>

      <div className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor="new-condition">
          {t('addItem')}
        </label>
        <input
          id="new-condition"
          className="gi-input"
          value={newCondition}
          disabled={disabled}
          onChange={(event) => setNewCondition(event.target.value)}
        />
        <button
          type="button"
          className="gi-button-secondary shrink-0"
          disabled={disabled || newCondition.trim() === ''}
          onClick={() => {
            onChange([
              ...items,
              {
                condition: newCondition.trim(),
                likelihood: 'moderate',
                origin: 'doctor',
                rejected: false,
              },
            ]);
            setNewCondition('');
          }}
        >
          {t('addItem')}
        </button>
      </div>
    </div>
  );
}

function renderAnswer(answer: CaseReviewData['answersByCluster'][number]['answers'][number]): string {
  const value = answer.value as Record<string, unknown> | null;
  if (value === null) return '—';

  switch (value.kind) {
    case 'single_select':
      return (
        answer.options.find((option) => option.id === value.optionId)?.label ??
        String(value.optionId)
      );
    case 'multi_select':
      return (value.optionIds as string[])
        .map((id) => answer.options.find((option) => option.id === id)?.label ?? id)
        .join(', ');
    case 'numeric':
      return `${String(value.value)} ${String(value.unit)}`;
    case 'duration': {
      const days = Number(value.days);
      if (days < 14) return `${days} days`;
      if (days < 60) return `~${Math.round(days / 7)} weeks`;
      if (days < 730) return `~${Math.round(days / 30)} months`;
      return `~${Math.round(days / 365)} years`;
    }
    case 'scale':
      return String(value.value);
    case 'date':
      return String(value.value);
    case 'text':
      return String(value.value);
    case 'body_map':
      return (value.regionIds as string[]).join(', ');
    default:
      return JSON.stringify(value);
  }
}
