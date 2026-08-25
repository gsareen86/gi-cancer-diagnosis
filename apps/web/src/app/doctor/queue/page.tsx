import { getFormatter, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, Notice, PageHeading, type Tone } from '@/components/primitives';
import { ClaimButton } from '@/components/doctor/claim-button';
import { clinical } from '@/server/db';
import { currentUser } from '@/lib/session';

/**
 * The review queue.
 *
 * Emergency-flagged cases sort first and are visually distinguishable at a glance — but the
 * urgency is also written as a word, because a red badge means nothing to a colour-blind reader
 * or on a phone screen in daylight.
 */
export default async function DoctorQueuePage() {
  const t = await getTranslations('doctor');
  const format = await getFormatter();
  const user = await currentUser();

  if (user === null) redirect('/login');
  if (user.role !== 'doctor') redirect('/');
  if (user.mfaPending) redirect('/mfa');

  const repo = clinical();
  const cases = await repo.listDoctorQueue(user.id, 'doctor');
  // Cases nobody owns. Assignment happens at submission, so one submitted before any doctor
  // existed has no owner and would otherwise be invisible to every queue.
  const claimable = await repo.listClaimableCases('doctor');

  const rank = (urgency: string | null): number =>
    urgency === 'emergency' ? 0 : urgency === 'urgent' ? 1 : urgency === 'routine-but-flagged' ? 2 : 3;

  const sorted = [...cases].sort(
    (a, b) =>
      rank(a.highestUrgency) - rank(b.highestUrgency) ||
      (a.submittedAt ?? a.createdAt).getTime() - (b.submittedAt ?? b.createdAt).getTime(),
  );

  const tone: Record<string, Tone> = {
    emergency: 'emergency',
    urgent: 'urgent',
    'routine-but-flagged': 'neutral',
  };
  const label: Record<string, string> = {
    emergency: t('urgencyEmergency'),
    urgent: t('urgencyUrgent'),
    'routine-but-flagged': t('urgencyFlagged'),
  };

  return (
    <div>
      <PageHeading>{t('queueHeading')}</PageHeading>

      {claimable.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg">{t('unassignedHeading')}</h2>
          <div className="mt-1">
            <Notice tone="urgent" role="note">
              {t('unassignedIntro')}
            </Notice>
          </div>

          <ul className="mt-4 space-y-3">
            {claimable.map((entry) => (
              <Card key={entry.id} as="li" className="border-l-4 border-l-urgent">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {entry.highestUrgency === null ? (
                        <Badge tone="neutral">{t('noFlags')}</Badge>
                      ) : (
                        <Badge tone={tone[entry.highestUrgency] ?? 'neutral'}>
                          {label[entry.highestUrgency] ?? entry.highestUrgency}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-ink-muted">
                      {t('submittedAgo', {
                        date: format.relativeTime(entry.submittedAt ?? entry.createdAt),
                      })}
                    </p>
                  </div>
                  <ClaimButton caseId={entry.id} />
                </div>
              </Card>
            ))}
          </ul>
        </section>
      )}

      {sorted.length === 0 ? (
        <p className="text-ink-muted">{t('queueEmpty')}</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((entry) => (
            <Card
              key={entry.id}
              as="li"
              className={entry.highestUrgency === 'emergency' ? 'border-l-4 border-l-emergency' : ''}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {entry.highestUrgency === null ? (
                      <Badge tone="neutral">{t('noFlags')}</Badge>
                    ) : (
                      <Badge tone={tone[entry.highestUrgency] ?? 'neutral'}>
                        {label[entry.highestUrgency] ?? entry.highestUrgency}
                      </Badge>
                    )}
                    {entry.aiSkipReason !== null && (
                      <Badge tone="neutral">{t('assessmentAbsent')}</Badge>
                    )}
                  </div>

                  <p className="mt-2 text-sm text-ink-muted">
                    {t('submittedAgo', {
                      date: format.relativeTime(entry.submittedAt ?? entry.createdAt),
                    })}
                  </p>
                </div>

                <Link href={`/doctor/cases/${entry.id}`} className="gi-button-secondary">
                  {t('openCase')}
                </Link>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
