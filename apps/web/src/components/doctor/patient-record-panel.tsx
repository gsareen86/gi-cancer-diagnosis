'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { Badge, DataPoint, Notice, type Tone } from '@/components/primitives';
import { StatusChip } from '@/components/ui/feedback';
import {
  AlertIcon,
  ClipboardIcon,
  PillIcon,
  PulseIcon,
  ScissorsIcon,
  UsersIcon,
} from '@/components/ui/icons';
import { bmiBand, bodyMassIndex } from '@/lib/clinical-history';
import type { CaseAnswer, CaseWorkspaceData } from './types';

/**
 * Everything the patient reported, in the order a clinician reads a history.
 *
 * Red flags sit above the history rather than below it. They are the only content on this panel
 * that can change what the doctor does in the next thirty seconds, and putting them after four
 * collapsible sections means they are found by scrolling — which is to say, sometimes not found.
 *
 * Nothing here is editable. The patient's record is the record; the doctor's disagreement with it
 * belongs in their own notes, where it is attributed to them.
 */

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

/**
 * The nine symptom clusters from `packages/core/src/taxonomy.ts`.
 *
 * Mapped explicitly rather than by string interpolation into `t()`: a cluster added to the
 * taxonomy without a catalogue entry would otherwise throw at render, taking down the whole case
 * view over a missing heading. Falling back to the raw identifier degrades one heading instead.
 */
const CLUSTER_KEY: Record<string, string> = {
  bowel_habit: 'cluster_bowel_habit',
  bleeding: 'cluster_bleeding',
  pain: 'cluster_pain',
  weight_appetite: 'cluster_weight_appetite',
  hepatobiliary: 'cluster_hepatobiliary',
  reflux_upper_gi: 'cluster_reflux_upper_gi',
  history: 'cluster_history',
  medication_lifestyle: 'cluster_medication_lifestyle',
  systemic: 'cluster_systemic',
};

export function PatientRecordPanel({ data }: { data: CaseWorkspaceData }) {
  const t = useTranslations('doctor');
  const tHistory = useTranslations('history');
  const tQuestion = useTranslations('question');
  const format = useFormatter();

  const history = data.history;
  const bmi = bodyMassIndex(history?.heightCm, history?.weightKg);

  return (
    <div className="flex flex-col gap-4">
      {/* ---------------------------------------------------------------- Demographics --- */}
      <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <header className="border-b border-line bg-surface-sunken px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><PulseIcon className="h-4 w-4 text-accent" />{t('recordAtGlance')}</h3>
          <p className="mt-1 text-xs text-ink-muted">{t('recordPatientReported')}</p>
        </header>
        <dl className="grid grid-cols-2 gap-4 px-4 py-3">
          <DataPoint
            label={t('fieldAge')}
            value={data.patient.ageYears === null ? null : t('years', { count: data.patient.ageYears })}
            absent={t('ageUnknown')}
          />
          <DataPoint
            label={t('fieldSex')}
            value={data.patient.sex === null ? null : t(`sex_${data.patient.sex}` as never)}
            absent={t('sexUnknown')}
          />
        </dl>
        <dl className="grid grid-cols-3 gap-2 px-3 pb-4">
          <Measurement
            label={t('fieldHeight')}
            value={history?.heightCm == null ? null : tHistory('cm', { value: history.heightCm })}
            absent={t('notRecorded')}
          />
          <Measurement
            label={t('fieldWeight')}
            value={history?.weightKg == null ? null : tHistory('kg', { value: history.weightKg })}
            absent={t('notRecorded')}
          />
          <Measurement
            label={t('fieldBmi')}
            value={
              bmi === null ? null : (
                <span className="flex flex-col items-start gap-1.5">
                  <span className="gi-numeric">{bmi}</span>
                  <StatusChip
                    tone={bmiBand(bmi) === 'normal' ? 'ok' : 'caution'}
                    dot={false}
                  >
                    {t(`bmiBand_${bmiBand(bmi)}` as never)}
                  </StatusChip>
                </span>
              )
            }
            absent={t('bmiNeedsBoth')}
          />
        </dl>

        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-sunken px-4 py-3">
          <p className="text-sm font-medium">{data.case.entryPoint}</p>
          {data.case.submittedAt !== null && (
            <span className="text-xs text-ink-faint">
              {t('submittedOn', {
                date: format.dateTime(new Date(data.case.submittedAt), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
              })}
            </span>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------- Red flags --- */}
      {data.redFlags.length > 0 && (
        <section
          className="order-first rounded-xl border border-emergency-line border-l-4 border-l-emergency-bright bg-emergency-faint p-4"
          aria-labelledby="red-flags-heading"
        >
          <h3
            id="red-flags-heading"
            className="flex items-center gap-2 text-sm font-semibold text-emergency"
          >
            <AlertIcon className="h-4 w-4" />
            {t('redFlagsHeading')}
          </h3>
          <p className="mt-1 text-xs text-emergency">{t('redFlagsIntro')}</p>

          <ul className="mt-3 space-y-2">
            {data.redFlags.map((flag) => (
              <li key={flag.ruleId} className="rounded-md border border-emergency-line bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={URGENCY_TONE[flag.urgency] ?? 'neutral'}>
                    {t((URGENCY_KEY[flag.urgency] ?? 'urgencyFlagged') as never)}
                  </Badge>
                  {flag.acknowledgedByPatient && (
                    <StatusChip tone="neutral" dot={false}>
                      {t('acknowledgedByPatient')}
                    </StatusChip>
                  )}
                </div>
                <p className="mt-2 text-sm font-medium text-ink">{flag.basis}</p>
                <details className="mt-2 text-xs text-ink-muted">
                  <summary className="cursor-pointer">{t('recordFlagSources')}</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-4">{flag.contributingQuestionIds.map(id => <li key={id}>{data.answersByCluster.flatMap(group => group.answers).find(answer => answer.questionId === id)?.prompt ?? id}</li>)}</ul>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* --------------------------------------------------------------------- History --- */}
      <Section plain icon={<PulseIcon className="h-4 w-4" />} title={t('historyHeading')}>
        {history === null ? (
          <Notice tone="caution" role="note">
            {t('historyNotRecorded')}
          </Notice>
        ) : (
          <div className="grid gap-3">
            <EntryList
              icon={<PulseIcon className="h-4 w-4" />}
              title={t('historyConditions')}
              empty={
                t('historyIncomplete')
              }
              items={history.conditions.map((entry) => ({
                key: `${entry.code}-${entry.label ?? ''}`,
                primary:
                  entry.code === 'other'
                    ? (entry.label ?? tHistory('condition_other'))
                    : tHistory(`condition_${entry.code}` as never),
                secondary: [
                  entry.sinceYear === undefined
                    ? null
                    : tHistory('sinceYear', { year: entry.sinceYear }),
                  entry.notes ?? null,
                ]
                  .filter(Boolean)
                  .join(' · '),
              }))}
            />

            <EntryList
              icon={<ScissorsIcon className="h-3.5 w-3.5" />}
              title={t('historySurgeries')}
              empty={
                t('historyIncomplete')
              }
              items={history.surgeries.map((entry, index) => ({
                key: `${entry.code}-${index}`,
                primary:
                  entry.code === 'other'
                    ? (entry.label ?? tHistory('surgery_other'))
                    : tHistory(`surgery_${entry.code}` as never),
                secondary: [
                  entry.year === undefined ? null : String(entry.year),
                  entry.notes ?? null,
                ]
                  .filter(Boolean)
                  .join(' · '),
              }))}
            />

            <EntryList
              icon={<PillIcon className="h-3.5 w-3.5" />}
              title={t('historyMedications')}
              empty={
                t('historyIncomplete')
              }
              items={history.medications.map((entry, index) => ({
                key: `${entry.name}-${index}`,
                primary: entry.name,
                // The prescription/over-the-counter split is the point of this section: it is
                // what separates supervised NSAID use from unsupervised.
                badge: {
                  tone: entry.kind === 'otc' ? ('caution' as const) : ('neutral' as const),
                  label: tHistory(`medicationKind_${entry.kind}` as never),
                },
                secondary: [entry.frequency ?? null, entry.notes ?? null].filter(Boolean).join(' · '),
              }))}
            />

            <EntryList
              icon={<AlertIcon className="h-4 w-4" />}
              title={t('historyAllergies')}
              empty={
                t('historyIncomplete')
              }
              items={history.allergies.map((entry, index) => ({
                key: `${entry.substance}-${index}`,
                primary: entry.substance,
                secondary: entry.reaction ?? '',
              }))}
            />

            <EntryList
              icon={<UsersIcon className="h-3.5 w-3.5" />}
              title={t('historyFamily')}
              empty={
                t('historyIncomplete')
              }
              items={history.familyHistory.map((entry, index) => ({
                key: `${entry.relation}-${entry.condition}-${index}`,
                primary:
                  entry.condition === 'other'
                    ? (entry.label ?? tHistory('familyCondition_other'))
                    : tHistory(`familyCondition_${entry.condition}` as never),
                secondary: [
                  tHistory(`relation_${entry.relation}` as never),
                  entry.ageAtDiagnosis === undefined
                    ? null
                    : tHistory('diagnosedAt', { age: entry.ageAtDiagnosis }),
                ]
                  .filter(Boolean)
                  .join(' · '),
              }))}
            />

            {history.lifestyle !== null && (
              <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
                <h4 className="gi-section-title">{t('historyLifestyle')}</h4>
                <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <DataPoint
                    label={t('historySmoking')}
                    value={tHistory(`smoking_${history.lifestyle.smoking}` as never)}
                    absent={t('notRecorded')}
                  />
                  <DataPoint
                    label={t('historyAlcohol')}
                    value={tHistory(`alcohol_${history.lifestyle.alcohol}` as never)}
                    absent={t('notRecorded')}
                  />
                  {history.lifestyle.diet !== undefined && (
                    <DataPoint
                      label={t('historyDiet')}
                      value={tHistory(`diet_${history.lifestyle.diet}` as never)}
                      absent={t('notRecorded')}
                    />
                  )}
                </dl>
              </div>
            )}

            {history.additionalNotes !== null && history.additionalNotes !== '' && (
              <div className="rounded-xl border border-accent-line bg-accent-faint/30 p-4">
                <h4 className="gi-section-title">{t('historyNotes')}</h4>
                <p className="mt-1.5 whitespace-pre-wrap text-sm">{history.additionalNotes}</p>
              </div>
            )}

            {history.completedAt === null && (
              <Notice tone="caution" role="note">
                {t('historyIncompleteNotice')}
              </Notice>
            )}
          </div>
        )}
      </Section>

      {/* ------------------------------------------------------------------ Transcript --- */}
      <Section plain icon={<ClipboardIcon className="h-4 w-4" />} title={t('answersHeading')}>
        {data.answersByCluster.length === 0 ? (
          <p className="text-sm text-ink-faint">{t('noAnswers')}</p>
        ) : (
          data.answersByCluster.map((group, index) => (
            <details key={group.cluster} open={index === 0} className="gi-disclosure mt-3 overflow-hidden rounded-xl border border-line bg-surface first:mt-0">
              <summary className="cursor-pointer bg-surface-sunken px-4 py-3 text-sm font-semibold">
                {CLUSTER_KEY[group.cluster] === undefined
                  ? group.cluster.replace(/_/g, ' ')
                  : t(CLUSTER_KEY[group.cluster] as never)}
                <span className="mt-1 block pl-4 text-xs font-normal text-ink-muted">{t('recordAnswerCount', { count: group.answers.length })}</span>
              </summary>
              <dl className="space-y-4 border-t border-line p-4">
                {group.answers.map((answer) => (
                  <div
                    key={answer.questionId}
                    className="border-l-2 border-accent-line pl-3"
                    data-question-id={answer.questionId}
                  >
                    <dt className="text-sm leading-relaxed text-ink-muted">{answer.prompt}</dt>
                    <dd className="mt-1 text-sm font-semibold">
                      {renderAnswer(answer, {
                        absent: t('noAnswerValue'),
                        days: (count) => t('days', { count }),
                        region: (id) => tQuestion.has(`region_${id}`) ? tQuestion(`region_${id}`) : id,
                      })}
                    </dd>
                    {answer.askedBecause !== null && (
                      <p className="mt-0.5 text-2xs text-ink-faint">
                        {t('askedBecause', { trigger: answer.askedBecause })}
                      </p>
                    )}
                  </div>
                ))}
              </dl>
            </details>
          ))
        )}
      </Section>

    </div>
  );
}

function Section({
  title,
  icon,
  children,
  plain = false,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  plain?: boolean;
}) {
  return (
    <section className={plain ? '' : 'rounded-xl border border-line bg-surface p-4 shadow-card'}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        {icon !== undefined && <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-faint text-accent">{icon}</span>}
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

interface Entry {
  key: string;
  primary: string;
  secondary?: string;
  badge?: { tone: Tone; label: string };
}

function EntryList({
  title,
  items,
  empty,
  icon,
}: {
  title: string;
  items: Entry[];
  empty: string;
  icon?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <h4 className="flex items-center gap-2 border-b border-line bg-surface-sunken px-4 py-3 text-sm font-semibold">
        <span className="text-accent">{icon}</span>
        {title}
        {items.length > 0 && <span className="ml-auto rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-ink-muted">{items.length}</span>}
      </h4>
      {items.length === 0 ? (
        <p className="px-4 py-3 text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line px-4">
          {items.map((entry) => (
            <li key={entry.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-2 py-3 text-sm">
              <span className="font-medium">{entry.primary}</span>
              {entry.badge !== undefined && (
                <StatusChip tone={entry.badge.tone} dot={false}>
                  {entry.badge.label}
                </StatusChip>
              )}
              {entry.secondary !== undefined && entry.secondary !== '' && (
                <span className="w-full leading-relaxed text-ink-muted">{entry.secondary}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Measurement({ label, value, absent }: { label: string; value: React.ReactNode; absent: string }) {
  return <div className="min-w-0 rounded-xl border border-line bg-surface-sunken p-2.5">
    <dt className="text-xs font-medium text-ink-muted">{label}</dt>
    <dd className="mt-2 break-words text-lg font-semibold tracking-tight">{value ?? <span className="text-xs font-normal text-ink-muted">{absent}</span>}</dd>
  </div>;
}

/**
 * Renders one stored answer.
 *
 * Option identifiers resolve back to their labels wherever possible; an identifier that no longer
 * has a label is shown raw rather than hidden, because a doctor reading a case needs to see that
 * something was answered even when the interface cannot name it.
 */
function renderAnswer(
  answer: CaseAnswer,
  labels: { absent: string; days: (count: number) => string; region: (id: string) => string },
): string {
  const value = answer.value as Record<string, unknown> | null;
  if (value === null) return labels.absent;

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
    case 'duration':
      // Days, always. The interview's own "about three weeks" rounding is a kindness to a
      // patient recalling; a clinician comparing two histories wants the number they gave.
      return labels.days(Number(value.days));
    case 'scale':
      return String(value.value);
    case 'date':
      return String(value.value);
    case 'text':
      return String(value.value);
    case 'body_map':
      return (value.regionIds as string[]).map(labels.region).join(', ');
    default:
      return JSON.stringify(value);
  }
}
