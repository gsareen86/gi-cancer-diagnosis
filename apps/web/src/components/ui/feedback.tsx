import type { ReactNode } from 'react';
import { Badge, TONE_CLASSES, type Tone } from '@/components/primitives';

/**
 * Loading, empty, and status affordances.
 *
 * None of these carries a default string. That is not stylistic: the guard test in
 * `src/__tests__/no-hardcoded-strings.test.ts` scans for JSX text runs, so a component with a
 * built-in "No results" would fail the build — which is exactly the intent, because that string
 * would then read the same in Hindi.
 */

/* -------------------------------------------------------------------------------------------- */
/* Skeletons                                                                                     */
/* -------------------------------------------------------------------------------------------- */

/**
 * A skeleton matches the shape of what replaces it. A generic grey box tells the reader
 * something is loading; a box the size of the table that arrives tells them what is loading, and
 * stops the page jumping when it does.
 */
export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <span className={`gi-skeleton block ${className}`} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={index === lines - 1 ? 'h-3.5 w-2/3' : 'h-3.5 w-full'}
        />
      ))}
    </div>
  );
}

export function SkeletonRows({
  rows = 5,
  columns = 5,
  label,
}: {
  rows?: number;
  columns?: number;
  /** Announced while the table loads, so a screen-reader user is not met with silence. */
  label: string;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex items-center gap-4 px-3 py-3.5">
            {Array.from({ length: columns }, (_, column) => (
              <Skeleton
                key={column}
                className={column === 0 ? 'h-4 w-28 shrink-0' : 'h-4 flex-1'}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCards({ count = 4, label }: { count?: number; label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="gi-card">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Empty states                                                                                  */
/* -------------------------------------------------------------------------------------------- */

/**
 * An empty collection and a filter that matched nothing are different states and must read
 * differently — "you have no cases waiting" is good news, "your filters excluded everything" is
 * a dead end the reader needs a way out of. Callers pass the right copy and the right action.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  tone = 'neutral',
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon !== undefined && (
        <span
          className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border ${TONE_CLASSES[tone]}`}
        >
          {icon}
        </span>
      )}
      <p className="text-base font-semibold text-ink">{title}</p>
      {body !== undefined && <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{body}</p>}
      {action !== undefined && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Metrics                                                                                       */
/* -------------------------------------------------------------------------------------------- */

/**
 * A triage count.
 *
 * `tone` is applied only when `emphasise` is set, so an overdue card reads neutrally at zero and
 * in the emergency tone above it. A permanently red "Overdue: 0" trains the reader to ignore the
 * colour, which costs exactly the case it was meant to catch.
 */
export function MetricCard({
  label,
  value,
  caption,
  tone = 'neutral',
  emphasise = false,
  icon,
  href,
}: {
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  tone?: Tone;
  emphasise?: boolean;
  icon?: ReactNode;
  href?: string;
}) {
  const active = emphasise && tone !== 'neutral';
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="gi-section-title">{label}</span>
        {icon !== undefined && (
          <span className={active ? 'text-current opacity-70' : 'text-ink-faint'}>{icon}</span>
        )}
      </div>
      <p
        className={`gi-numeric mt-2 text-3xl font-semibold tracking-tight ${
          active ? 'text-current' : 'text-ink'
        }`}
      >
        {value}
      </p>
      {caption !== undefined && (
        <p className={`mt-1 text-sm ${active ? 'text-current opacity-90' : 'text-ink-muted'}`}>
          {caption}
        </p>
      )}
    </>
  );

  const className = [
    'block rounded-xl border p-4 shadow-card transition-shadow',
    active ? TONE_CLASSES[tone] : 'border-line bg-surface',
    href === undefined ? '' : 'hover:shadow-raised',
  ].join(' ');

  if (href === undefined) return <div className={className}>{body}</div>;
  return (
    <a href={href} className={className}>
      {body}
    </a>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Status                                                                                        */
/* -------------------------------------------------------------------------------------------- */

/**
 * A small status pill. Distinct from `Badge` only in weight — this one appears in table cells by
 * the dozen and would shout if it carried a border and full-size text.
 */
export function StatusChip({
  tone = 'neutral',
  children,
  dot = true,
}: {
  tone?: Tone;
  children: ReactNode;
  /**
   * The dot is decoration that repeats the tone. It is never the only signal — the word beside
   * it is — so it is safe to drop where a row is already tight.
   */
  dot?: boolean;
}) {
  const dotClass: Record<Tone, string> = {
    neutral: 'bg-ink-faint',
    accent: 'bg-accent-bright',
    ok: 'bg-ok-bright',
    caution: 'bg-caution-bright',
    urgent: 'bg-urgent-bright',
    emergency: 'bg-emergency-bright',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-2xs font-semibold uppercase tracking-[0.04em] ${TONE_CLASSES[tone]}`}
    >
      {dot && (
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dotClass[tone]}`} />
      )}
      {children}
    </span>
  );
}

export function RiskBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <Badge tone={tone} className="text-xs font-semibold uppercase tracking-[0.04em]">
      {children}
    </Badge>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Avatar                                                                                        */
/* -------------------------------------------------------------------------------------------- */

/**
 * Initials, never a photograph.
 *
 * A clinical interface showing a face beside a case invites recognition-based shortcuts, and an
 * uploaded image is another asset to scan, store and serve. Initials do the one job an avatar
 * has here: confirming to the signed-in person which account they are looking at.
 */
export function Avatar({
  name,
  tone = 'accent',
  size = 'md',
}: {
  /** Falls back to a neutral mark when the name has not been recorded yet. */
  name: string | null;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
}) {
  const initials = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const sizes = {
    sm: 'h-7 w-7 text-2xs',
    md: 'h-9 w-9 text-xs',
    lg: 'h-12 w-12 text-sm',
  };

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full border font-semibold ${TONE_CLASSES[tone]} ${sizes[size]}`}
    >
      {initials === '' ? '—' : initials}
    </span>
  );
}
