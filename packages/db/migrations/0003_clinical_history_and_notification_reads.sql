-- Clinical history behind a presenting complaint, and in-app notification read state.
--
-- The history is keyed on the case rather than the patient so that a signed review always
-- describes the record it was made against. `ON DELETE CASCADE` matches every other clinical
-- child table: an erasure that removes a case removes its history with it.
--
-- BMI is deliberately not a column. It is computed at render from height and weight, because a
-- stored BMI can disagree with the two numbers printed beside it.

CREATE TABLE IF NOT EXISTS "case_clinical_history" (
  "case_id" uuid PRIMARY KEY NOT NULL REFERENCES "cases"("id") ON DELETE CASCADE,
  "height_cm" integer,
  "weight_kg" numeric(5, 2),
  "conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "surgeries" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "medications" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "allergies" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "family_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "lifestyle" jsonb,
  "additional_notes" jsonb,
  "last_menstrual_period" date,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- When the recipient opened the notification inside the application. Nullable, so every existing
-- row reads as unread, which is the honest answer: nobody has opened a notification in an
-- in-app feed that did not exist until now.
--
-- This says nothing about the email. Establishing whether a message was opened in a mail client
-- needs a tracking pixel, which is a third-party beacon inside a message whose existence is
-- itself clinical context, so the platform does not claim to know.
ALTER TABLE "notification_deliveries" ADD COLUMN IF NOT EXISTS "read_at" timestamp with time zone;

--> statement-breakpoint

-- The bell's unread count is the only hot query on this table, and it is issued on every page
-- load of every workspace.
CREATE INDEX IF NOT EXISTS "notification_deliveries_unread_idx"
  ON "notification_deliveries" ("user_id", "read_at", "queued_at" DESC);
