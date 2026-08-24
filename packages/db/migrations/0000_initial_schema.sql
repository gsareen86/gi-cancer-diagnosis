CREATE TYPE "public"."account_status" AS ENUM('unverified', 'active', 'suspended', 'erased');--> statement-breakpoint
CREATE TYPE "public"."assessment_outcome" AS ENUM('generated', 'ungrounded', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('in_progress', 'submitted', 'ai_processing', 'ai_processed', 'ai_skipped', 'in_review', 'reviewed', 'released', 'closed');--> statement-breakpoint
CREATE TYPE "public"."consent_purpose" AS ENUM('account_processing', 'ai_assisted_analysis', 'share_with_assigned_doctor');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
CREATE TYPE "public"."delivery_outcome" AS ENUM('queued', 'sent', 'soft_bounced', 'hard_bounced', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."diff_action" AS ENUM('likelihood_changed', 'item_added', 'item_removed', 'item_rejected', 'next_steps_changed');--> statement-breakpoint
CREATE TYPE "public"."dsr_status" AS ENUM('received', 'awaiting_confirmation', 'in_progress', 'blocked_by_clinical_obligation', 'fulfilled', 'refused');--> statement-breakpoint
CREATE TYPE "public"."dsr_type" AS ENUM('access', 'correction', 'erasure');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('email_verification', 'password_reset', 'case_submitted', 'case_released', 'doctor_case_queued', 'doctor_urgent_case');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'in_review', 'finalized', 'released');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('patient', 'doctor', 'clinical_admin', 'platform_admin');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('pending', 'clean', 'infected', 'scanner_unavailable');--> statement-breakpoint
CREATE TYPE "public"."token_purpose" AS ENUM('email_verification', 'password_reset');--> statement-breakpoint
CREATE TYPE "public"."urgency" AS ENUM('emergency', 'urgent', 'routine-but-flagged');--> statement-breakpoint
CREATE TABLE "admin_elevations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_hash" text NOT NULL,
	"successful" boolean NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text
);
--> statement-breakpoint
CREATE TABLE "one_time_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"rotated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"mfa_pending" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "totp_factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"secret_enc" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "totp_factors_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'patient' NOT NULL,
	"status" "account_status" DEFAULT 'unverified' NOT NULL,
	"full_name_enc" text,
	"phone_enc" text,
	"date_of_birth" date,
	"sex" text,
	"locale" text DEFAULT 'en' NOT NULL,
	"emergency_contact_name_enc" text,
	"emergency_contact_phone_enc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"erased_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_role" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"subject_id" uuid,
	"outcome" text DEFAULT 'allowed' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "consent_policy_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"body_by_locale" jsonb NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"superseded_at" timestamp with time zone,
	"data_fiduciary_name" text NOT NULL,
	"grievance_contact" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "consent_purpose" NOT NULL,
	"policy_version" text NOT NULL,
	"policy_id" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"ip_hash" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "data_subject_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "dsr_type" NOT NULL,
	"status" "dsr_status" DEFAULT 'received' NOT NULL,
	"detail" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_by" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"retention_note" text
);
--> statement-breakpoint
CREATE TABLE "profile_amendments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"field" text NOT NULL,
	"previous_value" text NOT NULL,
	"new_value" text NOT NULL,
	"amended_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retention_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"retention_days" integer,
	"action" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "content_audit_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disease_taxonomy_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"clusters" text[] NOT NULL,
	"urgent_referral_only" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disease_taxonomy_entries_label_unique" UNIQUE("label")
);
--> statement-breakpoint
CREATE TABLE "questionnaire_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "red_flag_rule_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"content" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reference_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"caption_key" text NOT NULL,
	"alt_text_key" text NOT NULL,
	"source" text NOT NULL,
	"licence" text NOT NULL,
	"storage_key" text NOT NULL,
	"widths" integer[] DEFAULT '{320,640,1024}' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"content" jsonb NOT NULL,
	"approved_locales" text[] DEFAULT '{"en"}' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by" uuid,
	"published_at" timestamp with time zone,
	"retired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"outcome" "assessment_outcome" NOT NULL,
	"model_version" text NOT NULL,
	"prompt_version" text NOT NULL,
	"kb_version" text NOT NULL,
	"retrieved_chunk_ids" text[] DEFAULT '{}' NOT NULL,
	"payload" jsonb,
	"failure_reason" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" uuid NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "case_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"assigned_doctor_id" uuid,
	"template_version_id" uuid NOT NULL,
	"entry_point_id" text NOT NULL,
	"status" "case_status" DEFAULT 'in_progress' NOT NULL,
	"ai_skip_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "doctor_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"ai_assessment_id" uuid,
	"doctor_id" uuid NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"final_summary" jsonb,
	"doctor_notes" text,
	"released_content" jsonb,
	"started_at" timestamp with time zone,
	"finalized_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"released_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"text" text NOT NULL,
	"clusters" text[] DEFAULT '{}' NOT NULL,
	"embedding" vector(1024),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_key" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"source" text,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_entry_tags" (
	"entry_id" uuid NOT NULL,
	"taxonomy_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "red_flag_triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"rule_set_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"urgency" "urgency" NOT NULL,
	"basis_key" text NOT NULL,
	"contributing_question_ids" text[] DEFAULT '{}' NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "response_amendments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"response_id" uuid NOT NULL,
	"new_value" jsonb NOT NULL,
	"reason" text,
	"amended_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"question_id" text NOT NULL,
	"value" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retracted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "review_diffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"action" "diff_action" NOT NULL,
	"condition_id" text,
	"before_value" jsonb,
	"after_value" jsonb,
	"rationale" text,
	"model_version" text NOT NULL,
	"prompt_version" text NOT NULL,
	"kb_version" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploaded_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"scan_status" "scan_status" DEFAULT 'pending' NOT NULL,
	"patient_type_tag" text,
	"patient_date_tag" date,
	"machine_readable" boolean,
	"extract" jsonb,
	"extract_verified_by" uuid,
	"extract_verified_at" timestamp with time zone,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"outcome" "delivery_outcome" DEFAULT 'queued' NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"reference" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_reason" text
);
--> statement-breakpoint
ALTER TABLE "admin_elevations" ADD CONSTRAINT "admin_elevations_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "one_time_tokens" ADD CONSTRAINT "one_time_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "totp_factors" ADD CONSTRAINT "totp_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_policy_id_consent_policy_versions_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."consent_policy_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_amendments" ADD CONSTRAINT "profile_amendments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_template_id_questionnaire_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."questionnaire_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_assessments" ADD CONSTRAINT "ai_assessments_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_messages" ADD CONSTRAINT "case_messages_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_messages" ADD CONSTRAINT "case_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_assigned_doctor_id_users_id_fk" FOREIGN KEY ("assigned_doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_template_version_id_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."template_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_reviews" ADD CONSTRAINT "doctor_reviews_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_reviews" ADD CONSTRAINT "doctor_reviews_ai_assessment_id_ai_assessments_id_fk" FOREIGN KEY ("ai_assessment_id") REFERENCES "public"."ai_assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_reviews" ADD CONSTRAINT "doctor_reviews_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_chunks" ADD CONSTRAINT "knowledge_base_chunks_entry_id_knowledge_base_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."knowledge_base_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_entries" ADD CONSTRAINT "knowledge_base_entries_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_entry_tags" ADD CONSTRAINT "knowledge_base_entry_tags_entry_id_knowledge_base_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."knowledge_base_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "red_flag_triggers" ADD CONSTRAINT "red_flag_triggers_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "red_flag_triggers" ADD CONSTRAINT "red_flag_triggers_rule_set_id_red_flag_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."red_flag_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_amendments" ADD CONSTRAINT "response_amendments_response_id_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_diffs" ADD CONSTRAINT "review_diffs_review_id_doctor_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."doctor_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_documents" ADD CONSTRAINT "uploaded_documents_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_elevations_admin_idx" ON "admin_elevations" USING btree ("admin_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "external_identities_provider_key" ON "external_identities" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "external_identities_user_idx" ON "external_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "login_attempts_email_time_idx" ON "login_attempts" USING btree ("email_hash","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "one_time_tokens_hash_key" ON "one_time_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "one_time_tokens_user_idx" ON "one_time_tokens" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_refresh_hash_key" ON "sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_family_idx" ON "sessions" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_status_idx" ON "users" USING btree ("role","status");--> statement-breakpoint
CREATE INDEX "audit_actor_time_idx" ON "audit_log_entries" USING btree ("actor_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_subject_time_idx" ON "audit_log_entries" USING btree ("subject_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_target_idx" ON "audit_log_entries" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "consent_policy_versions_version_key" ON "consent_policy_versions" USING btree ("version");--> statement-breakpoint
CREATE INDEX "consent_records_user_purpose_idx" ON "consent_records" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE INDEX "dsr_user_status_idx" ON "data_subject_requests" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "profile_amendments_user_idx" ON "profile_amendments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "retention_policies_category_key" ON "retention_policies" USING btree ("category");--> statement-breakpoint
CREATE INDEX "content_audit_entity_idx" ON "content_audit_entries" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "questionnaire_templates_key_key" ON "questionnaire_templates" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "red_flag_rule_sets_version_key" ON "red_flag_rule_sets" USING btree ("version");--> statement-breakpoint
CREATE UNIQUE INDEX "reference_images_key_version_key" ON "reference_images" USING btree ("key","version");--> statement-breakpoint
CREATE INDEX "reference_images_status_idx" ON "reference_images" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "template_versions_template_version_key" ON "template_versions" USING btree ("template_id","version");--> statement-breakpoint
CREATE INDEX "template_versions_status_idx" ON "template_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_assessments_case_idx" ON "ai_assessments" USING btree ("case_id","generated_at");--> statement-breakpoint
CREATE INDEX "case_assignments_case_idx" ON "case_assignments" USING btree ("case_id","ended_at");--> statement-breakpoint
CREATE INDEX "case_assignments_doctor_idx" ON "case_assignments" USING btree ("doctor_id","ended_at");--> statement-breakpoint
CREATE INDEX "case_messages_case_idx" ON "case_messages" USING btree ("case_id","sent_at");--> statement-breakpoint
CREATE INDEX "cases_patient_status_idx" ON "cases" USING btree ("patient_id","status");--> statement-breakpoint
CREATE INDEX "cases_doctor_status_idx" ON "cases" USING btree ("assigned_doctor_id","status");--> statement-breakpoint
CREATE INDEX "cases_status_submitted_idx" ON "cases" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "doctor_reviews_doctor_status_idx" ON "doctor_reviews" USING btree ("doctor_id","status");--> statement-breakpoint
CREATE INDEX "doctor_reviews_case_idx" ON "doctor_reviews" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kb_chunks_entry_ordinal_key" ON "knowledge_base_chunks" USING btree ("entry_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "kb_entries_key_version_key" ON "knowledge_base_entries" USING btree ("entry_key","version");--> statement-breakpoint
CREATE INDEX "kb_entries_superseded_idx" ON "knowledge_base_entries" USING btree ("superseded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "kb_entry_tags_pk" ON "knowledge_base_entry_tags" USING btree ("entry_id","taxonomy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kb_snapshots_version_key" ON "knowledge_base_snapshots" USING btree ("version");--> statement-breakpoint
CREATE UNIQUE INDEX "red_flag_triggers_case_rule_key" ON "red_flag_triggers" USING btree ("case_id","rule_id");--> statement-breakpoint
CREATE INDEX "red_flag_triggers_case_urgency_idx" ON "red_flag_triggers" USING btree ("case_id","urgency");--> statement-breakpoint
CREATE INDEX "response_amendments_response_idx" ON "response_amendments" USING btree ("response_id");--> statement-breakpoint
CREATE UNIQUE INDEX "responses_case_question_key" ON "responses" USING btree ("case_id","question_id");--> statement-breakpoint
CREATE INDEX "responses_case_active_idx" ON "responses" USING btree ("case_id","active");--> statement-breakpoint
CREATE INDEX "review_diffs_review_idx" ON "review_diffs" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "review_diffs_condition_idx" ON "review_diffs" USING btree ("condition_id");--> statement-breakpoint
CREATE INDEX "uploaded_documents_case_idx" ON "uploaded_documents" USING btree ("case_id","deleted_at");--> statement-breakpoint
CREATE INDEX "notification_deliveries_user_idx" ON "notification_deliveries" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "notification_deliveries_outcome_idx" ON "notification_deliveries" USING btree ("outcome","queued_at");