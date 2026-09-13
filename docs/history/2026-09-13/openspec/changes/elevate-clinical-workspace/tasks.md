## 1. Design system foundations

- [x] 1.1 Replace the Tailwind token set with the clinical palette, each semantic colour carrying a text-safe `DEFAULT` and a decorative `bright`, and verify by unit test that every `DEFAULT` reaches 4.5:1 against `surface` and against white
- [x] 1.2 Add the compact density layer keyed off `data-density` on the shell, and verify the patient tree keeps its 44px minimum target while the clinician tree drops to 38px
- [x] 1.3 Add the risk-tier derivation (`emergency`/`urgent`/`routine-but-flagged`/none to Critical/High/Moderate/Routine) in one module, and verify every enum value plus the no-flag case maps exactly once
- [x] 1.4 Add the SLA helper computing time waiting and breach state from submission time, and verify the boundary at exactly 48 hours
- [x] 1.5 Extend the primitives with `MetricCard`, `StatusChip`, `RiskBadge`, `Skeleton`, `EmptyState`, `Tabs`, `Drawer`, `Timeline`, `Avatar`, `Stepper` and `SegmentedControl`, none carrying a default display string, and verify the no-hardcoded-strings guard still passes
- [x] 1.6 Add the toast provider and `useToast`, announcing through a live region, and verify a toast raised from a client action is readable by assistive technology

## 2. Routing, shell and session

- [x] 2.1 Restructure `src/app` into the `(auth)` group and the `patient/` and `doctor/` trees, and verify every previously reachable page has a new home
- [x] 2.2 Implement the workspace guard as an async layout resolving the session once, covering unauthenticated, MFA-pending, wrong-role, incomplete-profile and unconsented cases, and verify each redirect target by test
- [x] 2.3 Carry the requested path through `/login?next=` and return the user to it after authentication, and verify an unauthenticated deep link lands where it asked
- [x] 2.4 Implement the topbar with role branding, breadcrumbs, notification control and account menu, and verify the role is stated in words
- [x] 2.5 Implement sign-out clearing both cookies and revoking the refresh-token family, and verify a back-navigation after sign-out redirects to `/login`
- [x] 2.6 Add the legacy-path redirect map to `middleware.ts` preserving case identifiers, and verify `/cases/{id}` and `/doctor/cases/{id}` resolve
- [x] 2.7 Update `linkFor()` in the notification service to emit the new paths, and verify each notification type's link
- [x] 2.8 Rebuild the public landing page and the authentication screens on the shared auth layout, and verify register, login, forgot-password, reset and verify-email flows still complete

## 3. Clinical history — data and API

- [x] 3.1 Add the `case_clinical_history` table to the Drizzle schema with the JSONB shapes from design D6, and verify the generated migration applies cleanly against PostgreSQL 16
- [x] 3.2 Add `read_at` to `notification_deliveries` in the same migration, and verify existing rows are unaffected
- [x] 3.3 Add repository read and write for the history record routed through the same access context as responses, and verify both are audit-logged and consent-gated
- [x] 3.4 Refuse history writes once the case is no longer editable, and verify a post-submission write is rejected with the not-editable outcome
- [x] 3.5 Implement `GET`/`PUT /api/cases/[caseId]/history` with Zod validation of the coded condition list and the medication classification, and verify a malformed medication entry is rejected
- [x] 3.6 Pre-fill a new case's history from the patient's most recent prior case without linking the records, and verify editing the new one leaves the old one unchanged

## 4. Doctor triage

- [x] 4.1 Extend the queue query to carry patient age, sex, name for assigned cases only, flag count, highest urgency, AI snapshot and submission time, and verify a claimable case returns no name
- [x] 4.2 Implement `GET /api/doctor/metrics` returning pending, reviewed, closed and overdue counts, and verify each count matches the queue subset it links to
- [x] 4.3 Build `/doctor/dashboard` with the four metric cards linking into filtered queues, and verify the overdue card is neutral at zero and emergency-toned above it
- [x] 4.4 Build `/doctor/triage` with the filterable, searchable table, and verify filters combine, are individually clearable, and produce a distinct empty state when they match nothing
- [x] 4.5 Preserve the default ordering of risk tier then longest waiting, and verify a Critical case waiting two days outranks a Routine case waiting three
- [x] 4.6 Build `/doctor/analytics` over the existing counts, throughput and `review_diffs` override summary, and verify it exposes no individual patient identifier

## 5. Doctor case workspace

- [x] 5.1 Build the three-panel workspace with independent scroll regions, collapsing to tabs below 1280px, and verify the review panel does not move when the transcript scrolls
- [x] 5.2 Build the patient-record panel with demographics and computed BMI, history, medications with their classification, allergies, family history, red flags, documents and transcript, and verify a case with no history states so rather than rendering empty
- [x] 5.3 Frame the red-flag callout above the history with urgency in words, and verify it is visible without scrolling on a 1280px viewport
- [x] 5.4 Build the document drawer with zoom and full-screen, keeping the case behind it, and verify an unverified extract is labelled wherever it appears
- [x] 5.5 Rebuild the decision-support panel as the centre column with the differential matrix, etiology and risk factors, and suggested workup, read-only at source, and verify editable copies remain private drafts until physician approval
- [x] 5.6 Rebuild the sign-off panel with the structured fields from revised design D7, editable AI drafts and physician-authored prescriptions; verify private notes remain private
- [x] 5.7 Serialize the editable physician-approved workup as `recommendedNextSteps` for the existing wire contract, and verify the existing review and release endpoint tests still pass
- [x] 5.8 Verify substantive content is required, physician prescriptions are accepted, and only finalized, confirmed text can be dispatched
- [x] 5.9 Wire sign-and-dispatch to the existing release confirmation, and verify the chart locks and the notification is queued
- [x] 5.10 Add the per-case notification delivery audit to the workspace, and verify a `logged_only` outcome reads as not delivered

## 6. Patient workspace

- [x] 6.1 Build the patient shell and `/patient/dashboard` with the active-case timeline derived from case status, and verify AI processing state is shown separately without exposing findings or marking unavailable analysis complete
- [x] 6.2 Build the intake wizard rail mapping question clusters onto named stages, and verify a branch opening does not move the rail backwards
- [x] 6.3 Verify the wizard preserves the engine contract: nothing advances past an unpersisted answer, and a failed save keeps the answer editable
- [x] 6.4 Verify the emergency advisory still takes over the screen from the same response that saved the triggering answer
- [x] 6.5 Build the abdominal-region selector operable by keyboard with each region announced by its clinical name, and verify selection without a pointer
- [x] 6.6 Build the visual severity and stool-form aids with text labels independent of the imagery, and verify every option stays selectable when images fail to load
- [x] 6.7 Build the clinical-history stage over the new API, and verify it can be skipped and its absence reaches the doctor as "not recorded"
- [x] 6.8 Build the drag-and-drop upload stage with per-file progress, thumbnails, removal, and per-file rejection reasons, and verify a rejected file leaves its batch unaffected
- [x] 6.9 Build the review-and-submit stage listing every answer with its branching context, and verify submission is blocked while a required answer is missing
- [x] 6.10 Build `/patient/case/[caseId]` presenting the released content and standing notice, and verify no clinical content appears before release
- [x] 6.11 Add direct official PDF download and print support, and verify it contains the released content and the standing notice and nothing generated after release
- [x] 6.12 Build `/patient/records` listing prior cases with date, symptom area and outcome, and verify a prior released case shows exactly its frozen content

## 7. Notifications

- [x] 7.1 Implement `GET /api/notifications` and `POST /api/notifications/read` scoped to the caller, and verify one user cannot read another's feed
- [x] 7.2 Build the notification control and panel in the shell for both roles, and verify the unread count is announced as a count
- [x] 7.3 Distinguish urgent from routine doctor alerts in the feed with urgency stated in words, and verify the two are not visually identical
- [x] 7.4 Verify the feed renders only from the delivery record and has no clinical field available to it

## 8. Localisation, verification and cleanup

- [x] 8.1 Add every new key to `messages/en.json` and `messages/hi.json`, and verify the no-hardcoded-strings guard passes across the restructured tree
- [x] 8.2 Verify the two catalogues have identical key sets, so a missing Hindi string cannot degrade silently to English
- [x] 8.3 Run `npm run typecheck` and `npm test` across all workspaces and verify both pass
- [x] 8.4 Update the Playwright walkthroughs to the new paths and verify each completes against the compose stack
- [x] 8.5 Extend the demo-case seed to populate clinical history so the doctor workspace has a realistic record to render
- [x] 8.6 Verify keyboard reachability of every new interactive control, including the region selector, the tabs, the drawer and the account menu
## 9. Integration refinements

- [x] 9.1 Preserve drafts across tabs and viewport changes, invalidate approval after edits, and reject concurrent or stale release payloads
- [x] 9.2 Add patient acknowledgement that closes a released case while preserving its frozen summary
- [x] 9.3 Add submission-date filters and direct PDF downloads with bundled English/Hindi fonts
- [x] 9.4 Add DICOM Part 10 upload detection and authenticated content serving with working image/PDF previews
- [x] 9.5 Add visible-page refresh and under-review/overdue notification events without clinical content
- [x] 9.6 Verify new APIs enforce role, ownership, consent, audit and chart-locking boundaries

## 10. Annotated refinements and India readiness

- [x] 10.1 Restore the configured real local model and AI gateway, add a repeatable Windows launcher and verify validated assessment persistence with synthetic data
- [x] 10.2 Correct nested message namespaces and map assessment failure codes to readable English/Hindi messages with runtime translation tests
- [x] 10.3 Add immutable unique GI patient / GC case references with an additive backfill migration, preserving UUID routes and consent/audit/assignment boundaries; verify uniqueness and stability
- [x] 10.4 Refine case header, panel hierarchy and nonwrapping triage review actions; verify desktop, narrow-screen and keyboard behavior without draft loss
- [x] 10.5 Publish a primary-source India privacy register distinguishing phased DPDP commencement, current IT/SPDI/CERT-In applicability, India residency policy and unverified production gates
- [x] 10.6 Rerun typecheck, complete automated tests, production build and live API checks after the refinement migration

## 11. Review cards, AI assist and resource-aware local inference

- [x] 11.1 Reimagine the patient-record and decision-support panes as scan-friendly cards with persistent safety alerts and keyboard-operable progressive disclosure; verify all record content and provenance remain reachable at desktop and tabbed widths
- [x] 11.2 Add explicit AI-assist preview/apply actions to the physician review with one shared generation state; verify fill/append is deliberate and deduplicated, preserves existing text, invalidates approval, and cannot generate diagnosis, prescriptions, referral urgency or private notes
- [x] 11.3 Configure the installed llama.cpp runtime for a default five-minute idle sleep across launch paths, expose sleeping as healthy without waking it, and live-verify idle memory reduction, request-triggered reload, concurrent request safety and repeat sleep using synthetic data
- [x] 11.4 Update English/Hindi catalogues, tests, implementation guide and walkthrough assertions; rerun typecheck, automated tests, production build, strict OpenSpec validation and focused signed-in browser QA

## 12. Approved Navigator case workspace

- [x] 12.1 Supersede the wide three-panel layout with a persistent desktop case-section navigator and one mounted broad content canvas, retaining responsive section tabs and preserving drafts across section and viewport changes
- [x] 12.2 Rebuild the physician review in the selected flat full-width form, provide substantial resizable editors, and place compact Save/Finalize actions in a content-aligned action bar beneath the editor
- [x] 12.3 Update English/Hindi catalogues and component tests for Navigator selection, keyboard operation, one-scroll behavior, draft preservation, editor sizing and content-aligned actions
- [x] 12.4 Run typecheck, automated tests, production build, strict OpenSpec validation and signed-in browser QA at wide, tablet and mobile widths

## Verification status — 2026-09-05

78/78 tasks complete. Checked items have implementation plus code review, automated or live API
evidence. The approved Navigator browser evidence below supersedes the earlier three-panel layout.

- `npm test`: 546 passed (core 209, database 84, web 188, repository 65); the AI-service
  suite passed 102/102 in an isolated Python 3.12 environment from its declared dependencies.
- `npm run typecheck` and production build: passed.
- `npm run spec:validate`: strict non-interactive validation passed for both changes after repairing
  the repository script to invoke the documented package-qualified validator with `--all`.
- `npm run e2e:api`: 42 live HTTP checks passed after migration with real password/TOTP login, release and
  prescriptions, frozen PDF, history-copy isolation, acknowledgement, notifications, scanning,
  signed document content and logout.
- Real local-model smoke check passed; the reported case generated successfully, without release.
- Native idle testing passed with a temporary 20-second interval: repeated health checks did not
  wake the model; two concurrent real synthetic requests reloaded and completed without sleep;
  repeat sleep followed. Private memory measured about 18,059 MiB active and 383 MiB asleep.
  The final runtime was restored to the five-minute default; retained listener/driver memory is expected.
- Signed-in desktop, 900px tabs and 390px patient views inspected. Browser checks passed for
  password/TOTP deep links, logout/back, cross-role redirect, live-region toast, patient target sizes,
  the one-canvas Navigator, red-flag visibility, draft preservation and approval invalidation.
- Keyboard tabs, body map, account menu, review actions and drawer focus/Escape/return passed.
  Synthetic intake completed through emergency takeover, optional history, scanned upload and
  submission. PDF/image previews and keyboard image zoom worked. Official English/Hindi PDF
  layout was inspected over two pages. A separate screen-reader speech test was not performed.
- Focused synthetic refinement QA passed at 1800px, 900px and 390px: sticky desktop Navigator,
  responsive tabs, exact accessible labels, report separation, one content scroll, long-form editor
  sizing, content-aligned actions, card anatomy, AI preview, explicit fill/append, deduplication,
  protected fields, draft retention and no overflow. It made no save/release request.
- A fresh local synthetic account completed browser registration, verification, login,
  forgot-password, password reset and changed-password login at 390px without overflow.
- A route-wide keyboard audit passed login/MFA and every visible enabled control on the main
  doctor and patient routes, plus account-menu arrows and AI-drawer focus trap/Escape/return.
  Earlier focused checks cover the body map, document drawer and review actions.
- Final browser dispatch for synthetic case `GC100028` was blocked by the approval service;
  confirmation was cancelled and permission requested. It remains finalized, not released.
  No alternate release path was used after rejection. The earlier 42-check API run passed release.
- Main patient and doctor walkthroughs completed against the compose stack. The patient flow covered
  deterministic emergency handling. The doctor flow completed in safe mode through exact release
  confirmation and then cancelled; release atomics remain covered by the 42-check live API suite.
  Remaining older specialized walkthroughs are outside these main acceptance checks.
- Additional integration requirements remain visible in `docs/clinical-workspace.md`: provider
  email Delivered/Opened receipts, always-on overdue scheduling, validated numeric confidence,
  and operational/clinical compliance review. Existing ordinal likelihoods are not percentages.

Implementation map and page views: `docs/clinical-workspace.md`.
