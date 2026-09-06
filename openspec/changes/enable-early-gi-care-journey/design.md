## Context

This change operationalizes the adult symptom-first journey defined in proposal.md and the linked implementation roadmap. The current repository contains two unarchived planning changes and substantial existing implementation. There is no canonical openspec/specs tree. Implementation must establish the baseline before reconciling specifications; this proposal does not certify earlier checklist claims.

The core clinical opportunity is an accurate history and an appropriate next step before investigations exist. Clinical content and service capacity are separate dependencies from software delivery.

## Goals / Non-Goals

Goals: preserve complete history and uncertainty; reliable safety-question coverage on actual patient paths; advice-only immediate-care handling; accessible caregiver-aware intake; a useful no-report brief; recoverable clinician work; explicit service responsibility; traceable follow-through.

Non-goals: autonomous diagnosis/prescribing/staging, raw AI for patients, emergency calling/SOS, new e-prescribing, DICOM interpretation, public clinical effectiveness claims and assumed staffing. Preserve existing signed physician content and the approved Navigator interaction.

## Decisions

### D1. Keep the stack and divide responsibilities

Keep Next.js route handlers and UI, framework-independent TypeScript clinical logic, PostgreSQL/Drizzle and Python inference/extraction. Add a worker process beside the web app using the same PostgreSQL deployment and a maintained PostgreSQL queue/outbox implementation selected after compatibility review. This adds a process, not a new datastore. Avoid Redis/BullMQ initially because it adds operations without a demonstrated need.

The web application owns authorization, consent, clinical facts, state transitions and authoritative output validation. Python receives versioned, minimized inputs and returns candidate results. The worker coordinates jobs but does not independently authorize clinical actions.

No migration to a newer UI framework, cloud inference provider or embedding model is required by this plan. Evaluate extraction/retrieval candidates against representative synthetic or appropriately permitted data before choosing one; hosted processing must satisfy approved-region policy and provider terms.

### D2. Separate safety fact acquisition from symptom presentation

Extend the template with an approved safety domain: shared initial questions, safety follow-up rules, scenario fixtures and completion obligations. Retain existing symptom branches for focused detail. Both read canonical fact identifiers; avoid two separately editable jaundice answers.

Safety obligations describe what must be established when a clinically approved condition is present. For example, a positive inability-to-retain-fluid answer must not depend on an unrelated bleeding branch to ask the follow-ups needed by the dehydration rule. Exact clinical combinations, language and urgency remain clinician-authored content.

Compute safety questions from patient-attested answers, not from a graph's hypothetical transitive closure. Preserve unknown/unsure/cannot-assess states. Distinguish satisfied, explicitly negative and incomplete obligations. An incomplete obligation is not a negative screen and does not by itself assign every patient emergency urgency.

Run the same pure evaluator over the approved client bundle for immediate presentation and server-side for authoritative persistence. Identified answer writes keep the existing audit/consent hooks. If persistence fails, show locally determined advice and mark the unsaved state. Preliminary unauthenticated answers remain in volatile memory without transmission or clinical analytics; after consent they are confirmed and re-evaluated server-side.

Deduplicate an identical full-screen advisory within a stable episode. Keep a persistent warning after acknowledgement/submission. New or higher-severity findings can interrupt again. Corrections retain evaluation history; do not silently erase an unresolved high-priority advisory. There are no phone actions, emergency-contact requests or SOS jobs.

### D3. Canonical facts and immutable input snapshots

Extend current typed clinical facts instead of flattening history into a prompt string. Proposed fact envelope:

- factId, clinicalConcept, value and unit where applicable;
- assertion: affirmed / denied / unknown, plus unknownReason;
- sourceType: patient_answer / caregiver_answer / history / report_extract / clinician_confirmation;
- actorId, patientSubjectId, sourceRecordId, sourceVersion and optional document/page reference;
- recordedAt, effectiveDate or approximate duration, verificationState and supersedesFactId.

Not every fact requires a separate row: retain existing structured history storage where appropriate and expose a common compiler contract. Store immutable record snapshots at submission, amendment and release. Record the exact snapshot/version in each brief, job, AI assessment and clinician approval.

Preserve input language and normalized concepts. Patient-reported facts are not labelled clinically verified. Contradictory sources remain visible until an authorized resolution records what was reconciled. Never fabricate normal vitals or derive ECOG/cancer stage from free text.

### D4. Account holder is not the patient

The current cases.patientId references users. Introduce an explicit patient-subject/profile identity and an account-subject access relationship rather than creating fake login accounts for relatives.

Backfill one patient subject for each existing patient account, preserving public patient/case references and all UUID routes. Add a case subject foreign key and transition authorization through a compatibility adapter before removing any old dependency. Keep the existing patient account actor for historical audits.

Caregiver access records actor, subject, relationship, permitted purposes, consent/authority basis, scope, creation and revocation. Relationship text and phone ownership do not establish authority. For an adult able to consent, use the reviewed patient-authorization process; unsupported representation must not be silently accepted. Shared/recycled phone numbers never merge patients automatically.

Mobile OTP/provider integration is deferred by the user. Retain existing email/password, verification and recovery. A future phone adapter must use protected, expiring single-use codes and proof-based account linking; do not implement or advertise that adapter in this release. Doctor authentication and MFA retain stronger role requirements. Re-check subject access on every clinical request.

### D5. Model clinical urgency, workflow and communication separately

Keep three distinct concepts:

1. Clinical safety evaluation: advice based on approved rules.
2. Service workflow: draft, submitted, assigned, in_review, awaiting_information, finalized/released.
3. Care action and communication: recommendation progress, acknowledgement, delivery and closure reason.

Opening a case is a read. Start-review is an explicit authorized transition, idempotent under retries. Acknowledgement is an event, not proof of completed care.

An accepted review request must have configured service ownership. Where no clinician is available, show the actual unassigned/unsupported state and available preparation-only option without claiming a doctor is reviewing it. Do not silently redirect to a funder or invent a back-up clinician. Review windows derive from real service configuration; emergency advice always says not to wait.

### D6. The brief works without AI

The deterministic compiler produces:

- complaint and duration/progression timeline;
- explicit important findings and incomplete safety/history questions;
- medicines/remedies tried, response and previous consultations;
- relevant medical, surgical, allergy and family history;
- existing reports with dates, source/verification state and contradictions;
- missing information needed for the clinician's decision.

Missing reports are not automatically missing required investigations. Ask for an existing report if the patient says it exists; new investigations require clinician judgment.

AI can organize prose and propose private, source-linked support within its approved contract. It is optional. Remove any minimum differential count that forces unsupported entries; permit insufficient-information/abstention. Do not infer a cancer site merely to populate an organ-specific label.

Separate source-bound medication history from candidate recommendations. Validate schemas, provenance, scope and unsupported treatment output; test permitted factual mentions and adversarial treatment wording together. Regex is a supplementary guard, not proof of clinical correctness. Invalid output is bounded-retry and ends in a readable manual-work fallback.

### D7. Recoverable clinician work and explicit release

Retain Navigator. Use the first section as a concise brief with links into existing history/report views. Mobile triage uses cards and a collapsible filter sheet.

Persist drafts server-side with debounce, visible status and a revision number. Use compare-and-swap/ETag-style concurrency; stale writes return a conflict rather than last-write-wins. Flush outstanding saves before finalize; if saving fails, keep the editor and warn on navigation. Keep unsaved clinical text in memory, not unprotected long-lived localStorage. Test refresh/session renewal, multiple tabs and interrupted requests.

Requests for clarification create a thread and an information-request state with an owner. Patient replies/uploads create amendments; original submissions and released letters remain immutable. Any changed source snapshot invalidates an unreleased approval. A late AI job cannot replace a newer draft or source snapshot.

Templates are versioned drafts with explicit preview/apply and undo. Initial templates cover documentation and next-action structure; no symptom selection automatically writes a diagnosis or referral urgency. Investigations, diet and precautions also require review.

Finalization records clinician identity, registration metadata, patient identity, content version, source snapshot and approval timestamp. Release checks current authorization/consent, assignment, draft/source revisions and explicit confirmation atomically. PDF generation uses this frozen snapshot; a later doctor-profile change does not alter an old letter. Private notes and raw AI stay excluded.

### D8. Durable work and production document handling

Proposed persistence: background_jobs/outbox records, attempt/delivery receipts and service availability configuration. Store identifiers, purpose and snapshot references in jobs, not copied patient narratives. Business transition and its outbox event commit together. Consumers use stable idempotency keys, lease expiry, retry/backoff, failure visibility and operator-controlled replay.

Providers may deliver more than once or acknowledge ambiguously; record this uncertainty and deduplicate logical actions. Never promise exactly-once external delivery. Late jobs use fencing/source-version checks. Workers re-check current consent/assignment before accessing clinical data and before dispatch. Privacy fulfillment uses the appropriate authorized rights basis, not a requirement to re-consent to withdrawn processing.

Implement actual S3-compatible approved-region storage and configured malware inspection. Missing production scanner/storage configuration fails closed for report processing without blocking report-free intake. Stream/bound input size, pages and processing time; do not expose extracted data from quarantined files. Add PDF rasterization where needed. Extraction keeps page/date/unit/source provenance and explicit uncertainty; patient attestation or clinician verification is a separate action.

Guidance ingestion records source, permission, version, review date, eligible uses, approving clinician and retrieval evaluation. Freely viewable does not mean licensed for ingestion. Reindex new embedding versions into a separate compatible store/index; the current 1024-dimensional schema cannot simply accept an arbitrary replacement model. Activate only after evaluation; retain original references.

### D9. Small, real clinical authoring and follow-through

Add admin APIs and UI for draft/edit/preview/review/publish of the instrument and its language assets. Use existing condition grammar and constrain editing to supported primitives. Publication requires references, clinical approval and passing patient-path scenarios. Show differences and affected scenarios. For the initial small team, author and reviewer may be the same authorized clinician only if governance explicitly permits and records that choice; the app does not pretend an independent review occurred.

A care action stores recommendation, responsible service, due/review time, patient-reported progress, verification state and closure reason. Reminders are bounded, consented and symptom-free in external messages. No patient follow-up is described as actively monitored without an accountable service.

New symptoms create a fresh assessment event and can raise advice without waiting for routine messaging. Test upload receipt separately from result review. Preserve earlier advice and source versions.

### D10. Migrations, rollout and rollback

Use additive migrations and feature flags for safety-template version, patient-subject identity, new intake, brief, autosave, information requests, outbox, admin publication and care actions. Flags do not bypass consent or disable immediate safety advice for a started version.

Backfill identities and history with unknown provenance where evidence is missing; never backfill an explicit denial from an empty array. Compatibility reads are temporary, with invariant checks and a documented removal gate. No irreversible column/table removal in the initial rollout.

Shadow-run new compilers/evaluators on synthetic fixtures first; compare source facts and expected outcomes. Clinical content stays unpublished until approved. Enable provider dispatch only with intended configuration and authorized test recipients during implementation.

Rollback disables new intake/service acceptance and reverts to an approved compatible version while preserving started cases, submissions, releases and audit history. Preserve job idempotency and quarantine stale work. Test database/object-store restore using synthetic data.

## Implementation Map

| Area | Existing anchors | Proposed additions |
|---|---|---|
| Safety | packages/core/src/questionnaire/*; packages/core/src/safety/*; packages/db/src/seed/questions.ts and red-flags.ts | Safety obligations, scenario fixtures, advice-only render/persistence |
| Facts and snapshots | packages/core/src/assessment/clinical-summary.ts; packages/db/src/schema/history.ts; apps/web/src/server/services/assessment-service.ts | Provenance/unknown contracts, symptom timeline, versioned compiler inputs |
| Identity | packages/db/src/schema/identity.ts and clinical.ts; apps/web/src/app/api/auth/*; ClinicalRepository | Patient subjects, access grants, OTP challenges, compatibility migration |
| Patient UI | apps/web/src/components/patient/*; questionnaire/*; cases APIs | Symptom-first stages, optional reports, amendments |
| Doctor UI/API | case-workspace.tsx; signoff-panel.tsx; triage-table.tsx; review and messages routes | Explicit start, autosave revisions, source brief, clarification and snapshot release |
| Operations | notification-service.ts; notifications/sync; storage.ts; file-inspection.ts | Worker entry point, outbox, availability, scanner/storage configuration, operator dashboard |
| AI/content | services/ai/gi_ai/{schemas,prompt,extraction,retrieval,embeddings}.py; content-service.ts | Contract alignment, candidate facts, grounded-use gate, authoring APIs |
| Follow-through/privacy | summary/acknowledge; privacy/requests; privacy schema | Care actions, receipt-only acknowledgement, fulfillment state and exceptions |

Paths are relative to the repository and must be verified during implementation.

## Proposed API Contract Surface

Final route names can follow existing conventions; the behavior and authorization below are the contract. Reuse existing endpoints when compatible instead of duplicating them.

| Surface | Contract / concurrency rule |
|---|---|
| Phone challenge and verify | Challenge ID, normalized destination and purpose; code never returned/logged outside synthetic delivery; verify returns authenticated actor only |
| Patient-subject access | Subject identity and active scoped grant; every dependent route checks actor-to-subject authority |
| Case brief read | Current snapshot ID, source-linked facts and completeness; authenticated assigned clinician or permitted patient view; no raw AI exposure |
| Draft save | Expected draft revision, source snapshot and private draft payload; return new revision or explicit conflict |
| Review start | Explicit idempotent transition with assignment/current authority checks; a case GET never calls it |
| Information request / reply | Thread and request ID, author, patient subject and source version; reply can attach authorized existing/new documents |
| Case amendment | Expected source version, changed facts, reason and provenance; append-only version with re-evaluation and stale-approval invalidation |
| Finalize / release | Expected draft and source revisions plus explicit release confirmation; atomic frozen snapshot and outbox event |
| Care action update | Expected action revision, source-attributed reported/verified progress and reason; acknowledgement is a separate receipt event |
| Clinical draft / publish | Editor authority, draft version, approval evidence and scenario results; publication does not rewrite started cases |
| Rights request / fulfillment | Verified requester scope, assigned operator, applicable authority, evidence and retained-data exceptions |

Contract tests cover unauthorized scope, withdrawn authority, stale revisions, duplicate requests and failed persistence. Error responses contain actionable status without disclosing another patient's existence or content.

## Supersession and Compatibility

| Earlier pending requirement | New behavior |
|---|---|
| add-gi-compass-mvp: emergency escalation includes 112/108 and emergency contact | Advice-only, no calling/SOS/contact feature |
| elevate-clinical-workspace: acknowledgement closes the case | Record receipt; close care actions/episode with explicit evidence and reason |
| History frozen at submission with all later writes refused | Freeze the historical snapshot; accept append-only amendments and new review versions |
| On-mount start-review behavior | Opening is read-only; explicit authorized transition |
| All symptom cases assigned using the first doctor | Actual availability/capacity and accepted service ownership |
| Optional absent history interpreted as no findings | Explicit unknown/no record; no invented clinical negatives |

Do not archive or mutate the earlier changes as part of this planning turn. Reconcile the pending base and delta semantics in Phase 0 before formal validation/merge.

## Risks / Trade-offs

- A shorter questionnaire can omit necessary facts; use clinical obligations and scenario testing rather than a fixed question-count promise.
- Local preliminary assessment improves access but increases version/disclosure complexity; use one published bundle and server confirmation.
- Caregiver identity migration is substantial because patient currently equals user; complete access tests before enabling proxy records.
- Human handling can exceed software costs; record workload and constrain service acceptance to actual capacity.
- Clinical approval and regional-language review are external dependencies. Research cannot approve a questionnaire or establish adoption.
- Provenance does not prove a statement is true; show uncertainty and preserve original evidence.
- Reports and AI can create apparent authority. Keep unverified data out of deterministic patient triage and leave manual review available.
- Clinical/model/provider behavior may change; use pinned versions and documented re-evaluation triggers.

## Open Decisions and Defaults

Track implementation markers as TODO(confirm): EGC-<id>; decisions may be resolved asynchronously without blocking unrelated engineering.

- EGC-01: clinical adult scope and exclusions; default planning boundary 18+ with general access guidance for unsupported groups.
- EGC-02: service owner, capacity and absence; default no review promise until configured.
- EGC-03: mobile OTP and paid messaging provider integration deferred by user on 2026-09-06; existing email authentication remains active.
- EGC-04: patient/caregiver authority process; default no automatic adult-proxy authorization.
- EGC-05: approved question/rule/language set; default unpublished synthetic fixtures.
- EGC-06: storage/scanner/queue selection; default current stack plus PostgreSQL worker and fail-closed production configuration.
- EGC-07: content permissions and optional AI use; default factual manual brief if no approved grounding.
- EGC-08: retention/rights/product-classification applicability; default dated assessment, no blanket compliance claim.
- EGC-09: reminder ownership and cadence; default disabled until service and recipient preferences are configured.
- EGC-10: distribution/branding; default neutral referral without hospital endorsement or guaranteed appointments.

## Validation Strategy

Test domain contracts first, then authenticated APIs and migrations, then browser interactions and full synthetic episodes. Every clinical requirement includes consent/audit behavior and a denial or unsafe-path scenario where relevant. Run existing required typecheck, unit/integration, build and OpenSpec checks after implementation; do not report old pass counts as current evidence.

The planning files themselves require structural checks now and official CLI validation when the tool is available. See tasks.md for independently verifiable work and docs/early-gi-care-implementation-plan.md for phase gates, staffing and evidence limits.
