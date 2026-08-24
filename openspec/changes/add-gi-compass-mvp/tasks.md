## 1. Repository and toolchain foundations

- [ ] 1.1 Create the npm-workspaces monorepo (`apps/web`, `packages/core`, `packages/db`, `services/ai`) and verify `npm install` completes and `npm run -ws build` resolves every workspace
- [ ] 1.2 Configure TypeScript in strict mode with a shared base config and verify `npm run typecheck` passes across all TS workspaces
- [ ] 1.3 Configure Vitest for `packages/core` and `packages/db`, and pytest for `services/ai`, and verify `npm test` and `pytest` both run and report zero tests failing
- [ ] 1.4 Configure ESLint and Prettier, including the custom rule that fails on literal display text in patient-facing components (design D12), and verify the rule fires on a deliberately hardcoded string fixture
- [ ] 1.5 Add `docker-compose.yml` providing Postgres 16 with `pgvector` and an S3-compatible store, and verify `docker compose up` yields a database that accepts `CREATE EXTENSION vector`
- [ ] 1.6 Add a CI workflow running typecheck, lint, unit tests, and the Python test suite, and verify it passes on the initial commit

## 2. Domain core — condition grammar and questionnaire engine

- [x] 2.1 Define the closed condition grammar types (`all`/`any`/`not` over `answered`, `equals`, `includes`, `gt`, `lt`, `between`, `duration_gte`, `age_gte`) with a Zod schema, and verify malformed condition trees are rejected by unit test
- [x] 2.2 Implement the deterministic condition evaluator over an answer set, and verify a table-driven test covers every predicate plus nesting, negation, and missing-answer behaviour
- [x] 2.3 Implement answer-type validation for all nine question types with per-type contracts, and verify unit tests cover the numeric-out-of-range and unknown-option rejections named in `questionnaire/engine`
- [x] 2.4 Implement adaptive path computation (which questions are active given an answer set), and verify a five-hop chain fixture reveals questions in order
- [x] 2.5 Implement branch retraction when an earlier answer changes, marking orphaned answers inactive rather than deleting them, and verify the retraction scenario from `questionnaire/engine`
- [x] 2.6 Implement branching-graph validation (cycle detection, unreachable target, retired-question target), and verify a cyclic template fixture is refused with the cycle identified
- [x] 2.7 Implement adaptive progress computation against the active path, and verify progress recomputes when a branch opens
- [x] 2.8 Verify engine determinism with a property test asserting the same answer set always yields the same active path and progress

## 3. Domain core — red-flag triage

- [x] 3.1 Define the red-flag rule type (id, basis, urgency, condition, ruleset version) reusing the grammar from 2.1, and verify rules round-trip through Zod validation
- [x] 3.2 Implement the synchronous red-flag evaluator returning triggered flags with their contributing answers, and verify the black-tarry-stool AND (lightheadedness OR fainting) combination fixture
- [x] 3.3 Implement the publication guard rejecting escalation copy containing any disease-taxonomy term, and verify a condition-naming message is refused
- [x] 3.4 Verify by test that the evaluator has no import path reaching the AI client, HTTP, or any async boundary — the negative scenario in `safety/red-flag-triage`
- [x] 3.5 Benchmark the evaluator against a realistic rule set and verify p99 evaluation stays under 100 ms

## 4. Domain core — consent policy, summary compiler, AI schema

- [x] 4.1 Implement the consent purpose enum and the active-consent decision function (grant, withdrawal, superseded policy version), and verify each state transition by unit test
- [x] 4.2 Implement the deterministic clinical-summary compiler producing narrative plus fact table, distinguishing explicitly-denied from never-asked, and verify the same case compiles identically twice
- [x] 4.3 Define the AI assessment Zod schema exactly as specified in `assessment/ai-pipeline`, as a strict object with taxonomy-constrained condition identifiers, and verify a response containing `final_diagnosis` or any extra key is rejected
- [x] 4.4 Implement JSON-Schema generation from that Zod schema for the model tool definition, and verify the generated schema and the validator accept and reject the same fixtures
- [x] 4.5 Verify by test that no code path can construct an assessment lacking the mandatory disclaimer

## 5. Data layer

- [x] 5.1 Write the Drizzle schema for every entity in the proposal's data model, and verify the generated migration applies cleanly against a live PostgreSQL 16 database
- [x] 5.2 Add the `pgvector` column and index for knowledge-base chunk embeddings, and verify a nearest-neighbour query returns ordered results on seeded fixtures
- [x] 5.3 Create the restricted application database role with insert/select-only privileges on the audit table, and verify an attempted `UPDATE` or `DELETE` on an audit row fails at the database level
- [x] 5.4 Implement the `ClinicalRepository` taking a required `AccessContext`, writing the audit entry in the same transaction as every clinical read and write, and verify a forced audit-write failure rolls back the clinical write
- [x] 5.5 Implement the consent gate inside the repository and verify a read for an unconsented purpose is refused before any clinical row is fetched
- [ ] 5.6 Add the lint rule forbidding raw database-client and schema imports outside `packages/db`, and verify it fires on a fixture that bypasses the repository
- [x] 5.7 Seed the disease taxonomy, the consent policy version, and a starter draft questionnaire template with red-flag rules, and verify the seed runs idempotently

## 6. Authentication and access control

- [x] 6.1 Implement registration with Argon2id hashing, the 12-character and breached-password policy, and verify weak-password rejection and that no log line contains a submitted password
- [x] 6.2 Implement email verification with a 24-hour single-use token, and verify token reuse is refused and unverified accounts cannot create a case
- [x] 6.3 Implement login issuing a ≤15-minute access token and a rotating `httpOnly` refresh cookie, and verify a replayed refresh token revokes the whole session family
- [x] 6.4 Implement failed-login rate limiting and verify the eleventh attempt within 15 minutes is refused and audit-logged
- [x] 6.5 Implement password reset with a ≤60-minute single-use token that revokes all sessions, and verify the unknown-address response is byte-identical to the known-address response
- [ ] 6.6 Implement TOTP MFA and require it for doctor, clinical-admin, and platform-admin roles, and verify an unenrolled doctor's session can reach only the enrolment endpoints
- [ ] 6.7 Implement the linked-external-identity model and verify a provider link with a verified matching email attaches to the existing account rather than creating a second identity
- [x] 6.8 Implement the RBAC middleware chain (`authenticate → authorize → consent-gate → audit`) and verify a direct API call bypassing the UI is refused with `403` and audit-logged
- [x] 6.9 Implement patient-ownership, doctor-assignment, clinical-admin, and platform-admin scoping rules, and verify the cross-patient request returns `404` and reads no clinical field
- [ ] 6.10 Implement time-limited, reason-carrying break-glass elevation for platform admins, and verify unelevated clinical reads are refused and both elevation and read are logged
- [x] 6.11 Implement the under-18 case-creation guard with the `TODO(confirm): Decision E` marker, and verify a minor's case creation is refused

## 7. Consent, audit, and data-subject rights

- [x] 7.1 Implement per-purpose consent capture presenting each purpose separately with nothing pre-selected, and verify partial consent leaves the account usable
- [x] 7.2 Implement immutable consent records with policy version and request metadata, and verify a withdraw-and-regrant cycle leaves all three facts independently readable
- [x] 7.3 Implement withdrawal in the patient's own account area and verify withdrawing `ai_assisted_analysis` stops a queued AI job and withdrawing doctor sharing ends the doctor's access
- [x] 7.4 Implement the consent-state view showing state, timestamp, policy version, and consequence of withdrawal, and verify the read is audit-logged
- [ ] 7.5 Implement the audit query interface restricted to platform admins, and verify a doctor's query is refused and that refusal is itself logged
- [ ] 7.6 Verify by test that no audit entry contains an answer value or document content
- [ ] 7.7 Implement data-subject access export and verify it contains answers, documents, and released summaries and excludes the raw AI assessment and doctor working notes
- [ ] 7.8 Implement correction as an amendment preserving the original, and verify a post-submission answer correction flags the case for the doctor without rewriting the original response
- [ ] 7.9 Implement erasure with a second confirmation and open-clinical-obligation handling, and verify clinical content is removed while audit entries survive with a pseudonymous subject reference
- [ ] 7.10 Implement the retention job driven by configuration with no defaults and the `TODO(confirm): Decision F` marker, and verify an unset category alerts instead of deleting

## 8. Case lifecycle and questionnaire API

- [x] 8.1 Implement the case state machine with explicit permitted transitions, and verify an `in_progress` to `released` transition is refused and logged
- [x] 8.2 Implement case creation pinning the published template version, and verify an in-flight case is unaffected by a subsequent republish
- [x] 8.3 Implement the single-`in_progress`-case rule and verify starting a second draft offers resume or discard
- [x] 8.4 Implement the answer-write endpoint that validates, persists, evaluates red flags, and returns the next active question in one transaction, and verify the red-flag result is present in the same response
- [x] 8.5 Implement resume and verify a case reopened on a different device returns to the correct position with all answers intact
- [x] 8.6 Implement submission with required-question checking and consent-based routing, and verify submission without doctor-sharing consent is refused and submission without AI consent yields an `ai_skipped` case
- [x] 8.7 Implement doctor assignment and reassignment with retained history, and verify the previous doctor loses access immediately
- [x] 8.8 Implement the patient case-status endpoint and verify it returns state only for a case in `ai_processed` or `in_review`, with the attempt audit-logged — the `TODO(confirm): Decision A` marker
- [ ] 8.9 Verify end-to-end that an emergency-flagged case abandoned before submission still appears in the doctor queue marked urgent

## 9. Document upload and extraction

- [x] 9.1 Implement upload with content-inspection type detection and the size limit, and verify a non-PDF renamed to `.pdf` is rejected and nothing is stored
- [x] 9.2 Integrate the malware scanner and verify an infected file is discarded, unreferenced, and logged, and that scanner unavailability holds the upload as pending rather than accepted
- [x] 9.3 Implement streaming to encrypted object storage with no app-filesystem persistence, and verify no temporary file remains after an upload
- [x] 9.4 Implement signed-URL issuance after an authorization check, capped at 15 minutes and scoped to one object, and verify an unassigned doctor receives no URL and the denial is logged
- [x] 9.5 Implement patient document tagging (type, approximate date) and verify tags persist when extraction fails
- [ ] 9.6 Implement text extraction in `services/ai` — native PDF/DOCX plus OCR for scans — and verify a scanned fixture yields text and a corrupt fixture yields a not-machine-readable status
- [ ] 9.7 Implement the LLM extraction summarizer producing report type, date, key findings, and flagged abnormal values, and verify the output is stored labelled AI-generated and unverified with the original unchanged
- [ ] 9.8 Verify extraction is skipped entirely, with no content leaving the trust boundary, when `ai_assisted_analysis` consent is absent
- [x] 9.9 Implement pre-submission deletion and post-submission deletion refusal, and verify both paths including their audit entries

## 10. AI assessment pipeline

- [ ] 10.1 Implement knowledge-base entry CRUD with versioning and a snapshot version that advances on any change, and verify a prior version remains retrievable after an edit
- [ ] 10.2 Implement chunking and embedding with regeneration on edit, and verify retrieval never matches stale content after a revision
- [ ] 10.3 Implement tag-and-cluster-filtered semantic retrieval, and verify a hepatobiliary case prefers hepatobiliary entries over similar unrelated ones
- [ ] 10.4 Implement the taxonomy CRUD with the malignancy single-category constraint and the `TODO(confirm): Decision C` marker, and verify the taxonomy view lists attached questions and entries
- [ ] 10.5 Implement the guarded model call using the generated tool schema at low temperature, and verify the prompt version is pinned in the stored result
- [ ] 10.6 Implement server-side response validation with bounded retry under a stricter reminder, and verify a missing field, an extra field, a drug mention, a `final_diagnosis` field, and an off-taxonomy condition are each rejected rather than patched
- [ ] 10.7 Implement retry-exhaustion routing to the doctor queue marked "AI assessment unavailable", and verify the case is reviewable with no assessment present
- [ ] 10.8 Implement the ungrounded-assessment marking when retrieval returns nothing above threshold, and verify the doctor view states no curated guidance matched
- [ ] 10.9 Implement version pinning of model, prompt, knowledge-base snapshot, and retrieved entry ids, and verify a stored assessment reconstructs its exact grounding
- [ ] 10.10 Implement the pre-egress consent check and verify that consent withdrawn between submission and processing sends nothing to the provider and marks the case `ai_skipped`
- [ ] 10.11 Verify by test that no endpoint, notification, or export returns assessment content to a patient

## 11. Doctor review dashboard

- [x] 11.1 Implement the review queue scoped to assigned cases, sortable by urgency and submission time, and verify emergency cases sort above non-flagged ones by default
- [x] 11.2 Implement the one-screen case view rendering answers by symptom cluster with branching context, documents with extracts, red flags with basis, and the assessment, and verify each panel read emits its own audit entry
- [x] 11.3 Implement the no-assessment case presentation and verify it states the reason plainly
- [x] 11.4 Implement inline override of likelihood, addition, removal, and rejection with reason, and verify the original AI assessment remains retrievable unmodified
- [x] 11.5 Implement structured feedback diffs with rationale and version pins, and verify diffs are queryable and that no automated path submits them for model training
- [x] 11.6 Implement the doctor-authored final summary and next-steps editor with no medication pre-fill, and verify finalization is refused when the AI summary is passed through untouched
- [x] 11.7 Implement release behind an explicit confirmation showing the patient-visible content, and verify nothing becomes patient-visible without that confirmation and that release is recorded with content version and timestamp
- [x] 11.8 Implement case messaging with no raw-AI-content insertion, and verify messages are stored with the case and audit-logged

## 12. Clinical admin console

- [ ] 12.1 Implement question, group, option, help-text, and reference-image-attachment authoring, and verify retiring a question leaves in-progress cases and historical answers intact
- [ ] 12.2 Implement branching-rule authoring over the condition grammar with a diffable view, and verify an invalid rule cannot be saved
- [ ] 12.3 Implement draft-and-publish with immutable published versions, and verify a draft edit is invisible to patients until publication
- [ ] 12.4 Implement publication validation (cycles, retired targets, missing lay explanations, unapproved clinical translations) and verify each failure blocks publication with the problem identified
- [ ] 12.5 Implement rollback by republishing a prior version and verify both events appear in history
- [ ] 12.6 Implement preview mode walking the real patient path including red-flag escalation, and verify no case, response, or assessment is written
- [ ] 12.7 Implement the reference-image library with caption, alt text, source, licence, and versioning, and verify publication is refused without attribution and that replacing an asset preserves the prior version
- [ ] 12.8 Verify aggregate question statistics enforce a minimum cohort size and expose no individual answer or patient identifier
- [ ] 12.9 Verify every content create, edit, publish, retire, and rollback records actor, timestamp, and before-and-after content

## 13. Patient-facing web experience

- [ ] 13.1 Implement the registration, verification, and login flows against the auth API, and verify the unverified state blocks clinical actions in the UI as well as the API
- [ ] 13.2 Implement the granular consent screen with per-purpose controls and plain-language explanations, and verify nothing is pre-selected
- [ ] 13.3 Implement the symptom-area entry point selection that never asks the patient to name a disease, and verify each area starts the correct entry group
- [ ] 13.4 Implement the question renderer for all nine question types including the body map, and verify each type's validation surfaces inline
- [ ] 13.5 Implement reference-image rendering with responsive sizes, modern format with fallback, and lazy loading, and verify the question is usable before any image loads and the payload carries no image binary
- [ ] 13.6 Implement autosave with unsaved-state indication and retry, and verify the patient is not advanced past an unpersisted answer
- [ ] 13.7 Implement the adaptive progress indicator and verify it explains itself when a branch adds questions
- [ ] 13.8 Implement the full-screen emergency escalation with 112 and 108 tap-to-call, acknowledgement recording, and a persistent banner on continue, and verify it renders with the AI service fully down
- [ ] 13.9 Implement document upload with tagging and pre-submission deletion, and verify upload progress and failure states on a throttled connection
- [ ] 13.10 Implement the patient case-status and released-summary views, and verify no pre-release assessment content is reachable
- [ ] 13.11 Implement the privacy settings area with consent review and withdrawal, and verify withdrawal takes no more actions than granting did
- [ ] 13.12 Verify the patient flow against WCAG 2.1 AA with an automated audit plus a manual keyboard and screen-reader pass of one full interview

## 14. Localization

- [ ] 14.1 Wire `next-intl` with English and Hindi catalogues and verify a missing key falls back to English while recording the gap
- [ ] 14.2 Add per-language `clinician_approved` flags to clinical content and verify publication refuses a language whose clinical text is unapproved
- [ ] 14.3 Implement mid-case language switching and verify stored answers are unchanged because they hold option identifiers
- [ ] 14.4 Implement locale-correct date, number, and duration formatting with unambiguous date entry controls, and verify `03/04/2026` cannot be stored ambiguously
- [ ] 14.5 Verify the hardcoded-string lint rule passes across the whole patient flow

## 15. Notifications

- [x] 15.1 Implement the transactional email sender with templates for verification, reset, submission, review-released, and doctor-queue notification, and verify each renders in both languages
- [x] 15.2 Implement the clinical-content guard that fails rendering when a template variable holds clinical content, and verify the notification is not sent
- [x] 15.3 Implement delivery recording with outcome and operator-visible permanent failures, and verify a hard bounce leaves the release standing and the summary readable on sign-in
- [x] 15.4 Verify a queued notification for an erased account is dropped and the drop recorded

## 16. Integration verification and rollout readiness

- [ ] 16.1 Write an end-to-end test covering register → verify → consent → interview with branching → upload → submit → AI assessment → doctor review → release → patient reads released summary, and verify it passes against the compose stack
- [ ] 16.2 Write an end-to-end test for the emergency path with the AI service stopped, verifying escalation, answer persistence, and urgent queue placement
- [ ] 16.3 Write an end-to-end test for the consent-refused path verifying no egress to the model provider, using a provider stub that fails the test if called
- [ ] 16.4 Run a security review covering authz bypass, IDOR on case and document identifiers, signed-URL scope, and session handling, and verify each finding is closed or explicitly accepted
- [ ] 16.5 Verify low-bandwidth behaviour by loading a full interview under a throttled profile and recording payload sizes against a documented budget
- [ ] 16.6 Verify every `TODO(confirm): Decision <X>` marker from design D13 is present and greppable, and produce the list for the clinical co-founder's review
- [ ] 16.7 Document the deployment runbook covering the India-region requirements, the restricted database role, provider key placement, and the first-admin bootstrap, and verify a clean environment can be brought up by following it
