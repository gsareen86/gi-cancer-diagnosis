# Clinical workspace refinement

Implementation guide for the OpenSpec change `elevate-clinical-workspace`.
The change was superseded on 2026-09-13, not completed or archived. Its preserved artifacts
are in `docs/history/2026-09-13/openspec/changes/elevate-clinical-workspace/`.
Use the [current brief](specialty-navigation/brief.md) for product requirements.

## Page views and routes

| Workspace | Routes | View |
| --- | --- | --- |
| Public | `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/mfa` | Clinical landing page and shared split-screen authentication layout; privileged roles require MFA |
| Patient | `/patient/dashboard`, `/patient/records` | Active case, persisted progress timeline, prior consultation records |
| Patient intake | `/patient/intake`, `/patient/intake/:caseId` | Symptom pathway selection, adaptive questionnaire, abdominal map, stool/severity visuals, history, uploads, review |
| Patient case | `/patient/case/:caseId`, `/patient/case/:caseId/documents` | Status before release; frozen physician summary, PDF/print and receipt acknowledgement after release |
| Clinical queue | `/doctor/dashboard`, `/doctor/triage` | Four metrics; risk, status, category, submission-date and SLA filters; search and prioritized rows |
| Clinical case | `/doctor/case/:caseId` | Sticky desktop case Navigator opening one broad record, reports, decision-support or physician-review canvas; responsive tabs below the desktop breakpoint |
| Clinical analytics | `/doctor/analytics` | Aggregate throughput, risk and override information without patient identifiers |
| Shared account tools | `/patient/notifications`, `/doctor/notifications`, `/patient/profile`, `/doctor/profile` | Notification history and account/profile controls |
| Patient onboarding | `/patient/profile`, `/patient/consent`, `/patient/privacy` | Profile completion, purpose-specific consent and privacy requests |

Old patient `/cases/*`, `/start`, `/profile`, `/consent`, `/privacy`, and doctor `/doctor/queue`
and `/doctor/cases/*` links redirect while preserving identifiers. Guards retain safe deep links
through login/MFA and redirect cross-role navigation to the caller's dashboard with an explanation.
The API independently enforces role, assignment, consent and audit boundaries.

## Updated file structure

```text
apps/web/src/
  app/
    (auth)/                         shared auth layout and forms
    patient/(onboarding)/           profile, consent, privacy + guard
    patient/(workspace)/            dashboard, intake, case, records, notifications
    doctor/                         dashboard, triage, case, analytics, profile, notifications
    api/
      cases/[caseId]/history/       patient history GET/PUT
      cases/[caseId]/documents/     upload, scan, metadata, authorized content, removal
      cases/[caseId]/summary/       frozen summary, PDF and acknowledgement
      doctor/metrics/              queue-consistent aggregate metrics
      doctor/cases/[caseId]/        case, review/start, review, release
      notifications/               list, read, overdue sync
  components/
    shell/                         app shell, navigation, breadcrumbs, account menu, refresh
    ui/                            cards, badges, skeletons, tabs, drawers, stepper, toast
    doctor/                        triage table, Navigator case workspace, record/reports/CDS/review
                                   panels, document drawer, AI draft drawer, release dialog and delivery audit
    patient/                       history capture and summary actions
    questionnaire/                 adaptive interview, body map and stool illustrations
    notifications/                 bell, feed and delivery-state presentation
    document-uploader.tsx          drag/drop, picker, progress and per-file feedback
  lib/                             guard, safe navigation, risk/SLA, triage filters,
                                   categories, history validation, stages and timelines,
                                   public references, non-destructive ai-draft adoption and assessment-failure messages
  server/services/                  triage, analytics, notifications, assessment and PDF
packages/db/
  migrations/0003_*                clinical history + notification reads
  migrations/0004_*                lifecycle notification types + deduplication
  migrations/0005_*                immutable unique patient/case public numbers + backfill
  src/schema/history.ts           per-case history storage
  src/repositories/clinical-repository.ts
                                   audited/consented state changes and row locking
e2e/
  clinical-api.mjs                 live HTTP workflow and authorization checks
  ai-live.mjs                      opt-in real local-model persistence smoke check
  model-idle.mjs                   non-clinical live sleep/health/wake/concurrency/re-sleep check
  image-preview.mjs                scanned image for the current synthetic draft
  doctor-review.mjs                desktop/mobile review/release browser walkthrough
  patient-walkthrough.mjs          registration through emergency-interruption walkthrough
  support/clinical-fixture.ts      local synthetic fixture, no real-account mutation
scripts/start-ai.ps1               repeatable Windows local model + gateway launcher
docs/india-privacy.md               India applicability register and production evidence gates
```

The component code is implemented in these source files, not duplicated as snippets in this guide.
English and Hindi display catalogues are in `apps/web/messages/`; palette/density tokens are in
`apps/web/tailwind.config.ts` and `apps/web/src/app/globals.css`.

Patient references (`GI100001` onward) identify a person across consultations; case references
(`GC100001` onward) identify a consultation. PostgreSQL identities, unique indexes and an update
guard keep them stable, including existing records. UUID primary keys and routes remain unchanged.
References are labels, not access tokens: claimable cases do not expose patient names or GI numbers.

The review header separates identity, risk and encounter metadata. On desktop, a sticky case
Navigator opens one mounted broad content canvas and the page has one predictable content scroll;
below the desktop breakpoint the same sections become keyboard-operable tabs without remounting
the editor. Red flags appear first, reports have their own section, private notes remain plainly
identified, and the compact save/finalize/dispatch bar sits beneath the full-width review fields.
Measurements have value tiles; history domains have separate titled cards with counts and full
entries. Transcript clusters and differential evidence are keyboard-expandable, without dropping
source content. The AI draft assistant previews source summary/workup before deliberate adoption.
Queue actions are single-line, high-contrast buttons with an accessible case-specific name.

## Review lifecycle and state ownership

```text
Submitted → AI processing (optional) → In review → Reviewed → Released → Closed
                                          ↑          │           │
                                          └─ editing ┘           └─ patient acknowledgement
```

- The server is authoritative. Case-first row locks and atomic draft/finalization writes protect
  concurrent requests; release compares the confirmed fields and the saved finalized version.
- Review editors use local React state. Tabs keep one mounted editor across viewport changes.
  Editing invalidates the current approval; saving a draft also invalidates server finalization.
- Patient summary and workup start from the saved physician draft, not automatic AI copying.
  The AI assistant previews existing output or generates a new assessment through the same shared
  request state as CDS. Each field is adopted explicitly: fill an empty field, or append while
  preserving existing wording. Duplicate content and over-limit additions are rejected, never
  truncated. Adoption invalidates approval and changes only local unsaved summary/workup state.
  Diagnosis, prescriptions, referral urgency and private notes are not changed by adoption.
  Prescription instructions are physician-authored. Original AI output remains immutable.
- The confirmation shows exactly what will be dispatched. Private physician notes and raw AI
  metadata never enter the released object. Released charts reject further edits and duplicate
  release. A late AI job cannot rewind review/release state.
- Patient pages and PDFs read the same frozen release. Acknowledging receipt closes the case
  without altering its contents. PDF reads are consent-gated, audited and `private, no-store`.
- The patient AI milestone exposes processing state only. Failed or skipped analysis is explicitly
  unavailable rather than a fabricated completed step; a doctor can still review the case.

## Documents and communications

Uploads support PDF, JPG/PNG, DOCX and DICOM Part 10; filenames and byte signatures are checked.
Files are scanned before they can be served as clean content. Each rejected upload has its own
reason. The authenticated content endpoint also checks the short-lived signature, role, ownership
or assignment, consent and audit access. PDF/images open in the drawer; DICOM is downloadable
for an external viewer, not rendered as medical imaging in the browser.

The bell polls while the workspace is visible, and case/dashboard views refresh periodically.
Under-review and released events notify the patient. Assigned high-risk/new-case events and
deduplicated overdue events notify clinicians. General feeds contain no clinical payload;
the authorized case audit can show the recipient account and timestamps.

SMTP acceptance is labelled Sent. Logged-only explicitly means no email was sent. In-app read
timestamps are separate from email delivery and never presented as email-open receipts.

## Running and verification

Use the existing compose services and `.env` configuration. Apply all three additive migrations before
starting the upgraded app; do not reset the database or delete clinical rows.

```powershell
npm run db:migrate
npm run typecheck
npm test
npm run build
npm run spec:validate
```

If the local Node/tsx launcher reports `uv_os_get_passwd`, the existing Vite runner works:

```powershell
node --env-file-if-exists=.env node_modules/vite-node/vite-node.mjs --script packages/db/src/migrate.ts
```

### Local AI recovery on Windows

The failed assessment was caused by the local model and AI gateway not listening on their configured
ports. Compose starts PostgreSQL, storage and mail; it does not start these two AI processes.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-ai.ps1
```

The launcher reads the existing local `.env` configuration, checks matching gateway tokens, starts
the configured llama.cpp binary/model and Python gateway in hidden windows, and checks readiness.
It does not download a model, stop an unrelated listener, substitute a stub or fall back to a cloud model.
Logs remain under ignored `var/tmp/ai-runtime/`. Run it again after a machine restart if needed.
The current model can take several minutes; the page keeps failure feedback readable and retryable.
Patient-facing AI text is never adopted just because a result arrives; use the explicit preview/apply controls.

The installed llama.cpp binary supports native idle sleep. `LOCAL_MODEL_IDLE_SECONDS` in
`services/ai/.env` defaults to `300` (five minutes), accepts 1–86400 seconds, and permits `-1`
only as an explicit opt-out. Both launchers pass `--sleep-idle-seconds`. To apply a new value to
the existing verified model when all requests are idle:

```powershell
./scripts/start-ai.ps1 -RestartModel
```

Native sleep unloads model weights and KV cache; the lightweight listener/driver retains some
memory. A new inference request reloads automatically. The server's scheduler protects active
and queued requests. `/props` and `/health` do not wake/reset the idle timer; the gateway exposes
`modelState: sleeping` as healthy. Cold loading can temporarily delay readiness probes. Never
monitor with a completion request or `/v1/models`. See the
[llama.cpp native sleep documentation](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md#sleeping-on-idle).
The model request budget is 15 minutes; the web gateway budget defaults to 16 minutes. Explicit
`AI_REQUEST_TIMEOUT_MS` overrides must allow for cold load plus inference.

Live synthetic verification used a temporary 20-second idle interval: repeated gateway health
polling preserved sleep, two concurrent real requests automatically reloaded and completed, and
the model slept again. Private allocation was approximately 18,059 MiB active and 383 MiB asleep
on this AMD unified-memory machine. This is not a claim of zero RAM/driver use or discrete GPU
VRAM measurement. The final runtime setting was restored to 300 seconds.

Real local-model generation and persistence were verified on synthetic data and the reported case.
The reported case was not finalized or released. Successful generation is not clinical validation:
the result is labelled ungrounded when no curated guidance matches.

See `e2e/README.md` for live test commands and required services. Test fixtures are local-only,
synthetic and retained for inspection; they do not reset existing users or their MFA factors.

Verification recorded on 2026-09-05:

- Type checking and production build passed.
- 546 automated tests passed: core 209, database 84, web 188, repository checks 65. The focused
  web-unit suite passed 31 checks, including catalogue parity and hardcoded-string coverage.
- The AI-service suite passed 102/102 tests in an isolated Python 3.12 environment using its
  declared project dependencies.
- Strict non-interactive OpenSpec validation passed for both repository changes.
- 42 live HTTP checks passed against the running compose services after migration, including real MFA, role gates,
  release consistency, frozen PDF, history-copy isolation, acknowledgement, notifications, scanned
  storage, signed document retrieval and cookie/session logout.
- Signed-in 1800px desktop, 900px tablet and 390px mobile views were checked. Browser checks passed
  for the sticky Navigator, responsive tabs, one-canvas selection, exact accessible tab names,
  report separation, long-form editor sizing, content-aligned actions, draft preservation, no
  horizontal overflow and approval invalidation. No save or release request was made.
- Keyboard checks passed for tabs, body-map selection, account menu, review action and document
  drawer focus trapping/Escape/return. Toasts were confirmed in the accessibility tree, not tested
  with a separately running screen reader. The route-wide every-control keyboard audit also passed.
- A synthetic intake completed through emergency takeover, optional history, scanned upload and
  submission. The advisory received focus immediately after the triggering answer was saved.
  PDF and image drawers rendered, and image zoom worked by keyboard. Official PDF layout was also
  inspected across two pages with mixed English/Hindi text and pagination.
- The browser's final dispatch confirmation for synthetic case `GC100028` was blocked by the
  approval service; it was cancelled safely and explicit permission was requested. The case is
  finalized but not released. No API workaround was used. Earlier live API release checks passed.
- All 78 OpenSpec checks are complete. Registration/reset/verification, route-wide keyboard audit,
  and both main walkthroughs pass. The doctor walkthrough used safe mode: it verified and cancelled
  the exact dispatch confirmation; the live API suite covers release atomics. The change is not archived.

## Remaining integration and release gates

- India is the deployment target. See [the India privacy register](india-privacy.md) for current
  IT/SPDI/CERT-In applicability, phased DPDP commencement and eight open production evidence gates.
  India residency is an explicit project policy, not described as a blanket DPDP localisation law.
  This is not a claim of DPDP/SPDI/HIPAA compliance, medical-device clearance or clinical validation.
  Deployment security, privacy, retention, access governance and applicable prescribing rules
  need the responsible team's review before real patient use.
- Email Delivered/Opened requires a verified provider event integration; none is invented here.
  Offline overdue notification scheduling is not yet implemented; current sync runs in an active
  clinician workspace. These remain requirements to resolve, not silently completed features.
- Differential likelihood is the existing high/moderate/low model output. Numeric confidence
  percentages require a validated model/schema change; this UI does not manufacture them.
- No organization switcher is shown because the application has no organization/membership model.
- Physician sign-off is authenticated and audited, not a cryptographically signed PDF or an
  e-prescribing/pharmacy integration. DICOM diagnostic rendering is not implemented.
- Hindi interface keys and fonts are present; clinical translations still require the existing
  clinician-approval process. Existing questionnaire/triage safety rules were not replaced.
- The OpenSpec implementation tasks are complete, but that does not make the application ready for
  real-patient deployment. The operational, privacy, security, clinical and regulatory evidence
  gates above still require the responsible teams before production use.
