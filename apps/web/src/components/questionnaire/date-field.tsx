'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';

/**
 * Three separate fields, never a free-text date.
 *
 * "03/04/2026" means March in one convention and April in another, and a report date the doctor
 * reads six weeks late is a real clinical error. Day, month, and year are captured explicitly and
 * stored as ISO 8601, so there is nothing left to interpret.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function DateField({
  value,
  onChange,
  disabled,
  id,
}: {
  value: string | null;
  onChange: (isoDate: string) => void;
  disabled?: boolean | undefined;
  id?: string;
}) {
  const t = useTranslations('profile');
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [parts, setParts] = useState(() => split(value));

  useEffect(() => {
    setParts(split(value));
  }, [value]);

  function emit(next: { day: string; month: string; year: string }) {
    setParts(next);
    const day = Number(next.day);
    const month = Number(next.month);
    const year = Number(next.year);
    if (!day || !month || !year || next.year.length !== 4) return;

    const candidate = new Date(Date.UTC(year, month - 1, day));
    // Rejects 31 February rather than letting the Date constructor roll it into March.
    if (
      candidate.getUTCFullYear() !== year ||
      candidate.getUTCMonth() !== month - 1 ||
      candidate.getUTCDate() !== day
    ) {
      return;
    }
    onChange(candidate.toISOString().slice(0, 10));
  }

  const currentYear = new Date().getUTCFullYear();

  return (
    <div className="flex gap-3" role="group">
      <div>
        <label className="gi-label" htmlFor={`${fieldId}-day`}>
          {t('day')}
        </label>
        <input
          id={`${fieldId}-day`}
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          className="gi-input w-20"
          value={parts.day}
          disabled={disabled}
          onChange={(event) => emit({ ...parts, day: event.target.value })}
        />
      </div>
      <div className="flex-1">
        <label className="gi-label" htmlFor={`${fieldId}-month`}>
          {t('month')}
        </label>
        <select
          id={`${fieldId}-month`}
          className="gi-input"
          value={parts.month}
          disabled={disabled}
          onChange={(event) => emit({ ...parts, month: event.target.value })}
        >
          <option value="">—</option>
          {MONTHS.map((name, index) => (
            <option key={name} value={String(index + 1)}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="gi-label" htmlFor={`${fieldId}-year`}>
          {t('year')}
        </label>
        <input
          id={`${fieldId}-year`}
          type="number"
          inputMode="numeric"
          min={1900}
          max={currentYear}
          className="gi-input w-28"
          value={parts.year}
          disabled={disabled}
          onChange={(event) => emit({ ...parts, year: event.target.value })}
        />
      </div>
    </div>
  );
}

function split(value: string | null): { day: string; month: string; year: string } {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { day: '', month: '', year: '' };
  }
  const [year, month, day] = value.split('-');
  return { day: String(Number(day)), month: String(Number(month)), year: year ?? '' };
}
