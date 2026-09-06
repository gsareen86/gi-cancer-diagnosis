ALTER TABLE doctor_reviews ADD COLUMN draft_revision integer NOT NULL DEFAULT 0;
ALTER TABLE doctor_reviews ADD CONSTRAINT doctor_reviews_revision_nonnegative CHECK (draft_revision >= 0);
