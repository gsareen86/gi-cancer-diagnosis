import { getFormatter, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, Notice, PageHeading } from '@/components/primitives';
import { clinical } from '@/server/db';
import { currentUser } from '@/lib/session';

/**
 * What the patient sees about their case.
 *
 * Before release this shows state and nothing else — no differential, no red-flag list, no
 * clinician summary. A case that has been through the AI pipeline looks, from here, exactly like
 * one that has not, which is the point: the assessment is for the doctor.
 *
 * TODO(confirm): Decision A — whether a patient may ever see raw AI output. The default here is
 * doctor-released only.
 */
export default async function CaseStatusPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const t = await getTranslations('case');
  const format = await getFormatter();
  const user = await currentUser();
  if (user === null) redirect('/login');

  const context = {
    actor: { id: user.id, role: user.role },
    subjectId: user.id,
    purpose: 'account_processing' as const,
  };

  const repo = clinical();
  const caseRecord = await repo.getCase(context, caseId);
  if (caseRecord === null) redirect('/cases');
  if (caseRecord.status === 'in_progress') redirect(`/cases/${caseId}/interview`);

  const released =
    caseRecord.status === 'released' ? await repo.getReleasedSummary(context, caseId) : null;

  const content = released?.releasedContent as
    | { summary: string; nextSteps: string[]; standingNotice: string }
    | undefined;

  return (
    <div className="mx-auto max-w-reading">
      <PageHeading>{t('statusHeading')}</PageHeading>

      {content === undefined ? (
        <Card>
          <Badge tone="neutral">{t('statusSubmitted')}</Badge>
          <p className="mt-4">{t('awaitingReview')}</p>
          <p className="mt-2 text-sm text-ink-muted">{t('noResultYet')}</p>
          <Link href={`/cases/${caseId}/documents`} className="gi-button-secondary mt-5">
            {t('uploadsHeading')}
          </Link>
        </Card>
      ) : (
        <div className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone="ok">{t('statusReleased')}</Badge>
              {released?.releasedAt != null && (
                <span className="text-sm text-ink-faint">
                  {t('reviewedOn', {
                    date: format.dateTime(new Date(released.releasedAt), { dateStyle: 'long' }),
                  })}
                </span>
              )}
            </div>

            <h2 className="mt-5 text-xl">{t('releasedHeading')}</h2>
            <p className="mt-3 whitespace-pre-wrap">{content.summary}</p>

            {content.nextSteps.length > 0 && (
              <>
                <h3 className="mt-6 text-lg">{t('nextSteps')}</h3>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  {content.nextSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {/* Shown with the summary, never separated from it: this is a clinical impression from
              a doctor who has not examined the patient in person. */}
          <Notice tone="accent" role="note">
            {content.standingNotice}
          </Notice>
        </div>
      )}
    </div>
  );
}
