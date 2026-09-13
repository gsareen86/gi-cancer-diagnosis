## Why

GI Compass needs to help adults and their families act on persistent gastrointestinal symptoms and bring a coherent history to an appropriate clinician. The primary journey is a person with symptoms, repeated self-treatment or previous consultations, and possibly no reports. The clinical owner is a busy GI surgeon; his availability does not establish a staffed triage service.

The existing application provides a useful foundation, but the reviewed implementation has gaps in clinical-history propagation, question-path coverage, reliable background execution, recoverable review work, and follow-through. Test-suite success is engineering evidence, not evidence of clinical effectiveness, adoption, or willingness to pay.

## User refinements — 2026-09-06

- Mobile OTP/paid provider integration is deferred; retain existing email authentication.
- Optional MRI, CT, endoscopy and other existing reports remain a prominent clinician capability.
- Verify wide desktop layouts as well as mobile; do not constrain the clinician canvas to a phone-width column.
- Research reusable reference images and record rights; use honest text-supported placeholders pending hospital-supplied assets and clinical approval.
- Implement on codex/early-gi-care-journey and preserve the pre-existing working tree.

## What Changes

- Build a symptom-first, caregiver-aware journey with optional reports, existing email authentication (mobile OTP deferred), approved language content and explicitly unknown answers.
- Introduce a shared safety-assessment layer with clinically reviewed follow-ups and patient-path tests. Advice remains synchronous and independent of AI.
- Make emergency handling advice-only, including a clear instruction to seek immediate in-person assistance and not wait for app review. Remove emergency calling, SOS, contact-notification promises and related collection.
- Compile the complete, source-attributed record into a useful brief even when no reports or AI output exist.
- Retain the current Navigator workspace; add explicit review start, server autosave, concise actions, request-information threads, mobile queue cards and identified, immutable released letters.
- Add durable jobs and a transactional outbox early. Complete availability-aware assignment, operational ownership, secure production storage, document inspection, privacy fulfillment and delivery recovery before external service use.
- Build a small clinical authoring workflow with draft, preview, review, publish and version rollback; include bilingual wording, image rights and a curated guidance register.
- Track recommendations, reported attendance, outstanding results and barriers separately from reading a summary.
- Establish offline evidence gates and a realistic work breakdown. No real clinic observation or supervised pilot is assumed.

## Capabilities

### New Capabilities

- `care/follow-through`: recommendation ownership, progress, barriers and closure independent of summary acknowledgement.
- `platform/background-jobs`: durable jobs, delivery outbox, retries, leases, operational failures and idempotency.

### Modified Capabilities

Preserve the established nested paths. The delta files use additional requirement names because this checkout has no canonical `openspec/specs` directory; Phase 0 must reconcile the two existing unarchived changes before formal merge/archive.

- `safety/red-flag-triage`: actual-path coverage, advice-only escalation and incomplete-assessment handling.
- `intake/clinical-history`: full history, symptom trajectory, provenance and amendment snapshots.
- `intake/case-management`: report-optional intake and explicit submission/service receipt.
- `identity/user-auth`: existing email access and separate actor, patient and authorized caregiver.
- `review/doctor-dashboard`: concise brief, recoverable review, clarification and release identity.
- `assessment/ai-pipeline`: complete source-bound inputs, private optional AI and verified extraction.
- `admin/clinical-content`: clinical scenario approval, language approval and executable publication gates.
- `privacy/data-subject-rights`: operational fulfillment and lawful retention exceptions.

## Non-goals

- Autonomous diagnosis, prescribing, cancer probability scoring, staging or resectability determination.
- Patient-facing raw AI output.
- Emergency telephone links, ambulance dispatch, automatic SOS, emergency-contact notification or a facility-capability finder.
- A new e-prescribing module. Preserve existing physician-authored signed historical content; do not delete or reinterpret it.
- A native mobile app, full WhatsApp chatbot, mandatory voice intake, DICOM interpretation or hospital EHR replacement.
- Requiring CT, tumour-marker testing, biopsy or other investigations before a patient can seek a consultation.
- Marketing claims of validated early cancer detection, proven clinician time savings, hospital endorsement or demonstrated commercial demand.
- Assuming a receptionist, coordinator, fellow or on-call team exists.

## Impact and Constraints

Retain Next.js, TypeScript domain logic, PostgreSQL/Drizzle, Python AI service and the existing local-model adapter. Add a separate worker using PostgreSQL-backed durable state; select a maintained queue implementation during Phase 0. Keep clinical facts, audit records, consent and released versions intact through additive migrations.

All clinical reads and writes require appropriate actor authorization, purpose checks and audit behavior, including worker execution and caregiver actions. Approved India-region processing is existing project policy. Legal applicability and product classification must be assessed against the actual intended use; internal deployment is not an automatic regulatory exemption. Do not claim certification from architectural controls.

Current user instructions supersede conflicting pending specifications: emergency calling/contact actions, automatic closure on acknowledgement, automatic review-start on opening, and mandatory frozen-with-no-amendment workflows are replaced as specified in the design.

## Evidence and Readiness

This is a planning change, not an implementation or clinical approval. The detailed roadmap is in `docs/early-gi-care-implementation-plan.md`. OpenSpec CLI was unavailable on 2026-09-06 and was not available in the offline npm cache. Artifacts are written in the established spec-driven format; official CLI validation remains an explicit task.
