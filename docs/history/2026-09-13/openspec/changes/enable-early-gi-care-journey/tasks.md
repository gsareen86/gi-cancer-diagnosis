## Execution rules

A checked item requires its named evidence; writing a component or passing an old test suite is insufficient. Implementation is authorized on codex/early-gi-care-journey. Mobile OTP integration is deferred by the user.

Capability groups map to roadmap phases but are not a strictly serial execution order. Implement safety/authorization contracts and tests before dependent UI. First delivery slice: 0.1–0.4, 1.1–1.7, 2.1–2.4, then 5.1–5.4; develop the durable worker foundation (6.1–6.3) alongside it. Complete all external-use gates before offering a live clinical review service.

Use existing repository commands after confirming the runtime baseline. Preserve user changes and existing signed records. Do not create live messages, public clinical publishing or provider/cloud settings merely to complete a local test.

## 0. Baseline and scope — Phase 0 — Engineering / product / clinical owner

- [x] 0.1 Record the current commit, dirty-file inventory and application/runtime topology without printing secrets; capture current required test/typecheck/build outcomes separately from older reports.
- [ ] 0.2 Reconcile pending OpenSpec changes and the supersession table; establish correct canonical/delta semantics and run official strict OpenSpec validation when the CLI is available.
- [ ] 0.3 Create the initial fictional clinical scenario pack with expected questions, advice, explicit unknowns and rationale; mark each expectation pending or approved by the clinical owner.
- [x] 0.4 Document adult scope, advice-only emergency behavior, no-report journey and service-acceptance assumptions; verify no planning requirement promises calls, SOS or staffed coverage.
- [ ] 0.5 Produce reviewable patient and doctor wireframes using fictional cases and existing Navigator patterns; record corrections from available asynchronous review.
- [ ] 0.6 Resolve or retain explicit EGC decision defaults for providers, queue compatibility, clinical ownership, content rights and deployment mode; re-estimate phase effort from the baseline.

## 1. Safety assessment — Phase 1 — Core engineering / clinical owner

- [x] 1.1 Add a regression that reproduces the nonbloody vomiting, inability-to-retain-fluids and reduced-urine failure with the proposed five and nine universal seeds; demonstrate failure before repair.
- [ ] 1.2 Define versioned safety questions, canonical fact IDs, follow-up obligations and incomplete states; verify that symptom presentation cannot hide obligated follow-ups.
- [ ] 1.3 Implement the approved scheduler in core and add actual-answer sequence tests across all five entry points, including relevant negative and uncertain answers.
- [ ] 1.4 Review broader urgent patterns including dysphagia option coverage and jaundice combinations; encode only clinically approved expectations and retain unapproved fixtures outside published content.
- [ ] 1.5 Wire the shared evaluator to client immediate advice and authoritative server persistence; verify AI downtime and failed saves never suppress advice and unsaved state remains honest.
- [ ] 1.6 Replace emergency calling/contact UI and promises with approved advice-only copy in all affected views/locales; verify no phone/SOS/emergency-contact side effect is created.
- [ ] 1.7 Persist advisory/evaluation history, deduplicate identical interruptions and retain the warning after acknowledgement and submission; verify new concerning information can interrupt again.
- [ ] 1.8 Verify corrections, answer retraction and incomplete assessments never become false reassurance; include version-pinned behavior and consent/audit denial tests.
- [ ] 1.9 Measure core evaluation against the existing p99 performance requirement under a documented synthetic workload; distinguish it from network/UI latency.

## 2. Clinical facts and snapshots — Phases 1–2 — Data/core engineering

- [ ] 2.1 Define assertion, unknown reason, source, actor, effective date, unit and verification contracts; verify serialization across TypeScript and Python.
- [ ] 2.2 Extend structured history to capture symptom progression, prior remedies and response, and previous consultations; preserve source wording and distinguish unknown from explicit denial.
- [ ] 2.3 Wire complete case clinical history into the deterministic summary compiler and optional AI request; verify medicines, allergies, surgery and family history survive end to end.
- [ ] 2.4 Render a useful source-linked brief for a no-report case with AI disabled; verify no normal findings, diagnosis or stage are invented.
- [ ] 2.5 Add immutable input snapshots and amendment relationships; verify later edits never mutate an earlier submission or released letter.
- [ ] 2.6 Add approved measurement plausibility checks and uncertainty handling; verify invalid/unconfirmed data do not generate misleading BMI or weight-change conclusions.
- [ ] 2.7 Backfill legacy missing provenance and empty history conservatively; test migrations preserve ownership, references and explicit negatives only where actually supported.

## 3. Identity and caregiver access — Phase 2 — Identity/data engineering

- [ ] 3.1 Add patient subjects and account-subject access relationships through additive migrations; backfill existing patient accounts without changing public references or route UUIDs.
- [ ] 3.2 Adapt repository authorization and consent/audit context to distinct actor and patient; test patient, caregiver, assigned clinician, unassigned clinician and revoked access.
- [ ] 3.3 Implement the reviewed adult-proxy authorization process and visible caregiver attribution; verify relationship text or shared phone possession alone grants no clinical access.
- Deferred by user: 3.4 Mobile OTP provider adapter and phone-code flow. Retain existing email login; revisit when a provider is selected.
- [ ] 3.5 Verify existing email account recovery and identity separation; no phone linking is added and no silent household/account merge or wrong-subject case creation is permitted.
- [ ] 3.6 Retain clinician MFA and improve session renewal/replay/throttle protections where baseline gaps are confirmed; test expiry, logout and shared-device access.
- [ ] 3.7 Add revocation checks for pending jobs/disclosures and caregiver session transitions; verify historical attribution remains immutable.

## 4. Patient intake — Phase 2 — Frontend / clinical content

- [ ] 4.1 Implement language and patient/caregiver entry with short approved safety-first interaction; verify guidance is accessible when authentication or email delivery fails.
- [ ] 4.2 Keep any preliminary answers in volatile memory without server transmission or clinical analytics; confirm and re-evaluate before storing an identified consented case.
- [ ] 4.3 Organize focused stages around trajectory, impact, prior care and relevant history; verify stable stage progress and no pre-completed unanswered stages.
- [ ] 4.4 Make reports optional and allow text-first completion after upload/extraction failure; verify no diagnostic investigation is a prerequisite to seeking consultation.
- [ ] 4.5 Provide licensed/approved visual aids, text alternatives, visible labels and non-disappearing image-failure handling; verify body-map/stool selection with keyboard and on mobile.
- [ ] 4.6 Add authenticated draft resumption and editable pre-submit review; verify changed answers recompute follow-ups and save failures remain recoverable.
- [ ] 4.7 Implement explicit preparation/requested-review/accepted-review receipt states; verify no configured capacity means no fabricated specialist-review promise.
- [ ] 4.8 Publish only approved language versions after comprehension review; verify the entire visible journey uses the chosen approved version and unavailable languages are described honestly.

## 5. Clinician workspace and release — Phase 3 — Frontend/API engineering

- [ ] 5.1 Remove mount-triggered start-review and add an explicit idempotent action; verify opening five cases produces no start notification or workflow mutation.
- [ ] 5.2 Add source brief navigation within the current Navigator and accurate in-review/awaiting-information metrics; verify counts match authorized queue subsets.
- [ ] 5.3 Add server draft revisions, compare-and-swap saves and session-safe APIs; verify stale saves conflict rather than overwrite newer work.
- [ ] 5.4 Add visible debounced autosave, failed-save recovery and navigation protection; verify refresh after saved state, session renewal, multiple tabs and lost responses.
- [ ] 5.5 Implement compact mobile queue cards and collapsible filters; verify key facts/actions at narrow widths and keyboard focus behavior.
- [ ] 5.6 Wire information-request and reply UI to audited, authorized APIs; accept post-submission report/history amendments while preserving the original snapshot.
- [ ] 5.7 Add a small clinically reviewed neutral template library with explicit preview/apply/undo; verify existing text is preserved and template selection cannot finalize or dispatch advice.
- [ ] 5.8 Add explicit next-action structure with clinician-controlled timing and destination; verify no default diagnostic conclusion or payer-based routing.
- [ ] 5.9 Extend clinician registration/service identity and frozen release snapshots; verify PDFs show correct patient/clinician details and exclude private notes/raw AI.
- [ ] 5.10 Atomically reject stale-source, stale-draft, unauthorized and duplicate release requests; verify new amendments invalidate unreleased approval and historical letters remain reproducible.

## 6. Jobs, assignment and delivery — Phases 1 and 4 — Backend/operations engineering

- [ ] 6.1 Select a maintained PostgreSQL-compatible queue/outbox implementation against the current runtime; document transaction, lease, retry and compatibility behavior without adding an unnecessary datastore.
- [ ] 6.2 Add durable jobs and transactional outbox writes with stable keys and scoped authority; verify business transition and event are atomic.
- [ ] 6.3 Add worker lifecycle, leases, bounded retries, stale-snapshot checks and failure visibility; fault-test restart, duplicate execution and consent withdrawal.
- [ ] 6.4 Move assessment orchestration off long web requests; verify users can navigate away, manual review remains available and late output cannot overwrite a newer snapshot.
- [ ] 6.5 Implement delivery-state receipts, duplicate/ambiguous provider handling and authenticated nonclinical notification links; verify failed/logged-only is never labelled delivered.
- [ ] 6.6 Add actual service availability/capacity and assignment; verify unavailable clinicians and absent backup staff are handled without doctors[0] fallback.
- [ ] 6.7 Implement browser-independent due checks and operator visibility into accepted unowned/overdue work; verify clinical urgent advice never depends on the operational clock.
- [ ] 6.8 Add explicit handover/absence procedures and scoped operator actions; verify ordinary coordinators cannot read clinical details without authorization.
- [ ] 6.9 Document provider configuration, intended recipients and recovery drills; exercise external dispatch only under the authorization and configuration appropriate to the implementation session.

## 7. Documents and optional AI — Phases 1 and 4 — AI/backend engineering

- [ ] 7.1 Separate source-bound factual medication history from generated recommendations in schemas and validation; test legitimate facts and prohibited treatment variants together.
- [ ] 7.2 Permit insufficient-information/abstention instead of forced differentials; verify no autonomous diagnosis/staging/prescribing or raw patient AI output.
- [ ] 7.3 Implement real configured storage and malware inspection with bounded file/page processing; verify missing scanner configuration blocks report processing but not report-free intake.
- [ ] 7.4 Repair PDF/image extraction paths and preserve source page, date, units and uncertainty; benchmark permitted document classes and record field-level errors/abstentions.
- [ ] 7.5 Add explicit confirmation/verification of candidate facts and wrong-patient/contradiction handling; verify unverified extraction cannot silently answer a safety question.
- [ ] 7.6 Build a permission/version/review register and ingestion path for a small clinically approved guidance set; verify unsupported/unapproved recommendation generation remains disabled.
- [ ] 7.7 Evaluate retrieval/embedding candidates on the approved content, handle index dimensions and versions explicitly, and activate only with reproducible relevance/provenance evidence.
- [ ] 7.8 Apply provider data-minimization, approved-region and retention policies to OCR/AI/logs; verify real patient material is not sent to an unapproved adapter.

## 8. Clinical content management — Phase 4 — Admin engineering / clinical owner

- [ ] 8.1 Implement draft CRUD APIs and UI for supported questions, rules and text with editor RBAC; verify changes require no TypeScript editing.
- [ ] 8.2 Add instrument preview using fictional cases, diffs and affected-scenario results; verify real-case preview retains clinical authorization/consent/audit checks.
- [ ] 8.3 Add clinical rationale, review and approval metadata, including an honest record if author/reviewer roles overlap under governance; verify unapproved content cannot publish.
- [ ] 8.4 Gate publication on schema, reference, scenario and language/image approval checks; include negative publication tests.
- [ ] 8.5 Pin versions for active cases and support controlled publication rollback for new cases; verify old decisions and wording remain reconstructable.
- [ ] 8.6 Record content/source expiry or review-due state and a responsible owner; verify unavailable content has an honest operational fallback.

## 9. Follow-through — Phase 5 — Product/backend/frontend

- [ ] 9.1 Add care actions with owner, recommendation, due/review time, reported/verified state and closure reason; verify reading the summary changes receipt only.
- [ ] 9.2 Add patient progress, access-barrier, decline and clarification responses with actor/source attribution; verify no unsupported claim of attendance or completed care.
- [ ] 9.3 Separate requested-report receipt from clinical result review; verify outstanding review responsibility remains visible after upload.
- [ ] 9.4 Add a new-symptom amendment/reassessment flow after release; verify urgent advice can reappear independently of routine messaging.
- [ ] 9.5 Add configured, consented, bounded reminders and opt-out; verify missing service ownership or revoked permission prevents dispatch.
- [ ] 9.6 Capture minimal distribution and journey metrics without symptom content/advertising trackers; verify payer/acquisition source cannot change clinical routing.

## 10. Privacy and deployment controls — Phase 4 — Engineering / designated reviewer

- [ ] 10.1 Reverify the dated privacy/intended-use applicability register against selected providers and service model; document decisions without claiming automatic legal certification.
- [ ] 10.2 Implement owned, identity-checked rights request fulfillment and scoped export; verify unauthorized representatives cannot access another patient's data.
- [ ] 10.3 Implement assessed retention/deletion policies and exceptions across primary records, objects and derivatives; verify rights fulfillment remains possible after consent withdrawal.
- [ ] 10.4 Add backup/restore, access/key handling and incident runbooks with real evidence from synthetic data; verify scoped audit records and minimal clinical logging.
- [ ] 10.5 Add deployment readiness checks and feature flags that keep unapproved clinical content/providers unavailable; test compatible rollback without destroying records or disabling advice in started cases.

## 11. Integrated evidence and release — Phase 6 — Engineering / clinical owner / product

- [ ] 11.1 Run the fictional corpus across applicable entry points and approved locales, including negative/uncertain answers; report coverage and known limits without claiming clinical sensitivity.
- [ ] 11.2 Run complete no-report, caregiver, information-request, amendment, manual-review, release and follow-through journeys against the actual application.
- [ ] 11.3 Perform available remote/asynchronous clinical and bilingual comprehension reviews using fictional data; record unresolved issues and keep unapproved content unpublished.
- [ ] 11.4 Measure scripted patient completion and clinician active work versus waiting, correction burden and omissions; label all results as simulation/usability observations.
- [ ] 11.5 Exercise worker/provider failures, stale tabs, revoked access, wrong-case documents and database/object restoration; resolve critical failures before readiness sign-off.
- [ ] 11.6 Run current required typecheck, unit/integration suites, production build and strict OpenSpec validation; retain results tied to the implementation revision.
- [ ] 11.7 Review service ownership/capacity, content approvals and operational evidence before enabling external personalized clinical use; no pilot or adoption claim is substituted by automated tests.
- [ ] 11.8 Present the release evidence, unresolved limitations, actual operating-cost inputs and rollback procedure; keep willingness to pay and real-world benefit explicitly unmeasured until evidence exists.
