'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Notice, Spinner } from '@/components/primitives';

export function VerifyEmail({ token }: { token: string | null }) {
  const t = useTranslations('auth');
  const tApp = useTranslations('app');
  const [state, setState] = useState<'pending' | 'verified' | 'failed'>(
    token === null ? 'failed' : 'pending',
  );

  useEffect(() => {
    if (token === null) return;
    let cancelled = false;
    void api.post('/api/auth/verify-email', { token }).then((result) => {
      if (!cancelled) setState(result.ok ? 'verified' : 'failed');
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === 'pending') return <Spinner label={tApp('loading')} />;

  if (state === 'verified') {
    return (
      <div>
        <Notice tone="ok" role="status">
          {t('verifySuccess')}
        </Notice>
        <Link href="/login" className="gi-button-primary mt-6">
          {t('login')}
        </Link>
      </div>
    );
  }

  return (
    <Notice tone="emergency" role="alert">
      {t('verifyFailed')}
    </Notice>
  );
}
