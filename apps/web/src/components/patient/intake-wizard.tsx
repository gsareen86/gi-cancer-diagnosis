'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ApiProblem } from '@/lib/api-client';
import { Card, Notice, Progress, Spinner } from '@/components/primitives';
import { Stepper, type StepDefinition } from '@/components/ui/navigation';
import { useToast } from '@/components/ui/toast';
import { EmergencyAdvisoryScreen, EmergencyBanner } from '@/components/questionnaire/emergency-advisory';
import { ClinicalTerms, QuestionField } from '@/components/questionnaire/question-field';
import { ReferenceImages } from '@/components/questionnaire/reference-images';
import type { AnswerValue, InterviewView } from '@/components/questionnaire/types';
import { DocumentUploader, type UploadedDocumentView } from '@/components/document-uploader';
import { HistoryStep } from './history-step';
import {
  STAGE_LABEL_KEY,
  STAGE_ORDER,
  completedStages,
  stageForCluster,
  stageIndex,
  type StageId,
} from '@/lib/intake-stages';

/**
 * The intake.
 *
 * A staged presentation wrapped around the questionnaire engine — the engine's contract is
 * unchanged, and three of its behaviours matter more than anything visual here.
 *
 * Nothing advances past a question whose answer has not been persisted. The Next button submits
 * and waits; a failed save keeps the answer on screen, marks it unsaved, and retries, rather than
 * moving on and silently losing it.
 *
 * The emergency advisory is rendered from the same response that saved the answer. There is no
 * second request, no polling, and no dependency on the AI pipeline — a patient who has just
 * described a bleed sees the advisory in the same interaction, ahead of the rail and the stage.
 *
 * Progress is recomputed from the server's view of the current path, so when an answer opens a
 * branch the denominator grows and the interface says why. The rail never moves backwards: it
 * tracks the furthest stage reached, because a branch that reopens an earlier cluster un-ticking
 * three stages reads as losing work even though nothing was lost.
 *
 * After the engine reports the questionnaire complete, three local stages follow — the clinical
 * history form, uploads, and a final review — before submission.
 */

type Phase = 'questions' | 'record' | 'reports' | 'review';

export function IntakeWizard({
  caseId,
  initialView,
  hasEmergencyContact,
  documents,
}: {
  caseId: string;
  initialView: InterviewView;
  hasEmergencyContact: boolean;
  documents: UploadedDocumentView[];
}) {
  const t = useTranslations('case');
  const tApp = useTranslations('app');
  const tQuestion = useTranslations('question');
  const tIntake = useTranslations('intake');
  const router = useRouter();
  const { toast } = useToast();

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
  const [uploadBusy, setUploadBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>(initialView.nextQuestion === null ? 'record' : 'questions');
  const [furthest, setFurthest] = useState<StageId>('symptoms');

  const promptRef = useRef<HTMLHeadingElement>(null);
  const previousTotal = useRef(view.progress.total);
  const previousQuestionId = useRef(view.nextQuestion?.id ?? null);

  const question = view.nextQuestion;

  const currentStage: StageId =
    phase === 'questions'
      ? question === null
        ? 'background'
        : stageForCluster(question.cluster)
      : phase === 'record'
        ? 'record'
        : phase === 'reports'
          ? 'reports'
          : 'review';

  useEffect(() => {
    setFurthest((current) =>
      stageIndex(currentStage) > stageIndex(current) ? currentStage : current,
    );
  }, [currentStage]);

  useEffect(() => {
    const current = view.nextQuestion?.id ?? null;
    if (current !== previousQuestionId.current) {
      previousQuestionId.current = current;
      // Move focus to the new question so a screen-reader user is not left at the bottom of the
      // page they just submitted.
      promptRef.current?.focus();
    }
  }, [view.nextQuestion?.id]);

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

      if (next.nextQuestion === null) setPhase('record');
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
      toast({ message: t('submitFailed'), tone: 'emergency' });
      return;
    }
    toast({ message: t('submitSucceeded'), tone: 'ok' });
    router.push(`/patient/case/${caseId}`);
    router.refresh();
  }

  // The advisory takes over the whole screen, ahead of the rail and the current stage.
  if (showAdvisory && view.emergency !== null) {
    return (
      <EmergencyAdvisoryScreen
        advisory={view.emergency}
        onAcknowledge={acknowledge}
        hasEmergencyContact={hasEmergencyContact}
      />
    );
  }

  const steps: StepDefinition[] = STAGE_ORDER.map((stage) => ({
    id: stage,
    label: tIntake(STAGE_LABEL_KEY[stage] as never),
  }));

  return (
    <div className="mx-auto max-w-2xl">
      {view.emergency !== null && advisoryAcknowledged && <EmergencyBanner />}

      <div className="mb-6">
        <Stepper
          steps={steps}
          currentId={stageIndex(furthest) > stageIndex(currentStage) && phase === 'questions' ? furthest : currentStage}
          completedIds={completedStages(furthest, currentStage)}
          label={tIntake('railLabel')}
          stepStatusLabel={(position, total, name) =>
            tIntake('stepStatus', { position, total, name })
          }
        />

        {phase === 'questions' && (
          <div className="mt-4">
            <Progress
              answered={view.progress.answered}
              total={view.progress.total}
              label={t('progress', {
                answered: view.progress.answered,
                total: view.progress.total,
              })}
              branchOpenedLabel={t('branchOpened')}
              branchOpened={branchOpened}
            />
          </div>
        )}
      </div>

      {phase === 'questions' && question !== null && (
        // The question id is exposed so end-to-end tests and support can address a specific
        // question without matching on prompt text, which changes with wording and language.
        <Card className="scroll-mt-4" data-question-id={question.id}>
          <TriggerNote view={view} questionId={question.id} />

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

      {phase === 'record' && (
        <HistoryStep
          caseId={caseId}
          onComplete={() => setPhase('reports')}
          onBack={() => {
            // The engine has no "previous question": answers are already persisted and an
            // earlier one is corrected from the review stage, where the whole set is visible.
            setPhase('review');
          }}
        />
      )}

      {phase === 'reports' && (
        <Card>
          <h2 className="text-xl">{tIntake('reportsHeading')}</h2>
          <p className="mt-2 text-ink-muted">{tIntake('reportsIntro')}</p>

          <div className="mt-5">
            <DocumentUploader caseId={caseId} editable initial={documents} onBusyChange={setUploadBusy} />
          </div>

          <div className="mt-7 flex flex-wrap gap-3 border-t border-line pt-5">
            <button
              type="button"
              className="gi-button-secondary"
              onClick={() => setPhase('record')}
              disabled={uploadBusy}
            >
              {tApp('back')}
            </button>
            <button
              type="button"
              className="gi-button-primary flex-1"
              onClick={() => setPhase('review')}
              disabled={uploadBusy}
            >
              {tIntake('continueToReview')}
            </button>
          </div>
        </Card>
      )}

      {phase === 'review' && (
        <Card>
          <h2 className="text-xl">{t('review')}</h2>
          <p className="mt-2 text-ink-muted">{tIntake('reviewIntro')}</p>

          <AnsweredList view={view} />

          {view.unansweredRequired.length > 0 ? (
            <div className="mt-6">
              <Notice tone="urgent" role="status" title={tIntake('incompleteHeading')}>
                {t('incomplete')}
              </Notice>
              <button
                type="button"
                className="gi-button-secondary mt-4"
                onClick={() => setPhase('questions')}
              >
                {tIntake('backToQuestions')}
              </button>
            </div>
          ) : (
            <div className="mt-7 flex flex-wrap gap-3 border-t border-line pt-5">
              <button
                type="button"
                className="gi-button-secondary"
                onClick={() => setPhase('reports')}
              >
                {tApp('back')}
              </button>
              <button
                type="button"
                className="gi-button-primary flex-1"
                onClick={() => void submit()}
                disabled={submitting}
              >
                {submitting ? t('submitting') : t('submitLabel')}
              </button>
            </div>
          )}

          {problem !== null && <ProblemNotice problem={problem} />}
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
  const t = useTranslations('intake');
  const tQuestion = useTranslations('question');
  const tDoctor = useTranslations('doctor');
  if (view.answeredQuestions.length === 0) {
    return <p className="mt-4 text-sm text-ink-faint">{t('noAnswersYet')}</p>;
  }

  return (
    <dl className="mt-5 space-y-3">
      {view.answeredQuestions.map((entry) => (
        <div key={entry.question.id} className="border-b border-line pb-3 last:border-0">
          <dt className="text-sm text-ink-muted">{entry.question.prompt}</dt>
          <dd className="mt-0.5 font-medium">{renderAnswer(entry.question, entry.value, {
            days: (count) => tDoctor('days', { count }),
            region: (id) => tQuestion.has(`region_${id}`) ? tQuestion(`region_${id}`) : id,
          })}</dd>
          {entry.askedBecause !== null && (
            <p className="mt-0.5 text-xs text-ink-faint">{tQuestion('whyAsked', { trigger: entry.askedBecause })}</p>
          )}
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
