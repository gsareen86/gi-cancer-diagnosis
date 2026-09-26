# GI Compass: readiness for the hospital demonstration

Assessment date: 26 September 2026, India time. Intended setup: this laptop and projector,
with separate patient and clinician browser profiles. Working branch:
`claude/gi-compass-clean-slate`.

## Decision

The application supports a production-like, supervised demonstration using fictional
patients. It has a working database, staff authentication and MFA, patient intake, actual
report extraction, AI assessment, clinician review and separate patient-plan release.
It is not ready to enrol real hospital patients or be presented as a clinically validated
production service. The most useful outcome of the meeting is agreement on a clinical
evaluation and controlled pilot, with named clinical and operational owners.

The complete journey has passed in the actual demo project with the running app, real
Gemini and its independent worker, using separate patient and clinician browser profiles.
The final prompt is `gi-assessment-2026-09-26.4`. Clinical content and rules remain DRAFT;
software checks do not establish diagnostic accuracy or hospital approval.

## Current workflow readiness

| Area | Current evidence | Demonstration implication |
| --- | --- | --- |
| Patient intake | Named main topics, relevant follow-ups, optional detail, contextual answer choices and saved topic resume; Important advice leaves navigation available | Show a few representative topics and pause/resume. Completion time, comprehension and abandonment still need patient testing. |
| Reports | The authorised supplied PDF completed: 15/15 pages and 87 unverified findings. Live fictional blood, ultrasound, CT and MRI text was then extracted and used by AI without a staff-verification action | Staff verification is optional. Findings retain original quotations, dates, pages and unreviewed provenance. Use fictional samples on the projector. |
| Clinician assessment | Short impressions save through UI/API/database and survive reload; field errors preserve entries | The generic save failure is corrected. Clinicians can work while report processing runs. |
| Draft preservation | Processing, retries and corrections preserve both saved drafts and unsaved text | Changed facts disable signing until the clinician reviews them and selects **I have reviewed the updated facts**. |
| AI and release | Actual demo-project extraction, assessment, clinician save/release, patient receipt and feedback passed | Three fresh current-prompt clinic examples are prepared. Older AI is withheld and labelled **AI needs refresh**, while clinician plans/history remain intact. |
| Access boundaries | Actual Auth/MFA, patient capability, site/role isolation and HTTP/database safeguards tested | Keep patient and clinician in separate profiles. Two tabs in one profile share cookies. |
| Runtime | Local web app and independent worker; hosted database/Auth and Gemini require Internet | Suitable for the confirmed laptop/projector setup. There is no offline database or automatic provider fallback. |

The processed supplied upload was not automatically verified, clinically interpreted by
the coding agent, or used to submit/release an assessment. Its processing approval does
not make it a suitable document to project to an audience.

## Verification on this date

- 172 unit checks and 503 database assertions passed, including test isolation/rollback.
- 35 actual Auth/MFA/HTTP access and session checks passed.
- 21 patient-entry/questionnaire browser cases passed across desktop, tablet and phone widths.
- 17 focused recovery checks passed with real Auth/MFA, the existing isolated test database
  and actual Gemini extraction of a generated three-page fictional PDF. These include
  visible page progress, retry, draft preservation, unchanged/changed verification,
  external source changes, validation and short assessment persistence after reload.
- Independent source review found the report callback issue; the focused correction was
  reviewed again with no remaining blocker. Broader independent implementation review
  remains open in OpenSpec tasks 5.3 and 6.7.
- 25 complete-journey checks passed on the actual demo project, using its independently
  running Gemini worker, without any staff report-verification step. Assertions cover
  all four report types in the frozen AI source facts, actual report citations, distinct
  uncertainty, independent clinician save/release, patient receipt, feedback and reset.
  Responsive screenshots and overflow checks cover the principal screens.
- The three prepared cases were separately reviewed and checked against the final output
  boundaries. One no-report case inferred an unperformed examination from missing results;
  the guard was extended, regression-tested and the fictional case regenerated through the
  independent worker. Its current output states that results are unavailable instead.
- Production build, typecheck, lint, strict OpenSpec validation and all six runtime preflight
  checks passed. The project-owned local app was rebuilt and restarted; the existing
  independent worker remains healthy. All 23 migrations are applied to test and demo.
  Preflight checks successful backend RPC access, not just a heartbeat. No new cloud
  resource was created.

Browser evidence uses invented data only, under ignored `var/demo-live-review`,
`var/ui-review` and `var/intake-recovery`. The full rehearsal writes some remaining questionnaire answers from
an explicit fictional fixture through the normal API; it is not a timed human completion
study. No diagnostic accuracy or time-saving percentage is inferred from these tests.

## Before the audience arrives

1. Keep the laptop powered, prevent sleep and confirm Internet. Use the tested local build;
   avoid provider, origin or schema changes immediately before the presentation.
2. From the project directory run:

   ```powershell
   npm run demo:start -- -Production
   npm run demo:preflight
   npm run demo:status
   ```

   Require all six preflight checks to pass. The current provider is Gemini. Older
   prepared cases are reported separately from current-prompt completions.
3. Sign in and complete MFA in the clinician profile at `http://localhost:3000/staff`.
   Open `http://localhost:3000/start/gi-clinic` in the separate patient profile. Keep the
   authenticator available in case the staff session expires.
4. Use one of the fresh fictional **Demo Clinic** visits: **854547C2** (Aarav, blood and
   written imaging reports), **098D131C** (no-report scenario), or **8B4487FF** (jaundice
   scenario). Confirm **AI ready** before projecting. Older visits remain as history.
   Keep `public/demo-assets/synthetic-whole-body-report.pdf` and
   `public/demo-assets/synthetic-written-imaging-report.pdf` ready.
5. Test the actual projector resolution and browser zoom. Avoid showing credentials,
   private notes or the owner's uploaded report while switching windows.

## Suggested 12-minute walkthrough

| Time | Show | Explain |
| --- | --- | --- |
| 0–1 min | Patient and clinician profiles | Structured GI intake and review; fictional demonstration, DRAFT clinical content. |
| 1–4 min | Consent, a contextual symptom topic, linked Important advice, Save and pause/resume | Patients can describe recurring symptoms, remain unsure, and continue answering when advice appears. |
| 4–6 min | Fictional PDF, processing status, source text and original page | Completed extraction informs preliminary AI automatically; staff correction is optional. Use an already processed case if live processing is slow. |
| 6–10 min | Prepared case, independent clinician assessment, Save, AI comparison | Clinician assessment is recorded separately. Prior AI exposure is recorded; agreement is not proof of accuracy. |
| 10–12 min | Clinician release and patient plan, then end the patient session | Preliminary AI and the clinician's signed plan are distinct. Demonstrate that the released plan reaches the other profile. |

Releasing a prepared case is persistent. Leave another unreleased example available, and
use a fresh fictional encounter for repeat demonstrations. For the detailed walkthrough
and failure recovery, see [demo-rehearsal.md](demo-rehearsal.md).

## Requirements before real patient use

| Requirement | What is still needed |
| --- | --- |
| Clinical validation | Named approval of questions, wording and urgency rules; clinical-lead case review; broader evaluation of missed urgency, unsupported output, patient comprehension and report-extraction errors. No autonomous diagnosis or validated cancer screening claim. |
| Hospital workflow | Agreed intended use, responsible reviewers, escalation/acknowledgement process and coverage, patient notices/consent, operational capacity and pilot success criteria. |
| Real-data architecture | Approved provider and full data-flow residency, including logs/backups; documented retention/deletion and private document storage design. Current Gemini demo success does not establish the project's real-data India-routing requirement. Originals currently use bounded private database storage. |
| Operational reliability | Production hosting and worker supervision, alerting, tested backup/restore, load/concurrency testing and incident/recovery ownership. This laptop and serial worker are not a hospital availability service. |
| Security/release evidence | Complete broader independent implementation review, durable redacted security-event logging/retention, verified CI/environment protections, per-client abuse protection and staff-password policy. The source baseline is being committed/pushed as part of this delivery; this does not close the broader release gates. |
| Product evaluation | Timed patient/coordinator usability testing, completion/abandonment measurement and measured clinician workload. Current scope is English-first; HIS/EMR integration and hospital-wide identity/workflow integration are not implemented. |

These are existing project readiness gates, not a claim that a particular regulatory
approval has been obtained or that clinical safety has been certified. See
[product brief](product-brief.md), [roadmap](roadmap.md) and
[foundation verification](reference/foundation-cloud-verification.md).

## Disposition of the supplied review

- The previous type error, ambiguous test selector, old demo guide and clinician-save
  failures had already been corrected. Current checks reconfirm the affected flows.
- The migration concern is resolved: the actual demo ledger lists every migration as
  applied, including the new automatic-evidence and versioned-notice migrations.
- The Important banner remains in view after scrolling; blank active intake no longer
  announces missing safety answers. Missing information remains explicit at review.
  The report footer no longer overlays the upload area.
- The actual live run initially found excessive evidence citations, causing schema
  rejection. Specific bounded repair feedback fixed the failure without relaxing
  validation. Distinct uncertainty and plain patient wording are now checked. Original
  report quotations remain unchanged, including technical terms in the source itself.
- Incompatible old AI is withheld. No earlier response is silently relabelled as generated
  by the new prompt. Fresh examples and their report evidence are available for rehearsal.
- Entry and consent visibly identify the fictional demo; notice `gi-privacy-2026-09-26`
  discloses automatic report use and external AI processing. This is not a complete,
  hospital-approved real-patient privacy notice. The real-mode India-routing guard remains.
- Worker health now records safe RPC failure codes and fails preflight after backend
  access fails. API identity checks do not guarantee future quota or uninterrupted service.
- New SQL text patches assert their expected boundaries and are tested. Older applied
  migrations were not rewritten; report originals in private Postgres, clinical approval,
  password hardening, production hosting and abuse controls remain production work.

For the Medical Superintendent, ask for a clinical sponsor, representative evaluation
cases, the intended OPD workflow and review coverage, and hospital IT/security involvement
in defining a controlled pilot. Present the working workflow and the remaining validation
plan together.
