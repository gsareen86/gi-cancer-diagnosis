## 1. Scope and cross-review
- [x] 1.1 Record the integrated scope and owner-supplied independent Claude review; incorporate authorised revisions.
## 2. Encounter and safety foundation
- [x] 2.1 Add tested DRAFT question/rule data and realistic fictional scenarios, including no-report, acute, unknown and incomplete paths.
- [x] 2.2 Add a forward audited/RLS migration for encounters, expiring handoff, consent, report evidence, independent reviews and durable leased AI jobs; test isolation and stale publication.
## 3. Patient and evidence journey
- [x] 3.1 Build responsive consent, details, universal checks, adaptive questions, history/timeline, save/resume and submission screens against wireframes.
- [x] 3.2 Implement optional authorised report upload/view, text extraction, quality/error states, source-linked human verification and synthetic whole-body sample PDF.
- [x] 3.3 Implement patient-only capability/reset, persistent urgency, preliminary/unavailable results and separate clinician release display.
## 4. AI and clinician journey
- [x] 4.1 Implement approved local gateway, served-model/context/schema/evidence validation, independently running leased worker and explicit status/failure handling.
- [x] 4.2 Replace demographic placeholders with a responsive queue and full clinician workspace, independent assessment, AI comparison, clarification/notes and clinician-only release.
## 5. Verification and delivery
- [x] 5.1 Apply/test on existing test Cloud then demo Cloud; verify actual live local inference, uploaded sample and no-report browser flows at desktop/tablet/phone sizes.
- [x] 5.2 Supply preflight, repeatable fictional demo setup and rehearsal guide; accurately document unresolved pilot/foundation gates.
- [ ] 5.3 Obtain independent Claude implementation review, fix findings and run required checks. Archive only after all tasks pass.

Verification: 72 unit checks; 154 SQL assertions; 35 real Auth/HTTP checks;
23 complete browser-journey checks with actual local inference and five focused
handoff/reset browser checks. A further browser run verifies review/release with
AI deliberately unavailable, including the final clinician source-version guard.
Production build, typecheck, lint, remote API types,
six-check live preflight and strict OpenSpec validation pass. See
`docs/demo-rehearsal.md` and synthetic evidence under `var/demo-rehearsal`.
These totals describe the earlier implementation. Independent review of the revised code
remains pending; no archive or clinical-readiness claim is made.

## 6. Owner-authorised wireframe and provider revision (22 September)
- [x] 6.1 Rebuild patient/staff visual hierarchy, one-question intake, urgent interrupt, pause, queue and assessment evidence view.
- [x] 6.2 Add model provider adapters, versioned prompts, source aliases, structured outputs and bounded specific retries.
- [x] 6.3 Add public patient entry, explicit site data mode, expiring capabilities and database-backed start rate limits.
- [x] 6.4 Add durable report processing, model-based extraction, staff verification and append-only evidence revisions.
- [x] 6.5 Add structured investigations/follow-up, release confirmation, assessment history and detailed AI feedback.
- [x] 6.6 Verify complete rendered journeys at desktop, tablet and phone sizes; test local vision and configured provider contracts.
- [ ] 6.7 Document operational configuration, update main references and obtain independent review of the revised implementation before archive.

The supplied Claude review authorises addressing the identified gaps; it does not approve new clinical content or certify real-data operation. Test fixtures, logs and screenshots remain fictional. The previous transmission approval request is no longer a reason to pause owner-authorised implementation.

Revision verification: 80 unit checks, 183 database assertions, 35 hosted Auth/HTTP
checks, nine public browser checks and 25 complete browser-journey checks with live
local AI. Sixteen screens were captured at desktop/tablet/phone sizes, with overflow
checks. Actual report worker processing published 12 unverified findings in 104 seconds
with four lease renewals. Production build, lint, typecheck and strict OpenSpec validation
pass. Six tested migrations were applied to the application project after explicit owner
approval. Patient entry is configured at `/start/gi-clinic`; existing data mode is retained.
Operational documentation is in `docs/reference/ai-providers.md`. At that point a real Gemini request awaited the owner's key; the new verification below closes that configuration check. Broader independent implementation review remains open. Prompt revision
`.2` receives a separate focused inference check after manual review of the `.1` output.

## 7. Owner-requested questionnaire correction (22 September)
- [x] 7.1 Revise planning and obtain independent Claude review against question-inventory urgency scenarios.
- [x] 7.2 Write failing safety tests for linked timing, recurrence, recovery, same-episode rules, unknown/declined, contradictory/reordered/inactive answers, legacy versions and uninterrupted navigation.
- [x] 7.3 Draft the complete contextual questionnaire, linked rules, provenance and inventory mapping; implement generic dependency/answer handling and version support.
- [x] 7.4 Replace forced urgent pages with persistent Important banners across intake, pause, reports, review and results; add contextual multi-select/details and accessible navigation.
- [x] 7.5 Add a forward content migration and verify browser/server/database validation and floors, preserving historical encounters and snapshots.
- [x] 7.6 Verify fictional desktop/tablet/phone journeys, build/typecheck/lint, SQL tests and configured Gemini gateway request; record results and limitations.
- [x] 7.7 Obtain independent Claude implementation review, resolve findings and recheck. Retain older unresolved archive gates honestly.

## 8. Intake length and clinician-save correction
- [x] 8.1 Diagnose the synthetic reported visit using audited, redacted diagnostics and independently review the plan.
- [x] 8.2 Add named core topics, optional detail, honest progress and saved topic resume with rule dependency coverage.
- [x] 8.3 Accept short clinical impressions across UI/API/SQL; show accessible field errors and normalize historical drafts.
- [x] 8.4 Verify safety, SQL, responsive browser and actual save behavior; apply reviewed migration and refresh the running demo.
- [x] 8.5 Independently review the implementation and record final results; keep broader unresolved gates open.
- [x] 8.6 Repair report processing: prefer embedded PDF text, bound schema retries, expose page counts/failure status and staff-only retries without replacing verified evidence. Verify generated fictional reports; replay the owner's uploaded PDF only with explicit approval for Gemini processing.
- [x] 8.7 Prevent unchanged/empty report verification from clearing clinician drafts or requeueing assessment. Verify source-version, consent and active-extraction guards.
- [x] 8.8 After explicit owner approval for Gemini processing, reprocess the supplied upload and verify its processing status. Owner approved on 26 September; all 15 pages processed with 87 unverified findings through Gemini. Only audited status/counts were inspected; no uploaded report text entered coding-agent context, logs or screenshots.

## 9. Current demo readiness review (26 September)
- [x] 9.0 Preserve clinician form state during report progress, retry and unchanged verification; retain the stale-source guard and verify intentional changed-evidence handling.
- [x] 9.1 Recheck runtime, tests and a complete fictional patient/clinician/AI release journey; update stale rehearsal navigation.
- [x] 9.2 Independently review present source risks and record demo versus production prerequisites.
- [x] 9.3 Provide a candid readiness assessment and a practical runbook for the Medical Superintendent demonstration.

## 10. Automatic report evidence and owner-supplied review
- [x] 10.1 Reconcile and independently review the revised evidence/provenance/versioning plan.
- [x] 10.2 Test and implement type-aware source-grounded report extraction and automatic preliminary-AI inclusion without mandatory staff verification.
- [x] 10.3 Add a guarded forward migration for immutable report snapshots, pending-report gating, terminal-state requeueing and stale/released/consent safeguards; verify test and demo targets.
- [x] 10.4 Correct advice visibility, early missing-count copy, footer overlap, report labels, specific AI uncertainty and incompatible legacy-output display.
- [x] 10.5 Distinguish worker liveness from backend access and test unhealthy preflight; reconcile migration safety and synthetic-entry notices with the review.
- [x] 10.6 Run unit/SQL/Auth/responsive tests and a complete actual demo-environment report-to-AI-to-clinician-release rehearsal using fictional records; review generated text and update readiness/runbook.
- [x] 10.7 Independently review the final correction, resolve findings, refresh the local app/worker and record remaining production prerequisites accurately.
- [ ] 10.8 Inspect the complete working tree for credentials/private data, commit the application on the owner-designated branch and push it to the configured remote.

Section 10 verification (26 September): 172 unit checks, 503 rolled-back SQL assertions,
35 actual Auth/HTTP checks, 21 responsive patient browser cases and 17 actual recovery
checks passed. The actual demo-project journey passed 25 checks at 03:14 UTC with prompt
`gi-assessment-2026-09-26.4`, its independent Gemini worker, automatic blood/ultrasound/CT/MRI
report use, separate patient/clinician profiles, assessment save, release and reset.
Three current-prompt fictional clinic cases are prepared and separately reviewed. A final
missing-results wording regression was fixed and its affected fictional example regenerated
through the worker; current examples pass the expanded boundary checks. Source-only
independent review found no remaining concrete blocker in these additions. Build, typecheck,
lint, strict change validation and all six final runtime checks pass. All 23 migrations are
applied to both existing projects. Clinical approval and broader gates 5.3/6.7 remain open;
the change is not archived and no real-patient production readiness is claimed.

Section 9 verification (26 September, India time): 145 unit checks, 454 isolated SQL
assertions, 35 real Auth/HTTP checks, 21 responsive public/questionnaire browser cases,
16 real Auth/MFA recovery checks and 27 complete-journey checks passed. Both recovery and
the full journey used actual Gemini requests with fictional inputs. Production build,
typecheck, lint, strict OpenSpec validation and all six refreshed-runtime checks passed.
The project-owned app was rebuilt/restarted; the existing worker is healthy. Independent
source review and focused follow-up found no remaining blocker in the form correction.
Readiness and the confirmed laptop/two-profile runbook are recorded in
`docs/demo-readiness-2026-09-26.md`. No clinical approval, hospital production readiness,
or closure of broader review gates 5.3/6.7 is claimed.

Section 8 verification: 145 unit checks, 454 isolated SQL assertions (including the
no-op migration), 12 questionnaire browser cases and 10 real Auth/MFA/browser
workflow checks passed. The actual leased worker processed the generated three-page
PDF with Gemini, published unverified text-linked findings and exposed page progress.
A short independent impression saved through UI/API/SQL and persisted after reload;
blank-field focus and older minimal draft hydration passed. Responsive screenshots
are under ignored `var/intake-recovery`. Production build, typecheck, lint, strict spec
validation and six runtime preflight checks passed. Save/recovery migrations are
applied to test and demo, including the final no-op verification safeguard. The app and
worker are refreshed and all six health checks pass. Internal independent review found
no remaining blocker in the correction or either follow-up. The supplied report itself
was then awaiting processing authorization. The owner subsequently approved processing;
the completed result is recorded in task 8.8.

Questionnaire correction verification: 130 unit tests (50 contextual), 419 isolated SQL
assertions, 12 mocked browser cases at three widths, a real fictional saved/resumed visit
on the production app, build, typecheck, lint and six-check runtime preflight passed.
Gemini generated a fictional assessment through the gateway with evidence/semantic checks.
Both questionnaire migrations are applied to the existing test and demo projects; all three
bundled/stored content documents match exactly. The app and worker were restarted.

Claude's independent implementation review completed; its banner and assisted-wording
blockers were fixed. A final independent internal Codex review found no remaining blockers
in this correction. Automatic approval review rejected a repeat external Claude check
because of source/draft-content transmission; it was not run. No claim is made that a
second Claude review passed. Clinical content stays DRAFT. Tasks 5.3 and 6.7 remain open
for the broader original implementation, so this change is not archived.
