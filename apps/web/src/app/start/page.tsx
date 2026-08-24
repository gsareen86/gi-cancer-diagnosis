import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createTextResolver } from '@gi-compass/core';
import { PageHeading } from '@/components/primitives';
import { StartCase } from '@/components/start-case';
import { currentPublishedTemplate } from '@/server/services/content-service';
import { consentState } from '@/server/services/consent-service';
import { currentUser, profileComplete } from '@/lib/session';

/**
 * Choosing where to start.
 *
 * The options are symptom areas, never conditions. Asking a patient which disease they think they
 * have both biases their answers and asks them to do the thing they came here because they
 * cannot.
 */
export default async function StartPage() {
  const t = await getTranslations('case');
  const user = await currentUser();
  if (user === null) redirect('/login');
  if (!profileComplete(user)) redirect('/profile');

  const consents = await consentState(user.id);
  const storageGranted = consents.purposes.find(
    (purpose) => purpose.purpose === 'account_processing',
  )?.granted;
  if (storageGranted !== true) redirect('/consent');

  const { document, index } = await currentPublishedTemplate();
  const resolve = createTextResolver(document, user.locale);

  const areas = [...document.template.entryPoints]
    .sort((a, b) => a.order - b.order)
    .map((entry) => ({
      id: entry.id,
      label: resolve(entry.labelKey),
      cluster: index.groupById.get(entry.entryGroupId)?.cluster ?? 'history',
    }));

  return (
    <div className="mx-auto max-w-reading">
      <PageHeading lead={t('chooseAreaIntro')}>{t('chooseAreaHeading')}</PageHeading>
      <StartCase areas={areas} />
    </div>
  );
}
