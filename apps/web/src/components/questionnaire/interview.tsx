'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ApiProblem } from '@/lib/api-client';
import { Card, Notice, Progress, Spinner } from '@/components/primitives';
import { EmergencyAdvisoryScreen, EmergencyBanner } from './emergency-advisory';
import { ClinicalTerms, QuestionField } from './question-field';
import { ReferenceImages } from './reference-images';
import type { AnswerValue, InterviewView } from './types';

/**
 * The interview.
 *
 * Three behaviours matter more than anything visual here.
 *
 * Nothing advances past a question whose answer has not been persisted. The Next button submits
 * and waits; a failed save keeps the answer on screen, marks it unsaved, and retries, rather than
 * moving on and silently losing it.
 *
 * The emergency advisory is rendered from the same response that saved the answer. There is no
 * second request, no polling, and no dependency on the AI pipeline — a patient who has just
 * described a bleed sees the advisory in the same interaction.
 *
 * Progress is recomputed from the server's view of the current path, so when an answer opens a
 * branch the denominator grows and the interface says why.
 */
export function Interview({
  caseId,
  initialView,
  hasEmergencyContact,
}: {
  caseId: string;
  initialView: InterviewView;
  hasEmergencyContact: boolean;
}) {
  const t = useTranslations('case');
  const tApp = useTranslations('app');
  const tQuestion = useTranslations('question');
  const router = useRouter();

  const [view, setView] = useState(initialView);
  const [draft, setDraft] = useState<AnswerValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [showAdvisory, setShowAdvisory] = useState(
    view.emergency !== null && view.emergency.requiresInterruption,
  );
  const [advisoryAcknowledged, setAdvisoryAcknowledged] = useState(
    view.emergency !== null && !view.emergency.requiresInterruption,
  );
  const [branchOpened, setBranchOpened] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const promptRef = useRef<HTMLHeadingElement>(null);
  const previousTotal = useRef(view.progress.total);
  const previousQuestionId = useRef(view.nextQuestion?.id ?? null);

  useEffect(() => {
    const current = view.nextQuestion?.id ?? null;
    if (current !== previousQuestionId.current) {
      previousQuestionId.current = current;
      // Move focus to the new question so a screen-reader user is not left at the bottom of the
      // page they just submitted.
      promptRef.current?.focus();
    }
  }, [view.nextQuestion?.id]);

  const question = view.nextQuestion;

  const save = useCallback(
    async (value: AnswerValue) => {
      if (question === null) return;
      setSaving(true);
      setProblem(null);

      const result = await api.put<InterviewView>(`/api/cases/${caseId}/answers`, {
        questionId: question.id,
        value,
      });

      setSaving(false);

      if (!result.ok) {
        // The answer stays on screen and stays editable. Nothing has advanced.
        setProblem(result.problem);
        return;
      }

      const next = result.data;
      setBranchOpened(next.progress.total > previousTotal.current);
      previousTotal.current = next.progress.total;
      setView(next);
      setDraft(null);

      if (next.emergency !== null && (next.newlyTriggeredRuleIds?.length ?? 0) > 0) {
        // A newly triggered emergency interrupts again, even if an earlier one was acknowledged.
        setShowAdvisory(true);
        setAdvisoryAcknowledged(false);
      }
    },
    [caseId, question],
  );

  async function acknowledge() {
    setShowAdvisory(false);
    setAdvisoryAcknowledged(true);
    // Recorded with its timestamp. It does not clear the flag or change the doctor's queue.
    await api.post(`/api/cases/${caseId}/acknowledge`);
  }

  async function submit() {
    setSubmitting(true);
    setProblem(null);
    const result = await api.post<{ status: string }>(`/api/cases/${caseId}/submit`);
    setSubmitting(false);

    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    router.push(`/patient/case/${caseId}`);
    router.refresh();
  }

  if (showAdvisory && view.emergency !== null) {
    return (
      <EmergencyAdvisoryScreen
        advisory={view.emergency}
        onAcknowledge={acknowledge}
        hasEmergencyContact={hasEmergencyContact}
      />
    );
  }

  return (
    <div className="gi-prose">
      {view.emergency !== null && advisoryAcknowledged && <EmergencyBanner />}

      <div className="mb-6">
        <Progress
          answered={view.progress.answered}
          total={view.progress.total}
          label={t('progress', { answered: view.progress.answered, total: view.progress.total })}
          branchOpenedLabel={t('branchOpened')}
          branchOpened={branchOpened}
        />
      </div>

      {question === null ? (
        <Card>
          <h2 className="text-xl">{t('review')}</h2>
          <AnsweredList view={view} />

          {view.unansweredRequired.length > 0 ? (
            <Notice tone="urgent" role="status">
              {t('incomplete')}
            </Notice>
          ) : (
            <button
              type="button"
              className="gi-button-primary mt-6 w-full"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? t('submitting') : t('submitLabel')}
            </button>
          )}

          {problem !== null && <ProblemNotice problem={problem} />}
        </Card>
      ) : (
        // The question id is exposed so end-to-end tests and support can address a specific
        // question without matching on prompt text, which changes with wording and language.
        <Card className="scroll-mt-4" data-question-id={question.id}>
          {view.answeredQuestions.length > 0 && question.id !== undefined && (
            <TriggerNote view={view} questionId={question.id} />
          )}

          <h2 ref={promptRef} tabIndex={-1} className="text-xl outline-none">
            {question.prompt}
            {!question.required && (
              <span className="ml-2 text-sm font-normal text-ink-faint">
                {tQuestion('optional')}
              </span>
            )}
          </h2>

          {question.help !== null && <p className="mt-2 text-ink-muted">{question.help}</p>}
          <ClinicalTerms question={question} />

          {question.referenceImageIds.length > 0 && (
            <ReferenceImages ids={question.referenceImageIds} />
          )}

          <div className="mt-6">
            <QuestionField
              question={question}
              value={draft}
              onChange={setDraft}
              disabled={saving}
            />
          </div>

          {problem !== null && <ProblemNotice problem={problem} />}

          <div className="mt-7 flex items-center gap-3">
            <button
              type="button"
              className="gi-button-primary flex-1"
              disabled={draft === null || saving}
              onClick={() => draft !== null && void save(draft)}
            >
              {saving ? tApp('saving') : t('next')}
            </button>
            {saving && <Spinner label={tApp('saving')} />}
          </div>

          {problem !== null && problem.code === 'network' && (
            <p className="gi-hint" role="status">
              {t('unsavedRetry')}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function TriggerNote({ view, questionId }: { view: InterviewView; questionId: string }) {
  const t = useTranslations('question');
  const entry = view.answeredQuestions.find((item) => item.question.id === questionId);
  const trigger = entry?.askedBecause;
  if (trigger === undefined || trigger === null) return null;
  return <p className="mb-2 text-sm text-ink-faint">{t('whyAsked', { trigger })}</p>;
}

function AnsweredList({ view }: { view: InterviewView }) {
  const tQuestion = useTranslations('question');
  const tDoctor = useTranslations('doctor');
  return (
    <dl className="mt-4 space-y-4">
      {view.answeredQuestions.map((entry) => (
        <div key={entry.question.id} className="border-b border-line pb-3 last:border-0">
          <dt className="text-sm text-ink-muted">{entry.question.prompt}</dt>
          <dd className="mt-0.5 font-medium">{renderAnswer(entry.question, entry.value, {
            days: (count) => tDoctor('days', { count }),
            region: (id) => tQuestion.has(`region_${id}`) ? tQuestion(`region_${id}`) : id,
          })}</dd>
        </div>
      ))}
    </dl>
  );
}

function renderAnswer(
  question: InterviewView['answeredQuestions'][number]['question'],
  value: AnswerValue,
  labels: { days: (count: number) => string; region: (id: string) => string },
): string {
  switch (value.kind) {
    case 'single_select':
      return question.options.find((option) => option.id === value.optionId)?.label ?? value.optionId;
    case 'multi_select':
      return value.optionIds
        .map((id) => question.options.find((option) => option.id === id)?.label ?? id)
        .join(', ');
    case 'numeric':
      return `${value.value} ${value.unit}`;
    case 'scale':
      return String(value.value);
    case 'duration':
      return labels.days(value.days);
    case 'date':
      return value.value;
    case 'text':
      return value.value;
    case 'body_map':
      return value.regionIds.map(labels.region).join(', ');
    case 'image':
      return String(value.documentIds.length);
  }
}

function ProblemNotice({ problem }: { problem: ApiProblem }) {
  const t = useTranslations();
  return (
    <div className="mt-4">
      <Notice tone="emergency" role="alert">
        {t(problem.messageKey as never)}
      </Notice>
    </div>
  );
}
