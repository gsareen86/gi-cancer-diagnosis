'use client';

import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Panel } from '@/components/primitives';
import { EmptyState, SkeletonRows, StatusChip } from '@/components/ui/feedback';
import { InboxIcon } from '@/components/ui/icons';
import {
  DELIVERY_OUTCOME_KEY,
  DELIVERY_OUTCOME_TONE,
  NOTIFICATION_TYPE_KEY,
  NOTIFICATION_TYPE_TONE,
  type FeedEntry,
} from '@/lib/notifications';

/**
 * The full notification history, for both roles.
 *
 * The same rows the bell shows, with room to read them. Opening this page marks everything read —
 * the same rule as the bell, and for the same reason: the count can only honestly mean "you have
 * not looked at these".
 *
 * The delivery chip is the part worth having on a page rather than a dropdown. A patient whose
 * release email bounced can see that here and knows to check their address, rather than
 * concluding nobody reviewed their case.
 */
export function NotificationFeed({ caseHrefPrefix }: { caseHrefPrefix: string }) {
  const t = useTranslations('notifications');
  const format = useFormatter();
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const result = await api.get<{ entries: FeedEntry[]; unread: number }>('/api/notifications');
    if (result.ok) setEntries(result.data.entries);
    setFailed(!result.ok);
    setLoaded(true);
    if (result.ok && result.data.unread > 0) {
      const marked = await api.post('/api/notifications/read', { ids: result.data.entries.map((entry) => entry.id) });
      if (!marked.ok) setFailed(true);
      else window.dispatchEvent(new Event('gi-notifications-read'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Panel title={t('heading')} bodyClassName="">
      {failed ? <div className="p-5" role="alert"><p>{t('loadFailed')}</p><button type="button" className="gi-button-secondary mt-3" onClick={() => void load()}>{t('retry')}</button></div> : !loaded ? (
        <SkeletonRows rows={4} columns={3} label={t('loading')} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<InboxIcon className="h-5 w-5" />}
          title={t('emptyTitle')}
          body={t('emptyBody')}
        />
      ) : (
        <ul className="divide-y divide-line">
          {entries.map((entry) => {
            const typeKey = NOTIFICATION_TYPE_KEY[entry.type] ?? 'typeUnknown';
            const outcomeKey = DELIVERY_OUTCOME_KEY[entry.outcome] ?? 'deliveryQueued';
            const body = (
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{t(typeKey as never)}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {format.dateTime(new Date(entry.queuedAt), {
                      dateStyle: 'full',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusChip tone={NOTIFICATION_TYPE_TONE[entry.type] ?? 'neutral'} dot={false}>
                    {t(`${typeKey}Short` as never)}
                  </StatusChip>
                  <StatusChip tone={DELIVERY_OUTCOME_TONE[entry.outcome] ?? 'neutral'} dot={false}>
                    {t(outcomeKey as never)}
                  </StatusChip>
                </div>
              </div>
            );

            return (
              <li key={entry.id}>
                {entry.reference === null ? (
                  body
                ) : (
                  <Link
                    href={`${caseHrefPrefix}/${entry.reference}`}
                    className="block transition-colors hover:bg-surface-inset"
                  >
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
