import { getTranslations } from 'next-intl/server';
import { PageHeading, Panel } from '@/components/primitives';
import { ProfileForm } from '@/components/profile-form';
import { requireWorkspace } from '@/lib/guard';

/**
 * The profile.
 *
 * Guarded without the onboarding checks — this is the page that resolves them, so a guard that
 * enforced them here would redirect the page to itself for exactly as long as the profile stayed
 * incomplete.
 */
export default async function ProfilePage() {
  const user = await requireWorkspace('patient', { skipOnboardingChecks: true });
  const t = await getTranslations('profile');

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading lead={t('intro')}>{t('heading')}</PageHeading>
      <Panel>
        <ProfileForm
          initial={{
            fullName: user.fullName,
            dateOfBirth: user.dateOfBirth,
            sex: user.sex,
          }}
        />
      </Panel>
    </div>
  );
}
