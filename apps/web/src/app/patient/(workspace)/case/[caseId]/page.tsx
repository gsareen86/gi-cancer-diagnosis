import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Badge, Notice, Panel } from '@/components/primitives';
import { Timeline, type Milestone } from '@/components/ui/timeline';
import { PrintButton } from '@/components/patient/print-button';
import { LiveRefresh } from '@/components/ui/live-refresh';
import { AcknowledgeSummary } from '@/components/patient/acknowledge-summary';
import { ClockIcon, UploadIcon } from '@/components/ui/icons';
import {
  MILESTONE_LABEL_KEY,
  milestoneStates,
  patientStatusKey,
  patientStatusTone,
} from '@/lib/case-timeline';
import { requireWorkspace } from '@/lib/guard';
import { clinical } from '@/server/db';
import { caseReference } from '@/lib/references';

/**
 * What the patient sees about their case.
 *
 * Before release this shows state and nothing else — no differential, no red-flag list, no
 * clinician summary. A case that has been through the AI pipeline looks, from here, exactly like
 * one that has not, which is the point: the assessment is for the doctor.
 *
 * After release it shows exactly the content frozen at release time, with the standing notice
 * inseparable from it, and can be printed as an official copy for the patient to take to an
 * in-person appointment.
 */
interface ReleasedContent {
  summary: string;
  nextSteps: string[];
  standingNotice: string;
  diagnosis?: string | null;
  dietaryAdvice?: string | null;
  precautions?: string | null;
  referralUrgency?: 'emergency' | 'within_week' | 'routine' | 'none' | null;
  followUpInterval?: string | null;
  prescriptionInstructions?: string | null;
}

export default async function PatientCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const user = await requireWorkspace('patient');
  const t = await getTranslations('case');
  const tDash = await getTranslations('patientDashboard');
  const format = await getFormatter();

  const context = {
    actor: { id: user.id, role: user.role },
    subjectId: user.id,
    purpose: 'account_processing' as const,
  };

  const repo = clinical();
  const caseRecord = await repo.getCase(context, caseId);
  if (caseRecord === null) redirect('/patient/records');
  if (caseRecord.status === 'in_progress') redirect(`/patient/intake/${caseId}`);

  const released =
    ['released', 'closed'].includes(caseRecord.status) ? await repo.getReleasedSummary(context, caseId) : null;
  const content = released?.releasedContent as ReleasedContent | undefined;

  const analysis = await repo.patientProcessingState(context, caseId);
  const milestones: Milestone[] = milestoneStates(caseRecord.status, analysis).map((entry) => ({
    id: entry.id,
    label: tDash((entry.id === 'analysis' && analysis !== 'complete' ? analysis === 'pending' ? 'milestoneAnalysisPending' : 'milestoneAnalysisUnavailable' : MILESTONE_LABEL_KEY[entry.id]) as never),
    state: entry.state,
    detail:
      entry.id === 'submitted' && caseRecord.submittedAt !== null
        ? format.dateTime(caseRecord.submittedAt, { dateStyle: 'long' })
        : entry.id === 'ready' && released?.releasedAt != null
          ? format.dateTime(new Date(released.releasedAt), { dateStyle: 'long' })
          : undefined,
  }));

  const sections =
    content === undefined
      ? []
      : [
          { key: 'diagnosis', label: t('releasedDiagnosis'), body: content.diagnosis ?? '' },
          { key: 'dietary', label: t('releasedDietary'), body: content.dietaryAdvice ?? '' },
          { key: 'precautions', label: t('releasedPrecautions'), body: content.precautions ?? '' },
          { key: 'prescriptions', label: t('releasedPrescriptions'), body: content.prescriptionInstructions ?? '' },
          {
            key: 'followUp',
            label: t('releasedFollowUp'),
            body: content.followUpInterval ?? '',
          },
        ].filter((section) => section.body.trim() !== '');

  return (
    <div className="mx-auto max-w-3xl">
      <LiveRefresh />
      <div className="gi-no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('statusHeading')}</h1>
          <p className="mt-1 font-mono text-sm font-semibold text-accent">{caseReference(caseRecord.publicNumber)}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {tDash('openedOn', {
              date: format.dateTime(caseRecord.createdAt, { dateStyle: 'long' }),
            })}
          </p>
        </div>
        <Badge tone={patientStatusTone(caseRecord.status)}>
          {t(patientStatusKey(caseRecord.status) as never)}
        </Badge>
      </div>

      <div className="gi-no-print mb-5">
        <Panel title={tDash('timelineLabel')}>
          <Timeline milestones={milestones} label={tDash('timelineLabel')} />
        </Panel>
      </div>

      {content === undefined ? (
        <Panel>
          <div className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-muted"
            >
              <ClockIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="font-medium">{t('awaitingReview')}</p>
              <p className="mt-1 text-sm text-ink-muted">{t('noResultYet')}</p>
            </div>
          </div>
          <Link href={`/patient/case/${caseId}/documents`} className="gi-button-secondary mt-5">
            <UploadIcon className="h-4 w-4" />
            {t('uploadsHeading')}
          </Link>
        </Panel>
      ) : (
        <article className="space-y-5">
          <Panel
            title={t('releasedHeading')}
            actions={
              <span className="gi-no-print">
                <a href={`/api/cases/${caseId}/summary/pdf`} className="gi-button-sm gi-button-primary mr-2" download>{t('downloadSummary')}</a>
                <PrintButton label={t('printSummary')} />
              </span>
            }
          >
            {released?.releasedAt != null && (
              <p className="text-sm text-ink-faint">
                {t('reviewedOn', {
                  date: format.dateTime(new Date(released.releasedAt), { dateStyle: 'long' }),
                })}
              </p>
            )}

            {content.referralUrgency != null && content.referralUrgency !== 'none' && (
              <div className="mt-4">
                <Notice
                  tone={
                    content.referralUrgency === 'emergency'
                      ? 'emergency'
                      : content.referralUrgency === 'within_week'
                        ? 'urgent'
                        : 'accent'
                  }
                  role="note"
                  title={t('releasedReferral')}
                >
                  {t(`referral_${content.referralUrgency}` as never)}
                </Notice>
              </div>
            )}

            <p className="mt-5 whitespace-pre-wrap leading-relaxed">{content.summary}</p>

            {sections.map((section) => (
              <section key={section.key} className="mt-6">
                <h3 className="text-base font-semibold">{section.label}</h3>
                <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">{section.body}</p>
              </section>
            ))}

            {content.nextSteps.length > 0 && (
              <section className="mt-6">
                <h3 className="text-base font-semibold">{t('nextSteps')}</h3>
                <ul className="mt-2 space-y-1.5">
                  {content.nextSteps.map((step) => (
                    <li key={step} className="flex gap-2">
                      <span
                        aria-hidden="true"
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-bright"
                      />
                      {step}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </Panel>

          {/* Shown with the summary, never separated from it: this is a clinical impression from
              a doctor who has not examined the patient in person. */}
          <Notice tone="accent" role="note">
            {content.standingNotice}
          </Notice>
          <div className="gi-no-print"><AcknowledgeSummary caseId={caseId} acknowledged={caseRecord.status === 'closed'} /></div>
        </article>
      )}
    </div>
  );
}
