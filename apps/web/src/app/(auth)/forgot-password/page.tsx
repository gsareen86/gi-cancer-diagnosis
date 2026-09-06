import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ResetRequestForm } from '@/components/auth-forms';

/**
 * Asking for a reset link.
 *
 * Split from `/reset-password`, which now only completes one. Two states behind one path meant
 * the sign-in page had to link to a URL that would show a form for a token nobody had yet.
 */
export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth');
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{t('forgotHeading')}</h1>
      <p className="mt-2 text-ink-muted">{t('forgotIntro')}</p>
      <div className="mt-7">
        <ResetRequestForm />
      </div>
      <p className="mt-5 text-sm text-ink-muted">
        <Link href="/login" className="font-medium text-accent underline underline-offset-4">
          {t('backToLogin')}
        </Link>
      </p>
    </div>
  );
}
