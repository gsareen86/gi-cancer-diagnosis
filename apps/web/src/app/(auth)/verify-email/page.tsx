import { getTranslations } from 'next-intl/server';
import { VerifyEmail } from '@/components/verify-email';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const t = await getTranslations('auth');
  const { token } = await searchParams;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{t('verifyHeading')}</h1>
      <div className="mt-7">
        <VerifyEmail token={token ?? null} />
      </div>
    </div>
  );
}
