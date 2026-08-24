import { getTranslations } from 'next-intl/server';
import { VerifyEmail } from '@/components/verify-email';
import { PageHeading } from '@/components/primitives';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const t = await getTranslations('auth');
  const { token } = await searchParams;

  return (
    <div className="mx-auto max-w-reading">
      <PageHeading>{t('verifyHeading')}</PageHeading>
      <VerifyEmail token={token ?? null} />
    </div>
  );
}
