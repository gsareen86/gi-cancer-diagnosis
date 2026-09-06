'use client';

import { useTranslations } from 'next-intl';

/**
 * Where does it hurt?
 *
 * An abdominal diagram with named regions. The answer stores region identifiers, never screen
 * coordinates, so it survives a different screen size and means the same thing to the doctor as
 * it did to the patient.
 *
 * Each region is a real button with a real visible label, so the whole thing is answerable by
 * keyboard and by screen reader — an image map with no text alternative would make this question
 * unanswerable for some patients rather than merely harder. That is also why the labels come from
 * the catalogue: they used to be English string literals in this file, which meant a Hindi
 * speaker answering a Hindi questionnaire hit "Upper right" in the middle of it.
 *
 * The torso outline is decorative. If the SVG fails to render, every region is still a labelled,
 * pressable button in a nine-square grid.
 */

interface Region {
  id: string;
  /** Catalogue key under `question`. */
  labelKey: string;
  /** Percentage box within the diagram: left, top, width, height. */
  box: [number, number, number, number];
}

const REGION_LAYOUT: Record<string, Region> = {
  right_upper: { id: 'right_upper', labelKey: 'region_right_upper', box: [8, 12, 28, 22] },
  epigastrium: { id: 'epigastrium', labelKey: 'region_epigastrium', box: [36, 12, 28, 22] },
  left_upper: { id: 'left_upper', labelKey: 'region_left_upper', box: [64, 12, 28, 22] },
  right_flank: { id: 'right_flank', labelKey: 'region_right_flank', box: [8, 34, 28, 22] },
  periumbilical: { id: 'periumbilical', labelKey: 'region_periumbilical', box: [36, 34, 28, 22] },
  left_flank: { id: 'left_flank', labelKey: 'region_left_flank', box: [64, 34, 28, 22] },
  right_lower: { id: 'right_lower', labelKey: 'region_right_lower', box: [8, 56, 28, 22] },
  suprapubic: { id: 'suprapubic', labelKey: 'region_suprapubic', box: [36, 56, 28, 22] },
  left_lower: { id: 'left_lower', labelKey: 'region_left_lower', box: [64, 56, 28, 22] },
  whole_abdomen: { id: 'whole_abdomen', labelKey: 'region_whole_abdomen', box: [8, 80, 84, 8] },
  back: { id: 'back', labelKey: 'region_back', box: [8, 89, 84, 8] },
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

  const label = (region: Region) => t(region.labelKey as never);

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
          {/* Faint quadrant guides, so the nine boxes read as an abdomen rather than a grid. */}
          <g stroke="currentColor" strokeWidth="0.6" opacity="0.5">
            <line x1="36" y1="14" x2="36" y2="98" />
            <line x1="64" y1="14" x2="64" y2="98" />
            <line x1="16" y1="42" x2="84" y2="42" />
            <line x1="15" y1="70" x2="85" y2="70" />
          </g>
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
              className={`absolute rounded-lg border-2 text-xs font-medium leading-tight transition-colors ${
                isSelected
                  ? 'border-accent bg-accent-faint text-accent'
                  : 'border-transparent bg-transparent text-ink-muted hover:border-line-strong hover:bg-surface'
              }`}
            >
              {/* The label is visible, not only an accessible name: a patient should not have to
                  guess which invisible box is "upper right". */}
              {label(region)}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <p className="mt-3 text-sm text-ink-muted" role="status">
          {selected
            .map((id) => {
              const region = REGION_LAYOUT[id];
              return region === undefined ? id : label(region);
            })
            .join(', ')}
        </p>
      )}
    </fieldset>
  );
}
