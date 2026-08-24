import { getFormatter, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, PageHeading, type Tone } from '@/components/primitives';
import { clinical } from '@/server/db';
import { currentUser, profileComplete } from '@/lib/session';

const STATUS_TONE: Record<string, Tone> = {
  in_progress: 'accent',
  submitted: 'neutral',
  ai_processing: 'neutral',
  ai_processed: 'neutral',
  ai_skipped: 'neutral',
  in_review: 'neutral',
  reviewed: 'neutral',
  released: 'ok',
  closed: 'neutral',
};

/** The states a patient is shown. AI processing is not one of them — it is not their concern. */
function patientStatusKey(status: string): string {
  if (status === 'in_progress') return 'statusInProgress';
  if (status === 'released') return 'statusReleased';
  if (status === 'in_review' || status === 'reviewed') return 'statusInReview';
  return 'statusSubmitted';
}

export default async function CasesPage() {
  const t = await getTranslations('case');
  const format = await getFormatter();
  const user = await currentUser();
  if (user === null) redirect('/login');
  if (!profileComplete(user)) redirect('/profile');

  const cases = await clinical().listPatientCases({
    actor: { id: user.id, role: user.role },
    subjectId: user.id,
    purpose: 'account_processing',
  });

  const draft = cases.find((entry) => entry.status === 'in_progress');

  return (
    <div className="mx-auto max-w-reading">
      <PageHeading>{t('statusHeading')}</PageHeading>

      {draft !== undefined && (
        <Card className="mb-6 border-accent bg-accent-faint">
          <h2 className="text-lg">{t('resumeHeading')}</h2>
          <p className="mt-1 text-ink-muted">{t('resumeBody')}</p>
          <Link href={`/cases/${draft.id}/interview`} className="gi-button-primary mt-4">
            {t('resume')}
          </Link>
        </Card>
      )}

      <ul className="space-y-3">
        {cases.map((entry) => (
          <Card key={entry.id} as="li">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone={STATUS_TONE[entry.status] ?? 'neutral'}>
                {t(patientStatusKey(entry.status) as never)}
              </Badge>
              <span className="text-sm text-ink-faint">
                {format.dateTime(entry.createdAt, { dateStyle: 'long' })}
              </span>
            </div>
            <Link
              href={
                entry.status === 'in_progress'
                  ? `/cases/${entry.id}/interview`
                  : `/cases/${entry.id}`
              }
              className="mt-3 inline-block font-medium text-accent underline underline-offset-4"
            >
              {entry.status === 'in_progress' ? t('resume') : t('statusHeading')}
            </Link>
          </Card>
        ))}
      </ul>

      {draft === undefined && (
        <Link href="/start" className="gi-button-primary mt-6">
          {t('chooseAreaHeading')}
        </Link>
      )}
    </div>
  );
}
