import { getTranslations } from 'next-intl/server';
import { Notice, PageHeading, Panel } from '@/components/primitives';
import { ConsentForm } from '@/components/consent-form';
import { DataSubjectRights } from '@/components/data-subject-rights';
import { consentState } from '@/server/services/consent-service';
import { requireWorkspace } from '@/lib/guard';

/**
 * Privacy settings.
 *
 * Consent withdrawal lives here, in the patient's own account area, taking no more actions than
 * granting took. The law requires withdrawal to be as easy as consent, and a support-email-only
 * route would not be.
 *
 * Guarded without the onboarding checks: a patient who has withdrawn storage consent must still
 * be able to reach the page that shows them they did.
 */
export default async function PrivacyPage() {
  const user = await requireWorkspace('patient', { skipOnboardingChecks: true });
  const t = await getTranslations('privacy');

  const state = await consentState(user.id);
  const serializable = {
    ...state,
    purposes: state.purposes.map((purpose) => ({
      ...purpose,
      grantedAt: purpose.grantedAt === null ? null : purpose.grantedAt.toISOString(),
    })),
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading>{t('heading')}</PageHeading>

      <Panel title={t('consentHeading')}>
        <ConsentForm state={serializable} showWithdrawal />
      </Panel>

      <div className="mt-6">
        <Panel title={t('rightsHeading')}>
          <p className="text-ink-muted">{t('rightsIntro')}</p>
          <div className="mt-4">
            <DataSubjectRights />
          </div>
        </Panel>
      </div>

      <div className="mt-6">
        <Notice tone="caution" role="note" title={t('erasureWarningHeading')}>
          {t('erasureWarningBody')}
        </Notice>
      </div>
    </div>
  );
}
