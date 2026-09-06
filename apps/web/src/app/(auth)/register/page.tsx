import { getTranslations } from 'next-intl/server';
import { RegisterForm } from '@/components/auth-forms';

export default async function RegisterPage() {
  const t = await getTranslations('auth');
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{t('registerHeading')}</h1>
      <p className="mt-2 text-ink-muted">{t('registerIntro')}</p>
      <div className="mt-7">
        <RegisterForm />
      </div>
    </div>
  );
}
