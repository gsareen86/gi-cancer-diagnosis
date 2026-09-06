'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, type ApiProblem } from '@/lib/api-client';
import { Notice } from '@/components/primitives';

/**
 * Takes an unassigned case. A single deliberate action, because claiming makes this doctor the
 * one responsible for reviewing it.
 */
export function ClaimButton({ caseId, compact = false }: { caseId: string; compact?: boolean }) {
  const t = useTranslations('doctor');
  const tAll = useTranslations();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);

  async function claim() {
    setPending(true);
    setProblem(null);

    const result = await api.post(`/api/doctor/cases/${caseId}/claim`);
    setPending(false);

    if (!result.ok) {
      setProblem(result.problem);
      // Someone else may have taken it a moment ago, so show the queue as it now stands.
      router.refresh();
      return;
    }
    router.push(`/doctor/case/${caseId}`);
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        className={compact ? 'gi-button-sm gi-button-primary' : 'gi-button-primary'}
        disabled={pending}
        onClick={() => void claim()}
      >
        {t('claimLabel')}
      </button>
      {problem !== null && (
        <div className="mt-2">
          <Notice tone="urgent" role="alert">
            {tAll(problem.messageKey as never)}
          </Notice>
        </div>
      )}
    </div>
  );
}
