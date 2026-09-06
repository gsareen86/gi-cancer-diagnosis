import { getTranslations } from 'next-intl/server';
import { PageHeading, Panel } from '@/components/primitives';
import { ConsentForm } from '@/components/consent-form';
import { consentState } from '@/server/services/consent-service';
import { requireWorkspace } from '@/lib/guard';

export default async function ConsentPage() {
  const user = await requireWorkspace('patient', { skipOnboardingChecks: true });
  const t = await getTranslations('consent');

  const state = await consentState(user.id);
  // Dates cross the server/client boundary as ISO strings; the client formats them for the
  // reader's locale rather than receiving a pre-rendered date it cannot re-localize.
  const serializable = {
    ...state,
    purposes: state.purposes.map((purpose) => ({
      ...purpose,
      grantedAt: purpose.grantedAt === null ? null : purpose.grantedAt.toISOString(),
    })),
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading lead={t('intro')}>{t('heading')}</PageHeading>
      <Panel>
        <ConsentForm state={serializable} redirectTo="/patient/intake" />
      </Panel>
    </div>
  );
}
