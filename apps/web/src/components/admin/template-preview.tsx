'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import {
  computeInterview,
  createTextResolver,
  evaluateRedFlags,
  indexTemplate,
  type AnswerValue,
  type RecordedAnswer,
  type RedFlagRuleSet,
  type TemplateVersion,
} from '@gi-compass/core';
import { Badge, Card, Notice, Progress } from '@/components/primitives';
import { QuestionField } from '@/components/questionnaire/question-field';
import type { RenderedQuestion } from '@/lib/wire-types';

/**
 * The patient's path, walked in the browser against the same engine the server uses.
 *
 * Everything lives in component state. Reusing the real evaluator rather than a simplified
 * preview is the point: a preview that approximated the branching would tell a clinician their
 * rules work when they do not.
 */
export function TemplatePreview({
  template,
  clinicalText,
  redFlagRules,
  redFlagText,
  entryPointLabels,
}: {
  template: TemplateVersion;
  clinicalText: Record<string, Record<string, string>>;
  redFlagRules: RedFlagRuleSet;
  redFlagText: Record<string, Record<string, string>>;
  entryPointLabels: Record<string, string>;
}) {
  const t = useTranslations('admin');
  const tCase = useTranslations('case');

  const index = useMemo(() => indexTemplate(template), [template]);
  const resolve = useMemo(() => createTextResolver({ clinicalText }, 'en'), [clinicalText]);
  const resolveFlag = useMemo(
    () => createTextResolver({ clinicalText: redFlagText }, 'en'),
    [redFlagText],
  );

  const [entryPointId, setEntryPointId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<RecordedAnswer[]>([]);
  const [draft, setDraft] = useState<AnswerValue | null>(null);
  const [ageYears, setAgeYears] = useState(52);

  const interview = useMemo(() => {
    if (entryPointId === null) return null;
    return computeInterview({ index, entryPointId, answers, subject: { ageYears } });
  }, [index, entryPointId, answers, ageYears]);

  const flags = useMemo(() => {
    if (interview === null) return null;
    return evaluateRedFlags({
      ruleSet: redFlagRules,
      answers: interview.effectiveAnswers,
      subject: { ageYears },
    });
  }, [interview, redFlagRules, ageYears]);

  function restart() {
    setEntryPointId(null);
    setAnswers([]);
    setDraft(null);
  }

  if (entryPointId === null) {
    return (
      <div>
        <PreviewBadge label={t('previewBadge')} />
        <AgeControl value={ageYears} onChange={setAgeYears} />
        <ul className="mt-4 space-y-3">
          {[...template.entryPoints]
            .sort((a, b) => a.order - b.order)
            .map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className="gi-choice w-full"
                  onClick={() => setEntryPointId(entry.id)}
                >
                  {entryPointLabels[entry.id] ?? entry.id}
                </button>
              </li>
            ))}
        </ul>
      </div>
    );
  }

  const nextEntry = interview?.activeQuestions.find(
    (entry) => entry.question.id === interview.nextQuestionId,
  );
  const question = nextEntry?.question ?? null;

  return (
    <div>
      <PreviewBadge label={t('previewBadge')} />
      <AgeControl value={ageYears} onChange={setAgeYears} />

      {flags !== null && flags.triggered.length > 0 && (
        <div className="my-5 space-y-2">
          {flags.triggered.map((flag) => (
            <Notice
              key={flag.ruleId}
              tone={flag.urgency === 'emergency' ? 'emergency' : 'urgent'}
              role="note"
              title={flag.ruleId}
            >
              {resolveFlag(flag.basisKey)}
            </Notice>
          ))}
        </div>
      )}

      {interview !== null && (
        <div className="my-5">
          <Progress
            answered={interview.progress.answered}
            total={interview.progress.total}
            label={tCase('progress', {
              answered: interview.progress.answered,
              total: interview.progress.total,
            })}
            branchOpenedLabel={tCase('branchOpened')}
            branchOpened={false}
          />
        </div>
      )}

      {question === null ? (
        <Card>
          <p className="font-medium">{tCase('review')}</p>
          <ol className="mt-3 space-y-2 text-sm">
            {answers.map((answer) => (
              <li key={answer.questionId}>
                <span className="text-ink-muted">{answer.questionId}</span>{' '}
                <code className="rounded bg-surface-sunken px-1">
                  {JSON.stringify(answer.value)}
                </code>
              </li>
            ))}
          </ol>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-ink-faint">{question.id}</p>
          <h2 className="mt-1 text-xl">{resolve(question.promptKey)}</h2>
          {question.helpKey !== undefined && (
            <p className="mt-2 text-ink-muted">{resolve(question.helpKey)}</p>
          )}

          <div className="mt-5">
            <QuestionField
              question={toRendered(question, resolve)}
              value={draft}
              onChange={setDraft}
            />
          </div>

          <button
            type="button"
            className="gi-button-primary mt-6 w-full"
            disabled={draft === null}
            onClick={() => {
              if (draft === null) return;
              setAnswers((current) => [
                ...current.filter((answer) => answer.questionId !== question.id),
                {
                  questionId: question.id,
                  value: draft,
                  answeredAt: new Date(),
                  active: true,
                },
              ]);
              setDraft(null);
            }}
          >
            {tCase('next')}
          </button>
        </Card>
      )}

      <button type="button" className="gi-button-secondary mt-5" onClick={restart}>
        {t('restart')}
      </button>
    </div>
  );
}

function PreviewBadge({ label }: { label: string }) {
  return (
    <div className="mb-4">
      <Badge tone="accent">{label}</Badge>
    </div>
  );
}

function AgeControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const t = useTranslations('admin');
  return (
    <div className="flex items-center gap-3">
      <label className="gi-label mb-0" htmlFor="preview-age">
        {t('previewAge')}
      </label>
      <input
        id="preview-age"
        type="number"
        min={0}
        max={120}
        className="gi-input max-w-[6rem]"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {/* Age-dependent rules only fire when the age is known, so the preview makes it settable. */}
      <span className="text-sm text-ink-muted">{t('previewAgeHint')}</span>
    </div>
  );
}

/** Adapts a stored question into the rendered shape the shared field component expects. */
function toRendered(
  question: TemplateVersion['questions'][number],
  resolve: (key: string) => string,
): RenderedQuestion {
  return {
    id: question.id,
    groupId: question.groupId,
    cluster: 'history',
    type: question.type,
    prompt: resolve(question.promptKey),
    help: question.helpKey === undefined ? null : resolve(question.helpKey),
    clinicalTerms: question.clinicalTerms.map((term) => ({
      term: term.term,
      explanation: resolve(term.layExplanationKey),
    })),
    options: [...question.options]
      .sort((a, b) => a.order - b.order)
      .map((option) => ({
        id: option.id,
        label: resolve(option.labelKey),
        referenceImageIds: option.referenceImageIds,
      })),
    numeric: question.numeric ?? null,
    scale:
      question.scale === undefined
        ? null
        : {
            ...question.scale,
            minLabel: resolve(question.scale.minLabelKey),
            maxLabel: resolve(question.scale.maxLabelKey),
          },
    bodyMapRegionIds: question.bodyMapRegionIds,
    referenceImageIds: question.referenceImageIds,
    required: question.required,
    multiSelectMax: question.multiSelectMax ?? null,
    textMaxLength: question.textMaxLength,
  };
}
