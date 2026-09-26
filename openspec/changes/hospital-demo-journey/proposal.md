# Hospital demonstration journey

## Why

The owner requested a professional application matching the supplied wireframes, with AI analysis central to an end-to-end patient and clinician journey. The supplied Claude review identified missing states, patient-owned report verification, brittle prompts and a staff-only entry path. The authorised revision addresses these gaps and adds selectable model providers. Verification uses fictional records; software tests do not establish clinical validity or replace site deployment approval.

## What Changes

- Extend the existing Cloud Supabase foundation with audited, site-scoped synthetic encounters, expiring patient handoffs, saved intake, report evidence, durable AI jobs and distinct clinician releases.
- Implement the complete responsive patient and clinician journey using the owner's wireframes. Supply realistic fictional cases and a synthetic whole-body laboratory report for rehearsal; support cases without reports.
- Draft versioned questions and universal danger checks from the question inventory. Unknown remains unknown; immediate advice is independent of AI and has no calling/SOS action.
- Connect local multimodal llama.cpp, native Gemini and compatible adapters through the server-side gateway and independently running durable worker. Version generation, extraction and checking prompts; display actual status/failures and preserve model provenance.
- Provide public no-login patient entry, a separate authenticated staff workspace, adaptive one-question intake, persistent Important advice with continued answering, pause/resume, source-detail views and structured clinician plans/feedback.
- Automatically use source-linked machine-extracted report findings in preliminary assessment, with extraction/human-review provenance and optional staff correction/rejection. Retain append-only evidence and assessment history and process PDF/photo reports through the selected model. Regex remains an output boundary, never the report interpreter or assessment generator.
- Provide an operator preflight, rehearsal instructions and end-to-end checks.

## Capabilities

### New Capabilities
- `hospital-demo`: Synthetic patient intake, optional report evidence, preliminary AI assessment, clinician comparison/release and rehearsal operations.

### Modified Capabilities
None. Foundation controls remain in force.

## Impact

Next.js UI/routes, forward SQL migration, local model worker, test fixtures and operator scripts. No new cloud project, paid service, Docker, mobile OTP, real patient ingestion or e-prescribing. The owner explicitly authorises the integrated build; prior roadmap sequencing is consolidated for this demonstration. Foundation external implementation-review/CI/log-retention gates remain honestly open.

## Invariants

S1–S4: deterministic, explained urgency floor; no reassurance/probabilities; all cases assigned, only clinicians release/close. S5: preliminary patient AI and clinician output are distinct, source-versioned. S6–S7: generic pre-consent advice; consent before storage, unknown/partial/unavailable handled explicitly. S8: reports remain source-linked proposals until verified. S9: model explicitly considers abdominal TB without forcing a diagnosis. S10: all clinical content is versioned DRAFT with provenance and no agent approval. D1–D3: atomic audited RPC access, per-site RLS, encounter-scoped patient capability and versioned consent. D4: existing India Cloud projects and explicitly configured local gateway only. D5: fictional records/reports only, no clinical payload logging.

## Owner-requested questionnaire correction (22 September 2026)

Replace broad binary danger screens and the compulsory urgent page with linked, time-specific questions and an accessible Important banner. Review the complete inventory: pain onset/current severity/recurrence/episode length, vomiting frequency/appearance, fever measurement, reflux, jaundice, itching, bowel/stool/bleeding, swallowing, appetite/weight, history and care timeline. Provide contextual options, unknown/declined states and optional patient detail. Establish whether concerning symptoms occur now and together; never infer an acute event from unrelated historical answers. Preserve immediate advice for specific danger facts without claiming the questionnaire confirms an emergency. New content remains DRAFT with source/provenance metadata. Pin historical encounters and jobs to their original content. Verify the supplied Gemini configuration through the existing gateway with fictional data only; no new services or changes to real-data residency controls.

## Intake burden and clinician save correction

The owner reports that the expanded questionnaire feels endless and independent assessment saving returns a generic error. Add a shorter main intake, named topic progress, optional detail and reliable resume. Preserve all active rule inputs and their dependencies, wording, values and urgency rules; unanswered information stays explicit. Permit nonempty short clinical impressions, with accessible field-level validation and matching database checks. Verify the synthetic reported visit without rewriting the clinician's assessment or exposing clinical text in diagnostics.

## Report processing correction
The owner also reports a readable PDF that appears unprocessed. Repair text-first extraction, explicit processing feedback and safe staff retry within the existing report workflow. Verify using generated fictional reports; explicit approval is needed before replaying the supplied upload through Gemini.

## Owner-requested automatic report evidence and review corrections (26 September)

Remove the mandatory staff-verification gate. Interpret written laboratory, ultrasound,
CT, MRI, endoscopy, pathology and other test-report findings according to their recorded
type and date; never interpret radiology pixels or infer missing results. Preserve the
original source quotation, page, extraction provenance and unreviewed status. Complete
report processing must reach a fresh, versioned assessment snapshot automatically.
Queued/running reports defer AI assessment; failed reports remain explicitly unavailable
and do not block human care. Optional staff correction/rejection still invalidates older
evidence snapshots. Keep clinical content DRAFT and clinician release independent.

Reconcile the supplied review with current evidence, fix banner visibility/early missing
counts, footer overlap, generic uncertainty wording and worker health reporting, suppress
incompatible legacy AI displays, rehearse actual demo-environment inference with fictional
records, update the operator guide, then commit and push the reviewed application without
credentials or private runtime data. No new cloud resources or real-data activation.


## Non-goals

Clinical accuracy claims, autonomous confirmed diagnosis, hospital branding/affiliation claims, AI interpretation of radiology images, cancer staging/resectability, medical prescriptions, emergency dispatch, production patient launch, offline Cloud replacement and patient identity/account enrolment.
