'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon, ChevronRightIcon, CloseIcon } from './icons';

/**
 * Interactive layout controls: tabs, a drawer, a stepper, a timeline, and a segmented control.
 *
 * All keyboard-operable, all announced. The case workspace presents the same mounted sections
 * as a persistent Navigator on wide screens and tabs below the desktop breakpoint. The
 * implementation follows the full roving-tabindex pattern rather than using styled buttons.
 */

/* -------------------------------------------------------------------------------------------- */
/* Tabs                                                                                          */
/* -------------------------------------------------------------------------------------------- */

export interface TabDefinition {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  /** Rendered beside the label — a count, a risk dot, an unread marker. */
  adornment?: ReactNode;
  content: ReactNode;
}

export function Tabs({
  tabs,
  listLabel,
  initialId,
  desktopNavigator = false,
  desktopLabel,
  className = '',
}: {
  tabs: TabDefinition[];
  /** Accessible name for the tab list, e.g. "case sections". */
  listLabel: string;
  initialId?: string;
  /** Reflows the same mounted tabs into a persistent case-section navigator on wide screens. */
  desktopNavigator?: boolean;
  /** Visible wide-screen label for the navigator; the accessible list name remains listLabel. */
  desktopLabel?: ReactNode;
  className?: string;
}) {
  const base = useId();
  const [active, setActive] = useState(initialId ?? tabs[0]?.id ?? '');
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();

      const index = tabs.findIndex((tab) => tab.id === active);
      const last = tabs.length - 1;
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
              ? (index - 1 + tabs.length) % tabs.length
              : (index + 1) % tabs.length;

      const target = tabs[next];
      if (target === undefined) return;
      setActive(target.id);
      listRef.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(`${base}-tab-${target.id}`)}`)?.focus();
    },
    [active, base, tabs],
  );

  return (
    <div
      data-case-navigator={desktopNavigator ? '' : undefined}
      className={`${className} ${
        desktopNavigator
          ? 'overflow-hidden rounded-2xl border border-line bg-surface shadow-card lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:bg-surface-sunken'
          : ''
      }`}
    >
      <div
        ref={listRef}
        role="tablist"
        aria-label={listLabel}
        onKeyDown={onKeyDown}
        className={`grid grid-cols-2 gap-1 border-b border-line sm:flex sm:flex-wrap ${
          desktopNavigator
            ? 'bg-surface-sunken p-2 lg:sticky lg:top-20 lg:self-start lg:flex-col lg:flex-nowrap lg:border-b-0 lg:border-r lg:p-3'
            : ''
        }`}
      >
        {desktopNavigator && desktopLabel !== undefined && (
          <p className="hidden px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint lg:block">
            {desktopLabel}
          </p>
        )}
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              id={`${base}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              className={`flex min-w-0 items-center gap-2 border-b-2 px-3 py-2.5 text-left text-sm font-medium transition-colors sm:whitespace-nowrap ${
                desktopNavigator
                  ? 'lg:grid lg:w-full lg:grid-cols-[2rem_minmax(0,1fr)_auto] lg:gap-2.5 lg:rounded-xl lg:border-b-0 lg:border-l-[3px] lg:px-3 lg:py-3'
                  : '-mb-px'
              } ${
                selected
                  ? 'border-accent-bright text-accent lg:border-l-accent-bright lg:bg-surface lg:text-ink lg:shadow-card'
                  : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink lg:hover:border-l-line-strong lg:hover:bg-surface/70'
              }`}
            >
              <span className={desktopNavigator ? 'lg:flex lg:h-8 lg:w-8 lg:items-center lg:justify-center lg:rounded-lg lg:bg-accent-faint lg:text-accent' : ''}>
                {tab.icon}
              </span>
              <span className="min-w-0">
                <span className="block">{tab.label}</span>
                {desktopNavigator && tab.description !== undefined && (
                  <span aria-hidden="true" className="mt-0.5 hidden overflow-hidden text-ellipsis whitespace-nowrap text-xs font-normal text-ink-faint lg:block">
                    {tab.description}
                  </span>
                )}
              </span>
              <span aria-hidden="true" className="ml-auto hidden items-center gap-1.5 lg:flex">
                {tab.adornment}
                <ChevronRightIcon className="h-3.5 w-3.5 text-ink-faint" />
              </span>
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${base}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${tab.id}`}
          tabIndex={0}
          className={`${tab.id === active ? 'block' : 'hidden'} ${
            desktopNavigator ? 'min-w-0 bg-surface p-3 sm:p-4 lg:p-5' : 'pt-4'
          }`}
        >
          {desktopNavigator && (
            <header className="hidden border-b border-line pb-4 lg:block">
              <h2 className="flex items-center gap-2.5 text-lg font-semibold">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface-sunken text-accent">
                  {tab.icon}
                </span>
                {tab.label}
              </h2>
              {tab.description && <p className="mt-1.5 text-sm text-ink-muted">{tab.description}</p>}
            </header>
          )}
          <div data-panel-content={tab.id} className={desktopNavigator ? 'pt-4 lg:pt-5' : ''}>
            {tab.content}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Drawer                                                                                        */
/* -------------------------------------------------------------------------------------------- */

/**
 * A side panel that keeps its context behind it.
 *
 * Used for the document viewer, so opening a report never navigates away from the case — a
 * doctor comparing a histopathology extract against an answer should not lose the answer to see
 * the report.
 *
 * Focus is trapped while open and returned to the opener on close, and Escape closes.
 */
export function Drawer({
  open,
  onClose,
  title,
  closeLabel,
  children,
  footer,
  width = 'max-w-3xl',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const candidates = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const focusable = [...(candidates ?? [])].filter(element => element.getClientRects().length > 0);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;

      if (!focusable.includes(document.activeElement as HTMLElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      opener.current?.focus();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  // A body portal escapes parent spacing/overflow rules and covers the entire viewport.
  return createPortal(
    <div className="gi-no-print fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-surface-deep/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex h-full w-full flex-col bg-surface shadow-overlay focus-visible:outline-none ${width}`}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 id={titleId} className="truncate text-base font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="gi-button-ghost -mr-2 h-11 w-11 shrink-0 !p-0"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </header>
        <div className="gi-scroll flex-1 overflow-auto">{children}</div>
        {footer !== undefined && (
          <footer className="shrink-0 border-t border-line px-5 py-3">{footer}</footer>
        )}
      </div>
    </div>, document.body
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Stepper                                                                                       */
/* -------------------------------------------------------------------------------------------- */

export interface StepDefinition {
  id: string;
  label: string;
}

/**
 * The intake progress rail.
 *
 * Presentation only: it reflects which stage the engine's current question belongs to. It never
 * decides what comes next, because the questionnaire engine computes the active path server-side
 * and a rail that thought it knew the order would be wrong the moment a branch opened.
 */
export function Stepper({
  steps,
  currentId,
  completedIds,
  label,
  stepStatusLabel,
}: {
  steps: StepDefinition[];
  currentId: string;
  completedIds: readonly string[];
  /** Accessible name for the rail as a whole. */
  label: string;
  /** Renders "Step 2 of 7: Symptoms" for assistive technology. */
  stepStatusLabel: (position: number, total: number, name: string) => string;
}) {
  const index = Math.max(0, steps.findIndex((step) => step.id === currentId));
  const current = steps[index];

  return (
    <nav aria-label={label}>
      <p className="sr-only" role="status">
        {current === undefined
          ? ''
          : stepStatusLabel(index + 1, steps.length, current.label)}
      </p>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
        {steps.map((step, position) => {
          const done = completedIds.includes(step.id);
          const active = step.id === currentId;
          return (
            <li key={step.id} className="flex items-center gap-1">
              <span
                className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'border-accent bg-accent text-white'
                    : done
                      ? 'border-ok-line bg-ok-faint text-ok'
                      : 'border-line bg-surface text-ink-faint'
                }`}
                aria-current={active ? 'step' : undefined}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-4 w-4 items-center justify-center"
                >
                  {done ? <CheckIcon className="h-3.5 w-3.5" /> : position + 1}
                </span>
                <span className={active || done ? '' : 'hidden sm:inline'}>{step.label}</span>
              </span>
              {position < steps.length - 1 && (
                <span aria-hidden="true" className="h-px w-3 bg-line-strong sm:w-5" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Segmented control                                                                             */
/* -------------------------------------------------------------------------------------------- */

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className = '',
}: {
  options: Array<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (next: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex rounded-lg border border-line-strong bg-surface-inset p-0.5 ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-[7px] px-3 py-1.5 text-sm font-medium transition-colors ${
              selected ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
