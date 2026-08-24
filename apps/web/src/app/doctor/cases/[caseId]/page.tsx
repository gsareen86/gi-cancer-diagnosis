import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { PageHeading } from '@/components/primitives';
import { CaseReview } from '@/components/doctor/case-review';
import { currentUser } from '@/lib/session';
import { headers } from 'next/headers';

/**
 * The doctor's case view.
 *
 * Fetched through the API rather than assembled here, so the exact authorization, consent, and
 * audit path a client would take is the one the page takes too — a server component that read
 * the repository directly would be a second code path with its own chance of drifting.
 */
export default async function DoctorCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const t = await getTranslations('doctor');
  const user = await currentUser();

  if (user === null) redirect('/login');
  if (user.role !== 'doctor') redirect('/');
  if (user.mfaPending) redirect('/mfa');

  const headerList = await headers();
  const cookie = headerList.get('cookie') ?? '';
  const host = headerList.get('host') ?? 'localhost:3000';
  const protocol = headerList.get('x-forwarded-proto') ?? 'http';

  const response = await fetch(`${protocol}://${host}/api/doctor/cases/${caseId}`, {
    headers: { cookie },
    cache: 'no-store',
  });

  if (!response.ok) redirect('/doctor/queue');
  const data = (await response.json()) as Parameters<typeof CaseReview>[0]['data'];

  return (
    <div>
      <PageHeading>{t('caseHeading')}</PageHeading>
      <CaseReview caseId={caseId} data={data} />
    </div>
  );
}
