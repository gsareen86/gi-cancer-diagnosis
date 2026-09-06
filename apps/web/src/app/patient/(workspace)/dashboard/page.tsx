import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Badge, PageHeading, Panel } from '@/components/primitives';
import { EmptyState } from '@/components/ui/feedback';
import { Timeline, type Milestone } from '@/components/ui/timeline';
import { ClipboardIcon, FileIcon, UploadIcon } from '@/components/ui/icons';
import {
  MILESTONE_LABEL_KEY,
  milestoneStates,
  patientStatusKey,
  patientStatusTone,
} from '@/lib/case-timeline';
import { requireWorkspace } from '@/lib/guard';
import { clinical } from '@/server/db';
import { LiveRefresh } from '@/components/ui/live-refresh';
import { caseReference } from '@/lib/references';

/**
 * Where the patient lands.
 *
 * One question dominates: what is happening with my case. So the active case and its milestone
 * tracker come first, everything else after — and the tracker shows real state read from the case
 * record, never elapsed time.
 *
 * No clinical content appears here before release. A case that has been through the AI pipeline
 * looks, from this page, exactly like one that has not.
 */
export default async function PatientDashboardPage() {
  const user = await requireWorkspace('patient');
  const t = await getTranslations('case');
  const tDash = await getTranslations('patientDashboard');
  const format = await getFormatter();

  const cases = await clinical().listPatientCases({
    actor: { id: user.id, role: user.role },
    subjectId: user.id,
    purpose: 'account_processing',
  });

  const draft = cases.find((entry) => entry.status === 'in_progress');
  // The most recent case that is actually in flight or answered — a draft is offered separately.
  const active = cases.find((entry) => entry.status !== 'in_progress');
  const past = cases.filter((entry) => entry !== draft && entry !== active).slice(0, 3);

  const analysis = active ? await clinical().patientProcessingState({ actor: { id: user.id, role: user.role }, subjectId: user.id, purpose: 'account_processing' }, active.id) : 'pending';

  const milestones: Milestone[] =
    active === undefined
      ? []
      : milestoneStates(active.status, analysis).map((entry) => ({
          id: entry.id,
          label: tDash((entry.id === 'analysis' && analysis !== 'complete' ? analysis === 'pending' ? 'milestoneAnalysisPending' : 'milestoneAnalysisUnavailable' : MILESTONE_LABEL_KEY[entry.id]) as never),
          state: entry.state,
          detail:
            entry.id === 'submitted' && active.submittedAt !== null
              ? format.dateTime(active.submittedAt, { dateStyle: 'long' })
              : entry.id === 'ready' && active.releasedAt !== null
                ? format.dateTime(active.releasedAt, { dateStyle: 'long' })
                : undefined,
        }));

  return (
    <div className="mx-auto max-w-4xl">
      <LiveRefresh />
      <PageHeading lead={tDash('lead')}>
        {tDash('heading', { name: user.fullName ?? '' })}
      </PageHeading>

      {draft !== undefined && (
        <div className="mb-5 rounded-xl border border-accent-line bg-accent-faint p-5">
          <h2 className="text-lg">{t('resumeHeading')}</h2>
          <p className="mt-1 text-ink-muted">{t('resumeBody')}</p>
          <Link href={`/patient/intake/${draft.id}`} className="gi-button-primary mt-4">
            {t('resume')}
          </Link>
        </div>
      )}

      {active === undefined ? (
        <Panel title={tDash('activeHeading')} bodyClassName="">
          <EmptyState
            icon={<ClipboardIcon className="h-5 w-5" />}
            title={tDash('noActiveTitle')}
            body={tDash('noActiveBody')}
            action={
              draft === undefined ? (
                <Link href="/patient/intake" className="gi-button-primary">
                  {tDash('startConsultation')}
                </Link>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <Panel
          title={`${tDash('activeHeading')} · ${caseReference(active.publicNumber)}`}
          actions={
            <Badge tone={patientStatusTone(active.status)}>
              {t(patientStatusKey(active.status) as never)}
            </Badge>
          }
        >
          <p className="text-sm text-ink-muted">
            {tDash('openedOn', {
              date: format.dateTime(active.createdAt, { dateStyle: 'long' }),
            })}
          </p>

          <div className="mt-5">
            <Timeline milestones={milestones} label={tDash('timelineLabel')} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
            <Link href={`/patient/case/${active.id}`} className="gi-button-secondary">
              {active.status === 'released' ? tDash('readSummary') : tDash('viewCase')}
            </Link>
            <Link
              href={`/patient/case/${active.id}/documents`}
              className="gi-button-secondary"
            >
              <UploadIcon className="h-4 w-4" />
              {tDash('viewUploads')}
            </Link>
          </div>
        </Panel>
      )}

      {past.length > 0 && (
        <div className="mt-6">
          <Panel
            title={tDash('pastHeading')}
            actions={
              <Link href="/patient/records" className="gi-button-sm gi-button-secondary">
                {tDash('viewAll')}
              </Link>
            }
            bodyClassName=""
          >
            <ul className="divide-y divide-line">
              {past.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={`/patient/case/${entry.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-surface-inset"
                  >
                    <span className="flex items-center gap-3">
                      <FileIcon className="h-4 w-4 text-ink-faint" />
                      <span className="text-sm">
                        {format.dateTime(entry.createdAt, { dateStyle: 'long' })}
                      </span>
                    </span>
                    <Badge tone={patientStatusTone(entry.status)}>
                      {t(patientStatusKey(entry.status) as never)}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {draft === undefined && active !== undefined && (
        <div className="mt-6">
          <Link href="/patient/intake" className="gi-button-secondary">
            {tDash('startAnother')}
          </Link>
        </div>
      )}
    </div>
  );
}
