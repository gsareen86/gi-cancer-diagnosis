import { getTranslations } from 'next-intl/server';
import { PageHeading } from '@/components/primitives';
import { NotificationFeed } from '@/components/notifications/notification-feed';

export default async function DoctorNotificationsPage() {
  const t = await getTranslations('notifications');
  return (
    <div>
      <PageHeading lead={t('lead')}>{t('heading')}</PageHeading>
      <NotificationFeed caseHrefPrefix="/doctor/case" />
    </div>
  );
}
