import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { ConsentForm } from '@/components/consent-form';
import { PageHeading } from '@/components/primitives';
import { consentState } from '@/server/services/consent-service';
import { currentUser } from '@/lib/session';

export default async function ConsentPage() {
  const t = await getTranslations('consent');
  const user = await currentUser();
  if (user === null) redirect('/login');

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
    <div className="mx-auto max-w-reading">
      <PageHeading lead={t('intro')}>{t('heading')}</PageHeading>
      <ConsentForm state={serializable} redirectTo="/start" />
    </div>
  );
}
