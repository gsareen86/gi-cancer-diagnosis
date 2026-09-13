# Specialty navigation implementation sequence

This is the roadmap, not a checklist to load into every coding session. The full v1
remains questionnaire + optional report ingestion + AI analysis + clinician review +
patient actions + doctor summary + a measurable clinic workflow. A new product brief
does not require discarding tested infrastructure or migrating to Supabase.

Each row becomes a **separate bounded OpenSpec change**. Draft/review its specs against
the current code, implement it, record evidence, and archive only when complete. The
first change is already specified; the others are planned, not secretly marked done.

| Order / change | Implement | Exit evidence |
| --- | --- | --- |
| 1. `establish-specialty-navigation-pilot` | Demo/pilot operating contract, fail-closed activation, honest responsive entry copy, pure agreement/timing contracts | Invalid/unknown/pilot modes blocked, no clinical body consumed by blocked paths, local synthetic smoke test, responsive entry screenshots, metric edge-case tests |
| 2. `add-site-encounters-and-tablet-access` | Sites, staff membership, coordinator role, patient subject separate from login, short-lived encounter access, patient/assisted provenance and reset | Cross-site/patient denial; revoked/expired token denial; back/reload/cache and next-patient isolation; portrait/landscape/tablet usability |
| 3. `add-navigation-consent-and-records` | Versioned notices/purposes, patient and assistant authority, clinical history/medications/existing diagnoses, encounter snapshots, amendments, retention configuration | Consent checks at reads/writes/worker egress, withdrawals, unknown versus none, correction/source-version tests; real-data activation remains closed |
| 4. `author-navigation-questionnaire` | Versioned content schema, clinician draft editor, value sets, patient-language preview, change comparison and approval records; turn the clinical inventory into reviewed content | Author/reviewer roles; no self-asserted approval; approved locale/version pinning; schema/branch/answer-sequence tests; unknown/declined and no-report paths |
| 5. `enforce-navigation-urgency-floor` | Independently scheduled safety questions, approved rule data, unknown state, advice persistence, AI/release urgency floor check, staff handover | Positive/negative/unknown cases for every rule and entry path; answer-order/offline/abandonment coverage; AI unavailable/less-urgent output cannot lower advice |
| 6. `ingest-readable-existing-reports` | PDF/photo/scanned-PDF validation, malware quarantine, local quality assessment, original viewer, bounded OCR, source-linked extraction and verification | Readable/blurred/skewed/cropped/missing-page corpus; tabular units and negation review; bad/malicious files never released; original preserved; optional-report fallback |
| 7. `generate-clinician-navigation-hypotheses` | Full history/report-aware AI contract, source evidence and uncertainty, candidate causes including specific malignancy where supported, specialty routing, local/Azure adapter parity, durable jobs | Fixed synthetic challenge set including non-cancer/infectious/inflammatory cases; abstention; source omissions; floor enforcement; provider timeouts/retries/revoked consent; no patient exposure |
| 8. `review-and-release-navigation` | Factual brief beside originals, independent assessment before AI reveal, explicit review start, revision-safe autosave, structured disagreements, clarification tasks, clinician-approved navigation letter | Stale-tab and amended-source rejection; AI-free review; no AI differential in patient API/PDF; identity metadata; incomplete reports don't block seeking care |
| 9. `measure-navigation-pilot` | Persist interval/event contracts, protocol versions, reference/AI pairs, analysis by site/cohort, restricted export and missing-data accounting | Denominator reconciliation; exposed-reference exclusion; no-AI cases counted; pause/concurrency corrections; cohort examples with known answers; no PHI in product analytics |
| 10. `operate-authorised-navigation-pilot` | Gate evidence registry, final India deployment, site onboarding, observed backups/restore, retention/rights operations, staffing/absence procedure and approved activation | Site-specific approval and consent evidence; model/egress proof; security and restore exercises; runbook rehearsal; clinician sign-off; separate deployment authorisation |

## First coherent demo

Demonstrate the encounter end to end with invented patients before Metro receives any
real-data access. It must be a realistic, working encounter rather than a scripted screen tour: upload
and process synthetic patient reports (PDFs, photos and scans), capture past history,
and run the patient questionnaire through both partial and complete submissions.
Combine questionnaire answers, past history and verified report findings into actual
local LLM analysis and a source-linked summary, making missing information and
uncertainty explicit. This integrated clinical picture is the core demonstration of
value for Metro's IT department and Medical Superintendent.

Follow AI generation with clinician review: record an independent clinical assessment
before revealing AI hypotheses, then check agreement and disagreements, resolve or
record outstanding clarifications, and require clinician approval before releasing
the two distinct final artifacts: a patient navigation letter with care actions and
a receiving-clinician summary. Keep AI hypotheses clinician-only and make source
corrections invalidate stale analysis and review before release.

The working sequence must also show a no-report patient, a clean report, a report
quality failure with a retake path, unknown/partial answers, immediate-care advice
without a model, AI unavailable, a clinician disagreement and a corrected source.
Use synthetic fixtures throughout; realistic functionality does not authorise real
patient-data access. Existing features may accelerate the sequence only after their
tests meet the new spec.

The operating boundary in change 1 prevents an unfinished prototype being mistaken
for the authorised pilot. Subsequent changes keep that boundary closed while building
the actual encounter. Do not add a boolean “compliant=true” escape hatch to enable it.

## Reuse decisions

| Existing component | Decision |
| --- | --- |
| Next.js/TypeScript/Tailwind/next-intl | Retain; use wide desktop layouts with report/summary panes and tablet-specific encounter flow. |
| Supabase PostgreSQL (primary database for both demo and pilot)/Drizzle/migrations | Retain; add site and encounter access explicitly. Do not assume current global user roles provide tenant isolation. |
| Auth, MFA, audited repository, consent | Retain useful primitives; assess account-centric assumptions before tablet access. Patient need not receive a staff account. |
| Questionnaire and safety engines | Retain only with behavioural tests; current seeded clinical content is not approved for the new pilot. |
| Clinical history, brief, report viewer, draft revision | Reuse after regression checks; new source/version/verification semantics still required. |
| Python AI/OCR layer | Retain the service boundary, replace insufficient parsing/provider pieces based on measured evidence. |
| Old diagnosis taxonomy / prompt | Revisit for specialty navigation and clinician-only hypotheses; never infer stage/resectability from symptoms or tumour markers alone. |
| Old patient account/onboarding, release/acknowledgement | Adapt for clinic encounters and care actions; viewing a case does not mean review started or care completed. |
| New dependencies preserved from earlier WIP | `pg-boss` and S3 SDK are present, not proof of functioning workers/storage. Use with tested integration or remove when unused; don't duplicate queues. |

## Architecture decisions to keep stable

- Data model: company/operator → site → staff membership and patient subject → encounter
  → consent/answers/history/reports → immutable source snapshot → AI/reference/review
  → released patient letter and receiving-clinician summary → measured care events.
- Keep identity and contact data separate from model-ready facts. Source references
  carry actor, time, units, document page, verification and version. Avoid raw identifiers
  in model prompts; redaction failures require human handling, not a claim of anonymity.
- Jobs are durable, idempotent and consent/source-version aware. AI/OCR failures never
  remove the deterministic brief or immediate-care advice. No browser-tab SLA scheduler.
- Clinical content is authored as data and reviewed as scenarios. General reasoning
  still uses versioned prompts/models; the lead approves the instrument, not every
  possible future LLM inference. Regression cases and an abstention path are necessary.
- Separate operational review targets from medical urgency. Capacity settings cannot
  weaken a patient's advised action. No named-doctor routing or commercial referral bias.
- Local demo has local inference and synthetic fixtures. Azure pilot provider selection
  is an explicit adapter/deployment decision; no paid cloud build in this reset.

## Report quality spike before the full ingestion change

Start with synthetic clean PDFs and artificially degraded copies. Use PDF text where
available, image dimensions/blur/exposure/skew/crop checks, and OCR diagnostics to ask
for retakes. A sharp image can still have a wrong patient, missing page or unreadable
stamp. Human review and preserved originals remain essential. Do not adopt a magic
“quality score > X” threshold without testing the target report types and devices.

Once D05 authorises representative data, run a separately controlled extraction
evaluation. Measure per-field precision/recall and transcription/units/date/negation
errors against clinician-checked references, not the model's confidence. Keep development
and evaluation records apart; do not put real examples into the repository.

## Planning realism

No fixed eight-week delivery claim. A solo implementation includes access controls,
document handling, review semantics and operations as well as visible screens. Clinical
authoring, wording review, Metro permission, provider capacity and agreed retention are
separate dependencies. Re-estimate after the first verified encounter and report spike.
Do not cut measurement or coordinator effort from the scope to make a date look feasible.
