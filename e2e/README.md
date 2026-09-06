# Clinical workflow verification

## Prerequisites

Use a local-only database and application. Start the project's compose services, apply migrations,
install npm dependencies, and start the application. Do not point these fixtures at production.

The new walkthroughs default to `http://127.0.0.1:3100`. Override `BASE_URL` for your local server.
In PowerShell:

```powershell
$env:BASE_URL = "http://127.0.0.1:3100"
npm run e2e:api
```

The live API suite creates its own synthetic patient, doctor, completed MFA factor and case.
It signs in normally and computes a real TOTP code; it never clears another person's MFA or
marks sessions satisfied in SQL. Fixtures use `DATABASE_URL` from the root `.env`.
Only localhost/loopback hosts are accepted for both application and fixture database.

It verifies authentication, role gates, substantive review, exact confirmation, prescription
release, locked charts, frozen PDF, acknowledgement, history prefill isolation, notification
deduplication, real scanned storage/signed content and logout. Scanning/storage services must
be healthy. These HTTP checks do not certify browser interaction or layout.

## Browser walkthroughs

Install a matching browser once:

```powershell
npx playwright install chromium
npm run e2e:doctor
npm run e2e:patient
```

Alternatively set `CHROMIUM_PATH` to an installed compatible Chromium executable.
Set `SHOTS` to override screenshot output; defaults are ignored subdirectories of `var/tmp`.

- `doctor-review.mjs`: real password/TOTP deep-link login, desktop Navigator review,
  tab/viewport draft preservation, keyboard section navigation, approval invalidation and exact
  release confirmation.
  Safe mode is the default and cancels at confirmation. Only set `CONFIRM_SYNTHETIC_RELEASE=1`
  when the user has explicitly authorized the medical release action; that opt-in continues through
  release locking, private-note isolation, patient PDF, mobile overflow, role redirect and logout.
- `patient-walkthrough.mjs`: registration, verification, profile and consent, then the bleeding
  pathway until the emergency interruption. Only its newly registered synthetic account receives
  a known verification-token hash. It uses parameterized SQL through the configured local
  database, not shell-interpolated psql. This is not yet a full all-pathways intake test.
- `auth-workflows.mjs`: register, verify, login, forgot-password, reset and changed-password login
  for one fresh local synthetic account, including a 390px layout check. Like the patient
  walkthrough, it replaces only that fixture user's one-time-token hash with a known local token;
  no real account or mailbox is read.
- `keyboard-audit.mjs`: keyboard-only login/MFA plus every visible enabled control on the main
  doctor and patient routes, with dedicated menu arrow-key and AI-drawer focus-trap/return checks.
  It complements the body-map, document-viewer and review-keyboard assertions in the focused
  walkthroughs; browser-native controls retain their standard keyboard behavior.

Run these sequentially: the doctor's fixture credentials file is shared with its code helper.
Fixtures and synthetic clinical/audit records are intentionally retained for inspection.
Credentials live only in ignored `var/tmp/clinical-fixture.json`; do not commit or share that file.

## Real local AI and image checks

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-ai.ps1
node e2e/ai-live.mjs
```

The AI check requires the configured real llama.cpp model and gateway on their local ports. It
creates a new synthetic fixture, performs real password/TOTP login and verifies stored, validated
model output. It never finalizes or releases a summary. Allow several minutes for inference.
It rejects an identified stub and does not silently select a cloud provider. An ungrounded result
is reported as such; this smoke check does not establish clinical quality.

`node e2e/image-preview.mjs` uploads a one-pixel synthetic PNG to the **current fixture patient's
existing in-progress case** using normal authentication and the live scanner. It neither creates
nor submits a case. It prints the documents page for a separate browser rendering check; an HTTP
success alone is not a preview pass. Do not run fixture-creating scripts while another walkthrough
still depends on the shared credentials file.

## Current verification

The additional `review-refinement.mjs` walkthrough creates a fresh synthetic case and checks
card headings, explicit AI preview/adoption, append preservation, duplicates, protected fields,
sticky desktop Navigator behavior, exact accessible tab names, draft retention, long-form editor
sizing, content-aligned actions, responsive tabs and mobile overflow. It does not save, finalize
or release. Set `RUN_LIVE_AI=1` to additionally generate through the real provider from the drawer
and verify that fresh AI output does not overwrite the physician draft. Screenshots are retained
in ignored `var/tmp/review-refinement/`.

`node e2e/model-idle.mjs` checks sleeping, non-waking gateway health, two concurrent synthetic
non-clinical completions, automatic reload and repeat sleep. It does not reconfigure processes.
For an accelerated run, start the verified idle model with `-IdleSeconds 20`, set
`TEST_MODEL_IDLE_SECONDS=20`, run the check, then restore `-IdleSeconds 300`. The test's generation
must last longer than the test idle interval to verify in-flight protection. Never do this while
someone is generating a real assessment.

On 2026-09-05, 42 live HTTP checks remained recorded after the reference migration, alongside
546 passing automated tests, all-workspace type checking, production build and strict OpenSpec
validation. The separate AI-service suite passed 102/102 tests. The real local-model smoke check
passed; the original reported case also generated successfully without release. The final
Navigator walkthrough passed at 1800px, 900px and 390px.

Manual signed-in browser coverage passed for deep-link/MFA login, logout/back, wrong-role redirect,
desktop/tabbed/mobile layout, draft preservation and approval invalidation, emergency interruption,
intake submission, body-map keys, account menu and document drawer focus behavior. PDF/image
previews and keyboard image zoom worked. Official English/Hindi PDF layout was inspected separately.

The final synthetic browser dispatch confirmation was blocked by the approval service and remains
pending explicit user permission. No alternate release path was used after that rejection.
The dedicated registration/reset flow, route-wide keyboard audit and both main walkthroughs pass.
The doctor walkthrough used its default safe mode and cancelled at the exact release confirmation;
the prior live API suite covers the atomic release path. No browser release was performed.

## Additional existing tools

`doctor-onboarding.mjs`, `ai-analysis.mjs`, and `verify-hindi.mjs` are older specialized
walkthroughs and are not part of the verified refinement suite. Their fixture helpers and
selectors still need reconciliation before use with the new workspace. In particular, old
expectations that physician prescriptions or adopted AI drafts are refused no longer apply.

`stub-llama-server.mjs` is an explicitly synthetic model stub on port 8099, not a diagnostic
model or evidence of clinical model quality. Never substitute it for the real model without
clearly labelling the environment.

For a realistic record in an existing doctor's queue, the existing `npm run demo-case --
doctor@example.com` command now also populates clinical history.

## Reading the screen

UI assertions should use rendered text, roles and labelled controls. Next.js includes the message
catalogue in script payloads, so `textContent('body')` can report text that is not on screen.
`support/page-text.mjs` provides visible-text helpers. Full delivered-content checks are useful
separately for verifying that private information never reaches the patient's device.
