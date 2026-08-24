'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';

/**
 * "How long has this been happening?"
 *
 * A number plus a unit rather than a date picker: a patient rarely remembers the day symptoms
 * started, but almost always knows "about three weeks". The stored value is days, so the
 * clinician-authored thresholds ("more than two weeks") compare cleanly whatever unit was used.
 */

type Unit = 'days' | 'weeks' | 'months' | 'years';

const DAYS_PER_UNIT: Record<Unit, number> = {
  days: 1,
  weeks: 7,
  months: 30,
  years: 365,
};

/** Picks the unit that renders a stored day count most naturally when resuming. */
function decompose(days: number | null): { amount: string; unit: Unit } {
  if (days === null) return { amount: '', unit: 'weeks' };
  for (const unit of ['years', 'months', 'weeks'] as const) {
    const factor = DAYS_PER_UNIT[unit];
    if (days >= factor && days % factor === 0) {
      return { amount: String(days / factor), unit };
    }
  }
  return { amount: String(days), unit: 'days' };
}

export function DurationField({
  days,
  onChange,
  disabled,
}: {
  days: number | null;
  onChange: (days: number) => void;
  disabled?: boolean | undefined;
}) {
  const t = useTranslations('question');
  const fieldId = useId();
  const [state, setState] = useState(() => decompose(days));

  useEffect(() => {
    setState(decompose(days));
  }, [days]);

  function emit(amount: string, unit: Unit) {
    setState({ amount, unit });
    const parsed = Number(amount);
    if (amount === '' || Number.isNaN(parsed) || parsed < 0) return;
    onChange(Math.round(parsed * DAYS_PER_UNIT[unit]));
  }

  return (
    <div>
      <span className="gi-label" id={`${fieldId}-legend`}>
        {t('durationHeading')}
      </span>
      <div className="flex gap-3" role="group" aria-labelledby={`${fieldId}-legend`}>
        <label className="sr-only" htmlFor={`${fieldId}-amount`}>
          {t('enterNumber')}
        </label>
        <input
          id={`${fieldId}-amount`}
          type="number"
          inputMode="numeric"
          min={0}
          className="gi-input max-w-[7rem]"
          value={state.amount}
          disabled={disabled}
          onChange={(event) => emit(event.target.value, state.unit)}
        />
        <label className="sr-only" htmlFor={`${fieldId}-unit`}>
          {t('durationHeading')}
        </label>
        <select
          id={`${fieldId}-unit`}
          className="gi-input max-w-[10rem]"
          value={state.unit}
          disabled={disabled}
          onChange={(event) => emit(state.amount, event.target.value as Unit)}
        >
          <option value="days">{t('durationDays')}</option>
          <option value="weeks">{t('durationWeeks')}</option>
          <option value="months">{t('durationMonths')}</option>
          <option value="years">{t('durationYears')}</option>
        </select>
      </div>
    </div>
  );
}
