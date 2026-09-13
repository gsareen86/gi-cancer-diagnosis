# GI Compass — current product brief

Decision date: **2026-09-13**. Owner input: the attached clinician discussion and the
owner's 18 answers. This brief supersedes the previous early-care product direction.
It does not claim that early cancer detection is impossible; early detection is simply
outside this product's intended use and evaluation.

## Intended use

**GI Compass structures an adult patient's GI symptoms, history and optional existing
reports, helps a clinician review possible causes, the appropriate specialty and
urgency, and provides clinician-approved next-step instructions to the patient.**

The first question it helps answer is “What type of doctor is appropriate for this
problem?” The AI may consider serious causes, including specific malignancies, in
the clinician workspace. A hypothesis is not a diagnosis, calibrated probability,
stage or statement of resectability.

## Decisions now settled

| Area | Current decision | Consequence for the build |
| --- | --- | --- |
| Builder | Owner, using Claude Code/Codex and OpenSpec | Retain a maintainable monorepo; one bounded change and evidence record per session. |
| IP | Owner intends to own the IP | Record separately from data rights; an agreement, not application settings, documents title and clinical contributions. |
| Operating entity | Owner's existing IT services company | Configurable legal name/contact in notices; no invented company name. |
| Data role | Company proposed as primary data fiduciary | Record actual purposes and each site's role before real-data use; a unilateral designation is not the full agreement. |
| Funding | Self-funded; hospital payment explored after pilot | No paid OTP, payment module or speculative revenue assumptions. |
| First sites | Clinical lead's own clinic and Metro | Separate site/encounter permissions; Metro remains proposed, not approved or a claimed partner. Apollo is not a first-site requirement. |
| Intake | Patient self-service and coordinator-assisted tablet | Encounter-scoped sessions, assistance provenance and explicit handover/reset between people. |
| Form factor | Responsive web for desktop, tablet and phone | Desktop is a full workspace; tablet is a guided encounter. “Phone” is responsive web, not a native app or WhatsApp integration. |
| Differential | **Clinician-only in v1** | Latest answer supersedes earlier discussion about displaying possible cancer causes to patients. Block raw/edited AI differential from patient APIs, PDFs and messages. |
| Patient output | Reviewed specialty, reason for referral, urgency and actions | Type of doctor, not a list of named doctors; no autonomous release. Previously confirmed diagnoses can be stated as documented history. |
| Reports | Optional, included in v1 | Clean PDFs/scanned PDFs and readable photos of existing reports; CT/MRI written reports, endoscopy, pathology, labs and prior summaries. No report is a valid intake. |
| Report quality | Detect quality problems and ask for a clearer copy | Quality heuristics assist capture; they do not verify clinical meaning. Keep originals and allow clinician manual review. |
| Demo hosting/model | Local machine/local inference | Use synthetic examples by default; no patient files in source, fixtures, AI coding tools or screenshots. |
| Pilot hosting/model | Indian servers/data centres; Azure OpenAI | Verify model, deployment type, processing geography, storage, logging, support and backups. An India resource label is insufficient evidence. |
| Model data minimisation | Final handling subject to site guidance | Default to minimised structured facts without direct identifiers. Do not claim free text or scans are automatically de-identified. |
| Clinical ownership | Brother-in-law authors/signs wording, coded values and hard urgency rules | Draft → review → approved immutable version. His name, role and dated approval are real inputs, never seed-script inventions. |
| Pilot outcomes | Clinical agreement + OPD time saved | Define denominators, independent reference and timing protocol before recruitment; capture errors and staff effort too. |
| Emergency behaviour | Advice only | Persistent “seek immediate assistance / visit a doctor or hospital”; no calling, SOS, contact notification or dispatch. AI must not delay or weaken it. |
| Images | Metro assets later; licensed candidates/placeholders now | Visible descriptions and honest placeholders; separate licensing from clinical approval. |
| OTP | Deferred | Keep staff account security; encounter access need not require a patient's email account. |

## The complete v1 encounter

1. **Prepare:** authorised staff selects the site, creates/checks the encounter and
   confirms the correct patient. Patient identity is separate from staff identity and
   from the person holding the tablet. The patient sees the notice and consent choices.
2. **Capture:** self-service or assisted mode records who supplied each answer. A short
   universal safety assessment runs independently of symptom branches. Follow-up
   questions cover the actual symptoms; unknown and declined remain explicit.
3. **Add existing evidence:** optional reports can be added when convenient. Patients
   without reports continue. Staff can help with a blurred page; the app does not tell
   a patient to buy investigations merely to finish intake.
4. **Prepare the clinician view:** show a factual summary, source-linked findings,
   medication/history timeline, missing or conflicting information, and the rule-based
   urgency floor even when AI is unavailable. Summaries label reported diagnoses.
5. **Review:** clinician first records an independent specialty/urgency assessment for
   evaluable pilot cases, then reveals the AI hypothesis and routing suggestion. They
   can agree, disagree with a coded reason, request clarification or proceed without AI.
   Necessary safety information is never hidden for measurement.
6. **Release:** clinician edits the patient actions and explicitly signs a source-version
   snapshot. The patient receives the specialty type, understandable rationale, urgency
   instructions and what existing material to carry. The differential stays clinician-only.
7. **Finish:** explicitly end/reset the tablet session. Record care progress separately
   from “read the summary”. Reading or downloading does not prove attendance or benefit.

## Clinical and data boundaries

- Hard safety logic is deterministic and sourced from clinically approved versioned
  rules. AI can recommend greater urgency; it cannot lower the floor. Timeframe wording
  can be contextual, with a structured constraint checked before review/release. There
  are no developer-invented universal four-band deadlines.
- Unknown safety answers or an abandoned form must not become “routine” or “no serious
  illness”. Provide conservative completion guidance and staff handover. Rule reachability
  is only software coverage, not clinical sensitivity or correctness.
- Machine extraction is a proposal with document/page/source text and verification
  status. It cannot silently overwrite a patient answer or a clinician correction.
  Normal-looking values, low-quality OCR and absent reports cannot rule out disease.
- Clinical thresholds, question text/options, specialty mappings and curated guidance
  are versioned content. Engines and formatting code remain code. AI reasoning still
  depends on model/prompt versions; do not pretend a data-driven engine makes it fully
  deterministic. Do not invent “India-weighted” numerical priors.
- Input amendments invalidate stale AI/review snapshots. Staff permissions, subject
  permissions, purposes, audit access and site scopes apply on the server and workers.
- No broad training permission is inferred from consent to care, a report upload, a
  clinical colleague's access or “personally sourced” records. Retrospective evaluation
  and prompt development require their own documented authority/purpose.
- Adults are the initial implementation assumption, consistent with the inherited app.
  A minor/guardian or adult lacking decision-making capacity requires a separately
  approved authority workflow; a coordinator cannot act as a substitute decision-maker.

## Open decisions and when they matter

These do not block synthetic development. They do block the associated patient-data
operation. The owner has not been asked to answer them again during this reset.

| ID | Still needed | Owner / gate |
| --- | --- | --- |
| D01 | Legal entity name, privacy contact, agreements documenting IP and clinic/Metro processing roles | Product owner/legal; before notices or real-data activation |
| D02 | Metro site authority and whether the evaluation needs ethics/research/service-improvement review | Clinical lead + Metro; before recruitment there |
| D03 | Retention by data class and purpose; pilot-end return/export, deletion or lawful hold, backups and vendor copies | Company + sites; **before first pilot record**, not after the pilot |
| D04 | Exact Azure model/version/SKU, geography and capacity; abuse monitoring/storage terms and residency evidence | Company infrastructure/privacy owner; before model egress |
| D05 | Site-approved minimisation/de-identification process and authorised uses of historical cases | Company + clinical lead/site; before importing or reusing any real case |
| D06 | Named reviewing RMP and coordinator permissions, available hours, absence cover and local response workflow | Clinical lead; before supervised use |
| D07 | Sample size/volume, enrollment criteria, comparator protocol and numerical success thresholds | Clinical lead + owner, ideally independent evaluation reviewer; before pilot measurement |
| D08 | Initial English/Hindi approvals, question/value-set/rule sign-off, image rights and approved clinical usage | Clinical lead; before publishing the relevant version |
| D09 | Intended-use/regulatory assessment and relevant professional/site approvals | Owner + qualified adviser/clinical lead; before real-data deployment |

## What success means

Use the [measurement protocol](pilot-measurement.md). Clinical agreement is reported by
dimension with disagreements and unevaluable cases, not an invented composite accuracy
score. OPD savings compare a declared baseline with measured active clinician time,
including review and corrections, while showing coordinator effort separately.
Synthetic test results and one clinician's preferences cannot prove patient benefit,
clinical safety, willingness to pay or generalisable diagnostic accuracy.

## Authority and evidence

This file records **product decisions**, not hospital permission or clinical approval.
Technical and regulatory assumptions are explained in the [evidence notes](evidence-notes.md).
The implementation sequence is in [implementation-plan.md](implementation-plan.md).
