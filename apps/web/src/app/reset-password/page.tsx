import { getTranslations } from 'next-intl/server';
import { ResetCompleteForm, ResetRequestForm } from '@/components/auth-forms';
import { PageHeading } from '@/components/primitives';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const t = await getTranslations('auth');
  const { token } = await searchParams;

  return (
    <div className="mx-auto max-w-reading">
      <PageHeading>{t('resetHeading')}</PageHeading>
      {token === undefined ? <ResetRequestForm /> : <ResetCompleteForm token={token} />}
    </div>
  );
}
