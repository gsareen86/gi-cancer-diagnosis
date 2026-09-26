# Design

## Decisions

### Shorter main intake and review save fix

Use a separately versioned DRAFT presentation document tied to the existing contextual content version. Group related essential questions on named topic screens. Every rule field and transitive dependency stays on the main route; detailed characterization and extended history can be added from review, one chosen topic at a time. Never fill skipped answers or label an incomplete topic complete. Preserve all authored clinical questions, options, rules and old content. Save topic/mode in the consented intake for resume. No time estimate or new dependency. A review-now route preserves incomplete answers and existing warning advice.

An audited metadata/validation check of the owner-identified synthetic test visit found a four-character impression rejected by the five-character schema minimum. Fix client/server and database validation together: nonempty trimmed impressions and plans, preserving maximum lengths and urgency/access/version boundaries. Show field errors with focus and preserve drafts. Normalize older saved review objects with defaults for absent metadata. Do not submit or release the owner's stored assessment as a test.

Independent internal Codex planning review confirmed the 37-field closure of rule inputs/dependencies and identified historical draft hydration as another save risk. Tests must cover short impressions, whitespace rejection, field errors, normalized old drafts, core dependency closure, optional-unknown behavior, precise resume and unchanged floors. This is software review, not clinical approval. Existing broader archive gates remain open.

### Report processing recovery

Audited metadata for the owner-identified test visit shows its PDF extraction failed on the first attempt with a generic error and zero findings. The worker is healthy; the old UI hid this distinction as staff review needed. Native PDF text was unnecessarily routed to vision whenever vision was configured. Prefer embedded text on readable pages, retain vision for scans, validate source quotes, and allow one schema correction retry. Preserve bounded findings, consent, source provenance and staff verification. Record only numeric page progress and safe error codes. Expose explicit pending/running/failed/interrupted/empty states and staff-only retry for failed or expired unverified reports with no saved findings. Retry invalidates the old lease without changing encounter evidence or clinician drafts, and is audited. No automatic replay of failed uploads.

Independent internal review identified these paths. Test generated fictional PDFs and recovery authorization/lease boundaries. Automatic approval review blocked replaying the owner's upload through Gemini because the document may contain health data and that transfer lacked explicit authorization. This upload remains untouched pending explicit approval; synthetic verification can continue.

Live generated-PDF verification additionally reproduced Gemini HTTP 400 on the full extraction decoder schema. Removing string limits alone did not fix it; removing bounded array repetition from the decoder allowed all three fictional pages to complete (21 unverified findings). Use the compact structural decoder schema already used for local inference for Gemini too, while keeping the full application Zod length/count validation and bounded output tokens. No provider fallback. Gemini documents schema complexity limits at https://ai.google.dev/gemini-api/docs/structured-output.

The actual worker browser rehearsal then exposed a separate root cause before parsing: the worker supplies a Node Buffer, and PDF.js explicitly rejects Buffer even though it extends Uint8Array. Buffer.slice() preserved that incompatible type. Normalize both PDF parsing boundaries with an owned plain Uint8Array. A regression test using the actual Buffer input failed with the PDF.js error before the fix and passed after it. This also avoids transferring ownership of the caller's source bytes.

A final audited metadata check found the owner visit advanced from source version 295 to 296 during the work: report verification at 18:24:19 UTC cleared the draft, before deployment. The report still had zero findings. Do not restore a stale assessment silently. Add a forward no-op boundary for identical report fields, retaining consent/site/source-version guards and the audit, without mutating drafts or triggering assessment. Disable saving an empty unchanged verification, and reject verification while extraction is queued as well as running. The previously reported draft preservation applies to deployment actions, not this intervening verification; the owner was informed promptly.

1. Extend the existing foundation with a forward migration; never weaken its MFA, active membership, site isolation or audit boundaries. Fixed RPC operations return explicit projections. Direct table access remains unavailable to browser roles. Staff creation requires clinician/coordinator membership and an assigned active clinician. Admin-only users cannot read encounters.
2. Patient handoff uses a cryptographically random bearer capability, stored hashed, with absolute expiry and revocation. It is submitted in a POST body, never a URL. On same-device handoff the server revokes the staff application session and signs out before setting an HttpOnly patient cookie. A new handoff invalidates the old one. Reset revokes the capability, clears cookies and removes UI state. Every patient operation is encounter-bound and audited, including denials. Consent is required before storing clinical content; prepared fictional examples carry explicit fixture consent provenance.
3. Store bounded report objects privately in Postgres without public URLs or another cloud resource. Original retrieval is authorised and audited. A leased worker extracts structured proposals through the selected model from native PDF text or rendered pages/photos. Vision needs the pinned local projector or a configured multimodal provider. Every proposal has page/source provenance and remains unverified until staff accept, correct or reject it. Append-only revisions retain earlier evidence. Failed or exhausted jobs preserve original viewing and manual findings; optional reports cannot block intake.
4. An independently running worker leases durable Postgres jobs. Snapshot/version and consent are rechecked on claim and completion; stale results cannot publish. Lease heartbeats explicitly execute their Supabase thenables. Admins select configured local, Gemini or compatible adapters; credentials remain server-side and environment restrictions remain enforced. There is no provider fallback. Text context uses provider tokenization; bounded local image embeddings are checked by the served model. Structured output is schema validated, evidence IDs checked, semantically reviewed and urgency clamped. Two corrective retries receive generic failure codes. Failure yields unavailable output, never replacement diagnoses.
5. Intake content and rules are versioned JSON DRAFT data. Universal danger questions precede adaptive detail. Every rule dependency is reachable regardless of entry point; contradictory and unknown values remain explicit. Clinical parameters are `assumed` adaptations for synthetic demonstration, with guideline references and clinical sign-off pending. Clinical lead's nine domains plus history/timeline are represented. Body-map controls are schematic aids, not clinical reference photography.
6. The desktop clinician workspace uses a broad summary/evidence split; tablet intake has stable stages and large controls; phone stacks panels. Save independent clinician impression, urgency and specialty before revealing AI. Record prior AI exposure separately. Comparison reports actual saved fields and coded disagreement reasons. Patient release excludes internal notes. Only a clinician can release, never an AI job.
7. Prepared cases are realistic, visibly fictional records; any prepared AI output must be explicitly labelled with its actual generation provenance. Live model failure is visible. Clinical questionnaire text and rule thresholds remain DRAFT. No approved Hindi text or guideline grounding is claimed.
8. Dependencies are limited to PDF text/image handling and local worker tooling where necessary; all pinned. No provider SDK or new paid service. Existing Supabase Cloud is authorised. Local private report storage in Postgres is a demo-size tradeoff, not a production object-storage recommendation.
9. Clarifications stay in the authorised encounter with sender/time provenance; they do not silently amend the AI snapshot. Incomplete consented intake can be explicitly taken for clinician review. Draft, independent-assessment and release writes carry the source version shown to the clinician; an older workspace cannot sign newer answers. Patient reset/handoff broadcasts a content-free invalidation signal to other local tabs.
10. The launcher hashes the model and binary against operator-configured SHA256 pins before loading the model. The gateway validates the receipt, served path/context and unchanged file size/time before every assessment. This avoids rereading the large weights during inference on the 32 GB demonstration machine. This is a trusted local operator boundary, not a remote attestation claim. A single independently running worker serialises model jobs; transient outages use bounded backoff, output failures require explicit retry.

## Review

### Automatic report evidence design (26 September 2026, owner-authorised)

The owner explicitly replaces the earlier manual-verification prerequisite. S8 remains:
extractions are attributed proposals, never silently overwriting patient/clinician facts.
Include non-rejected text/vision extractions in preliminary AI, labelled unreviewed; keep
unverified manual transcriptions excluded and mark edits as manual provenance. Snapshot
report names, statuses, type, date, page, exact quotation and extraction provenance.

Serialize report completion/failure and assessment publication under the encounter lock.
For submitted encounters, report terminal transitions advance source version, cancel old
leases/jobs and enqueue a fresh snapshot. For intake still being edited, completion updates
report evidence without changing the patient-answer version; submission locks the same
encounter and freezes the current report set. Assessment claims defer while any attached
report is queued/running. Failed/empty reports produce explicit unavailable-source facts.
Never mutate a released plan. Test stale completions, multiple reports, partial failures,
deleted/withdrawn/released cases and unchanged corrections. New migration definitions and
text patches must assert their expected boundaries; do not rewrite applied migration files.

Version DRAFT prompts for report-type-aware extraction, attributed evidence, plain patient
language and possibility-specific uncertainty without a reusable example sentence. Reject
duplicate uncertainty and unsupported negative findings. Historical AI without compatible
prompt/source snapshots must not be presented as current; retain stored history and use
fresh fictional cases for the demo instead of silently rewriting old conclusions.

Keep the Important advice banner sticky and height-bounded while the patient scrolls,
without focus theft or blocked navigation. Hide missing-answer counts during active intake
until review/output; retain danger advice immediately. Remove footer content overlap.
Worker status distinguishes liveness from successful report/assessment RPC access, records
only safe error categories, and makes preflight fail during loss of backend access.

Independent internal source review identified required snapshot metadata, terminal-state
requeueing, pending/failure handling, manual-correction provenance, source-label and legacy
compatibility tests. These are incorporated above. The owner-supplied external review is
recorded as review input; its intermediate-state findings do not establish current failures
or clinical approval. Continue the same OpenSpec change; broader production gates stay open.

Final source review by the independent internal reviewer checked the migration, report
field validation, source snapshots, draft acknowledgement and worker health paths. The
initial SQL validation blocker was fixed; 503 SQL assertions passed. Follow-up found an
obsolete upload-side verification prerequisite; it was corrected to match automatic use
and the separately versioned `gi-privacy-2026-09-26` notice. Historical consent remains
unchanged. Both saved and unsaved drafts now survive changed report evidence and require
explicit review of newer facts before signing.

The actual demo-project rehearsal exposed excessive evidence IDs in a report-rich
Gemini response. Repair feedback now identifies only schema paths, codes and numeric
limits, never rejected values. A regression test covers truncation followed by excessive
citations and successful repair. The final DRAFT prompt `.4` further requires everyday
condition names and explanation of jargon. The display boundary rejects claims that
unavailable tests were never performed, as well as the prior unsupported no-mass wording.
Printed laboratory reference intervals are retained as source evidence, not hardcoded
clinical thresholds. Clinical review/approval remains outstanding.

Final prepared-case review found a second form of the missing-results error: "No ...
have been completed/performed". Three regression variants first failed, then passed with
the expanded guard; a negative control preserves valid unavailable-results wording. The
affected fictional example was regenerated through the existing versioned worker path.
The verifier restricts refresh to deterministic current-prompt synthetic clinic fixtures
without release, saved draft or independent review, and audits both read and refresh.
Independent source review found no concrete blocker in this focused follow-up. The actual
demo journey passed 25 checks and the final unit suite passed 172; broader independent
implementation and clinical approval gates are still open.

### Demo readiness correction (26 September 2026)

The owner approved processing the supplied PDF through the configured Gemini provider
and requested a current readiness assessment for a laptop/projector demonstration with
separate patient and clinician browser profiles. All 15 pages processed, yielding 87
unverified findings. Only audited processing metadata was inspected; uploaded content
did not enter source, logs, screenshots or coding-agent prompts.

Independent source review found that ReportLibrary progress/retry/no-op callbacks still
cleared the clinician's in-memory form despite the database no-op safeguard. Distinguish
refresh, upload, retry and verification callbacks, including the source version used by
the action. Same-version updates preserve form
text, dirty state and draft provenance. Only a successful local evidence change, made
against the form's current source version and without unsaved edits, resets/rebases
assessment fields; initialize
the replacement form at the deterministic urgency floor. Background changes retain the
old form and existing stale-version guard; unsaved edits are retained with that guard
even for local verification. Explain the changed-evidence reset before
verification. Exercise these cases through actual Auth/MFA and browser/API/database
boundaries on newly created fictional test encounters.

The review also identifies clinical DRAFT approval, real-data provider/residency,
document storage/retention, broader implementation review and operational deployment
evidence as production/pilot prerequisites. The supplied laptop/profile setup needs no
new origin or cloud resources. Keep tasks 5.3 and 6.7 open.

The independent internal reviewer approved the bounded design with requirements to retain
unsaved text and carry the action's source version. Both are implemented. Follow-up review
found no concrete blocker; its minor stale-error-display observation was fixed by clearing
the obsolete error after an intentional clean reset. This is a focused source review, not
a completed independent Claude review of the entire application. Actual browser recovery
checks cover retry/progress/no-op preservation, changed evidence with dirty text, clean
local verification, external source changes and short impression persistence. All 16 passed.
The full Gemini patient-to-clinician-release journey passed 27 checks. The production app
was rebuilt/restarted and all six runtime checks passed. See the dated readiness assessment
for remaining clinical, product, security and operational prerequisites.

### Questionnaire revision design (22 September 2026; DRAFT)

The owner authorises artifact revision and implementation. Replace generic yes/no bundles with separate facts and adjacent conditional follow-ups. Specific current danger facts require explicit symptom and timing/impact answers; never wait for unrelated questions. Separate fainting, lightheadedness and new confusion. Historical recovered fainting and intermittent pain between episodes cannot match current-collapse or current-severe-pain rules. Obstruction and biliary combinations require explicit same-episode context. Unknown/declined and missing follow-ups remain incomplete, with conservative advice and human review.

Use versioned JSON for questions, dependencies, options, help, rules, advice and provenance. Add generic dependency evaluation and multi-location input without clinical predicates in components. Every question permits unknown/declined and additional detail. When a parent changes, inactive answers remain identifiable as earlier answers but cannot contribute active rule matches or current AI facts. UI, schemas and database urgency evaluation use the same semantics. Old content stays immutable and supported by version in patient/staff views and queued jobs. A forward migration selects revised content for new encounters; old encounters are labelled as earlier questionnaires.

Urgency appears at the top of the flow as Important, with advice, reasons and source answers. It never replaces the question, steals focus, requires acknowledgement or disables Back/Continue/Save and pause. Answering must not delay seeking assistance. Advice remains available on pause, reports, review and output, including network/AI failure. Reject requiring multiple unrelated symptoms: specific current severe pain, sudden new confusion, inability to swallow saliva or active bleeding can warrant immediate advice after linked characterization. This is conservative navigation, not confirmation of an emergency or disease.

Clinical parameters are assumed local adaptations for synthetic testing, not validated Indian triage thresholds. Sources: NHS Stomach ache (https://www.nhs.uk/symptoms/stomach-ache/), Vomiting blood (https://www.nhs.uk/symptoms/vomiting-blood/), Fainting (https://www.nhs.uk/symptoms/fainting/), Sudden confusion (https://www.nhs.uk/symptoms/confusion/), Dehydration (https://www.nhs.uk/conditions/dehydration/), and Rectal bleeding (https://www.nhs.uk/symptoms/bleeding-from-the-bottom-rectal-bleeding/). UK service routing is adapted to clinic/hospital wording; clinical sign-off remains pending. No dependencies or model-generated triage are added. Gemini uses existing configuration and fictional verification only.

Independent Claude planning review completed on 22 September (task 7.1); full text is in ignored `var/reviews/hospital-demo-spec.json`. It does not approve clinical content or close 5.3/6.7/7.7.

Disposition: B1 uncertain overlap receives the existing `prompt` floor from positive component rules, never an inferred negative; explicitly different episodes do not establish the combination. B2 all danger domains now have scenarios and versioned rules, with named review/prompt/immediate advice. B3 unanswered, uncertain, declined and inactive answers remain distinct; source facts identify reporter/enterer and requested quantitative provenance. Existing reporter/enterer fields apply to the supplied intake; changing authorship requires recording the actual source rather than inferring it. B4 add rule version/population/source/adaptation/unknown handling and handover text. Verbal current functional severity deliberately differs from the lead's DRAFT numerical worst-pain bands: worst historical score never establishes current severe pain. Felt fever explicitly counts as reported fever, never a measured threshold; the ambiguous 100-degree threshold is not adopted. B5 existing neutral clinician-review advice remains the no-match state, never reassurance.

B6 and B10 are pre-existing independent-first/real-data readiness concerns, outside this correction: preserve existing operational restrictions and leave 5.3/6.7 open, with no claim of blinded or clinically approved use. B7 existing database source-version/lease checks reject stale publication; test both content versions and retain current advice on edited intake. B8 existing public start/consent/reviewer checks stay in force; this change stores no new pre-consent fields. B9 patient and verified-report facts stay separate, never overwrite one another. Nonblocking: add contradictory/reordered tests, preserve unknown TB information and no forced diagnosis; no report-based deterministic lab thresholds are invented. The proposed 25-case clinical validation remains for the clinical lead; synthetic regression coverage is not a substitute.

Additional independent Codex review (GPT-5.5, not the author): all 20 inventory areas are covered. Its planning findings were fixed: alternate vomit/stool blood appearances now have timing/amount follow-ups and immediate rules, and multi-select uncertainty is exclusive. Its implementation finding was fixed by reusing decoded, explicitly labelled earlier-answer summaries in patient output and clinician views. Per-answer supplier/enterer snapshots now preserve attribution when someone helps later. Unanswered questions and inactive-detail reconciliation are explicit in the AI source information. Software coverage and remaining clinical responsibilities are in `docs/clinical/questionnaire-revision.md`.

Owner-supplied Claude review received on 22 September 2026 identifies the wireframe gaps, patient-owned verification, missing public entry, insufficient AI reliability and the local model's unloaded vision projector. The owner explicitly authorised implementation of the expanded scope. This review replaces the earlier unresolved request to transmit planning documents; it does not constitute approval of subsequently written code or clinical content.

### Authorised revision (22 September 2026)

- Use a shared wireframe-derived design system with a patient stage rail, one-question screens, persistent Important advice without interrupting answers, pause/resume, prominent AI analysis and source details, and a separate clinician sidebar/worklist.
- Public `/start/<clinic>` creates an expiring encounter capability through a narrow server-only function with clinic assignment and an atomic per-clinic rate limit. Staff remains under `/staff`, protected by Auth, MFA and membership. No account is required for patient intake.
- Remove repeated demo disclaimers from normal product screens and model instructions. Keep fixture provenance in records and tests, DRAFT content metadata, honest AI authorship, and clinician sign-off boundaries. Explicit site data mode permits live records; tests continue using invented information only.
- Centralise provider configuration on the server. Adapters cover local llama.cpp, Gemini and compatible HTTPS deployments. Admins choose the configured provider for new requests. No provider fallback; live records enforce the existing India-routing requirement. API keys never enter browser bundles. Cloud credentials are supplied by the owner.
- Version assessment, semantic-check and extraction prompts. Use compact evidence aliases, explicit data delimiters, structured output, specific retry errors, semantic support checks and stable source IDs. Regex checks are defensive boundaries, never the source of report interpretation or generated assessments.
- Save uploads first and extract through a leased worker. Model reading handles native PDF text and rendered report pages/photos. Staff verifies, corrects or rejects source-linked proposals. Append-only revisions preserve evidence changes; verification advances source version, invalidates stale assessments and queues a fresh result when appropriate.
- Structured investigations and follow-up persist in clinician plans. Append-only assessment history and dimension-level AI evaluation records support review without modifying released patient plans.
- `@napi-rs/canvas` is pinned to render PDF pages for vision; no additional model or cloud resource is provisioned. Report bytes retain the existing bounded private Postgres storage. Moving historical files to private object storage and large-report resumable upload remain separate deployment work; no claim of hospital-scale storage readiness is made.

Verification for these revisions is tracked separately below and in `tasks.md`; earlier test totals are historical and are not treated as evidence for the new work.

The owner's supplied Claude review is the planning cross-review input. No independent review of the entire broader implementation has been completed. The questionnaire correction has the focused review recorded below. Keep the change open; the reviewer must check urgency scenarios against `docs/clinical/question-inventory.md`, patient/staff separation, report verification, stale publication and blind review boundaries. Automatic approval review separately declined rewriting the foundational synthetic-only operating policy; that policy remains intact. The owner explicitly approved the six tested migrations on the existing application project; they were applied on 22 September.

## Verification

The 22 September revision passed 80 unit checks, 183 SQL assertions, 35 hosted Auth checks,
nine public browser checks and a 25-check complete journey with actual local AI. Sixteen
screens were checked at three widths. The independent report worker read a fictional image,
renewed four leases and published 12 unverified source-linked findings in 104 seconds.
The browser run exposed and led to fixes for lazy heartbeat execution and feedback label
accessibility. Specific rejected wording now reaches generation retries, without clinical
text in routine logs. Manual review of generated text also prompted version `.2` instructions
against inferring a negative examination from absent evidence. This remains DRAFT content.
See `docs/reference/ai-providers.md` and ignored fictional artifacts in `var/ui-review`.

Earlier implementation verification follows for historical context only.

Test consent rejection, cross-site/cross-encounter access and denial audit, expired/revoked capabilities, clinician-only release, stale/duplicate job completion, unknown answers, all rule branches, unavailable/lower-urgency AI, unsupported evidence and private-note exclusion. Rehearse the real browser flow at desktop/tablet/phone sizes with the synthetic report and without reports, then live local model generation and clinician comparison/release. Preserve open foundation readiness gates.

Completed locally: full real-Auth browser rehearsal with actual local inference (23 checks),
focused cross-tab reset rehearsal (5 checks), and a subsequent clinician workflow rehearsal
with deliberately unavailable AI. Original PDF rendering, 16 extracted proposals,
verification, source-backed output, clarification, independent assessment and separate
patient release were exercised. Software tests do not establish clinical accuracy.

### Final questionnaire review and verification

The independent Claude implementation review is saved in ignored `var/reviews/questionnaire-implementation.json`. Both blockers were fixed: Important advice persists on About you after Back/reload, and all modes render authored labels verbatim. Versioned assisted-entry help explains the patient perspective without transforming clinical text. Regression checks cover both behaviors.

Other fixes: inactive/unasked/note-only summaries are distinct; unknown queue versions show priority unavailable; loaders validate supported content before rendering; shared types and per-version advice avoid legacy casts and mixed advice. A read-only parity check found display-only fields and noticeVersion had drifted in the previous bundle; the bundle was restored from its immutable stored document. Clinical legacy questions/rules were unchanged. All three documents now compare identically on both databases.

Draft .2 preserves .1 and the original document. It adds alternative bleeding amount/retching, removes exact right-upper location as a requirement for current same-illness pain/fever/yellowing, and completes source metadata. The source catalog distinguishes brief original recommendations from assumed local thresholds. Fever chills are recorded history; they do not independently establish an emergency. Free-text details do not drive hidden clinical predicates.

Independent Codex review found that stale clients could omit per-answer provenance. The second forward migration now preserves the stored supplier/enterer for unchanged answers/notes and fills declarations for new answers. Actual capability-RPC tests cover omitted maps and changed assistance. A final read-only Codex (GPT-5.5) review found no remaining concrete blockers in this correction. Automatic approval review declined a repeat external Claude transmission of source and clinical drafts; that invocation was not performed. The completed first Claude review and internal follow-up are reported distinctly.

Final software evidence: 130 unit checks including 50 contextual cases; 419 isolated SQL assertions with deliberate-failure/rollback runner check; 12 responsive mocked browser cases; one completed real fresh fictional production-app visit; build, typecheck, lint and all six runtime preflight checks. Gemini inference passed evidence/semantic checks using fictional sources. The two migrations were applied to the existing test and demo projects after verification; app/worker restarted and live version parity verified. Broader tasks 5.3/6.7 and clinical sign-off remain open; no archive or clinical validation claim.
