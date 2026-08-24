import { getTranslations } from 'next-intl/server';
import { RegisterForm } from '@/components/auth-forms';
import { PageHeading } from '@/components/primitives';

export default async function RegisterPage() {
  const t = await getTranslations('auth');
  return (
    <div className="mx-auto max-w-reading">
      <PageHeading>{t('registerHeading')}</PageHeading>
      <RegisterForm />
    </div>
  );
}
