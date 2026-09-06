## Why

The MVP proved the clinical loop works. It does not yet look or behave like a system a
gastroenterologist would trust with a patient's history. Every screen is a single centred column
of cards on a 5rem-wide page; the doctor's queue is an undifferentiated list with no counts, no
filters and no service-level signal; the case view is two stacked columns that make the doctor
scroll past the whole questionnaire transcript to reach the sign-off box; and the patient's
interview is a bare one-question-at-a-time flow with no sense of where they are or how much is
left. There is no application shell, no way to sign out, no notification surface, and no route
structure that separates the patient's world from the clinician's.

Three consequences matter clinically rather than cosmetically.

A reviewing doctor cannot see, at a glance, which of their cases is breaching review time. The
red-flag engine already classifies urgency at submission, but nothing in the interface turns that
into a work-management signal, so an emergency-flagged case and a routine one look equally
patient until the doctor opens each in turn.

A doctor signing a clinical opinion is doing so on a partial record. Past medical and surgical
history, current medications (including the NSAID and PPI use that changes the entire reading of
an upper-GI presentation), family GI history and basic anthropometry are not collected anywhere.
The questionnaire asks about the presenting complaint and stops.

Neither party can see whether the system actually told the other anything. Notification delivery
is recorded in `notification_deliveries` with a real outcome — including `logged_only`, which
means nothing left the process — but that record is invisible in the interface, so a released
summary whose email hard-bounced looks exactly like one the patient read.

This change rebuilds the interface layer on a proper design system, splits it into role-isolated
workspaces behind route guards, adds the clinical-history record the review depends on, and
surfaces the notification trail that already exists in the database.

## What Changes

- **Annotated review refinements.** Stable `GI` patient and `GC` case references replace UUID fragments in clinical views. The record becomes a scan-friendly collection of measurement, history, medication, allergy, report and expandable transcript cards. The approved desktop Navigator replaces the cramped three-column view with persistent case-section navigation, one broad reading canvas and one page scroll; narrow screens retain the familiar section tabs. Evidence in decision support uses progressive disclosure. The physician review uses full-width long-form editors, explicit AI-assist preview, and a compact content-aligned action bar without silently replacing text or generating prescriptions.
- **Recoverable local AI runtime.** Add Windows and development-launcher support for native llama.cpp idle sleep (configurable, five minutes by default), automatic wake on an inference request, non-waking health checks and readable localized loading/failure states. Verify real memory release and wake with synthetic data. Active requests must not be interrupted; no unrelated process is stopped. AI failure must never prevent manual review or emergency advice.
- **India privacy baseline.** Maintain an India-specific legal applicability and readiness register covering the IT Act/SPDI Rules, phased DPDP Act/Rules commencement, and CERT-In directions. India-region hosting is a project policy, not a claim that DPDP imposes blanket localization. Document production gates without asserting certification.
- **Role-isolated routing.** `/patient/*` and `/doctor/*` become separate workspaces, each with
  its own layout, navigation and server-side guard. Authenticated cross-role access is refused at
  the layout boundary and redirected to the caller's own workspace with an explanation, rather
  than relying on each page remembering to check. Legacy paths (`/cases/*`, `/start`,
  `/doctor/queue`, `/doctor/cases/*`, `/profile`, `/consent`, `/privacy`) redirect to their new
  homes so existing notification links keep working.
- **An application shell.** A persistent topbar carrying role-specific branding, breadcrumbs, the
  notification bell, and an account menu with an explicit sign-out that clears both cookies and
  the server-side session family. This is the first build in which a signed-in user can sign out
  from the interface at all.
- **A design system.** Tokens retuned to a clinical slate/cyan palette with every foreground pair
  meeting WCAG 2.1 AA against its own background, a four-tier risk scale that maps the existing
  three-value `urgency` enum plus the unflagged case onto Critical / High / Moderate / Routine, a
  denser type and spacing scale for the clinician workspace that leaves the patient's comfortable
  reading scale untouched, plus skeletons, empty states, toasts, tabs, drawers and a data-table
  idiom.
- **A triage dashboard** with counts of pending, reviewed, closed and SLA-breaching cases, and
  a filterable, searchable case table carrying risk tier, an AI clinical snapshot, patient age and
  sex, time in queue, and a direct action into review.
- **A Navigator case workspace** replacing the stacked and three-column reviews: a persistent
  desktop section navigator opens the patient record, reports, AI decision support and physician
  review in one broad content canvas with one page scroll. Narrow screens use the same sections as
  tabs. The physician review adopts a flat, full-width long-form editor and keeps save/finalize
  actions beneath the clinical content rather than in the navigation rail.
- **A clinical-history record**, captured per case rather than per patient so that a signed review
  is anchored to what was true at submission. Covers comorbidities, prior GI and abdominal
  surgery, current prescription and over-the-counter medication, allergies, family GI history,
  and height and weight for BMI.
- **A stepped intake wizard** replacing the bare interview: named stages with a progress rail,
  an interactive abdominal-quadrant selector, visual severity and stool-form reference aids, a
  drag-and-drop upload zone with per-file progress and thumbnails, and a final review-and-submit
  stage.
- **A patient case timeline** showing Submitted to AI processing complete to Under review to Summary ready as real state
  derived from the case record, with the doctor's released summary presented for reading rather
  than as a wall of text, a downloadable official PDF, and patient acknowledgement that closes the case.
- **An in-app notification centre** for both roles, backed by the existing
  `notification_deliveries` table extended with a read timestamp, plus a per-case delivery audit
  showing what was sent, when, and whether it actually reached a mail server.

## Non-goals

- **No autonomous diagnosis or prescribing.** AI output remains a private decision-support artifact. Per the approved refinement, a physician may edit and adopt an AI draft and manually author prescription instructions. Finalization records physician approval; a separate confirmation releases only that finalized version.
- **No patient-facing raw AI output.** The differential, the likelihoods, the grounding versions
  and the model's prose remain doctor-only. The patient sees the doctor's released content and
  nothing else.
- **No new clinical content.** The question bank, branching rules and red-flag rule set are
  untouched. The intake wizard restructures how the existing engine is presented; it does not add
  or reword clinical questions.
- **No change to the authorization model.** Route guards are a usability affordance layered on
  top of API-layer RBAC, never a replacement for it. Every clinical read still goes through the
  repository's consent and audit hooks.

## Capabilities

### New Capabilities

- `platform/design-system`: the token set, contrast contract, risk scale, density scale and
  shared interface primitives every workspace is built from.
- `platform/navigation`: role-isolated route structure, the application shell, server-side route
  guards, breadcrumbs, and session sign-out.
- `intake/clinical-history`: per-case comorbidity, surgical, medication, allergy, family-history
  and anthropometry capture, and its presentation to the reviewing doctor.

### Modified Capabilities

- `review/doctor-dashboard`: adds triage metrics, filtering and search, the four-tier risk scale,
  the SLA signal, the Navigator workspace, patient identity for the assigned doctor only, the
  structured sign-off, and the per-case notification audit.
- `intake/case-management`: adds the staged wizard presentation, the drag-and-drop upload zone,
  and the patient-facing case timeline.
- `platform/notifications`: adds in-app delivery of the notifications already being sent, an
  unread count, and the per-case delivery audit trail.

## Impact

- `packages/db`: a per-case history table, notification read timestamps and event deduplication,
  lifecycle notification types, three additive migrations including stable references, and audited repository methods.
- `apps/web`: the `src/app` tree is restructured into `(auth)`, `patient/` and `doctor/` trees;
  `src/components` gains `shell/`, `ui/`, `patient/` and a rebuilt `doctor/`; `tailwind.config.ts`
  and `globals.css` are replaced; `middleware.ts` gains legacy-path redirects; the message
  catalogue gains roughly 200 keys in both English and Hindi.
- `packages/core`: unchanged. No safety logic moves.
- `services/ai` and `scripts/`: non-waking runtime health, idle-sleep configuration and live unload/wake verification. No model download or provider change.
- `e2e/`: the Playwright walkthroughs are updated to the new paths.
