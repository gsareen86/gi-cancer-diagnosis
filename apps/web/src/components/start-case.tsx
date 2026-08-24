'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, type ApiProblem } from '@/lib/api-client';
import { Notice } from '@/components/primitives';

const CLUSTER_ICON: Record<string, string> = {
  pain: '◐',
  bowel_habit: '◑',
  bleeding: '◒',
  reflux_upper_gi: '◓',
  hepatobiliary: '◔',
};

export function StartCase({
  areas,
}: {
  areas: Array<{ id: string; label: string; cluster: string }>;
}) {
  const t = useTranslations('case');
  const tAll = useTranslations();
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [problem, setProblem] = useState<ApiProblem | null>(null);

  async function start(entryPointId: string) {
    setPending(entryPointId);
    setProblem(null);

    const result = await api.post<{ case: { id: string } }>('/api/cases', { entryPointId });
    setPending(null);

    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    router.push(`/cases/${result.data.case.id}/interview`);
  }

  return (
    <div>
      <ul className="space-y-3">
        {areas.map((area) => (
          <li key={area.id}>
            <button
              type="button"
              className="gi-choice w-full items-center"
              disabled={pending !== null}
              onClick={() => void start(area.id)}
            >
              <span aria-hidden="true" className="text-2xl text-accent">
                {CLUSTER_ICON[area.cluster] ?? '○'}
              </span>
              <span className="flex-1 text-lg">{area.label}</span>
            </button>
          </li>
        ))}
      </ul>

      {problem !== null && (
        <div className="mt-5 space-y-3">
          <Notice tone={problem.code === 'conflict' ? 'accent' : 'emergency'} role="alert">
            {tAll(problem.messageKey as never)}
          </Notice>
          {problem.code === 'conflict' && (
            <a href="/cases" className="gi-button-secondary">
              {t('resume')}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
