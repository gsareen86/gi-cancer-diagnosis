import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { ResetCompleteForm } from '@/components/auth-forms';

/** Completing a reset. Without a token there is nothing to complete, so ask for one first. */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const t = await getTranslations('auth');
  const { token } = await searchParams;
  if (token === undefined || token === '') redirect('/forgot-password');

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{t('resetHeading')}</h1>
      <p className="mt-2 text-ink-muted">{t('resetIntro')}</p>
      <div className="mt-7">
        <ResetCompleteForm token={token} />
      </div>
    </div>
  );
}
