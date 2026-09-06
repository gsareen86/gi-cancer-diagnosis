ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'case_under_review';
--> statement-breakpoint
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'doctor_overdue_case';
--> statement-breakpoint
ALTER TABLE notification_deliveries ADD COLUMN dedupe_key text UNIQUE;
