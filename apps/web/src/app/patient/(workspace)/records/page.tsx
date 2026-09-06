import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Badge, PageHeading, Panel } from '@/components/primitives';
import { EmptyState } from '@/components/ui/feedback';
import { ChevronRightIcon, FileIcon } from '@/components/ui/icons';
import { patientStatusKey, patientStatusTone } from '@/lib/case-timeline';
import { requireWorkspace } from '@/lib/guard';
import { clinical } from '@/server/db';
import { caseReference } from '@/lib/references';

/**
 * Past consultations.
 *
 * Every case the patient has ever opened, newest first, with its outcome state. Opening one shows
 * exactly the content that was frozen at release — not a regenerated summary, which would let a
 * later change to a template or a model silently rewrite what a doctor once said.
 */
export default async function PatientRecordsPage() {
  const user = await requireWorkspace('patient');
  const t = await getTranslations('case');
  const tRecords = await getTranslations('records');
  const format = await getFormatter();

  const cases = await clinical().listPatientCases({
    actor: { id: user.id, role: user.role },
    subjectId: user.id,
    purpose: 'account_processing',
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading
        lead={tRecords('lead')}
        actions={
          <Link href="/patient/intake" className="gi-button-primary">
            {tRecords('startNew')}
          </Link>
        }
      >
        {tRecords('heading')}
      </PageHeading>

      <Panel bodyClassName="">
        {cases.length === 0 ? (
          <EmptyState
            icon={<FileIcon className="h-5 w-5" />}
            title={tRecords('emptyTitle')}
            body={tRecords('emptyBody')}
            action={
              <Link href="/patient/intake" className="gi-button-primary">
                {tRecords('startNew')}
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {cases.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={
                    entry.status === 'in_progress'
                      ? `/patient/intake/${entry.id}`
                      : `/patient/case/${entry.id}`
                  }
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-inset"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-sm text-accent">{caseReference(entry.publicNumber)}</span>
                    <span className="block font-medium">
                      {format.dateTime(entry.createdAt, { dateStyle: 'long' })}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-muted">
                      {entry.releasedAt === null
                        ? tRecords('notReleased')
                        : tRecords('releasedOn', {
                            date: format.dateTime(entry.releasedAt, { dateStyle: 'long' }),
                          })}
                    </span>
                  </span>
                  <Badge tone={patientStatusTone(entry.status)}>
                    {t(patientStatusKey(entry.status) as never)}
                  </Badge>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-faint" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
