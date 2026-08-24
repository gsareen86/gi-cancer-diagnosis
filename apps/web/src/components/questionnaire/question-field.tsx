'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import type { AnswerValue, RenderedQuestion } from './types';
import { ReferenceImages } from './reference-images';
import { BodyMap } from './body-map';
import { DurationField } from './duration-field';
import { DateField } from './date-field';

/**
 * Renders one question of any type.
 *
 * Every control here is a real form control with a real label. Choices are large pressable rows
 * rather than native radios because the whole row needs to be a target on a phone — but they are
 * still radios and checkboxes underneath, so keyboard and screen-reader behaviour is the
 * browser's, not something reimplemented badly.
 */
export function QuestionField({
  question,
  value,
  onChange,
  disabled,
}: {
  question: RenderedQuestion;
  value: AnswerValue | null;
  onChange: (value: AnswerValue) => void;
  disabled?: boolean | undefined;
}) {
  const t = useTranslations('question');
  const fieldId = useId();

  switch (question.type) {
    case 'single_select':
      return (
        <fieldset disabled={disabled}>
          <legend className="sr-only">{t('selectOne')}</legend>
          <div className="space-y-3">
            {question.options.map((option) => {
              const selected = value?.kind === 'single_select' && value.optionId === option.id;
              return (
                <label
                  key={option.id}
                  className={`gi-choice cursor-pointer ${selected ? 'gi-choice-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name={`${fieldId}-${question.id}`}
                    className="mt-1 h-5 w-5 shrink-0 accent-accent"
                    checked={selected}
                    onChange={() => onChange({ kind: 'single_select', optionId: option.id })}
                  />
                  <span className="flex-1">
                    <span className="block">{option.label}</span>
                    {option.referenceImageIds.length > 0 && (
                      <ReferenceImages ids={option.referenceImageIds} compact />
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      );

    case 'multi_select': {
      const selectedIds = value?.kind === 'multi_select' ? value.optionIds : [];
      // "None of these" is exclusive: selecting it clears everything else, and selecting
      // anything else clears it. Otherwise a patient can submit "no symptoms, and also pain".
      const exclusive = question.options.find((option) => option.id === 'none')?.id;

      return (
        <fieldset disabled={disabled}>
          <legend className="mb-3 text-sm text-ink-muted">{t('selectAll')}</legend>
          <div className="space-y-3">
            {question.options.map((option) => {
              const selected = selectedIds.includes(option.id);
              return (
                <label
                  key={option.id}
                  className={`gi-choice cursor-pointer ${selected ? 'gi-choice-selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0 rounded accent-accent"
                    checked={selected}
                    onChange={() => {
                      let next: string[];
                      if (option.id === exclusive) {
                        next = selected ? [] : [option.id];
                      } else {
                        next = selected
                          ? selectedIds.filter((id) => id !== option.id)
                          : [...selectedIds.filter((id) => id !== exclusive), option.id];
                      }
                      onChange({ kind: 'multi_select', optionIds: next });
                    }}
                  />
                  <span className="flex-1">
                    <span className="block">{option.label}</span>
                    {option.referenceImageIds.length > 0 && (
                      <ReferenceImages ids={option.referenceImageIds} compact />
                    )}
                  </span>
                </label>
              );
            })}
          </div>
          {question.multiSelectMax !== null && (
            <p className="gi-hint">
              {selectedIds.length}/{question.multiSelectMax}
            </p>
          )}
        </fieldset>
      );
    }

    case 'scale': {
      const scale = question.scale;
      if (scale === null) return null;
      const current = value?.kind === 'scale' ? value.value : null;
      const steps = Array.from(
        { length: scale.max - scale.min + 1 },
        (_, index) => scale.min + index,
      );

      return (
        <fieldset disabled={disabled}>
          <legend className="sr-only">{question.prompt}</legend>
          {/*
            Buttons rather than a range input: a slider gives no feedback about which value is
            selected without sight, and a patient in pain should not have to drag precisely.
          */}
          <div className="flex flex-wrap gap-2">
            {steps.map((step) => (
              <button
                key={step}
                type="button"
                aria-pressed={current === step}
                onClick={() => onChange({ kind: 'scale', value: step })}
                className={`h-12 w-12 rounded-lg border-2 font-medium transition-colors ${
                  current === step
                    ? 'border-accent bg-accent text-white'
                    : 'border-line bg-surface hover:border-line-strong'
                }`}
              >
                {step}
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-sm text-ink-muted">
            <span>{scale.minLabel}</span>
            <span className="text-right">{scale.maxLabel}</span>
          </div>
        </fieldset>
      );
    }

    case 'numeric': {
      const numeric = question.numeric;
      if (numeric === null) return null;
      const current = value?.kind === 'numeric' ? value.value : '';
      const inputId = `${fieldId}-numeric`;

      return (
        <div>
          <label className="gi-label" htmlFor={inputId}>
            {t('enterNumber')}
          </label>
          <div className="flex items-center gap-3">
            <input
              id={inputId}
              type="number"
              inputMode={numeric.integerOnly ? 'numeric' : 'decimal'}
              className="gi-input max-w-[10rem]"
              min={numeric.min}
              max={numeric.max}
              step={numeric.integerOnly ? 1 : 'any'}
              value={current}
              disabled={disabled}
              aria-describedby={`${inputId}-range`}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                if (event.target.value === '' || Number.isNaN(parsed)) return;
                onChange({ kind: 'numeric', value: parsed, unit: numeric.unit });
              }}
            />
            <span className="text-ink-muted">{numeric.unit}</span>
          </div>
          <p className="gi-hint" id={`${inputId}-range`}>
            {t('range', { min: numeric.min, max: numeric.max })}
          </p>
        </div>
      );
    }

    case 'duration':
      return (
        <DurationField
          days={value?.kind === 'duration' ? value.days : null}
          onChange={(days) => onChange({ kind: 'duration', days })}
          disabled={disabled}
        />
      );

    case 'date':
      return (
        <DateField
          value={value?.kind === 'date' ? value.value : null}
          onChange={(isoDate) => onChange({ kind: 'date', value: isoDate })}
          disabled={disabled}
        />
      );

    case 'body_map':
      return (
        <BodyMap
          regionIds={question.bodyMapRegionIds}
          selected={value?.kind === 'body_map' ? value.regionIds : []}
          onChange={(regionIds) => onChange({ kind: 'body_map', regionIds })}
          disabled={disabled}
        />
      );

    case 'text': {
      const inputId = `${fieldId}-text`;
      const current = value?.kind === 'text' ? value.value : '';
      return (
        <div>
          <label className="sr-only" htmlFor={inputId}>
            {question.prompt}
          </label>
          <textarea
            id={inputId}
            className="gi-input min-h-[8rem]"
            maxLength={question.textMaxLength}
            value={current}
            disabled={disabled}
            onChange={(event) => onChange({ kind: 'text', value: event.target.value })}
          />
          <p className="gi-hint">
            {current.length}/{question.textMaxLength}
          </p>
        </div>
      );
    }

    case 'image':
      // Inline capture attaches to the case's encrypted document storage, never the reference
      // image library. Handled by the upload flow rather than here.
      return null;
  }
}

/** A clinical term with its lay explanation, disclosed inline rather than in a tooltip. */
export function ClinicalTerms({ question }: { question: RenderedQuestion }) {
  const t = useTranslations('question');
  const [open, setOpen] = useState(false);

  if (question.clinicalTerms.length === 0) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        className="text-sm font-medium text-accent underline underline-offset-4"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {t('whatThisMeans')}
      </button>
      {open && (
        <dl className="mt-2 space-y-2 rounded-lg bg-surface-sunken p-3 text-sm">
          {question.clinicalTerms.map((term) => (
            <div key={term.term}>
              <dt className="font-medium">{term.term}</dt>
              <dd className="text-ink-muted">{term.explanation}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
