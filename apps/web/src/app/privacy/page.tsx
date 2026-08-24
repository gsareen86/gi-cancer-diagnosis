import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Card, Notice, PageHeading } from '@/components/primitives';
import { ConsentForm } from '@/components/consent-form';
import { DataSubjectRights } from '@/components/data-subject-rights';
import { consentState } from '@/server/services/consent-service';
import { currentUser } from '@/lib/session';

/**
 * Privacy settings.
 *
 * Consent withdrawal lives here, in the patient's own account area, taking no more actions than
 * granting took. The law requires withdrawal to be as easy as consent, and a support-email-only
 * route would not be.
 */
export default async function PrivacyPage() {
  const t = await getTranslations('privacy');
  const user = await currentUser();
  if (user === null) redirect('/login');

  const state = await consentState(user.id);
  const serializable = {
    ...state,
    purposes: state.purposes.map((purpose) => ({
      ...purpose,
      grantedAt: purpose.grantedAt === null ? null : purpose.grantedAt.toISOString(),
    })),
  };

  return (
    <div className="mx-auto max-w-reading">
      <PageHeading>{t('heading')}</PageHeading>

      <section>
        <h2 className="mb-4 text-xl">{t('consentHeading')}</h2>
        <ConsentForm state={serializable} showWithdrawal />
      </section>

      <section className="mt-10">
        <h2 className="text-xl">{t('rightsHeading')}</h2>
        <p className="mt-2 text-ink-muted">{t('rightsIntro')}</p>
        <Card className="mt-4">
          <DataSubjectRights />
        </Card>
      </section>

      <div className="mt-8">
        <Notice tone="neutral" role="note" title={t('erasureWarningHeading')}>
          {t('erasureWarningBody')}
        </Notice>
      </div>
    </div>
  );
}
