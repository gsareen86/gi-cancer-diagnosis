ALTER TABLE case_clinical_history ADD COLUMN trajectory jsonb;
ALTER TABLE case_clinical_history ADD COLUMN assertions jsonb NOT NULL DEFAULT '{}';
-- Legacy empty collections are unknown. There is no retrospective inference of a denial.
