'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ApiProblem } from '@/lib/api-client';
import { Badge, Field, Notice, type Tone } from '@/components/primitives';
import { useToast } from '@/components/ui/toast';
import { AlertIcon, CheckIcon, ShieldIcon, SparklesIcon } from '@/components/ui/icons';
import { addAiDraft, type DraftField } from '@/lib/ai-draft';
import { AiDraftDrawer } from './ai-draft-drawer';
import { ReleaseDialog } from './release-dialog';
import type { AssessmentView, FinalSummary, ReferralUrgency, GenerateAssessment } from './types';
import { REFERRAL_URGENCIES } from './types';

/** Physician-owned review. AI text is an editable draft; prescriptions are entered manually. */

interface DifferentialDraft {
  condition: string;
  likelihood: 'high' | 'moderate' | 'low';
  origin: 'ai' | 'doctor';
  rejected: boolean;
  rationale?: string;
}

const REFERRAL_TONE: Record<ReferralUrgency, Tone> = {
  emergency: 'emergency',
  within_week: 'urgent',
  routine: 'accent',
  none: 'neutral',
};

export function SignOffPanel({
  caseId,
  assessment,
  running,
  aiProblem,
  generate,
  saved,
  reviewStatus,
  draftRevision,
  doctorNotes,
}: {
  caseId: string;
  assessment: AssessmentView | null;
  running: boolean;
  aiProblem: ApiProblem | null;
  generate: GenerateAssessment;
  saved: FinalSummary | null;
  reviewStatus: string | null;
  draftRevision: number;
  doctorNotes: string | null;
}) {
  const t = useTranslations('doctor');
  const tAll = useTranslations();
  const router = useRouter();
  const { toast } = useToast();
  const payload = assessment?.payload ?? null;
  const [aiOpen, setAiOpen] = useState(false);
  const closeAi = useCallback(() => setAiOpen(false), []);

  const [differential, setDifferential] = useState<DifferentialDraft[]>(
    saved?.differential?.map((item) => ({
      condition: item.condition,
      likelihood: item.likelihood,
      origin: item.origin,
      rejected: item.rejected ?? false,
      ...(item.rationale === undefined ? {} : { rationale: item.rationale }),
    })) ??
      payload?.differential_assessment.map((item) => ({
        condition: item.condition,
        likelihood: item.likelihood,
        origin: 'ai' as const,
        rejected: false,
      })) ??
      [],
  );

  const [impression, setImpression] = useState(saved?.clinicalImpression ?? payload?.clinician_summary ?? '');
  const [diagnosis, setDiagnosis] = useState(saved?.diagnosis ?? '');
  const [patientSummary, setPatientSummary] = useState(saved?.patientFacingSummary ?? '');
  const [dietaryAdvice, setDietaryAdvice] = useState(saved?.dietaryAdvice ?? '');
  const [precautions, setPrecautions] = useState(saved?.precautions ?? '');
  const [referralUrgency, setReferralUrgency] = useState<ReferralUrgency>(
    saved?.referralUrgency ?? 'routine',
  );
  const [followUpInterval, setFollowUpInterval] = useState(saved?.followUpInterval ?? '');
  const [notes, setNotes] = useState(doctorNotes ?? '');
  const [prescriptionInstructions, setPrescriptionInstructions] = useState(saved?.prescriptionInstructions ?? '');
  const [workup, setWorkup] = useState((saved?.recommendedNextSteps ?? []).join('\n'));

  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [finalized, setFinalized] = useState(reviewStatus === 'finalized');
  const [locallyReleased, setReleased] = useState(false);
  const released = locallyReleased || reviewStatus === 'released';
  const [confirming, setConfirming] = useState(false);
  const draftVersion = JSON.stringify({ differential, impression, diagnosis, patientSummary, dietaryAdvice, precautions, referralUrgency, followUpInterval, notes, prescriptionInstructions, workup });
  const [finalizedVersion, setFinalizedVersion] = useState(reviewStatus === 'finalized' ? draftVersion : null);
  const canDispatch = finalized && finalizedVersion === draftVersion;
  const initialDraft = useRef(draftVersion);
  const revision = useRef(draftRevision);
  const saving = useRef(false);
  const [autosaving, setAutosaving] = useState(false);
  const [edited, setEdited] = useState(false);
  const [savedVersion, setSavedVersion] = useState(draftVersion);
  const dirty = edited && draftVersion !== savedVersion && !released;
  useEffect(() => {
    if (!dirty) revision.current = draftRevision;
  }, [draftRevision]);
  // Server drafts preserve clinical notes without leaving PHI in shared-device storage.
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const navigation = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest('a[href]');
      if (link && !link.getAttribute('href')?.startsWith('#') && !window.confirm(t('unsavedNavigation'))) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigation, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigation, true); };
  }, [dirty, t]);
  const adoptedAssessment = useRef(payload);
  useEffect(() => {
    if (payload === null || adoptedAssessment.current === payload) return;
    adoptedAssessment.current = payload;
    // A result arriving after generation can fill an untouched new editor, never overwrite
    // physician edits, a saved draft, an approved chart, or an in-flight save.
    if (saved !== null || draftVersion !== initialDraft.current || pending || finalized || released) return;
    setDifferential(payload.differential_assessment.map((item) => ({ condition: item.condition, likelihood: item.likelihood, origin: 'ai', rejected: false })));
    setImpression(payload.clinician_summary);
  }, [payload, saved, draftVersion, pending, finalized, released]);

  function applySuggestion(field: DraftField, suggestion: string) {
    if (released || pending || running) return;
    const result = addAiDraft(field === 'summary' ? patientSummary : workup, suggestion, field);
    if (!result.ok) { toast({ message: t(`aiDraft_${result.reason}`), tone: 'caution' }); return; }
    if (field === 'summary') setPatientSummary(result.value);
    else setWorkup(result.value);
    setEdited(true);
    setFinalized(false);
    setFinalizedVersion(null);
    toast({ message: t('aiApplied'), tone: 'ok' });
  }

  /**
   * What the patient will read, as an ordered list.
   *
   * One physician-approved action per line, kept as `recommendedNextSteps` on the wire.
   * The release confirmation displays the same array that will be frozen.
   */
  function releasedSteps(): string[] {
    return workup.split('\n').map((line) => line.trim()).filter(Boolean);
  }

  function diffsFrom(): Array<Record<string, unknown>> {
    const original = payload?.differential_assessment ?? [];
    const diffs: Array<Record<string, unknown>> = [];

    for (const item of differential) {
      const source = original.find((entry) => entry.condition === item.condition);
      if (source === undefined) {
        diffs.push({
          action: 'item_added',
          conditionId: item.condition,
          afterValue: item.likelihood,
          rationale: item.rationale,
        });
      } else if (item.rejected) {
        diffs.push({
          action: 'item_rejected',
          conditionId: item.condition,
          beforeValue: source.likelihood,
          rationale: item.rationale,
        });
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
        diffs.push({
          action: 'item_removed',
          conditionId: source.condition,
          beforeValue: source.likelihood,
        });
      }
    }
    return diffs;
  }

  async function save(finalize: boolean, automatic = false) {
    if (saving.current || released) return;
    saving.current = true;
    if (automatic) setAutosaving(true); else setPending(true);
    setProblem(null);

    const result = await api.put<{ status: string; draftRevision: number }>(`/api/doctor/cases/${caseId}/review`, {
      expectedRevision: revision.current,
      differential,
      recommendedNextSteps: releasedSteps(),
      clinicalImpression: impression,
      patientFacingSummary: patientSummary,
      diagnosis,
      dietaryAdvice,
      precautions,
      referralUrgency,
      followUpInterval,
      prescriptionInstructions,
      doctorNotes: notes,
      diffs: diffsFrom(),
      finalize,
    });
    setPending(false);
    setAutosaving(false);
    saving.current = false;

    if (!result.ok) {
      setProblem(result.problem);
      if (!automatic) toast({
        message: finalize ? t('finalizeFailed') : t('saveFailed'),
        tone: 'emergency',
      });
      return;
    }
    revision.current = result.data.draftRevision;
    setSavedVersion(draftVersion);

    if (finalize) {
      setFinalized(true);
      setFinalizedVersion(draftVersion);
      toast({ message: t('finalizeSucceeded'), tone: 'ok' });
    } else {
      setFinalized(false);
      setFinalizedVersion(null);
      if (!automatic) toast({ message: t('saveSucceeded'), tone: 'ok' });
    }
  }

  const saveLatest = useRef(save);
  saveLatest.current = save;
  useEffect(() => {
    if (!dirty || pending || autosaving || problem !== null || confirming) return;
    const timer = window.setTimeout(() => void saveLatest.current(false, true), 1000);
    return () => window.clearTimeout(timer);
  }, [dirty, draftVersion, pending, autosaving, problem, confirming]);

  const lockedNotice = released ? (
    <Notice tone="ok" role="status" title={t('releasedTitle')}>
      {t('releasedBody')}
    </Notice>
  ) : canDispatch ? (
    <Notice tone="accent" role="status" title={t('finalizedTitle')}>
      {t('finalizedBody')}
    </Notice>
  ) : null;

  return (
    <div className="space-y-6 pb-2" onChangeCapture={() => setEdited(true)}>
      {!released && <p role="status" className="text-xs text-ink-muted">{t(autosaving ? 'autosaving' : problem !== null ? 'autosaveFailed' : dirty ? 'autosavePending' : 'autosaveSaved')}</p>}
      {lockedNotice}

      <details className="rounded-xl border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">{t('yourDifferentialHeading')}</summary>
        <DifferentialEditor items={differential} onChange={(value) => { setEdited(true); setDifferential(value); }} disabled={released || pending} />
      </details>

      {/* ------------------------------------------------------------- Doctor-only --- */}
      <section className="border-t border-line pt-6">
        <header className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-sunken text-accent">
            <ShieldIcon className="h-4 w-4" />
          </span>
          <div>
            <h3 className="gi-section-title">{t('doctorOnlyHeading')}</h3>
            <p className="mt-1 text-xs text-ink-muted">{t('doctorOnlyHint')}</p>
          </div>
        </header>

        <div className="mt-5">
          <Field label={t('impression')} htmlFor="impression" hint={t('impressionHint')} className="mb-4">
            <textarea
              id="impression" maxLength={6000}
              className="gi-input gi-editor-lg"
              value={impression}
              disabled={released || pending}
              onChange={(event) => setImpression(event.target.value)}
            />
          </Field>

          <Field label={t('notes')} htmlFor="notes" hint={t('notesHint')} className="mb-0">
            <textarea
              id="notes" maxLength={6000}
              className="gi-input gi-editor-lg"
              value={notes}
              disabled={released || pending}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        </div>
      </section>

      {/* --------------------------------------------------------- Patient-facing --- */}
      <section className="border-t border-line pt-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="gi-section-title">{t('patientFacingHeading')}</h3>
            <p className="mt-1 text-xs text-ink-muted">{t('patientFacingHint')}</p>
          </div>
          {!released && (
            <button
              type="button"
              className="gi-button-secondary shrink-0"
              disabled={pending}
              onClick={() => setAiOpen(true)}
            >
              <SparklesIcon />{t('aiAssistTitle')}
            </button>
          )}
        </header>
        {!released && <p className="mt-2 text-xs leading-relaxed text-ink-muted sm:max-w-2xl">{t('aiAssistShort')}</p>}

        <div className="mt-5">
          <Field label={t('diagnosis')} htmlFor="diagnosis" hint={t('diagnosisHint')} className="mb-4">
            <textarea
              id="diagnosis" maxLength={2000}
              className="gi-input gi-editor-lg"
              value={diagnosis}
              disabled={released || pending}
              onChange={(event) => setDiagnosis(event.target.value)}
            />
          </Field>

          <Field
            label={t('patientSummary')}
            htmlFor="patient-summary"
            hint={t('patientSummaryHint')}
            className="mb-4"
          >
            {!released && <button type="button" className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-accent underline underline-offset-4" disabled={pending} onClick={() => setAiOpen(true)}><SparklesIcon className="h-3.5 w-3.5" />{t('aiPreviewSummary')}</button>}
            <textarea
              id="patient-summary" maxLength={6000}
              className="gi-input gi-editor-xl"
              value={patientSummary}
              disabled={released || pending}
              onChange={(event) => setPatientSummary(event.target.value)}
            />
          </Field>

          <Field
            label={t('dietaryAdvice')}
            htmlFor="dietary-advice"
            hint={t('dietaryAdviceHint')}
            className="mb-4"
          >
            <textarea
              id="dietary-advice" maxLength={4000}
              className="gi-input gi-editor-lg"
              value={dietaryAdvice}
              disabled={released || pending}
              onChange={(event) => setDietaryAdvice(event.target.value)}
            />
          </Field>

          <Field
            label={t('precautions')}
            htmlFor="precautions"
            hint={t('precautionsHint')}
            className="mb-4"
          >
            <textarea
              id="precautions" maxLength={4000}
              className="gi-input gi-editor-lg"
              value={precautions}
              disabled={released || pending}
              onChange={(event) => setPrecautions(event.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('referralUrgency')}
              htmlFor="referral-urgency"
              hint={t('referralUrgencyHint')}
              className="mb-0"
            >
              <select
                id="referral-urgency"
                className="gi-select"
                value={referralUrgency}
                disabled={released || pending}
                onChange={(event) => setReferralUrgency(event.target.value as ReferralUrgency)}
              >
                {REFERRAL_URGENCIES.map((value) => (
                  <option key={value} value={value}>
                    {t(`referral_${value}` as never)}
                  </option>
                ))}
              </select>
              <p className="mt-2">
                <Badge tone={REFERRAL_TONE[referralUrgency]}>
                  {t(`referral_${referralUrgency}` as never)}
                </Badge>
              </p>
            </Field>

            <Field
              label={t('followUpInterval')}
              htmlFor="follow-up"
              hint={t('followUpIntervalHint')}
              className="mb-0"
            >
              <input
                id="follow-up" maxLength={500}
                className="gi-input"
                value={followUpInterval}
                disabled={released || pending}
                onChange={(event) => setFollowUpInterval(event.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="mt-4">
          <Field label={t('workupInstructions')} htmlFor="workup-instructions" hint={t('workupHint')}>
            {!released && <button type="button" className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-accent underline underline-offset-4" disabled={pending} onClick={() => setAiOpen(true)}><SparklesIcon className="h-3.5 w-3.5" />{t('aiPreviewWorkup')}</button>}
            <textarea id="workup-instructions" className="gi-input gi-editor-lg" value={workup} disabled={released || pending} maxLength={4000} onChange={(event) => setWorkup(event.target.value)} />
          </Field>
          <Field label={t('prescriptionInstructions')} htmlFor="prescription-instructions" hint={t('prescriptionHint')}>
            <textarea id="prescription-instructions" className="gi-input gi-editor-lg" value={prescriptionInstructions} disabled={released || pending} maxLength={4000} onChange={(event) => setPrescriptionInstructions(event.target.value)} />
          </Field>
        </div>
      </section>

      <AiDraftDrawer open={aiOpen && !released} onClose={closeAi} assessment={assessment} running={running} problem={aiProblem}
        generate={generate} disabled={released || pending} summary={patientSummary} workup={workup} onApply={applySuggestion} />

      {/* --------------------------------------------------------------- Outcomes --- */}
      {problem !== null && (
        <Notice tone="emergency" role="alert">
          {tAll(problem.messageKey as never)}
        </Notice>
      )}

      {!released && (
        <div data-review-actions className="flex flex-col gap-3 rounded-xl border border-line bg-surface-sunken p-3 sm:flex-row sm:items-center sm:justify-between">
          {!canDispatch && (
            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <AlertIcon className="h-3.5 w-3.5" />
              {t('finalizeBeforeRelease')}
            </span>
          )}
          <div className="flex flex-wrap gap-2 sm:ml-auto sm:justify-end">
            <button
              type="button"
              className="gi-button-secondary"
              disabled={pending || autosaving}
              onClick={() => void save(false)}
            >
              {t('save')}
            </button>
            <button
              type="button"
              className="gi-button-secondary"
              disabled={pending || autosaving}
              onClick={() => void save(true)}
            >
              <CheckIcon className="h-4 w-4" />
              {t('finalize')}
            </button>
            <button
              type="button"
              className="gi-button-primary"
              disabled={pending || autosaving || dirty || !canDispatch}
              onClick={() => setConfirming(true)}
            >
              {t('signAndDispatch')}
            </button>
          </div>
        </div>
      )}

      {confirming && (
        <ReleaseDialog
          caseId={caseId}
          summary={patientSummary}
          nextSteps={releasedSteps()}
          diagnosis={diagnosis}
          dietaryAdvice={dietaryAdvice}
          precautions={precautions}
          referralUrgency={referralUrgency}
          followUpInterval={followUpInterval}
          prescriptionInstructions={prescriptionInstructions}
          onCancel={() => setConfirming(false)}
          onReleased={() => {
            setConfirming(false);
            setReleased(true);
            toast({ message: t('releaseSucceeded'), tone: 'ok' });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/**
 * The doctor's differential.
 *
 * Items the model raised are marked `ai`; items the doctor added are marked `doctor`. Rejecting
 * keeps an item visible with a strike through it rather than deleting it, because "the model
 * suggested this and I disagreed" is a different clinical record from "this was never raised" —
 * and the first is what the feedback diff is for.
 */
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
    <section className="rounded-lg border border-line bg-surface p-4">
      <h3 className="gi-section-title">{t('yourDifferentialHeading')}</h3>
      <p className="mt-1 text-xs text-ink-muted">{t('yourDifferentialHint')}</p>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-faint">{t('differentialEmpty')}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item, index) => (
            <li
              key={item.condition}
              className={`rounded-lg border p-3 ${
                item.rejected ? 'border-line bg-surface-inset' : 'border-line bg-surface'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={item.rejected ? 'text-ink-faint line-through' : 'font-medium'}>
                  {item.condition}
                </span>
                <Badge tone={item.origin === 'doctor' ? 'accent' : 'neutral'}>
                  {t(item.origin === 'doctor' ? 'originDoctor' : 'originAi')}
                </Badge>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`likelihood-${index}`}>
                  {t('likelihood')}
                </label>
                <select
                  id={`likelihood-${index}`}
                  className="gi-select w-auto"
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
                  className="text-xs font-medium text-urgent underline underline-offset-4 disabled:opacity-50"
                  disabled={disabled}
                  onClick={() => {
                    const next = [...items];
                    next[index] = { ...item, rejected: !item.rejected };
                    onChange(next);
                  }}
                >
                  {item.rejected ? t('unrejectItem') : t('rejectItem')}
                </button>

                <button
                  type="button"
                  className="text-xs font-medium text-emergency underline underline-offset-4 disabled:opacity-50"
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
                id={`rationale-${index}`} maxLength={2000}
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
      )}

      <div className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor="new-condition">
          {t('addItem')}
        </label>
        <input
          id="new-condition" maxLength={200}
          className="gi-input"
          placeholder={t('addItemPlaceholder')}
          value={newCondition}
          disabled={disabled}
          onChange={(event) => setNewCondition(event.target.value)}
        />
        <button
          type="button"
          className="gi-button-secondary shrink-0"
          disabled={disabled || items.length >= 12 || newCondition.trim() === '' || items.some((item) => item.condition.toLowerCase() === newCondition.trim().toLowerCase())}
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
    </section>
  );
}
