'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { Badge, Card, Notice } from '@/components/primitives';

/**
 * Granular consent.
 *
 * Each purpose is its own control with its own explanation and its own statement of what
 * withdrawing it would stop. Nothing is pre-selected and nothing is bundled: a patient can agree
 * to storage and doctor review while declining AI analysis, and the case still gets reviewed.
 *
 * Withdrawal is here too, in the same place and the same number of taps as granting — the law
 * requires it to be as easy, and burying it behind a support email would not be.
 */

export interface ConsentPurposeState {
  purpose: string;
  granted: boolean;
  reason: string | null;
  grantedAt: string | null;
  policyVersion: string | null;
  required: boolean;
  titleKey: string;
  explanationKey: string;
  withdrawalConsequenceKey: string;
}

export interface ConsentStateView {
  policyVersion: string;
  dataFiduciary: string;
  grievanceContact: string;
  purposes: ConsentPurposeState[];
}

export function ConsentForm({
  state,
  redirectTo,
  showWithdrawal = false,
}: {
  state: ConsentStateView;
  redirectTo?: string;
  showWithdrawal?: boolean;
}) {
  const t = useTranslations('consent');
  const format = useFormatter();
  const router = useRouter();

  const [current, setCurrent] = useState(state);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  async function grant() {
    if (selected.length === 0 && redirectTo !== undefined) {
      // Nothing selected is a valid answer; the next screen will say what cannot proceed.
      router.push(redirectTo);
      return;
    }
    setPending(true);
    const result = await api.post<ConsentStateView>('/api/consent', { purposes: selected });
    setPending(false);

    if (result.ok) {
      setCurrent(result.data);
      setSelected([]);
      if (redirectTo !== undefined) {
        router.push(redirectTo);
        router.refresh();
      }
    }
  }

  async function withdraw(purpose: string) {
    setPending(true);
    const result = await api.del<ConsentStateView>('/api/consent', { purpose });
    setPending(false);
    if (result.ok) setCurrent(result.data);
  }

  return (
    <div>
      <div className="space-y-4">
        {current.purposes.map((entry) => {
          const key = entry.purpose;
          const isSelected = selected.includes(key);
          return (
            <Card key={key}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-lg">{t(`${key}.title` as never)}</h2>
                <Badge tone={entry.required ? 'accent' : 'neutral'}>
                  {entry.required ? t('required') : t('optional')}
                </Badge>
              </div>

              <p className="mt-2 text-ink-muted">{t(`${key}.explanation` as never)}</p>

              <div className="mt-4 rounded-lg bg-surface-sunken p-3 text-sm">
                <p className="font-medium">{t('withdrawConsequence')}</p>
                <p className="mt-0.5 text-ink-muted">{t(`${key}.withdrawal` as never)}</p>
              </div>

              <div className="mt-4">
                {entry.granted ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-ok">
                      {t('granted', {
                        date:
                          entry.grantedAt === null
                            ? ''
                            : format.dateTime(new Date(entry.grantedAt), {
                                dateStyle: 'long',
                              }),
                      })}
                    </p>
                    {showWithdrawal && (
                      <button
                        type="button"
                        className="gi-button-secondary"
                        disabled={pending}
                        onClick={() => void withdraw(key)}
                      >
                        {t('withdraw')}
                      </button>
                    )}
                  </div>
                ) : (
                  <label className={`gi-choice cursor-pointer ${isSelected ? 'gi-choice-selected' : ''}`}>
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0 rounded accent-accent"
                      checked={isSelected}
                      onChange={() =>
                        setSelected((values) =>
                          values.includes(key)
                            ? values.filter((value) => value !== key)
                            : [...values, key],
                        )
                      }
                    />
                    <span>{t('grant')}</span>
                  </label>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {current.purposes.some((entry) => !entry.granted) && (
        <button
          type="button"
          className="gi-button-primary mt-6 w-full"
          disabled={pending}
          onClick={() => void grant()}
        >
          {t('saveAndContinue')}
        </button>
      )}

      <div className="mt-8 space-y-1 text-sm text-ink-faint">
        <p>{t('policyVersion', { version: current.policyVersion })}</p>
        <p>{t('dataFiduciary', { name: current.dataFiduciary })}</p>
        <p>{t('grievance', { contact: current.grievanceContact })}</p>
      </div>

      {current.dataFiduciary.startsWith('TODO') && (
        <div className="mt-4">
          {/* Visible on purpose: a deployment that has not settled its Data Fiduciary is not
              ready for real patient data, and hiding that would make it easy to miss. */}
          <Notice tone="urgent" role="note">
            This deployment has not yet recorded its Data Fiduciary and grievance officer. Settle
            these before processing real patient data.
          </Notice>
        </div>
      )}
    </div>
  );
}
