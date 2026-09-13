'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, type ApiProblem } from '@/lib/api-client';
import { Field, Notice } from '@/components/primitives';
import { SkeletonText, StatusChip } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { PillIcon, ScissorsIcon, TrashIcon, UsersIcon } from '@/components/ui/icons';
import {
  ALCOHOL_STATUSES,
  CONDITION_CODES,
  DIET_TYPES,
  FAMILY_CONDITION_CODES,
  FAMILY_RELATIONS,
  MEDICATION_KINDS,
  SMOKING_STATUSES,
  SURGERY_CODES,
  bmiBand,
  bodyMassIndex,
  type AllergyEntry,
  type ClinicalHistoryView,
  type ClinicalHistoryInput,
  type ConditionEntry,
  type FamilyHistoryEntry,
  type Lifestyle,
  type MedicationEntry,
  type SurgeryEntry,
} from '@/lib/clinical-history';

/**
 * The clinical-history stage.
 *
 * The single most useful thing a patient can tell a gastroenterologist that the symptom
 * questionnaire does not ask: what else is wrong with them, what they have had removed, and what
 * they are taking. Long-term NSAID use changes the entire reading of an upper-GI presentation,
 * and a patient will rarely volunteer it.
 *
 * Everything here is optional and the stage can be skipped. That is a deliberate trade: a form
 * that blocks progress gets abandoned, and an abandoned intake reaches the doctor as nothing at
 * all. What is not optional is that the doctor be told the difference — the record carries a
 * `completedAt`, and a skipped stage shows on the review as "not recorded" rather than as a
 * patient who reported no conditions.
 *
 * A new case pre-fills from the patient's most recent completed history, copied rather than
 * linked, so editing it here cannot change what an earlier reviewer saw.
 */

interface Draft {
  trajectory: NonNullable<ClinicalHistoryInput['trajectory']>;
  assertions: ClinicalHistoryInput['assertions'];
  heightCm: string;
  weightKg: string;
  conditions: ConditionEntry[];
  surgeries: SurgeryEntry[];
  medications: MedicationEntry[];
  allergies: AllergyEntry[];
  familyHistory: FamilyHistoryEntry[];
  lifestyle: Lifestyle;
  additionalNotes: string;
}

const EMPTY: Draft = {
  trajectory: { onset: '', course: 'unknown', impact: '', remedies: '', response: '', previousConsultations: '' },
  assertions: {},
  heightCm: '',
  weightKg: '',
  conditions: [],
  surgeries: [],
  medications: [],
  allergies: [],
  familyHistory: [],
  lifestyle: { smoking: 'unknown', alcohol: 'unknown' },
  additionalNotes: '',
};

function fromView(view: Partial<ClinicalHistoryView> | null): Draft {
  if (view === null) return EMPTY;
  return {
    trajectory: view.trajectory ?? EMPTY.trajectory,
    assertions: view.assertions ?? {},
    heightCm: view.heightCm == null ? '' : String(view.heightCm),
    // The column is `numeric`, so it arrives as "70.00"; trailing zeros in an input the patient
    // is about to edit look like a system that already knows better than them.
    weightKg: view.weightKg == null ? '' : String(Number.parseFloat(view.weightKg)),
    conditions: view.conditions ?? [],
    surgeries: view.surgeries ?? [],
    medications: view.medications ?? [],
    allergies: view.allergies ?? [],
    familyHistory: view.familyHistory ?? [],
    lifestyle: view.lifestyle ?? { smoking: 'unknown', alcohol: 'unknown' },
    additionalNotes: view.additionalNotes ?? '',
  };
}

export function HistoryStep({
  caseId,
  onComplete,
  onBack,
}: {
  caseId: string;
  onComplete: () => void;
  onBack: () => void;
}) {
  const t = useTranslations('history');
  const tApp = useTranslations('app');
  const tAll = useTranslations();
  const { toast } = useToast();

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);

  useEffect(() => {
    async function load() {
      const result = await api.get<{
        history: ClinicalHistoryView | null;
        prefill: Partial<ClinicalHistoryView> | null;
      }>(`/api/cases/${caseId}/history`);
      if (result.ok) {
        if (result.data.history !== null) {
          setDraft(fromView(result.data.history));
        } else if (result.data.prefill !== null) {
          setDraft(fromView(result.data.prefill));
          setPrefilled(true);
        }
      }
      setLoaded(true);
    }
    void load();
  }, [caseId]);

  const save = useCallback(
    async (complete: boolean) => {
      setSaving(true);
      setProblem(null);

      const height = draft.heightCm.trim() === '' ? null : Number.parseInt(draft.heightCm, 10);
      const weight = draft.weightKg.trim() === '' ? null : Number.parseFloat(draft.weightKg);

      const result = await api.put(`/api/cases/${caseId}/history`, {
        trajectory: draft.trajectory,
        assertions: Object.fromEntries((['conditions', 'surgeries', 'medications', 'allergies', 'familyHistory'] as const).map(key => [key, draft[key].length ? 'provided' : draft.assertions[key] ?? 'unknown'])),
        heightCm: height === null || Number.isNaN(height) ? null : height,
        weightKg: weight === null || Number.isNaN(weight) ? null : weight,
        conditions: draft.conditions,
        surgeries: draft.surgeries,
        medications: draft.medications,
        allergies: draft.allergies,
        familyHistory: draft.familyHistory,
        lifestyle: draft.lifestyle,
        additionalNotes: draft.additionalNotes.trim() === '' ? null : draft.additionalNotes,
        lastMenstrualPeriod: null,
        complete,
      });
      setSaving(false);

      if (!result.ok) {
        setProblem(result.problem);
        toast({ message: t('saveFailed'), tone: 'emergency' });
        return;
      }
      if (complete) {
        toast({ message: t('saved'), tone: 'ok' });
        onComplete();
      }
    },
    [caseId, draft, onComplete, t, toast],
  );

  if (!loaded) {
    return (
      <div className="gi-card">
        <SkeletonText lines={6} />
      </div>
    );
  }

  const bmi = bodyMassIndex(
    draft.heightCm === '' ? null : Number.parseInt(draft.heightCm, 10),
    draft.weightKg === '' ? null : draft.weightKg,
  );

  return (
    <div className="gi-card">
      <h2 className="text-xl">{t('heading')}</h2>
      <p className="mt-2 text-ink-muted">{t('intro')}</p>

      <section className="mt-6 rounded-xl border border-line bg-surface-inset p-4">
        <h3 className="gi-section-title">{t('trajectoryHeading')}</h3>
        <p className="gi-hint">{t('trajectoryHint')}</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {(['onset', 'impact', 'remedies', 'response', 'previousConsultations'] as const).map(key => (
            <Field key={key} label={t(`trajectory_${key}`)} htmlFor={`trajectory-${key}`} className="mb-0">
              <textarea id={`trajectory-${key}`} className="gi-input min-h-24" maxLength={key === 'onset' ? 300 : 1000} value={draft.trajectory[key]}
                onChange={event => setDraft({ ...draft, trajectory: { ...draft.trajectory, [key]: event.target.value } })} />
            </Field>
          ))}
          <Field label={t('trajectory_course')} htmlFor="trajectory-course" className="mb-0">
            <select id="trajectory-course" className="gi-select" value={draft.trajectory.course} onChange={event => setDraft({ ...draft, trajectory: { ...draft.trajectory, course: event.target.value as Draft['trajectory']['course'] } })}>
              {(['unknown', 'improving', 'unchanged', 'worsening', 'comes_and_goes'] as const).map(value => <option key={value} value={value}>{t(`course_${value}`)}</option>)}
            </select>
          </Field>
        </div>
      </section>

      {prefilled && (
        <div className="mt-4">
          <Notice tone="accent" role="status">
            {t('prefilledNotice')}
          </Notice>
        </div>
      )}

      {/* ------------------------------------------------------------ Anthropometry --- */}
      <section className="mt-6">
        <h3 className="gi-section-title">{t('measurementsHeading')}</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Field label={t('heightLabel')} htmlFor="height" className="mb-0">
            <input
              id="height"
              type="number"
              inputMode="numeric"
              min={50}
              max={260}
              className="gi-input"
              value={draft.heightCm}
              onChange={(event) => setDraft({ ...draft, heightCm: event.target.value })}
            />
          </Field>
          <Field label={t('weightLabel')} htmlFor="weight" className="mb-0">
            <input
              id="weight"
              type="number"
              inputMode="decimal"
              min={10}
              max={400}
              step="0.1"
              className="gi-input"
              value={draft.weightKg}
              onChange={(event) => setDraft({ ...draft, weightKg: event.target.value })}
            />
          </Field>
          <div className="flex flex-col justify-end pb-1">
            <p className="gi-label mb-1.5">{t('bmiLabel')}</p>
            {bmi === null ? (
              <p className="text-sm text-ink-faint">{t('bmiNeedsBoth')}</p>
            ) : (
              <p className="flex items-center gap-2">
                <span className="gi-numeric text-lg font-semibold">{bmi}</span>
                <StatusChip tone={bmiBand(bmi) === 'normal' ? 'ok' : 'caution'} dot={false}>
                  {t(`bmi_${bmiBand(bmi)}` as never)}
                </StatusChip>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Conditions --- */}
      <CodedList
        heading={t('conditionsHeading')}
        hint={t('conditionsHint')}
        addLabel={t('addCondition')}
        codes={CONDITION_CODES}
        codeLabel={(code) => t(`condition_${code}` as never)}
        otherLabel={t('conditionOtherLabel')}
        removeLabel={t('remove')}
        emptyLabel={t('noneAdded')}
        entries={draft.conditions}
        onChange={(conditions) => setDraft({ ...draft, conditions })}
        makeEntry={(code) => ({ code })}
      />

      {/* ----------------------------------------------------------------- Surgeries --- */}
      <CodedList
        icon={<ScissorsIcon className="h-3.5 w-3.5" />}
        heading={t('surgeriesHeading')}
        hint={t('surgeriesHint')}
        addLabel={t('addSurgery')}
        codes={SURGERY_CODES}
        codeLabel={(code) => t(`surgery_${code}` as never)}
        otherLabel={t('surgeryOtherLabel')}
        removeLabel={t('remove')}
        emptyLabel={t('noneAdded')}
        entries={draft.surgeries}
        onChange={(surgeries) => setDraft({ ...draft, surgeries })}
        makeEntry={(code) => ({ code })}
      />

      {/* --------------------------------------------------------------- Medications --- */}
      <section className="mt-6">
        <h3 className="gi-section-title flex items-center gap-1.5">
          <PillIcon className="h-3.5 w-3.5" />
          {t('medicationsHeading')}
        </h3>
        <p className="gi-hint">{t('medicationsHint')}</p>

        {draft.medications.length === 0 ? (
          <p className="mt-2 text-sm text-ink-faint">{t('noneAdded')}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {draft.medications.map((entry, index) => (
              <li key={index} className="rounded-lg border border-line p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <div>
                    <label className="sr-only" htmlFor={`med-name-${index}`}>
                      {t('medicationName')}
                    </label>
                    <input
                      id={`med-name-${index}`}
                      className="gi-input"
                      placeholder={t('medicationName')}
                      value={entry.name}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          medications: replaceAt(draft.medications, index, {
                            ...entry,
                            name: event.target.value,
                          }),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="sr-only" htmlFor={`med-kind-${index}`}>
                      {t('medicationKind')}
                    </label>
                    <select
                      id={`med-kind-${index}`}
                      className="gi-select w-auto"
                      value={entry.kind}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          medications: replaceAt(draft.medications, index, {
                            ...entry,
                            kind: event.target.value as MedicationEntry['kind'],
                          }),
                        })
                      }
                    >
                      {MEDICATION_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {t(`medicationKind_${kind}` as never)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="gi-button-sm gi-button-ghost text-emergency"
                    aria-label={t('remove')}
                    onClick={() =>
                      setDraft({ ...draft, medications: removeAt(draft.medications, index) })
                    }
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>

                <label className="sr-only" htmlFor={`med-freq-${index}`}>
                  {t('medicationFrequency')}
                </label>
                <input
                  id={`med-freq-${index}`}
                  className="gi-input mt-2"
                  placeholder={t('medicationFrequency')}
                  value={entry.frequency ?? ''}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      medications: replaceAt(draft.medications, index, {
                        ...entry,
                        frequency: event.target.value,
                      }),
                    })
                  }
                />
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className="gi-button-secondary mt-3"
          onClick={() =>
            setDraft({
              ...draft,
              medications: [...draft.medications, { name: '', kind: 'prescription' }],
            })
          }
        >
          {t('addMedication')}
        </button>
      </section>

      {/* ----------------------------------------------------------------- Allergies --- */}
      <section className="mt-6">
        <h3 className="gi-section-title">{t('allergiesHeading')}</h3>
        {draft.allergies.length === 0 ? (
          <p className="mt-2 text-sm text-ink-faint">{t('noneAdded')}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {draft.allergies.map((entry, index) => (
              <li key={index} className="flex gap-2">
                <label className="sr-only" htmlFor={`allergy-${index}`}>
                  {t('allergySubstance')}
                </label>
                <input
                  id={`allergy-${index}`}
                  className="gi-input"
                  placeholder={t('allergySubstance')}
                  value={entry.substance}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      allergies: replaceAt(draft.allergies, index, {
                        ...entry,
                        substance: event.target.value,
                      }),
                    })
                  }
                />
                <label className="sr-only" htmlFor={`allergy-reaction-${index}`}>
                  {t('allergyReaction')}
                </label>
                <input
                  id={`allergy-reaction-${index}`}
                  className="gi-input"
                  placeholder={t('allergyReaction')}
                  value={entry.reaction ?? ''}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      allergies: replaceAt(draft.allergies, index, {
                        ...entry,
                        reaction: event.target.value,
                      }),
                    })
                  }
                />
                <button
                  type="button"
                  className="gi-button-sm gi-button-ghost shrink-0 text-emergency"
                  aria-label={t('remove')}
                  onClick={() => setDraft({ ...draft, allergies: removeAt(draft.allergies, index) })}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="gi-button-secondary mt-3"
          onClick={() => setDraft({ ...draft, allergies: [...draft.allergies, { substance: '' }] })}
        >
          {t('addAllergy')}
        </button>
      </section>

      {/* ------------------------------------------------------------ Family history --- */}
      <section className="mt-6">
        <h3 className="gi-section-title flex items-center gap-1.5">
          <UsersIcon className="h-3.5 w-3.5" />
          {t('familyHeading')}
        </h3>
        <p className="gi-hint">{t('familyHint')}</p>

        {draft.familyHistory.length === 0 ? (
          <p className="mt-2 text-sm text-ink-faint">{t('noneAdded')}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {draft.familyHistory.map((entry, index) => (
              <li key={index} className="flex flex-wrap gap-2">
                <label className="sr-only" htmlFor={`family-relation-${index}`}>
                  {t('familyRelation')}
                </label>
                <select
                  id={`family-relation-${index}`}
                  className="gi-select w-auto"
                  value={entry.relation}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      familyHistory: replaceAt(draft.familyHistory, index, {
                        ...entry,
                        relation: event.target.value as FamilyHistoryEntry['relation'],
                      }),
                    })
                  }
                >
                  {FAMILY_RELATIONS.map((relation) => (
                    <option key={relation} value={relation}>
                      {t(`relation_${relation}` as never)}
                    </option>
                  ))}
                </select>

                <label className="sr-only" htmlFor={`family-condition-${index}`}>
                  {t('familyCondition')}
                </label>
                <select
                  id={`family-condition-${index}`}
                  className="gi-select flex-1"
                  value={entry.condition}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      familyHistory: replaceAt(draft.familyHistory, index, {
                        ...entry,
                        condition: event.target.value as FamilyHistoryEntry['condition'],
                      }),
                    })
                  }
                >
                  {FAMILY_CONDITION_CODES.map((code) => (
                    <option key={code} value={code}>
                      {t(`familyCondition_${code}` as never)}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="gi-button-sm gi-button-ghost shrink-0 text-emergency"
                  aria-label={t('remove')}
                  onClick={() =>
                    setDraft({ ...draft, familyHistory: removeAt(draft.familyHistory, index) })
                  }
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="gi-button-secondary mt-3"
          onClick={() =>
            setDraft({
              ...draft,
              familyHistory: [
                ...draft.familyHistory,
                { relation: 'parent', condition: 'colorectal_cancer' },
              ],
            })
          }
        >
          {t('addFamilyHistory')}
        </button>
      </section>

      {/* ----------------------------------------------------------------- Lifestyle --- */}
      <section className="mt-6">
        <h3 className="gi-section-title">{t('lifestyleHeading')}</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Field label={t('smoking')} htmlFor="smoking" className="mb-0">
            <select
              id="smoking"
              className="gi-select"
              value={draft.lifestyle.smoking}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  lifestyle: {
                    ...draft.lifestyle,
                    smoking: event.target.value as Lifestyle['smoking'],
                  },
                })
              }
            >
              {SMOKING_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`smoking_${status}` as never)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t('alcohol')} htmlFor="alcohol" className="mb-0">
            <select
              id="alcohol"
              className="gi-select"
              value={draft.lifestyle.alcohol}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  lifestyle: {
                    ...draft.lifestyle,
                    alcohol: event.target.value as Lifestyle['alcohol'],
                  },
                })
              }
            >
              {ALCOHOL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`alcohol_${status}` as never)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t('diet')} htmlFor="diet" className="mb-0">
            <select
              id="diet"
              className="gi-select"
              value={draft.lifestyle.diet ?? ''}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  lifestyle: {
                    ...draft.lifestyle,
                    ...(event.target.value === ''
                      ? { diet: undefined }
                      : { diet: event.target.value as NonNullable<Lifestyle['diet']> }),
                  },
                })
              }
            >
              <option value="">{t('dietUnspecified')}</option>
              {DIET_TYPES.map((diet) => (
                <option key={diet} value={diet}>
                  {t(`diet_${diet}` as never)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="mt-6">
        <h3 className="gi-section-title">{t('confirmMissingHeading')}</h3>
        <p className="gi-hint">{t('confirmMissingHint')}</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {(['conditions', 'surgeries', 'medications', 'allergies', 'familyHistory'] as const).filter(key => draft[key].length === 0).map(key => (
            <Field key={key} label={t(`assertion_${key}`)} htmlFor={`assertion-${key}`} className="mb-0">
              <select id={`assertion-${key}`} className="gi-select" value={draft.assertions[key] ?? 'unknown'} onChange={event => setDraft({ ...draft, assertions: { ...draft.assertions, [key]: event.target.value as 'unknown' | 'none' } })}>
                <option value="unknown">{t('notEstablished')}</option><option value="none">{t('explicitNone')}</option>
              </select>
            </Field>
          ))}
        </div>
      </section>
      {/* --------------------------------------------------------------------- Notes --- */}
      <div className="mt-6">
        <Field label={t('notesHeading')} htmlFor="history-notes" hint={t('notesHint')} className="mb-0">
          <textarea
            id="history-notes"
            className="gi-input min-h-[5rem]"
            value={draft.additionalNotes}
            onChange={(event) => setDraft({ ...draft, additionalNotes: event.target.value })}
          />
        </Field>
      </div>

      {problem !== null && (
        <div className="mt-4">
          <Notice tone="emergency" role="alert">
            {tAll(problem.messageKey as never)}
          </Notice>
        </div>
      )}

      <div className="mt-7 flex flex-wrap gap-3 border-t border-line pt-5">
        <button type="button" className="gi-button-secondary" onClick={onBack}>
          {tApp('back')}
        </button>
        <button
          type="button"
          className="gi-button-primary flex-1"
          disabled={saving}
          onClick={() => void save(true)}
        >
          {saving ? tApp('saving') : t('saveAndContinue')}
        </button>
        {/* Skipping records nothing rather than recording an empty history, so the doctor is told
            "not recorded" instead of "reported nothing". */}
        <button type="button" className="gi-button-ghost" onClick={onComplete}>
          {t('skipStep')}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* A coded add-and-remove list, shared by conditions and surgeries                                */
/* -------------------------------------------------------------------------------------------- */

interface Coded {
  code: string;
  label?: string | undefined;
}

/**
 * Generic over the entry type *and* its code union, so `makeEntry` receives the narrow code the
 * caller's list is built from rather than a bare `string` the entry type will not accept.
 */
function CodedList<Code extends string, T extends Coded & { code: Code }>({
  heading,
  hint,
  addLabel,
  codes,
  codeLabel,
  otherLabel,
  removeLabel,
  emptyLabel,
  entries,
  onChange,
  makeEntry,
  icon,
}: {
  heading: string;
  hint: string;
  addLabel: string;
  codes: readonly Code[];
  codeLabel: (code: Code) => string;
  otherLabel: string;
  removeLabel: string;
  emptyLabel: string;
  entries: T[];
  onChange: (entries: T[]) => void;
  makeEntry: (code: Code) => T;
  icon?: React.ReactNode;
}) {
  const t = useTranslations('history');
  const [choice, setChoice] = useState<Code | ''>('');
  const id = heading.replace(/\W+/g, '-').toLowerCase();

  return (
    <section className="mt-6">
      <h3 className="gi-section-title flex items-center gap-1.5">
        {icon}
        {heading}
      </h3>
      <p className="gi-hint">{hint}</p>

      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-ink-faint">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {entries.map((entry, index) => (
            <li key={`${entry.code}-${index}`} className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-line bg-surface-inset px-3 py-1.5 text-sm font-medium">
                {codeLabel(entry.code)}
              </span>
              {entry.code === 'other' && (
                <>
                  <label className="sr-only" htmlFor={`${id}-other-${index}`}>
                    {otherLabel}
                  </label>
                  <input
                    id={`${id}-other-${index}`}
                    className="gi-input flex-1"
                    placeholder={otherLabel}
                    value={entry.label ?? ''}
                    onChange={(event) =>
                      onChange(replaceAt(entries, index, { ...entry, label: event.target.value }))
                    }
                  />
                </>
              )}
              <button
                type="button"
                className="gi-button-sm gi-button-ghost text-emergency"
                aria-label={removeLabel}
                onClick={() => onChange(removeAt(entries, index))}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor={`${id}-add`}>
          {addLabel}
        </label>
        <select
          id={`${id}-add`}
          className="gi-select flex-1"
          value={choice}
          onChange={(event) => setChoice(event.target.value as Code)}
        >
          <option value="">{t('chooseEntry')}</option>
          {codes.map((code) => (
            <option key={code} value={code}>
              {codeLabel(code)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="gi-button-secondary shrink-0"
          disabled={choice === ''}
          onClick={() => { if (choice !== '') { onChange([...entries, makeEntry(choice)]); setChoice(''); } }}
        >
          {addLabel}
        </button>
      </div>
    </section>
  );
}

function replaceAt<T>(list: T[], index: number, value: T): T[] {
  return list.map((entry, position) => (position === index ? value : entry));
}

function removeAt<T>(list: T[], index: number): T[] {
  return list.filter((_, position) => position !== index);
}
