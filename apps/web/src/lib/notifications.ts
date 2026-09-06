import type { Tone } from '@/components/primitives';

/**
 * How a notification renders.
 *
 * One table for the bell, the full feed, and the per-case delivery audit, so a `logged_only`
 * outcome cannot read as "not sent" in one place and "sent" in another.
 */

export interface FeedEntry {
  id: string;
  type: string;
  reference: string | null;
  outcome: string;
  queuedAt: string;
  sentAt: string | null;
  readAt: string | null;
  failureReason: string | null;
}

export const NOTIFICATION_TYPE_KEY: Record<string, string> = {
  case_under_review: 'typeCaseUnderReview',
  doctor_overdue_case: 'typeDoctorOverdue',
  case_submitted: 'typeCaseSubmitted',
  case_released: 'typeCaseReleased',
  doctor_case_queued: 'typeDoctorCaseQueued',
  doctor_urgent_case: 'typeDoctorUrgentCase',
};

/**
 * An urgent assignment must not look identical to a routine one in a list of twenty. The word in
 * the row is what actually carries it; the tone is the thing that makes it findable at a glance.
 */
export const NOTIFICATION_TYPE_TONE: Record<string, Tone> = {
  case_under_review: 'accent',
  doctor_overdue_case: 'emergency',
  case_submitted: 'neutral',
  case_released: 'ok',
  doctor_case_queued: 'accent',
  doctor_urgent_case: 'urgent',
};

/**
 * Delivery outcomes, in the platform's own vocabulary.
 *
 * `logged_only` reads as "not sent", because that is what it means: no mail server was configured
 * and nothing left the process. There is no "opened" state — establishing that would need a
 * tracking pixel, which is a third-party beacon in a message whose existence is clinical context.
 */
export const DELIVERY_OUTCOME_KEY: Record<string, string> = {
  queued: 'deliveryQueued',
  sent: 'deliverySent',
  logged_only: 'deliveryNotSent',
  soft_bounced: 'deliverySoftBounced',
  hard_bounced: 'deliveryBounced',
  dropped: 'deliveryDropped',
};

export const DELIVERY_OUTCOME_TONE: Record<string, Tone> = {
  queued: 'neutral',
  sent: 'ok',
  logged_only: 'caution',
  soft_bounced: 'urgent',
  hard_bounced: 'emergency',
  dropped: 'urgent',
};
