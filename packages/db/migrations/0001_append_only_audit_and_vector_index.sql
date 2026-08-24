-- Append-only audit trail, least-privilege application role, and the retrieval index.
--
-- The audit guarantee is enforced at the database privilege level, not by application logic:
-- an application bug, a stray migration, or a compromised process must not be able to rewrite
-- the record of who accessed a patient's clinical data. The trigger below is defence in depth
-- for any connection that arrives with more privilege than it should have.

--> statement-breakpoint
-- The role the application connects as. It never owns the schema, so it cannot DROP or ALTER.
-- Deployment sets its password out of band; NOLOGIN here keeps a freshly migrated database from
-- accepting connections on it until that is done.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gi_compass_app') THEN
    CREATE ROLE gi_compass_app NOLOGIN;
  END IF;
END
$$;

--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO gi_compass_app;

--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gi_compass_app;

--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gi_compass_app;

--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gi_compass_app;

--> statement-breakpoint
-- The audit table is the exception: insert and read only. This is the backstop behind the
-- ClinicalRepository, which is the only code path that should ever write here.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log_entries FROM gi_compass_app;

--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE UPDATE, DELETE ON TABLES FROM gi_compass_app;

--> statement-breakpoint
-- Restore the ordinary grant for everything that is not the audit table, since the default
-- privileges statement above is a blanket rule for future tables.
GRANT UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gi_compass_app;

--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log_entries FROM gi_compass_app;

--> statement-breakpoint
-- Defence in depth: even a superuser connection cannot silently rewrite the trail.
CREATE OR REPLACE FUNCTION audit_log_is_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log_entries is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_log_append_only ON audit_log_entries;

--> statement-breakpoint
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log_entries
  FOR EACH ROW EXECUTE FUNCTION audit_log_is_append_only();

--> statement-breakpoint
-- Retrieval index for knowledge-base chunks. Cosine distance, matching the embedding model's
-- normalisation. HNSW rather than IVFFlat: the knowledge base is small and mostly static, and
-- HNSW needs no retraining as entries are added.
CREATE INDEX IF NOT EXISTS kb_chunks_embedding_idx
  ON knowledge_base_chunks
  USING hnsw (embedding vector_cosine_ops);

--> statement-breakpoint
-- Retrieval is always filtered by symptom cluster before ranking by similarity.
CREATE INDEX IF NOT EXISTS kb_chunks_clusters_idx
  ON knowledge_base_chunks USING gin (clusters);

--> statement-breakpoint
-- A patient may hold at most one draft case at a time.
CREATE UNIQUE INDEX IF NOT EXISTS cases_one_draft_per_patient
  ON cases (patient_id) WHERE status = 'in_progress';

--> statement-breakpoint
-- A case has at most one live doctor assignment.
CREATE UNIQUE INDEX IF NOT EXISTS case_assignments_one_live_per_case
  ON case_assignments (case_id) WHERE ended_at IS NULL;
