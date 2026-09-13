# GI Compass: product brief

Decisions as of **2026-09-13**. This file is the product authority. The safety and data
invariants live in [`openspec/config.yaml`](../openspec/config.yaml) so every change carries them.

## Why

GI cancer patients commonly reach a GI surgeon late. Most of the delay happens before
hospital contact: symptoms not recognised as serious, or months of treatment for "acidity".
The pilot starts where patients already arrive (the clinical lead's clinic and Metro
Hospital OPD) and builds the instrument that later extends to referring physicians.

## What GI Compass is

A clinic intake and review tool. On a tablet, a patient (alone or helped by a coordinator)
answers a structured questionnaire and adds existing reports. The system extracts report
findings, applies clinician-authored urgency rules and prepares an AI-assisted analysis.
A clinician reviews it, decides the appropriate **type of specialist** and the urgency,
and releases next steps to the patient.

It is not a cancer-risk calculator, a screening test or a diagnosis. Nothing reaches a
patient without clinician approval, and no output tells a patient they are fine.

## Intended use (DRAFT: needs regulatory consultant review)

> GI Compass collects an adult patient's gastrointestinal symptoms, history and existing
> medical reports and presents them, with rule-based urgency flags and AI-generated
> summaries, to a registered medical practitioner. The practitioner decides the appropriate
> specialty referral and urgency and approves next-step instructions for the patient.
> GI Compass does not diagnose, screen for or predict disease.

Under CDSCO's medical device software guidance, this wording drives classification. Have
it reviewed before the Metro demo, and treat that review as mandatory before real patient data.

## v1 scope

1. **Tablet encounter:** staff starts an encounter; patient self-service or
   coordinator-assisted; every answer records who gave it and who entered it.
2. **Consent:** versioned DPDP notice and consent before any clinical data.
3. **Questionnaire:** clinical-lead content, branching, unknown/declined answers,
   save and resume, conservative output at any abandonment point.
4. **Report upload:** clean PDFs, scans and photos that pass a quality gate (retake on
   failure); extraction to source-linked fields; human verification of low-confidence fields.
5. **Urgency floor:** deterministic rules and immediate-care advice, independent of AI.
6. **AI analysis (clinician-only):** case summary, hypotheses with evidence for and
   against, specialty suggestion.
7. **AI review:** an automated second pass that checks the analysis against source facts
   and the invariants before a clinician sees it. *Interpretation of the owner's "AI review"; confirm.*
8. **Clinician review:** worklist, independent assessment before revealing AI, approve,
   edit or disagree with a coded reason, release.
9. **Outputs:** a patient navigation letter (specialty type, urgency instructions, action
   items, what to bring) and a clinician summary, both from one approved analysis.
10. **Pilot telemetry:** completion and abandonment, AI–clinician agreement, OPD time.

Web only: a full clinician workspace on desktop, guided intake on tablet, and usable phone
layouts. Each is designed for its device, not a phone column stretched across a monitor.

## Not in v1

Patient-visible differential or probabilities · screening or early-detection claims ·
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
| Primary output | Specialty navigation first, with the urgency floor alongside |
| Differential | Clinician-only |
| Reports | Clean PDFs, scans and photos above a minimum quality, checked with open-source image-quality tools |
| Clinical content | Clinical lead writes and signs off patient wording, coded value sets and urgency rules |
| Hosting | India only: local machine for the demo; Supabase ap-south-1 (Mumbai) for the pilot |
| Models | Demo: local LLM through the LLM Gateway. Pilot: Azure OpenAI, **regional** deployment in an India region (Global and DataZone deployment types can process outside India) |
| Stack | Next.js + TypeScript; Supabase (Postgres, Auth, Storage, RLS); LLM Gateway service |
| Codebase | Clean slate on 2026-09-13. Earlier app preserved on branch `codex/gi-specialty-navigation`; gateway logic carried forward in [reference/llm-gateway.md](reference/llm-gateway.md) |
| Pilot success | Clinician agreement rate + OPD time saved, with numeric targets fixed before the pilot starts |
| North star | Stage at diagnosis in the clinical lead's practice, tracked year over year. It moves slowly, so don't declare success on a proxy |

## Data strategy

- **The tool is the data instrument.** Capturing the care-seeking timeline at first contact
  builds a consented, prospective cohort that later replaces assumed thresholds.
- **Past records** (if hospital consent is obtained) serve external validation. Never pool
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
