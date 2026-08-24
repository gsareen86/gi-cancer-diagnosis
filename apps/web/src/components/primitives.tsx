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

export function PageHeading({ children, lead }: { children: ReactNode; lead?: ReactNode }) {
  return (
    <header className="gi-prose mb-6">
      <h1 className="text-2xl sm:text-3xl">{children}</h1>
      {lead !== undefined && <p className="mt-3 text-ink-muted">{lead}</p>}
    </header>
  );
}

export type Tone = 'neutral' | 'accent' | 'ok' | 'urgent' | 'emergency';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted border-line',
  accent: 'bg-accent-faint text-accent border-accent/30',
  ok: 'bg-ok-faint text-ok border-ok/30',
  urgent: 'bg-urgent-faint text-urgent border-urgent/30',
  emergency: 'bg-emergency-faint text-emergency border-emergency/30',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium ${TONE_CLASSES[tone]}`}
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
}: {
  tone?: Tone;
  title?: ReactNode;
  children: ReactNode;
  /** `alert` for anything the reader must be interrupted by; `status` for passive updates. */
  role?: 'alert' | 'status' | 'note';
}) {
  return (
    <div
      role={role === 'note' ? undefined : role}
      className={`rounded-xl border p-4 ${TONE_CLASSES[tone]}`}
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
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor: string;
  children: ReactNode;
  optional?: ReactNode;
}) {
  const hintId = hint === undefined ? undefined : `${htmlFor}-hint`;
  const errorId = error === undefined ? undefined : `${htmlFor}-error`;

  return (
    <div className="mb-5">
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
          className="h-full rounded-full bg-accent transition-[width] duration-300"
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
