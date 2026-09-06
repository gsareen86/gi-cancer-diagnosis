import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth-forms';

export default async function LoginPage() {
  const t = await getTranslations('auth');
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{t('loginHeading')}</h1>
      <p className="mt-2 text-ink-muted">{t('loginIntro')}</p>
      <div className="mt-7">
        {/* `useSearchParams` inside the form reads `?next=`, so it needs a boundary. */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
