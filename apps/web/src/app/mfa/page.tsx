import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Notice, PageHeading } from '@/components/primitives';
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

  return (
    <div className="mx-auto max-w-reading">
      <PageHeading>{t('mfaHeading')}</PageHeading>
      <Notice tone="urgent" role="note">
        {t('mfaBody')}
      </Notice>
    </div>
  );
}
