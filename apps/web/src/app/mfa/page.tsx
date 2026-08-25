import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { tables } from '@gi-compass/db';
import { PageHeading } from '@/components/primitives';
import { MfaEnrolment } from '@/components/mfa-enrolment';
import { database } from '@/server/db';
import { currentUser } from '@/lib/session';

/**
 * Second-factor enrolment.
 *
 * A privileged account with an outstanding second factor holds an enrolment-scoped session: it
 * reaches this page and the MFA endpoints, and nothing else. In particular it cannot read any
 * patient clinical data — that is enforced in the API middleware, not by this redirect.
 */
export default async function MfaPage() {
  const t = await getTranslations('auth');
  const user = await currentUser();
  if (user === null) redirect('/login');
  if (!user.mfaPending) redirect('/');

  const [factor] = await database()
    .select({ confirmedAt: tables.totpFactors.confirmedAt })
    .from(tables.totpFactors)
    .where(eq(tables.totpFactors.userId, user.id))
    .limit(1);

  const alreadyEnrolled = factor?.confirmedAt != null;

  return (
    <div className="mx-auto max-w-reading">
      <PageHeading lead={alreadyEnrolled ? t('mfaSignInBody') : t('mfaBody')}>
        {alreadyEnrolled ? t('mfaSignInHeading') : t('mfaHeading')}
      </PageHeading>
      <MfaEnrolment alreadyEnrolled={alreadyEnrolled} />
    </div>
  );
}
