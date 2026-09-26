# GI Compass roadmap

Load this only when choosing or scoping the next change. Product decisions are in
[product-brief.md](product-brief.md); invariants are in [`openspec/config.yaml`](../openspec/config.yaml).

## Tracks that start now (no code)

| Track | Owner | Output |
| --- | --- | --- |
| Intended-use review | Owner + regulatory consultant | Approved wording recorded in the brief |
| Questions, patient wording, value sets, specialty mapping | Clinical lead | Signed-off content, starting from [clinical/question-inventory.md](clinical/question-inventory.md) |
| Draft urgency rules | Clinical lead | Exact guideline/version/population/recommendation per rule; separate acute-danger coverage. Any changed age threshold is a documented local adaptation requiring approval, not assumed validation |
| 25-case sanity check | Clinical lead | Counts only: rule fired / should have fired / missed |
| Capacity check | Clinical lead | Metro endoscopy and OPD headroom, before approaching the Medical Superintendent |
| Azure India availability | Owner | Chosen model confirmed with a regional deployment in an India region |

## Spike: report extraction (before change 7, outside OpenSpec)

About a day. Throwaway script, kept outside the repository (`var/spikes/`). Put ~15 reports
of the kinds actually seen (thermal-printed labs, photographed endoscopy printouts, bilingual
pathology reports) through quality check → OCR → local LLM extraction. Use look-alike
synthetic reports unless Q9 is resolved; real reports only with a documented basis and only
through the local connector. The result decides between automated extraction and a
verification-assisted flow.

## OpenSpec changes, in order

**21 September demo consolidation:** the owner prioritised a working Rajiv Gandhi Cancer
Institute walkthrough. `hospital-demo-journey` implements an integrated synthetic slice of
rows 2–10 on the existing foundation. Use [the rehearsal guide](demo-rehearsal.md) for the
current build. The rows below remain the broader pilot-readiness scope; do not treat the
synthetic demo as completing clinical approval, OCR validation, telemetry or real-data gates.

Each row is one change, done in its own session: propose → cross-review → apply → verify → archive.

The owner's 19 screen references are assigned to concrete delivery/acceptance tasks in
[UI screen-to-task contract](reference/ui-reference.md#screen-to-task-contract--21-september-2026).
When proposing each row below, carry in its matching screen tasks and connected-flow states.
The mockups guide layout; they do not approve clinical wording or add services/data purposes.

| # | Change | Scope |
| --- | --- | --- |
| 1 | `foundation` | Next.js + TypeScript app, owner's Supabase Cloud project (no Docker), staff auth, sites and roles, RLS baseline, audit log (D1, D2), isolated hosted tests, CI, invariant test harness |
| 2 | `encounters-and-consent` | Staff-started encounters, self-service/assisted provenance, versioned notice covering patient AI, encounter-scoped patient access, retention settings, tablet reset; state transitions and named review ownership from first consented record |
| 3 | `questionnaire-engine` | Rendering from versioned content, branching, unknown/declined states, save and resume, conservative output at any abandonment point |
| 4 | `questionnaire-content-v1` | Clinical-lead content as versioned YAML loaded into the database, care-seeking timeline section, provenance tags, sign-off records. Kept separate from the engine because content will change weekly |
| 5 | `urgency-rules` | Deterministic floor from rule data, immediate-care advice, exhaustive Given/When/Then scenarios, named clinical sign-off (demo may run on rules marked DRAFT) |
| 6 | `llm-gateway` | Sole egress, pinned local/Azure India connectors and capability tests; durable Postgres jobs/worker, leases, idempotency, bounded retries and cancellation. Contract in [reference/llm-gateway.md](reference/llm-gateway.md) |
| 7 | `report-ingestion` | Optional uploads, type/size validation, quarantine, quality/retake and manual-review fallback; audited originals, source-linked extraction proposals and verification; no-report/failed-extraction path. Reuses durable jobs |
| 8 | `clinical-reasoning` | Preliminary diagnoses with factual reasoning, uncertainty and urgency floor; validated patient-safe projection and clinician detail; no probability or confirmed diagnosis; automated checking, incomplete/unavailable states and immutable source snapshots |
| 9 | `output-generation` | Patient-visible preliminary AI assessment without individual clinician approval, author/status/version labels, encounter-only delivery and audited access; clinician-reviewed renderer exists but cannot label an output reviewed without a signed snapshot |
| 10 | `clinician-review` | Urgency worklist, independent assessment before clinician AI reveal, explicit AI-exposure tracking, autosaved drafts, source comparison, approve/edit/disagree, versioned reviewed release and human closure; old outputs marked superseded |
| 11 | `pilot-telemetry` | Predeclared agreement/under-triage denominators, AI exposure, failures/abstentions, clinician plus coordinator/correction time against baseline, patient understanding and action; no PHI in analytics |
| 12 | `pilot-readiness` | Separate approved Supabase Cloud pilot project in India and Azure India deployment; demo/test projects remain synthetic; backups with a tested restore, security review, open questions Q1–Q12 resolved for the site |

**Metro demo = changes 1–10 on synthetic data.** Changes 10 and 11 are where the pilot's
value is measured; don't let them slip or get cut to meet a date. Expect three to six months
for a solo build.

## Acceptance requirements carried into the owning change

- **Jobs (6–8):** transactional enqueue with consent/site/input/rule/model versions; unique
  idempotency keys, leased claims, bounded retry/backoff and terminal failure; restart and
  duplicate-delivery tests. Never leave the clinician queue waiting for a browser request.
  Withdrawal/cancellation and newer input versions are checked before work and publication.
- **Outputs (8–10):** preliminary AI and reviewed clinical artifacts are distinct immutable
  versions. New reports/answers mark previous assessments stale; an old review cannot sign
  new facts. Atomic publication checks patient/encounter, current consent and input snapshot.
  Correction preserves an audit trail and clearly labels superseded patient-visible output.
- **Reports (7):** no report, encrypted/missing-page PDF, poor quality, failed retake, parser
  failure and uncertain extraction all have explicit states. Unsafe uploads remain quarantined;
  safe but unreadable originals can receive manual review. Never order tests automatically to
  satisfy a document checklist. Dates, units and source text are verified, not inferred from
  an extraction confidence number; report text is untrusted input, never model instructions.
- **Experience (2–4, 7, 9–10):** desktop has a usable two-pane summary/original-report viewer;
  tablets have touch/keyboard-accessible intake, visible progress and reset; phone layouts
  retain all essential actions. Draft autosave goes to scoped server storage, not localStorage.
  English first; clinical lead approves translations. No report or image is mandatory.
  Licensed and clinician-approved illustrations only; until then use honest text/placeholders
  without broken 'compare with these pictures' instructions.
- **Clinical evaluation (4–5, 8, 11–12):** test initial-contact facts, unknown/contradictory
  inputs, reordered answers, every entry point, AI unavailable and lower-urgency proposals.
  Patient assessment must cover factual support, comprehension, distress, unsafe reassurance
  and actionability, including supported serious possibilities. An AI reviewer is not ground
  truth. Keep local adaptations distinct from guideline recommendations and validation results.
- **Pilot (12):** review the changed patient-facing diagnostic intended use, full data-flow
  residency (including logs/backups), signed content, patient access and staffing/retention
  before real records. No real-data activation solely by changing an environment flag.

## After v1

- **Referring-physician channel:** invite ~20 GPs from the existing referral network. This
  targets practitioner delay directly.
- **ABDM:** M3 to fetch existing records from other providers; M1 needs a CERT-In-empanelled
  security audit (budget 3–6 months).
- **Public-facing intake:** only after thresholds are recalibrated on the prospective cohort
  and escalation capacity is proven.
