'use client';

import { useTranslations } from 'next-intl';
import { Notice } from '@/components/primitives';

export function WorkspaceError({ reset }: { reset: () => void }) {
  const t = useTranslations();
  return <Notice role="alert" tone="emergency" title={t('error.internal')}><button type="button" className="gi-button-secondary mt-4" onClick={reset}>{t('app.retry')}</button></Notice>;
}
