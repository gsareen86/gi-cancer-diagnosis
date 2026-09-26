# GI Compass: product brief

Decisions as of **2026-09-13**. This file is the product authority. The safety and data
invariants live in [`openspec/config.yaml`](../openspec/config.yaml) so every change carries them.

**Demonstration update, 21 September 2026:** the owner requested a complete synthetic
walkthrough for Rajiv Gandhi Cancer Institute's Medical Superintendent. The integrated
`hospital-demo-journey` change connects the existing foundation through intake, optional
reports, actual local AI and clinician comparison/release. This demo audience does not
change the agreed pilot sites or establish hospital approval. See [rehearsal guide](demo-rehearsal.md).

## Why

GI cancer patients commonly reach a GI surgeon late. Most of the delay happens before
hospital contact: symptoms not recognised as serious, or months of treatment for "acidity".
The pilot starts where patients already arrive (the clinical lead's clinic and Metro
Hospital OPD) and builds the instrument that later extends to referring physicians.

## What GI Compass is

A clinic intake and review tool. On a tablet, a patient (alone or helped by a coordinator)
answers a structured questionnaire and optionally adds existing reports. Intake and review
must remain usable when no reports exist. The system extracts report
findings, applies clinician-authored urgency rules and prepares an AI-assisted analysis.
Patients receive an **AI-generated preliminary assessment before clinician review**, including
possible diagnoses, factual reasoning, uncertainty, appropriate specialty and urgency.
A clinician separately reviews the encounter and issues their own assessment and next steps.

This records the owner's F9 correction: individual clinician approval is not a prerequisite
for the initial AI assessment. It must be labelled preliminary and unreviewed, never presented
as a confirmed diagnosis, cancer-risk score or screening result. No output implies serious
disease has been excluded. All consented cases remain in the clinician queue.

## Intended use (DRAFT: needs regulatory consultant review)

> GI Compass collects an adult patient's gastrointestinal symptoms, history and existing
> optional medical reports. It provides the patient an AI-generated preliminary assessment
> with possible diagnoses, supporting facts, uncertainty and recommended care navigation,
> without waiting for individual clinician approval. A registered medical practitioner
> separately reviews the encounter and records their assessment and next-step instructions.
> The automated assessment is not a confirmed diagnosis or validated screening result.

The addition of patient-facing diagnostic hypotheses materially changes the intended use.
Reassess clinical validation and regulatory classification for this functionality rather
than relying on the earlier clinician-only wording. The existing real-data readiness review
must cover it; a synthetic demonstration is not authorisation for patient deployment.

## v1 scope

1. **Tablet encounter:** staff starts an encounter; patient self-service or
   coordinator-assisted; every answer records who gave it and who entered it.
2. **Consent:** versioned DPDP notice and consent before any clinical data.
3. **Questionnaire:** clinical-lead content, branching, unknown/declined answers,
   save and resume, conservative output at any abandonment point.
4. **Optional report upload:** clean PDFs, scans and photos that pass a quality gate (retake on
   failure); source-linked extraction proposals may inform preliminary AI without a staff
   verification prerequisite (owner decision, 26 September 2026). Preserve extraction and
   optional human-review provenance; staff can correct/reject findings. The clinician's
   independent assessment and release remain separate.
   No-report, unreadable-report and failed-extraction paths still reach clinician review.
5. **Urgency floor:** deterministic rules and immediate-care advice, independent of AI.
6. **Preliminary AI assessment (patient-visible):** possible diagnoses and concise reasoning
   tied to patient answers and attributed report findings, what is uncertain, specialty and next steps. Display
   AI authorship, creation time, source version and "not yet reviewed by a clinician".
7. **Automated output checks:** schema, factual support, urgency floor and presentation
   checks before patient display. A second model may assist checking but cannot certify
   correctness or replace these checks. Unsupported/failed output yields an unavailable
   assessment with appropriate advice and queued review.
8. **Clinician review:** worklist, independent assessment before revealing AI, approve,
   edit or disagree with a coded reason, release.
9. **Outputs:** a preliminary patient AI assessment and a later clinician-reviewed navigation
   letter, each pinned to its source snapshot and visibly distinguished. Clinician internal
   notes remain private. Superseded outputs retain their version and status.
10. **Pilot telemetry:** completion and abandonment, AI–clinician agreement, OPD time.

Web only: a full clinician workspace on desktop, guided intake on tablet, and usable phone
layouts. Each is designed for its device, not a phone column stretched across a monitor.

**UI direction, 15 September 2026:** use the owner's 19 mockups in `docs/ui wireframes`
as the visual reference when building the applicable screens. See
[UI reference and adaptations](reference/ui-reference.md). They do not override the clinical
invariants or approve draft wording; foundation uses the staff login/MFA references first.

## Not in v1

Confirmed autonomous AI diagnoses or probabilities · screening or early-detection claims ·
public-facing website · referring-GP channel · WhatsApp or native apps · ABDM integration ·
e-prescribing · named-doctor recommendations · emergency dispatch (the tool advises only).

## Decisions

| Area | Decision |
| --- | --- |
| Builder | Owner, solo, with Claude Code and Codex in VS Code; OpenSpec spec-driven development |
| IP | Owned by the owner |
| Entity and data fiduciary | Owner's IT services company is the primary data fiduciary; the clinical lead collects pilot data; site roles to be documented |
| Funding | Self-funded; hospital payment explored after the pilot |
| Pilot sites | Clinical lead's own clinic and Metro Hospital. Metro not yet approached; that happens once a working demo exists |
| Intake | Tablet, patient self-service and/or coordinator-assisted |
| Primary output | Patient-visible preliminary AI assessment with reasoning and navigation; subsequent clinician assessment; urgency floor throughout |
| Differential | Possible diagnoses may be shown to the patient as preliminary AI hypotheses, including serious conditions when supported by facts; never a confirmed diagnosis or likelihood score |
| Reports | Optional existing reports: clean PDFs, scans and photos above a minimum quality, checked with open-source image-quality tools. No-report intake remains a supported path |
| Clinical content | Clinical lead writes and signs off patient wording, coded value sets and urgency rules |
| Hosting | Web app and LLM on the local machine for the demo; database/Auth/Storage in the owner's **Supabase Cloud** account. No local Docker Supabase. Use separate approved synthetic demo/test and later pilot projects, with India region (e.g. Mumbai) verified; credentials supplied in ignored `.env` |
| Models | Demo: local LLM through the LLM Gateway. Pilot: Azure OpenAI, **regional** deployment in an India region (Global and DataZone deployment types can process outside India) |
| Stack | Next.js + TypeScript; Supabase (Postgres, Auth, Storage, RLS); LLM Gateway service |
| Codebase | Clean slate on 2026-09-13. Earlier app preserved on branch `codex/gi-specialty-navigation`; gateway logic carried forward in [reference/llm-gateway.md](reference/llm-gateway.md) |
| Working branch | `claude/gi-compass-clean-slate` only going forward; no application code is ported implicitly |
| Pilot success | Clinician agreement rate + OPD time saved, with numeric targets fixed before the pilot starts |
| North star | Stage at diagnosis in the clinical lead's practice, tracked year over year. It moves slowly, so don't declare success on a proxy |

## Data strategy

- **The tool is the data instrument.** Capturing the care-seeking timeline at first contact
  builds a consented, prospective cohort that later replaces assumed thresholds.
- **Past records** with documented authority can support retrospective evaluation; they
  constitute external validation only with a genuinely independent cohort and protocol. Never pool
  them with prospective records without accounting for their different completeness:
  missingness correlates with how sick the patient was.
- **25-case sanity check:** the clinical lead checks draft rules against 25 cases from
  their own clinic ("would the rules have fired at first contact?"). Only counts go in the repo.

## Open questions

| # | Question | Needed before |
| --- | --- | --- |
| Q1 | Regulatory consultant review of the intended-use wording | Metro demo (recommended); real data (required) |
| Q2 | Company legal name and privacy contact; written data roles with the clinical lead and each site | Real data |
| Q3 | Metro approval; research (ethics committee) or service-improvement framing | Metro pilot |
| Q4 | Retention per data type; what happens to pilot data when the pilot ends | First real record |
| Q5 | De-identification before model calls, per site guidance | Real data reaching a model |
| Q6 | Azure OpenAI model, regional deployment availability in India, data and abuse-monitoring terms | Pilot |
| Q7 | Reviewing RMP, available hours, escalation path when an emergency is flagged | Pilot |
| Q8 | Clinical lead's indemnity for co-developed software | Pilot |
| Q9 | Documented basis (consent or redaction) for using real reports in the extraction spike and sanity check | Any use of real reports |
| Q10 | Metro endoscopy and OPD capacity for additional urgent cases | Metro pilot |
| Q11 | Languages after English; encounter-only vs patient accounts; minors and guardians | Questionnaire content v1 |
| Q12 | Numeric pilot targets and sample size | Pilot start |

## Patient assessment and pilot acceptance contract

- Patient reasoning is a concise explanation of relevant facts and uncertainty, not private
  model chain-of-thought. Unknown or contradictory facts remain explicit. Medication regimens,
  inferred stage/resectability and definitive cancer claims are outside the preliminary output.
- Immediate advice to seek assistance or visit a doctor/hospital is independent of AI and
  login; no calling, SOS or emergency-contact notifications. In clinic, a consented urgent
  encounter has a named staff recipient, acknowledgment and documented backup coverage.
- A patient may view only the current authorised encounter through its expiring tablet
  session. Patient access, downloads, drafts, browser cache and reset are tested independently
  of staff access. Never hand a patient an authenticated staff workspace.
- Before consent: generic advice without clinical storage. After consent: partial work is
  clearly incomplete, assigned to a reviewer and never automatically closed.
- Agree before the pilot on urgency agreement, appropriate-specialty agreement, clinically
  acceptable alternatives, under-triage, failures/abstentions and confidence intervals/sample
  size. Save the clinician's independent assessment before revealing AI in their workspace.
  Patient disclosure of AI conclusions can unblind that assessment: record exposure and
  analyse those encounters separately, rather than claiming blinded agreement.
- Time measurement includes coordinator preparation, clinician review, corrections and
  follow-up for missing information, with baseline case mix and interruptions recorded.
  Also measure patient understanding, distress and whether advice was acted on; speed and
  agreement alone cannot establish benefit from patient-facing diagnostic hypotheses.
- Define organ, staging system, source/date, missingness and cohort denominator for the
  long-term stage-at-diagnosis outcome. The 25-case check is a sanity check using facts known
  at first contact, including non-cancer cases; it is not a clinical accuracy certificate.
