import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { deliveryOutcomeEnum, notificationTypeEnum } from './enums';
import { users } from './identity';

/**
 * Notifications never carry clinical content; they tell the recipient to sign in. Delivery is
 * recorded so a hard bounce is visible to an operator without blocking the clinical workflow —
 * a release stands even if its email does not arrive.
 */
export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    outcome: deliveryOutcomeEnum('outcome').notNull().default('queued'),
    locale: text('locale').notNull().default('en'),
    /** Non-clinical reference only, e.g. a case identifier. */
    reference: text('reference'),
    dedupeKey: text('dedupe_key').unique(),
    queuedAt: timestamp('queued_at', { withTimezone: true }).notNull().defaultNow(),
    /**
     * When the recipient opened this notification *inside the application*. It is what turns this
     * table into the in-app feed as well as the delivery log, which is the point: the bell and
     * the email can then never disagree about what the system told someone.
     *
     * It says nothing about the email. Knowing whether a message was opened in a mail client
     * requires a tracking pixel — a third-party beacon in a message whose very existence is
     * clinical context — so the platform does not claim to know.
     */
    readAt: timestamp('read_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
  },
  (table) => [
    index('notification_deliveries_user_idx').on(table.userId, table.type),
    index('notification_deliveries_outcome_idx').on(table.outcome, table.queuedAt),
  ],
);

export type NotificationDeliveryRow = typeof notificationDeliveries.$inferSelect;
