import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/components/auth-forms';
import { PageHeading } from '@/components/primitives';

export default async function LoginPage() {
  const t = await getTranslations('auth');
  return (
    <div className="mx-auto max-w-reading">
      <PageHeading>{t('loginHeading')}</PageHeading>
      <LoginForm />
    </div>
  );
}
