'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { StatusChip } from '@/components/ui/feedback';
import { MailIcon } from '@/components/ui/icons';
import {
  DELIVERY_OUTCOME_KEY as OUTCOME_KEY,
  DELIVERY_OUTCOME_TONE as OUTCOME_TONE,
  NOTIFICATION_TYPE_KEY as TYPE_KEY,
} from '@/lib/notifications';
import type { DeliveryEntry } from './types';

/**
 * What the system actually told people about this case.
 *
 * Rendered from `notification_deliveries`, which records a real outcome — including
 * `logged_only`, meaning no mail server was configured and nothing left the process. Until this
 * panel existed that distinction was invisible: a released summary whose email never went
 * anywhere looked exactly like one the patient had read.
 *
 * **There is no "opened" state, deliberately.** Establishing that a message was opened in a mail
 * client requires a tracking pixel, which is a third-party beacon embedded in a message whose
 * mere existence is clinical context. The vocabulary here stops at what the platform can
 * honestly assert.
 */

export function DeliveryAudit({ deliveries }: { deliveries: DeliveryEntry[] }) {
  const t = useTranslations('notifications');
  const format = useFormatter();

  if (deliveries.length === 0) {
    return <p className="text-sm text-ink-faint">{t('caseAuditEmpty')}</p>;
  }

  return (
    <ul className="space-y-2">
      {deliveries.map((entry) => {
        const outcomeKey = OUTCOME_KEY[entry.outcome] ?? 'deliveryQueued';
        const notDelivered = entry.outcome === 'logged_only';
        return (
          <li
            key={entry.id}
            className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3"
          >
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-inset text-ink-muted"
            >
              <MailIcon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {t((TYPE_KEY[entry.type] ?? 'typeUnknown') as never)}
              </p>
              {entry.recipientEmail && <p className="mt-1 break-all text-xs text-ink-muted">{t('recipientAccount', { email: entry.recipientEmail })}</p>}
              <p className="mt-0.5 text-xs text-ink-faint">
                {format.dateTime(new Date(entry.queuedAt), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
              {entry.readAt && <p className="mt-1 text-xs text-ink-muted">{t('readInApp', { date: format.dateTime(new Date(entry.readAt), { dateStyle: 'medium', timeStyle: 'short' }) })}</p>}
              <p className="mt-1.5">
                <StatusChip tone={OUTCOME_TONE[entry.outcome] ?? 'neutral'} dot={false}>
                  {t(outcomeKey as never)}
                </StatusChip>
              </p>
              {notDelivered && (
                <p className="mt-1.5 text-xs text-caution">{t('deliveryNotSentDetail')}</p>
              )}
              {entry.failureReason !== null && !notDelivered && (
                <p className="mt-1.5 font-mono text-2xs text-ink-faint">{entry.failureReason}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
