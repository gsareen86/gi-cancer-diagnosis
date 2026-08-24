'use client';

import { useTranslations } from 'next-intl';

/**
 * Where does it hurt?
 *
 * An abdominal diagram with named regions. The answer stores region identifiers, never screen
 * coordinates, so it survives a different screen size and means the same thing to the doctor as
 * it did to the patient.
 *
 * Each region is a real button with a real accessible name, so the whole thing is answerable by
 * keyboard and by screen reader — an image map with no text alternative would make this question
 * unanswerable for some patients rather than merely harder.
 */

interface Region {
  id: string;
  label: string;
  /** Percentage box within the diagram: left, top, width, height. */
  box: [number, number, number, number];
}

const REGION_LAYOUT: Record<string, Region> = {
  right_upper: { id: 'right_upper', label: 'Upper right', box: [8, 12, 28, 22] },
  epigastrium: { id: 'epigastrium', label: 'Upper middle', box: [36, 12, 28, 22] },
  left_upper: { id: 'left_upper', label: 'Upper left', box: [64, 12, 28, 22] },
  right_flank: { id: 'right_flank', label: 'Middle right', box: [8, 34, 28, 22] },
  periumbilical: { id: 'periumbilical', label: 'Around the navel', box: [36, 34, 28, 22] },
  left_flank: { id: 'left_flank', label: 'Middle left', box: [64, 34, 28, 22] },
  right_lower: { id: 'right_lower', label: 'Lower right', box: [8, 56, 28, 22] },
  suprapubic: { id: 'suprapubic', label: 'Lower middle', box: [36, 56, 28, 22] },
  left_lower: { id: 'left_lower', label: 'Lower left', box: [64, 56, 28, 22] },
  whole_abdomen: { id: 'whole_abdomen', label: 'All over my tummy', box: [8, 80, 84, 8] },
  back: { id: 'back', label: 'Through to my back', box: [8, 89, 84, 8] },
};

export function BodyMap({
  regionIds,
  selected,
  onChange,
  disabled,
}: {
  regionIds: string[];
  selected: string[];
  onChange: (regionIds: string[]) => void;
  disabled?: boolean | undefined;
}) {
  const t = useTranslations('question');

  function toggle(regionId: string) {
    onChange(
      selected.includes(regionId)
        ? selected.filter((id) => id !== regionId)
        : [...selected, regionId],
    );
  }

  const regions = regionIds
    .map((id) => REGION_LAYOUT[id])
    .filter((region): region is Region => region !== undefined);

  return (
    <fieldset disabled={disabled}>
      <legend className="mb-3 text-sm text-ink-muted">{t('selectAreas')}</legend>

      <div
        className="relative mx-auto aspect-[4/5] w-full max-w-sm rounded-2xl border border-line bg-surface-sunken"
        role="group"
      >
        {/* A simple torso outline. Decorative — every region below is separately labelled. */}
        <svg
          viewBox="0 0 100 125"
          className="absolute inset-0 h-full w-full text-line-strong"
          aria-hidden="true"
        >
          <path
            d="M50 4 C34 4 24 12 22 26 L14 66 C12 82 18 96 28 106 L50 118 L72 106 C82 96 88 82 86 66 L78 26 C76 12 66 4 50 4 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>

        {regions.map((region) => {
          const [left, top, width, height] = region.box;
          const isSelected = selected.includes(region.id);
          return (
            <button
              key={region.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggle(region.id)}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
              }}
              className={`absolute rounded-lg border-2 text-xs font-medium transition-colors ${
                isSelected
                  ? 'border-accent bg-accent/25 text-accent'
                  : 'border-transparent bg-transparent text-ink-faint hover:border-line-strong hover:bg-surface'
              }`}
            >
              {/* The label is visible, not only an accessible name: a patient should not have to
                  guess which invisible box is "upper right". */}
              {region.label}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <p className="mt-3 text-sm text-ink-muted" role="status">
          {selected
            .map((id) => REGION_LAYOUT[id]?.label ?? id)
            .join(', ')}
        </p>
      )}
    </fieldset>
  );
}
