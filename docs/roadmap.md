# GI Compass roadmap

Load this only when choosing or scoping the next change. Product decisions are in
[product-brief.md](product-brief.md); invariants are in [`openspec/config.yaml`](../openspec/config.yaml).

## Tracks that start now (no code)

| Track | Owner | Output |
| --- | --- | --- |
| Intended-use review | Owner + regulatory consultant | Approved wording recorded in the brief |
| Questions, patient wording, value sets, specialty mapping | Clinical lead | Signed-off content, starting from [clinical/question-inventory.md](clinical/question-inventory.md) |
| Draft urgency rules | Clinical lead | Rule worksheet. Start from NICE NG12 and ASGE alarm features, with age thresholds adjusted for younger Indian presentation |
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

Each row is one change, done in its own session: propose → cross-review → apply → verify → archive.

| # | Change | Scope |
| --- | --- | --- |
| 1 | `foundation` | Next.js + TypeScript app, local Supabase, staff auth, sites and roles, RLS baseline, audit log (D1, D2), CI, invariant test harness |
| 2 | `encounters-and-consent` | Staff-started tablet encounters, self-service vs assisted mode with answer provenance, versioned DPDP notice and consent, patient record, retention settings, session reset between patients |
| 3 | `questionnaire-engine` | Rendering from versioned content, branching, unknown/declined states, save and resume, conservative output at any abandonment point |
| 4 | `questionnaire-content-v1` | Clinical-lead content as versioned YAML loaded into the database, care-seeking timeline section, provenance tags, sign-off records. Kept separate from the engine because content will change weekly |
| 5 | `urgency-rules` | Deterministic floor from rule data, immediate-care advice, exhaustive Given/When/Then scenarios, named clinical sign-off (demo may run on rules marked DRAFT) |
| 6 | `llm-gateway` | Single egress service with connectors (local llama.cpp, Azure OpenAI India), schema-constrained output, served-model identity, per-environment connector allowlist. Carries forward [reference/llm-gateway.md](reference/llm-gateway.md) |
| 7 | `report-ingestion` | Upload, quality gate with retake, storage, OCR, extraction to source-linked fields with confidence, verification step. Shaped by the spike |
| 8 | `clinical-reasoning` | Clinician-only hypotheses with evidence for and against (S4, S9), specialty suggestion from the approved mapping, AI review pass, floor enforcement |
| 9 | `output-generation` | One approved analysis, two renderers: patient navigation letter and clinician summary |
| 10 | `clinician-review` | Worklist ordered by urgency, independent assessment before revealing AI, approve/edit/disagree with coded reason, release, human case closure (S3) |
| 11 | `pilot-telemetry` | Completion funnel, abandonment by question, AI–clinician agreement, OPD time against a declared baseline, no PHI in analytics |
| 12 | `pilot-readiness` | Supabase Mumbai and Azure India deployment, backups with a tested restore, security review, open questions Q1–Q12 resolved for the site |

**Metro demo = changes 1–10 on synthetic data.** Changes 10 and 11 are where the pilot's
value is measured; don't let them slip or get cut to meet a date. Expect three to six months
for a solo build.

## After v1

- **Referring-physician channel:** invite ~20 GPs from the existing referral network. This
  targets practitioner delay directly.
- **ABDM:** M3 to fetch existing records from other providers; M1 needs a CERT-In-empanelled
  security audit (budget 3–6 months).
- **Public-facing intake:** only after thresholds are recalibrated on the prospective cohort
  and escalation capacity is proven.
