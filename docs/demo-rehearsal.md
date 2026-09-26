# Hospital demo rehearsal

Updated 26 September 2026. Working branch: `claude/gi-compass-clean-slate`.
This is a complete **synthetic demonstration**, with DRAFT clinical content. It is not
authorisation to use identifiable patient reports or a claim of diagnostic accuracy.

## Start and check the demo

From the project folder in PowerShell:

```powershell
npm run demo:start -- -Production
npm run demo:preflight
npm run demo:status
```

The starter reuses running services and opens new background processes without visible
terminal windows. It starts the app at **http://localhost:3000** and the independent demo
worker. The current selected provider is Gemini; Supabase Auth/database and Gemini need
Internet. Leave the laptop powered and prevent sleep during the presentation. Do not
change providers immediately before the demonstration. When the local provider is selected,
the starter also launches the pinned local model at 127.0.0.1:8081; this is not required for
the current Gemini setup.

For a production build, stop the app process you started, run `npm run build`, then
`npm run demo:start -- -Production`. Do not run a second server on port 3000 or rebuild
the same output folder while it is serving. An already running app is left alone.

Preflight checks runtime configuration, the designated Cloud project, model identity/context,
sample report, web app, worker process and successful access to both backend RPC channels.
A fresh heartbeat alone cannot pass when a backend failure is unresolved. Worker logs under `var/demo-runtime`
contain status/error codes, not patient content. Local-model configuration stays in ignored
`.env.model` (`LLAMA_SERVER_BIN`, `LLAMA_MODEL` and pinned SHA256 values; see
`.env.model.example`). Credentials remain in the existing
ignored `.env`, `.env.operator` and `.env.test`; no paid OTP provider is needed.

After worker code changes, use `npm run demo:start -- -RestartWorker`. For an intentional
restart of the recorded demo model, use `npm run demo:model -- -Restart`; it refuses to
stop an unrelated process. Neither command downloads a model or changes cloud providers.

If a prepared example previously failed after an interrupted run:

```powershell
npm run demo:status -- --retry-failed
```

This queues only failed, unreleased **prepared fictional examples** for actual inference.
It preserves completed AI assessments and existing encounters. A clinician can also retry
a failed assessment in the comparison workspace. There is no fabricated fallback result.

## Use two browser profiles

Use Edge/Chrome's separate profiles or a normal and InPrivate window. Keep one for the
clinician, the other for the patient. Two tabs in one profile share cookies and are **not**
separate users. Staff sign-in uses the existing email/password and authenticator. Do not
reset an enrolled factor just for the demonstration.

In the patient profile, open **http://localhost:3000/start/gi-clinic** and select
**Begin questionnaire**. This creates a restricted two-hour encounter session without
patient or staff sign-in. The separate clinician profile stays at `/staff`. A staff-created
visit can still use **Start / resume patient intake**; that action signs staff out of the
shared device. See [provider and entry configuration](reference/ai-providers.md).

Physical tablets on a different device need a deliberately configured HTTPS origin and
network access; `localhost` on a tablet refers to that tablet. The current setup is rehearsed
on the laptop, with desktop/tablet/phone browser widths. Do not improvise public tunnelling
or change Auth/origin settings during the presentation.

## Suggested 10–15 minute walkthrough

1. **Set context.** All names, history and reports are invented. Explain that this collects
   symptoms and existing evidence, suggests preliminary possibilities, and records a
   separate clinician assessment. It does not diagnose cancer autonomously.
2. **Show a prepared case.** Sign in as a clinician and open the review queue. Three scenarios
   per seeded site cover bowel changes/bleeding, persistent upper-abdominal symptoms without
   reports, and jaundice. Prepared cases have a visible label and simulated consent.
   Available AI output was generated from the saved facts; check the recorded provider
   rather than describing an older result as a fresh Gemini response. Leave at least one
   prepared case unreleased for the presentation. Use the current-prompt cases listed in
   [the readiness record](demo-readiness-2026-09-26.md). Older output is withheld and labelled
   **AI needs refresh**; a stored old result is not a current successful assessment.
3. **Start a fresh encounter** from a synthetic patient in the second browser profile. Use
   the public `/start/gi-clinic` route in the patient profile. Explain the session reset and
   separation from the staff account. Handoff is for transferring an existing staff-created
   encounter and signs staff out of that profile.
4. **Consent and details.** Explain that the demonstration uses invented information, then
   record consent and who provides/enters the answers. Enter fictional details manually.
   For a short meeting, show several topics here and use an already prepared fictional
   case for the complete clinician/AI workflow; there is no patient-facing auto-fill shortcut.
5. **Questionnaire.** Show named topic progress, relevant follow-up questions, Save and pause,
   and optional extra detail. Unknown/declined remains distinct from “No”. A linked current
   danger scenario displays Important advice while Continue remains available. The DRAFT
   rules run without waiting for AI; the application has no calling or SOS feature. Do not
   spend the meeting completing every optional question.
6. **Optional report.** Upload `public/demo-assets/synthetic-whole-body-report.pdf`, also available at
   [the local sample-report URL](http://localhost:3000/demo-assets/synthetic-whole-body-report.pdf).
   Open the original, show page/zoom controls, and check extracted proposals against it.
   Show processing progress and source-linked findings; their count can vary by model
   output. Also available: `public/demo-assets/synthetic-written-imaging-report.pdf`, with
   fictional ultrasound, CT and historical MRI text. Completed machine extraction enters
   preliminary AI automatically. Staff can optionally correct/reject findings, but there
   is no verification prerequisite. All findings retain their document, date, page and
   unreviewed status. Manual staff additions need confirmation against the original.
7. **Submit.** The patient sees saved status and continuing urgency advice. Assessment waits
   for pending reports to finish; unavailable reports remain explicitly unknown. A durable job runs
   independently of the page. Inference can take several minutes, especially after
   startup or a rejected output that requires another attempt. Switch to a previously
   generated example while the live job runs; describe it honestly as previously generated.
8. **Clinician review.** In the clinician profile, open that encounter. Review source history
   and original reports, enter an independent impression, specialty, urgency and patient
   instructions. Drafts autosave. Record whether the patient has already disclosed the AI
   assessment. Saving this assessment unlocks AI comparison; simply opening a case does not.
9. **Compare and clarify.** Show actual urgency/specialty agreement, the possible diagnoses
   and evidence. Record agreement or a coded difference with a reason. Send a clarification
   request and reply from the patient profile. Messages do not silently change clinical
   facts; corrections require reopening/updating intake and submitting a new version.
10. **Release and reset.** Return to the final patient plan, edit as needed and explicitly
    release. The patient sees the clinician plan separately from preliminary AI. Private
    notes stay private. End the patient tablet session before handing it to someone else.

Use **Start new encounter** for another demonstration. Released plans are not overwritten.
For an unfinished form, use **Review saved incomplete intake** in the clinician workspace;
the missing answers remain visible as unknown and no AI output is fabricated.

## Reports: what works now

- PDF, JPEG and PNG, up to 5 MB per file, five files per encounter, PDF maximum 30 pages.
- Original PDFs render with page/zoom controls; photos can be inspected in a larger view.
- Readable laboratory, ultrasound, CT, MRI, endoscopy, pathology and other written reports
  produce type/date/page/source-linked findings used automatically by preliminary AI.
  The live demonstration rehearsal verifies blood, ultrasound, CT and MRI text; broader
  extraction accuracy across document formats remains a clinical evaluation task.
- Scans/photos use model image reading when the configured provider supports vision;
  manual transcription remains available when extraction fails or is incomplete. Readable
  PDFs prefer embedded text. This is extraction of written reports, not interpretation of
  MRI/CT pixels or DICOM, and extraction accuracy has not been clinically validated.
- Small or nearly blank photos are rejected. These quality checks are basic heuristics,
  not a validated guarantee of legibility. Inspect the original and retake unclear images.
- Use the supplied fictional report. Keep identifiable real reports outside this demo.

## Recovery during rehearsal

The current intake uses named main topics and an optional-detail menu. The main route
contains every warning-rule dependency; omitted details remain unknown. Save and pause
restores the exact topic. Historical content versions keep their original flow.

Reports now show waiting, page progress, failure, interruption or no extracted findings
explicitly. Readable PDFs use embedded text before image processing. Staff can use
**Retry processing** for failed/interrupted reports without saved findings; verified or
manually recorded evidence is preserved. The original remains available for review.
Short clinician impressions are valid; blank required fields receive an inline error.
Saving unchanged report findings preserves the clinician draft and source version;
an empty unchanged verification cannot be saved from the UI.
Report progress and retries preserve in-progress clinician text. Changed evidence preserves
both saved drafts and unsaved local text, but disables signing against older facts. Review
the updated findings, then select **I have reviewed the updated facts** to continue with
the retained draft. Unsaved edits still require saving before closing the browser. Released
plans cannot be silently changed by background processing.

Run `npm run demo:verify-recovery` for a focused real Auth/MFA browser check of short
assessment saves, historical drafts, report failure/retry and the leased report worker
at three viewport widths. It uses the existing isolated test project, temporary fictional
identities and the generated whole-body report with the configured AI provider. It
does not reprocess uploaded owner documents or submit an owner's saved assessment.

| Situation | Action |
| --- | --- |
| AI queued | Check `demo:preflight` and worker status. Clinician review remains available. |
| AI unavailable | Show the honest unavailable state; use a completed prepared example or clinician Retry. Do not present it as a successful AI result. |
| Save conflict | Keep the page open and copy unsaved entries before reloading to review the current facts. Avoid editing one intake in multiple tabs. |
| Staff session expires | Sign back in with TOTP. Saved drafts remain in the encounter. |
| Patient session ends | Staff creates a fresh handoff for that encounter. Do not share staff cookies or bearer tokens. |
| No Internet | Cloud Auth/database cannot function; restore connectivity. There is no offline database substitute. |

To repeat the full actual demo-project rehearsal with disposable fictional identities:

```powershell
npm run demo:rehearse -- --demo
```

This uses the running app on port 3000 and its independent configured worker. It creates
an isolated fictional clinic inside the existing demo project, tests separate browser
profiles, uploads both generated reports, submits without staff verification, checks
source-linked AI, saves/releases a clinician plan and ends the patient session. It
deactivates the temporary identity/entry afterward and retains audit history. Some
questionnaire answers are loaded from an explicit fixture through the normal API; this
is not a timed human completion study. Screenshots contain fictional records only.

The current consent notice is `gi-privacy-2026-09-26`. Entry and consent identify this
as a fictional demonstration and disclose external AI processing. The notice is not an
approved real-patient hospital privacy notice. No India-only Gemini residency is claimed.

Run `npx tsx scripts/verify-prepared.ts` to check the three deterministic current-prompt
fictional clinic examples against the output boundaries. It audits its read and prints
status only. `--refresh-invalid` can regenerate a failing fictional example only if it has
no released plan, saved clinician draft or independent assessment; recheck after processing.
Older examples remain preserved and are counted separately by `demo:status`.

## Verification and remaining gates

The rehearsal uses real Supabase test Auth/MFA, an isolated production build, the actual
sample PDF and the configured provider when run with `--live-ai`. It checks patient/staff isolation, source verification,
independent clinician assessment, comparison, release, reset and three viewport widths.
Current results/screenshots are synthetic and local under `var/ui-review`. Run
`npm run demo:rehearse -- --live-ai` to repeat with actual inference, or omit the flag to
check the honest AI-unavailable path. This creates isolated temporary test identities and
preserves their append-only test encounter/audit history. It does not reset demo credentials.

Clinical sign-off, patient-facing diagnostic safety validation, regulatory review, hospital
approval, retention/consent arrangements and India regional Azure deployment are still
pilot gates. Foundation log-retention/CI evidence and independent Claude review remain
tracked separately. A successful software rehearsal establishes workflow operation, not
clinical accuracy, time savings or real-world adoption.
