import type { ReactNode } from 'react';

/**
 * Shared building blocks.
 *
 * Two rules run through all of them. Meaning is never carried by colour alone — every urgency
 * and status also carries a word — because a red dot means nothing to a colour-blind reader or
 * on a washed-out phone screen in daylight. And nothing here accepts raw display text as a
 * default: strings come from the caller, which come from the catalogue.
 */

export function Card({
  children,
  className = '',
  as: Element = 'div',
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
} & Record<`data-${string}`, string | undefined>) {
  return (
    <Element className={`gi-card ${className}`} {...rest}>
      {children}
    </Element>
  );
}

/**
 * A titled surface with its own header row, for the workspace panels.
 *
 * Distinct from `Card` because the header stays put while `Panel`'s body scrolls — that is the
 * whole point of the three-column review, where reading the transcript must not move the
 * sign-off actions off screen.
 */
export function Panel({
  title,
  actions,
  children,
  className = '',
  bodyClassName = 'gi-panel-body',
  as: Element = 'section',
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return (
    <Element className={`gi-panel ${className}`}>
      {title !== undefined && (
        <header className="gi-panel-header">
          <h2 className="text-base font-semibold">{title}</h2>
          {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </Element>
  );
}

export function PageHeading({
  children,
  lead,
  actions,
}: {
  children: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="gi-prose">
        <h1 className="text-2xl sm:text-3xl">{children}</h1>
        {lead !== undefined && <p className="mt-2 text-ink-muted">{lead}</p>}
      </div>
      {actions !== undefined && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export type Tone = 'neutral' | 'accent' | 'ok' | 'caution' | 'urgent' | 'emergency';

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-surface-inset text-ink-muted border-line-strong',
  accent: 'bg-accent-faint text-accent border-accent-line',
  ok: 'bg-ok-faint text-ok border-ok-line',
  caution: 'bg-caution-faint text-caution border-caution-line',
  urgent: 'bg-urgent-faint text-urgent border-urgent-line',
  emergency: 'bg-emergency-faint text-emergency border-emergency-line',
};

/** The solid edge used to mark a row or card by tone without tinting its whole surface. */
export const TONE_EDGE: Record<Tone, string> = {
  neutral: 'border-l-line-strong',
  accent: 'border-l-accent-bright',
  ok: 'border-l-ok-bright',
  caution: 'border-l-caution-bright',
  urgent: 'border-l-urgent-bright',
  emergency: 'border-l-emergency-bright',
};

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-sm font-medium ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Notice({
  tone = 'neutral',
  title,
  children,
  role,
  className = '',
}: {
  tone?: Tone;
  title?: ReactNode;
  children: ReactNode;
  /** `alert` for anything the reader must be interrupted by; `status` for passive updates. */
  role?: 'alert' | 'status' | 'note';
  className?: string;
}) {
  return (
    <div
      role={role === 'note' ? undefined : role}
      className={`rounded-xl border p-4 ${TONE_CLASSES[tone]} ${className}`}
    >
      {title !== undefined && <p className="font-semibold">{title}</p>}
      <div className={title === undefined ? '' : 'mt-1'}>{children}</div>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  optional,
  className = 'mb-5',
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor: string;
  children: ReactNode;
  optional?: ReactNode;
  className?: string;
}) {
  const hintId = hint === undefined ? undefined : `${htmlFor}-hint`;
  const errorId = error === undefined ? undefined : `${htmlFor}-error`;

  return (
    <div className={className}>
      <label className="gi-label" htmlFor={htmlFor}>
        {label}
        {optional !== undefined && (
          <span className="ml-2 font-normal text-ink-faint">{optional}</span>
        )}
      </label>
      {/*
        The hint is wired through aria-describedby rather than left as adjacent text, so a
        screen-reader user hears the constraint before typing rather than after failing.
      */}
      <div aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}>
        {children}
      </div>
      {hint !== undefined && (
        <p className="gi-hint" id={hintId}>
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p className="gi-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Progress through the interview.
 *
 * The number is the honest one: answered out of the questions currently on the patient's path.
 * When a branch opens, the total grows — so the component says so rather than letting the bar
 * appear to slide backwards for no reason.
 */
export function Progress({
  answered,
  total,
  label,
  branchOpenedLabel,
  branchOpened,
}: {
  answered: number;
  total: number;
  label: string;
  branchOpenedLabel: string;
  branchOpened: boolean;
}) {
  const percent = total === 0 ? 0 : Math.round((answered / total) * 100);
  return (
    <div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={answered}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-accent-bright transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-ink-muted">{label}</p>
      {branchOpened && (
        <p className="mt-1 text-sm text-accent" role="status">
          {branchOpenedLabel}
        </p>
      )}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-ink-muted" role="status">
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-accent"
      />
      {label}
    </span>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

/**
 * A label-and-value pair, which is most of what a clinical record is.
 *
 * `value` being `null` renders the caller's "not recorded" text rather than an empty cell — the
 * difference between "the patient said no" and "nobody asked" is clinical, and a blank space
 * says neither.
 */
export function DataPoint({
  label,
  value,
  absent,
  className = '',
}: {
  label: ReactNode;
  value: ReactNode;
  absent?: ReactNode;
  className?: string;
}) {
  const missing = value === null || value === undefined || value === '';
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-[0.04em] text-ink-faint">{label}</dt>
      <dd className={missing ? 'mt-0.5 text-ink-faint' : 'mt-0.5 font-medium text-ink'}>
        {missing ? absent : value}
      </dd>
    </div>
  );
}
