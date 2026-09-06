'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { StatusChip } from '@/components/ui/feedback';
import { BellIcon } from '@/components/ui/icons';
import {
  DELIVERY_OUTCOME_KEY as OUTCOME_KEY,
  DELIVERY_OUTCOME_TONE as OUTCOME_TONE,
  NOTIFICATION_TYPE_KEY as TYPE_KEY,
  NOTIFICATION_TYPE_TONE as TYPE_TONE,
  type FeedEntry,
} from '@/lib/notifications';

/**
 * The notification control.
 *
 * Backed by `notification_deliveries`, the same table the emails are recorded in, so the bell and
 * the inbox cannot tell different stories. Each entry carries its delivery outcome, which is the
 * part that matters on a development or misconfigured deployment: a release recorded as
 * `logged_only` means nothing left the process, and the panel says so in words rather than
 * showing it as delivered.
 *
 * The count is polled rather than pushed. A websocket for a number that changes a few times a day
 * is infrastructure with a failure mode; a fetch on mount and on focus is not.
 */

export function NotificationBell({ caseHrefPrefix }: { caseHrefPrefix: string }) {
  const t = useTranslations('notifications');
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const load = useCallback(async () => {
    if (caseHrefPrefix === '/doctor/case') await api.post('/api/notifications/sync');
    const result = await api.get<{ entries: FeedEntry[]; unread: number }>('/api/notifications');
    setLoaded(true);
    setFailed(!result.ok);
    if (!result.ok) return;
    setEntries(result.data.entries);
    setUnread(result.data.unread);
    setLoaded(true);
  }, [caseHrefPrefix]);

  useEffect(() => {
    void load();
    // Refresh while visible and when focus returns; no health data is persisted in the browser.
    const onFocus = () => { if (document.visibilityState === 'visible') void load(); };
    const interval = window.setInterval(onFocus, 30_000);
    window.addEventListener('focus', onFocus);
    window.addEventListener('gi-notifications-read', onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', onFocus); window.removeEventListener('gi-notifications-read', onFocus); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || unread === 0) return;

    // Marked read on open, not on hover or on render: the count clears because the person
    // actually looked, which is the only thing it can honestly mean.
    const result = await api.post('/api/notifications/read', { ids: entries.filter((entry) => entry.readAt === null).map((entry) => entry.id) });
    if (!result.ok) { setFailed(true); return; }
    setUnread((count) => Math.max(0, count - entries.filter((entry) => entry.readAt === null).length));
    setEntries((current) =>
      current.map((entry) => ({ ...entry, readAt: entry.readAt ?? new Date().toISOString() })),
    );
    window.dispatchEvent(new Event('gi-notifications-read'));
  }

  return (
    <div ref={container} className="relative gi-no-print">
      <button
        ref={trigger}
        type="button"
        onClick={() => void toggle()}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={unread === 0 ? t('open') : t('openWithUnread', { count: unread })}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-inset hover:text-ink"
      >
        <BellIcon className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-emergency px-1 text-2xs font-bold leading-[18px] text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 z-30 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] animate-gi-rise overflow-hidden rounded-xl border border-line bg-surface shadow-overlay"
        >
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">{t('heading')}</h2>
          </header>

          <div className="gi-scroll max-h-[26rem] overflow-y-auto">
            {failed ? <div className="p-4 text-sm" role="alert"><p>{t('loadFailed')}</p><button type="button" className="gi-button-secondary mt-3" onClick={() => void load()}>{t('retry')}</button></div> : !loaded ? (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">{t('loading')}</p>
            ) : entries.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">{t('empty')}</p>
            ) : (
              <ul className="divide-y divide-line">
                {entries.map((entry) => {
                  const typeKey = TYPE_KEY[entry.type] ?? 'typeUnknown';
                  const outcomeKey = OUTCOME_KEY[entry.outcome] ?? 'deliveryQueued';
                  const body = (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-ink">{t(typeKey as never)}</p>
                        {entry.readAt === null && (
                          <span
                            aria-hidden="true"
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-bright"
                          />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {format.dateTime(new Date(entry.queuedAt), {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StatusChip tone={TYPE_TONE[entry.type] ?? 'neutral'} dot={false}>
                          {t(`${typeKey}Short` as never)}
                        </StatusChip>
                        <StatusChip tone={OUTCOME_TONE[entry.outcome] ?? 'neutral'} dot={false}>
                          {t(outcomeKey as never)}
                        </StatusChip>
                      </div>
                    </>
                  );

                  return (
                    <li key={entry.id}>
                      {entry.reference === null ? (
                        <div className="px-4 py-3">{body}</div>
                      ) : (
                        <Link
                          href={`${caseHrefPrefix}/${entry.reference}`}
                          onClick={() => setOpen(false)}
                          className="block px-4 py-3 transition-colors hover:bg-surface-inset"
                        >
                          {body}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
