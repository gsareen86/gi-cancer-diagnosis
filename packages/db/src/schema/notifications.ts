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
    queuedAt: timestamp('queued_at', { withTimezone: true }).notNull().defaultNow(),
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
