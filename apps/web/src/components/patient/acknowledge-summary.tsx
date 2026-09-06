'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

export function AcknowledgeSummary({ caseId, acknowledged }: { caseId: string; acknowledged: boolean }) {
  const t = useTranslations('case');
  const all = useTranslations();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  async function confirm() {
    setPending(true);
    const result = await api.post(`/api/cases/${caseId}/summary/acknowledge`);
    setPending(false);
    toast({ message: result.ok ? t('acknowledgedSummary') : all(result.problem.messageKey as never), tone: result.ok ? 'ok' : 'emergency' });
    if (result.ok) router.refresh();
  }
  return acknowledged ? <p className="text-sm text-ok" role="status">{t('acknowledgedSummary')}</p> : <button type="button" className="gi-button-primary" disabled={pending} onClick={() => void confirm()}>{t('acknowledgeSummary')}</button>;
}
