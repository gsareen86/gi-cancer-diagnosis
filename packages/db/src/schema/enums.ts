import { pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', [
  'patient',
  'doctor',
  'clinical_admin',
  'platform_admin',
]);

export const accountStatusEnum = pgEnum('account_status', [
  'unverified',
  'active',
  'suspended',
  'erased',
]);

export const tokenPurposeEnum = pgEnum('token_purpose', ['email_verification', 'password_reset']);

export const consentPurposeEnum = pgEnum('consent_purpose', [
  'account_processing',
  'ai_assisted_analysis',
  'share_with_assigned_doctor',
]);

export const dsrTypeEnum = pgEnum('dsr_type', ['access', 'correction', 'erasure']);

export const dsrStatusEnum = pgEnum('dsr_status', [
  'received',
  'awaiting_confirmation',
  'in_progress',
  'blocked_by_clinical_obligation',
  'fulfilled',
  'refused',
]);

export const contentStatusEnum = pgEnum('content_status', ['draft', 'published', 'retired']);

export const caseStatusEnum = pgEnum('case_status', [
  'in_progress',
  'submitted',
  'ai_processing',
  'ai_processed',
  'ai_skipped',
  'in_review',
  'reviewed',
  'released',
  'closed',
]);

export const scanStatusEnum = pgEnum('scan_status', [
  'pending',
  'clean',
  'infected',
  'scanner_unavailable',
]);

export const assessmentOutcomeEnum = pgEnum('assessment_outcome', [
  'generated',
  'ungrounded',
  'unavailable',
]);

export const reviewStatusEnum = pgEnum('review_status', [
  'pending',
  'in_review',
  'finalized',
  'released',
]);

export const diffActionEnum = pgEnum('diff_action', [
  'likelihood_changed',
  'item_added',
  'item_removed',
  'item_rejected',
  'next_steps_changed',
]);

export const urgencyEnum = pgEnum('urgency', ['emergency', 'urgent', 'routine-but-flagged']);

export const notificationTypeEnum = pgEnum('notification_type', [
  'email_verification',
  'password_reset',
  'case_submitted',
  'case_released',
  'doctor_case_queued',
  'doctor_urgent_case',
]);

export const deliveryOutcomeEnum = pgEnum('delivery_outcome', [
  'queued',
  'sent',
  'soft_bounced',
  'hard_bounced',
  'dropped',
]);
