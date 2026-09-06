'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

/**
 * Reference pictures beside a question.
 *
 * Three constraints shape this. They load lazily and at a size appropriate to the viewport,
 * because a patient on a slow mobile connection must be able to read and answer the question
 * before any image arrives. They are never required to answer — the text stands alone. And the
 * questionnaire payload carries identifiers and alternative text only, never image binaries.
 *
 * Assets are served from the reference library, which refuses to publish anything without a
 * recorded source and licence — so an unattributed placeholder renders as a caption, not as a
 * silently missing picture.
 */
export function ReferenceImages({ ids, compact = false }: { ids: string[]; compact?: boolean }) {
  const t = useTranslations('question');
  const [expanded, setExpanded] = useState(false);
  // An asset the library has not published — its source and licence are still placeholders — and
  // an asset that simply fails to arrive on a bad connection look the same from here. Either way
  // the question stands on its text alone, so the slot is removed rather than left as a broken
  // image icon beside a clinical question.
  const [failed, setFailed] = useState<string[]>([]);

  if (ids.length === 0) return null;

  if (compact && !expanded) {
    return (
      <button
        type="button"
        className="mt-2 text-sm font-medium text-accent underline underline-offset-4"
        onClick={(event) => {
          // Inside a <label>: without this the click also toggles the choice it sits in.
          event.preventDefault();
          event.stopPropagation();
          setExpanded(true);
        }}
      >
        {t('seeExamples')}
      </button>
    );
  }

  return (
    <ul className={`mt-3 grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
      {ids.map((id) => (
        <li key={id} className="overflow-hidden rounded-lg border border-line bg-surface-sunken">
          {failed.includes(id) ? <p role="status" className="p-4 text-sm text-ink-muted">{t('imageUnavailable')}</p> : <img
            src={`/api/reference-images/${encodeURIComponent(id)}`}
            alt={t('imageAlt')}
            loading="lazy"
            decoding="async"
            sizes="(max-width: 640px) 45vw, 30vw"
            className="aspect-[4/3] w-full object-cover"
            onError={() => setFailed((current) => [...current, id])}
          />}
        </li>
      ))}
    </ul>
  );
}
