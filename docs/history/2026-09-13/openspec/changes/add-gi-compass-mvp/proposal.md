## Why

Patients in India with suspected serious GI disease arrive at a specialist consultation with an
unstructured verbal history, so the first 20 minutes of a scarce GI surgeon's time goes to triage
that could have been collected beforehand. GI Compass captures that history through a guided,
image-assisted, adaptive questionnaire and turns it into a structured pre-assessment — but because
India's Telemedicine Practice Guidelines 2020 bar AI from independently diagnosing or consulting,
the assessment is explicitly *decision support for a Registered Medical Practitioner (RMP)*, never
a diagnosis delivered to the patient. This change builds the Phase 1 MVP: the whole patient →
AI-assisted summary → doctor review → doctor-released result loop, with the regulatory guardrails
built into the architecture rather than bolted on later.

## What Changes

- **New product, greenfield.** No existing behaviour is modified or removed; nothing is **BREAKING**.
- Patients can register with email + password, verify their email, and manage a single identity that
  Phase 2 OAuth providers will link into rather than replace.
- Patients grant **granular, versioned, independently revocable consent** per processing purpose
  (account data, AI-assisted analysis, sharing with the assigned doctor). Required by DPDP Act 2023
  and DPDP Rules 2025, which treat health data as sensitive personal data needing a clear
  affirmative action per purpose and withdrawal as easy as granting.
- A **configuration-driven adaptive questionnaire engine** evaluates branching rules over a versioned
  question bank, so clinical admins change the clinical content without a code deploy. This is the
  single highest-leverage architectural decision in the project: one engine serves every disease
  pathway instead of one hardcoded form per disease.
- Questions can carry **reference images** (stool-form chart, body map, blood-appearance comparison,
  jaundice reference) from an admin-managed, CDN-served, responsively sized asset library, because
  patients answer on phones on patchy mobile data.
- Patients **upload prior reports** (PDF/JPEG/PNG/DOCX) into encrypted object storage in an India
  region, reachable only through short-lived signed URLs, AV-scanned on upload, and passed through
  an OCR + LLM extraction step whose output is labelled AI-generated and unverified.
- A **deterministic red-flag rule engine** runs synchronously on every answer as it is submitted and
  can raise an emergency escalation *without waiting for, or depending on, the AI pipeline*.
- An **AI assessment pipeline** compiles a structured clinical summary, retrieves grounding chunks
  from the doctor-curated knowledge base (RAG over pgvector), calls an LLM under a strict system
  prompt, and **validates the response server-side against a fixed JSON schema** before it is
  allowed to touch the database. The schema has no `final_diagnosis` field and cannot acquire one.
- A **doctor review dashboard** shows the raw answers, the uploaded documents, and the AI assessment
  on one screen; the doctor edits, annotates, overrides, and finalizes. Releasing to the patient is
  an explicit, confirmed action — never automatic.
- A **clinical admin console** for the question bank, branching rules, reference images, disease
  taxonomy, and knowledge-base entries, with version history and a patient's-eye preview mode.
- **Audit logging and consent checks are enforced in the data-access layer**, so every read or write
  of patient clinical data is recorded with actor, action, and timestamp, and no clinical processing
  runs on a purpose the patient has not consented to.
- Transactional **email notifications** for verification, submission, review-ready, and password reset.
- All patient-facing copy runs through an **i18n layer (English + Hindi)** from the first commit,
  because retrofitting this is expensive.

## Capabilities

### New Capabilities

- `identity/user-auth`: registration, email verification, password hashing and policy, session
  issuance and refresh, password reset, optional MFA for privileged roles, and an identity model
  that Phase 2 OAuth links into.
- `identity/access-control`: role definitions (patient, doctor, clinical admin, platform admin) and
  API-layer RBAC including doctor-to-patient assignment scoping.
- `privacy/consent`: versioned per-purpose consent records, grant and withdrawal, and the gate that
  blocks processing for a purpose without an active grant.
- `privacy/audit-log`: append-only audit trail for every access to patient clinical data.
- `privacy/data-subject-rights`: access, correction, and erasure request handling and retention
  policy enforcement.
- `questionnaire/engine`: question bank, question types, branching-rule evaluation, adaptive path
  computation, autosave/resume, and adaptive progress reporting.
- `questionnaire/reference-images`: the reference image asset library and its delivery contract.
- `intake/case-management`: the case lifecycle from creation through submission, AI processing,
  doctor review, and release.
- `intake/document-upload`: upload, AV scanning, encrypted storage, signed access, and the OCR +
  LLM extraction pipeline.
- `safety/red-flag-triage`: deterministic emergency rule evaluation and the escalation experience.
- `assessment/ai-pipeline`: clinical summary compilation, knowledge-base retrieval, the guarded LLM
  call, server-side schema enforcement, and model/prompt/KB version pinning.
- `assessment/knowledge-base`: doctor-authored knowledge entries, versioning, embedding, and the
  disease taxonomy they are tagged against.
- `review/doctor-dashboard`: the review queue, the single-screen case view, inline override, the
  edit-diff feedback loop, and the confirmed release action.
- `admin/clinical-content`: authoring, versioning, preview, and publication of clinical content.
- `platform/notifications`: transactional notification delivery and its templates.
- `platform/localization`: the i18n contract for all patient-facing text.

### Modified Capabilities

None — this is the first change in the project.

## Impact

- **New code**: an npm-workspaces monorepo — `apps/web` (Next.js App Router UI + REST route
  handlers), `packages/core` (framework-free domain logic: questionnaire evaluation, red-flag rules,
  consent policy, AI output schema), `packages/db` (Prisma schema and client), `services/ai`
  (Python FastAPI: RAG, OCR, structured LLM call).
- **New infrastructure**: PostgreSQL 16 with the `pgvector` extension; S3-compatible object storage
  in an India region; an SMTP/transactional-email provider; an anti-virus scanner for uploads; an
  LLM provider with structured-output support.
- **New external dependencies**: Prisma, Zod, Auth-related crypto (Argon2id), Tailwind,
  `next-intl`, `sentence-transformers`/embedding client, `pytesseract` or a managed OCR API, the
  Anthropic SDK.
- **Data**: introduces the full clinical schema (users, consent records, questionnaire templates,
  questions, branching rules, cases, responses, uploaded documents, AI assessments, doctor reviews,
  knowledge-base entries, audit log). All of it is sensitive personal data under DPDP.
- **Operational**: retention and deletion jobs, audit-log retention, a grievance-redressal contact,
  and a privacy notice must exist before any real patient data is processed.
- **Out of scope of the code but blocking public launch**: a regulatory/legal opinion on CDSCO
  software-as-a-medical-device classification and DPDP data-fiduciary obligations.

## Non-goals

- **No autonomous diagnosis.** The system never produces a final diagnosis, and the AI output schema
  has no field capable of holding one. Only a doctor's finalized review may state a clinical
  impression, and even that is phrased as pending any in-person confirmation the doctor requires.
- **No prescribing of any kind.** No feature outputs a medication, dose, or treatment plan. Any
  prescription is authored entirely by the doctor outside this AI path.
- **No patient-visible raw AI output.** The patient sees only what the reviewing doctor has
  explicitly released. (Default per open Decision A; revisit only with the clinical co-founder.)
- **No AI-triggered emergency handling.** Emergency escalation is deterministic and synchronous; the
  AI pipeline is never on its critical path.
- **No minors in Phase 1.** DPDP requires verifiable parental consent under 18; the guardian-consent
  flow is deferred (open Decision E).
- **No fine-tuning on patient data.** Improvement happens through the doctor-edit feedback loop and
  knowledge-base curation, which are auditable; model training on clinical records is not in scope.
- Not in this change: OAuth sign-in, SMS/WhatsApp notifications, the React Native app, ABDM/ABHA
  integration, multi-clinic tenancy, and second-opinion workflows — these are Phase 2+.
