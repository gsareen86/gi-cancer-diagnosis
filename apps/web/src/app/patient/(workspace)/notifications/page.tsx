import { getTranslations } from 'next-intl/server';
import { PageHeading } from '@/components/primitives';
import { NotificationFeed } from '@/components/notifications/notification-feed';

export default async function PatientNotificationsPage() {
  const t = await getTranslations('notifications');
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading lead={t('lead')}>{t('heading')}</PageHeading>
      <NotificationFeed caseHrefPrefix="/patient/case" />
    </div>
  );
}
