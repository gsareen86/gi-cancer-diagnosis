import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { ProfileForm } from '@/components/profile-form';
import { PageHeading } from '@/components/primitives';
import { currentUser } from '@/lib/session';

export default async function ProfilePage() {
  const t = await getTranslations('profile');
  const user = await currentUser();
  if (user === null) redirect('/login');

  return (
    <div className="mx-auto max-w-reading">
      <PageHeading lead={t('intro')}>{t('heading')}</PageHeading>
      <ProfileForm
        initial={{
          fullName: user.fullName,
          dateOfBirth: user.dateOfBirth,
          sex: user.sex,
        }}
      />
    </div>
  );
}
