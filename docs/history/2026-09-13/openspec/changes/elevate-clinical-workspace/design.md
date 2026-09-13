## Context

The MVP's interface was built to prove the clinical loop, and it did. Its shape is that proof:
one `max-w-5xl` column, a `Card` primitive, and page-level `redirect()` calls standing in for a
navigation model. Everything below is about turning that into something two very different users
can work in — a patient answering on a phone while anxious, and a gastroenterologist triaging
twenty cases between clinics — without loosening any of the safety constraints the MVP put in
the data-access layer.

Three existing decisions constrain every choice here and are not revisited:

- Patient-facing text comes from the message catalogue. This is enforced by
  `apps/web/src/__tests__/no-hardcoded-strings.test.ts`, which scans every `.tsx` under
  `src/app` and `src/components` for JSX text runs and display attributes. Every new component
  takes its strings from the caller.
- Meaning is never carried by colour alone. Every urgency, status and delivery state also
  carries a word.
- RBAC is enforced at the API layer. Nothing added here is permitted to be the only thing
  standing between a role and data it should not see.

## Goals / Non-Goals

**Goals**

- A design token set with a stated contrast contract, so "is this colour allowed here" has an
  answer that is checkable rather than aesthetic.
- Two densities from one system: comfortable for the patient, compact for the clinician.
- Route structure that makes the workspace boundary explicit and guards it in one place.
- The clinical history the reviewing doctor needs, captured at intake, frozen with the case.
- Delivery truth surfaced: what was sent, when, and whether it actually left the process.

**Non-Goals**

- Not a component library. Primitives are added when a second caller needs one, not in advance.
- No client-side state management library. Server components hold server state; `useState` holds
  the draft the user is typing. The one shared client concern — toasts — is a context provider.
- No animation framework. Transitions are CSS, and all of them respect
  `prefers-reduced-motion`, which `globals.css` already honours globally.

## Decisions

### D1 — Retune the existing tokens rather than introduce a parallel palette

The brief names a palette by hex: slate `#0F172A`, cyan `#0EA5E9`, red `#EF4444`, amber
`#F59E0B`, emerald `#10B981`, background `#F8FAFC`. Four of those five accents fail WCAG AA as
foreground on white — cyan `#0EA5E9` is 2.9:1, amber `#F59E0B` is 2.1:1, emerald `#10B981` is
2.5:1, red `#EF4444` is 3.8:1 — and the existing components use them as *text* (`text-accent`,
`text-urgent`) as often as as fills.

So each semantic colour becomes a pair rather than a single value: a `DEFAULT` dark enough to be
legible as text and to carry white text as a fill, and a `bright` holding the brief's exact hue
for use where nothing is read against it — focus rings, active-tab underlines, the fill of a
progress bar, a chart stroke, the left edge of a flagged row.

| token | DEFAULT | contrast on white | bright | faint |
| --- | --- | --- | --- | --- |
| `accent` | `#0369A1` | 5.7:1 | `#0EA5E9` | `#E0F2FE` |
| `emergency` | `#B91C1C` | 6.4:1 | `#EF4444` | `#FEF2F2` |
| `urgent` | `#B45309` | 5.0:1 | `#F59E0B` | `#FFFBEB` |
| `caution` | `#854D0E` | 6.9:1 | `#EAB308` | `#FEFCE8` |
| `ok` | `#047857` | 5.2:1 | `#10B981` | `#ECFDF5` |

The neutral ramp is the brief's slate: `ink` `#0F172A`, `ink-muted` `#475569` (7.5:1),
`ink-faint` `#64748B` (5.0:1 — raised from the MVP's `#8194A0`, which was 3.0:1 and was being
used for timestamps a doctor has to read), `line` `#E2E8F0`, `line-strong` `#CBD5E1`,
`surface-sunken` `#F8FAFC`.

Because the token *names* do not change, every existing screen inherits the new palette without
being touched.

### D2 — Four risk tiers over a three-value enum

The brief asks for Critical Red / High Amber / Moderate Yellow / Routine Green. The database has
`urgency` as `emergency | urgent | routine-but-flagged`, and a case may have no flags at all.
Those are exactly four states, so the tier is derived, not stored:

| tier | derived from | tone |
| --- | --- | --- |
| Critical | highest flag is `emergency` | `emergency` |
| High | highest flag is `urgent` | `urgent` |
| Moderate | highest flag is `routine-but-flagged` | `caution` |
| Routine | no flags triggered | `ok` |

Deriving rather than storing means the tier can never disagree with the flags it came from, and
no migration is needed. `riskTier()` lives in `apps/web/src/lib/risk.ts` and is the only place
the mapping exists.

### D3 — Density as a shell attribute, not a component prop

The patient's interface is deliberately large: 17px base, 48px targets, capped line length. A
clinician reading twenty cases wants the opposite. Rather than every component taking a `dense`
prop, the doctor and admin shells set `data-density="compact"` on their root element, and
`globals.css` responds:

```css
[data-density='compact'] { font-size: 15px; line-height: 1.5; }
[data-density='compact'] .gi-card { @apply p-4; }
[data-density='compact'] .gi-input { min-height: 38px; }
```

Touch targets stay at 44px minimum in the patient tree because that is where mis-taps produce
wrong clinical answers. In the clinician tree, where the input device is a mouse and the cost of
a mis-click is a re-click, 38px is the compact floor.

### D4 — Route groups for auth, plain directories for the workspaces

`(auth)` is a route group: `/login`, `/register`, `/forgot-password` and friends stay at the top
level but share a split-screen layout. Role paths live under `app/patient/` and `app/doctor/`.
Patient `(workspace)` and `(onboarding)` route groups share the patient shell but apply different
profile/consent gates to avoid redirect loops. Their layouts and `app/doctor/layout.tsx` call
the same guard; React request caching deduplicates session resolution within a server render.

The guard's contract:

| condition | outcome |
| --- | --- |
| no session | `/login?next=<path>` |
| `mfaPending` | `/mfa` |
| wrong role | that role's own dashboard, with `?denied=1` |
| patient, profile incomplete | `/patient/profile` |
| patient, no storage consent | `/patient/consent` |

`?denied=1` is read by the shell, which raises a toast. This keeps the redirect a pure
server-side decision while still explaining itself, without a session flash message table.

This is a usability affordance. Every API route still declares `roles:` and every clinical read
still runs the repository's consent and audit hooks; the guard removes the dead-end, not the
check.

### D5 — Legacy paths redirect in middleware

`middleware.ts` already runs on every non-static request to mint the CSP nonce, so the legacy
map costs one array scan there and keeps `app/` free of a dozen redirect-only files. Email links
already in flight (`/cases/{id}`, `/doctor/cases/{id}`) resolve; `linkFor()` in the notification
service is updated so new mail points at the new paths directly.

### D6 — Clinical history belongs to the case, not the patient

A patient-level history record would mutate under a case a doctor has already signed. The review
would then no longer describe the record it was made against, which is the thing the whole
audit design exists to prevent.

So `case_clinical_history` is at most one row per case, created on the first history save, editable while
the case is `in_progress`, and frozen on submission by the same `assertEditable` path that
already freezes responses.

Shape — JSONB arrays rather than child tables, because nothing queries across them and the
questionnaire's own answers already establish JSONB as how clinical values are stored here:

```
case_id                 uuid  pk fk -> cases
height_cm               integer                -- nullable; BMI needs both
weight_kg               numeric(5,2)
conditions              jsonb  [{ code, label, sinceYear?, notes? }]
surgeries               jsonb  [{ label, year?, notes? }]
medications             jsonb  [{ name, kind: 'prescription'|'otc', frequency?, notes? }]
allergies               jsonb  [{ substance, reaction? }]
family_history          jsonb  [{ relation, condition, ageAtDiagnosis? }]
lifestyle               jsonb  { smoking, alcohol, diet? }
completed_at            timestamptz            -- null until the patient finishes the step
created_at / updated_at timestamptz
```

BMI is computed at render, never stored: a stored BMI can disagree with the height and weight
beside it.

`code` on a condition is drawn from a small closed list (`ibd`, `gerd`, `peptic_ulcer`,
`chronic_liver_disease`, `diabetes`, `hypertension`, …) with `label` carrying free text for
"other", so the common cases are analysable and the uncommon ones are not lost.

Reads and writes go through `ClinicalRepository`, so they inherit consent checking and audit
logging exactly as responses do. The doctor reads it under `share_with_assigned_doctor` like
every other clinical panel.

**Patient-reported medications are not prescribing.** Medication history accepts named prescription
and OTC products. The core AI output guard still excludes autonomous prescribing; the physician
editor accepts manually authored prescription instructions under the user-approved policy.

### D7 — Physician-owned drafts, prescriptions, and frozen release

The user explicitly approved editable AI drafts and physician-authored prescriptions. Patient-facing text now uses explicit AI-assist preview and adoption rather than automatic copying. The physician can generate fresh insights or preview the existing assessment, then fill empty summary/workup fields or explicitly append suggestions while keeping existing text. Adoption is deduplicated, respects field/action limits, invalidates approval, and never writes diagnosis, prescription, referral urgency or private notes. Prescription instructions start empty and are typed by the physician. AI output itself is immutable and cannot independently release content.

Structured fields are clinical impression, diagnosis, patient summary, dietary advice, precautions, referral urgency, follow-up, prescription instructions, editable workup actions, and private notes. Private reasoning and notes never enter the released object. The existing JSONB review stores these fields without a schema migration. The core AI output guard continues to forbid autonomous prescribing; the physician review no longer applies a drug-name blacklist.

Saving invalidates finalization. Draft content and finalization are persisted in one transaction under a case-row lock. Dispatch is disabled after edits until the current draft is finalized again. The release endpoint compares confirmation with the finalized record, and the repository performs a conditional update on state and content to reject concurrent edits or duplicate dispatch. Released charts are immutable. Late AI completion cannot rewind reviewed or released cases. The exact release is the only source for the patient page and PDF.

The recommendedNextSteps wire field contains one physician-approved workup action per line alongside structured fields. Older clients may omit new fields only when the finalized values equal their empty/default values; omitting a nonempty prescription blocks release. Confirmation must match all patient-facing finalized fields.

The Navigator keeps each case section mounted once while switching the visible section, avoiding duplicate editors and lost drafts. At narrow widths the same mounted sections are presented as tabs. This is product behavior, not a claim of HIPAA certification or legal authorization to practice.

### D8 — Notification centre reuses the delivery table

`notification_deliveries` already holds one row per notification with a real outcome, including
`logged_only` for "no SMTP configured, nothing was sent". Adding `read_at` turns that table into
the in-app feed as well, which means the bell and the email can never disagree about what the
system told someone.

`GET /api/notifications` returns the caller's own rows with a rendered title key and the case
reference; `POST /api/notifications/read` stamps `read_at`. The feed carries no clinical content,
which is already guaranteed by `assertNoClinicalVariables` at the point of queueing.

Delivery chips reflect stored outcomes: queued, sent, logged-only/not sent, bounced, and dropped.
Sent means accepted by the configured SMTP transport, not inbox delivery. In-app read timestamps
are shown separately from email delivery. Verified email Delivered/Opened states remain an open
integration requirement: no provider receipt/webhook or email-open tracking is configured.
Under-review events are sent when a review starts. Overdue events are deduplicated per case and
doctor and currently synchronized while a doctor workspace is active; offline scheduling remains
an operational gap rather than a claimed always-on alert service.

### D9 — The intake wizard wraps the existing engine, it does not replace it

The questionnaire engine computes the active path server-side and returns one next question at a
time. That is the safety-relevant behaviour — an answer is persisted before anything advances,
and the red-flag advisory is rendered from the same response that saved the answer.

The wizard therefore adds a *presentation* layer: stages are derived by mapping each question's
`cluster` onto a named stage, and the rail shows which stage the current question sits in and
how many stages remain. The engine's one-question-at-a-time contract, its persistence guarantee,
and the emergency interruption path are untouched.

Stage order: Symptoms → Pain mapping → Visual indicators → Background → History & medications →
Reports → Review & submit. The first four reflect engine clusters; the final three wrap history,
uploads and answer review. Profile and consent are separate onboarding routes. The furthest
visited engine stage never decreases when conditional branches open.

The patient timeline includes an operational AI milestone. Only persisted processing outcome is
exposed, never assessment text, differentials or likelihoods. Unavailable/skipped analysis is
labelled explicitly; physician review can proceed without waiting on the AI service.

### D10 — No hardcoded strings, which shapes the component API

Every primitive added here takes its display text as props. `EmptyState` takes `title` and
`body`; `MetricCard` takes `label`; `StatusChip` takes `children`. None has a default string.
This is not stylistic: the guard test scans for JSX text runs of four or more letters, so a
default would fail the build, which is the intent.

### D11 — Stable human-readable references, unchanged authorization

PostgreSQL assigns immutable, unique identity numbers to users and cases, starting at 100001.
Patients display as `GI100001`; consultations display as `GC100001`. Numbers are never truncated,
recomputed from a UUID, or recycled by application code. UUID primary keys, foreign keys and URL
parameters remain unchanged. The additive migration backfills existing rows without rewriting
clinical content. The reference is a label, not a credential or an anonymization mechanism.
An unclaimed queue row exposes its case reference but never the longitudinal patient reference;
assigned-doctor and patient reads retain consent, authorization and audit gates.

The review header separates identity, complaint and workflow state. Wide-screen panel headers
use icons and clear typography; the primary triage action stays on one line. Narrow screens keep
one mounted editor per case behind keyboard-operable tabs. No visual refresh may discard drafts.

### D12 — Local AI recovery and India release gates

The Windows launcher checks the configured loopback model and gateway, starts missing services
without stopping unrelated processes, and does not silently switch to a stub or cloud provider.
Synthetic real-model verification proves transport, schema validation and persistence, not clinical
accuracy or grounded retrieval. Error catalogues use nested next-intl namespaces; internal reason
codes map to readable text. Unavailable AI does not lock physician review.

Use the installed llama.cpp server's native `--sleep-idle-seconds` facility, configured by
`LOCAL_MODEL_IDLE_SECONDS` (default 300, -1 only as an explicit opt-out). The model weights and KV
cache are unloaded after idle expiry; the small server listener remains and inference wakes it.
The native scheduler owns active/queued-request coordination. Health uses only `/health` and
`/props`, which do not wake the model or reset its idle timer; sleeping is not an outage. Startup
may load once before the first idle expiry. Both Windows and development launch paths carry the
same policy. Reload latency is included in request budgets and explained in the generation UI.
Verify sleep, memory reduction, health polling while asleep, wake, concurrent requests and repeat
sleep on the installed binary. Do not claim zero process/driver memory or modify other model apps.

The deployment jurisdiction is India. `docs/india-privacy.md` records source dates, current versus
future duties and evidence gaps. The data inventory, purpose-specific notices/withdrawal, rights
handling, retention/legal holds, processor controls, incident response, India-region storage and
independent review are production acceptance gates. Do not describe a polished UI as legally
compliant. Operational commitments require named owners and verified deployment evidence.

### D13 — Approved Navigator, cards and explicit AI assistance

The approved wide-screen case view has two structural columns only: a stable case-section navigator
and one broad clinical canvas. Patient record, reports, AI decision support and physician review are
sections in that canvas, not simultaneous narrow panels. The document/page owns vertical scrolling;
the sections do not introduce independent viewport-height scroll regions. Below the desktop
breakpoint the navigator becomes the existing keyboard-operable section tabs. Every section remains
mounted once so viewport changes and section switching preserve unsaved physician drafts.

Within the patient record, measurements keep their value tiles and each history domain keeps its
scan-friendly card. Red flags remain permanently expanded above history. Transcript clusters and
differential evidence may collapse, with clear labels/counts and keyboard-operable disclosure
controls; all original content and provenance remain available. Document drawers preserve the case
context.

The physician review adopts the flatter hierarchy selected from the focused-tab concept. Diagnosis,
private notes, patient-facing summary, and plan/follow-up are full-width long-form editors rather than
two-column fields. Patient-facing and private groupings are labelled in words but do not constrain
the editors to small cards. The AI-assist action remains explicit. Save and finalize are compact
clinician-density actions in a content-aligned bar beneath the editor, never auto-placed under the
navigator. The release confirmation remains separate.

A drawer previews the immutable AI source and explicitly identifies ungrounded output. A shared
generation state prevents the decision-support and draft controls issuing competing requests.
Applying a suggestion is a local draft edit only, never a save, finalization, release or notification.

## Risks / Trade-offs

- **The catalogue grows by roughly 200 keys in two languages.** The Hindi strings are written
  here rather than deferred, because the guard test only proves a key exists in `en.json`; a
  missing Hindi key degrades to English silently. Clinical terms in the new history step reuse
  the existing `clinicalText` vocabulary where one exists.
- **Restructuring routes invalidates bookmarks and the Playwright walkthroughs.** Mitigated by
  the middleware redirect map for bookmarks and by updating the walkthroughs in the same change.
- **The persistent Navigator consumes horizontal space.** It is used only where the remaining
  canvas can retain a comfortable clinical reading width. Below that breakpoint it becomes the
  same section tabs used on mobile. This trades simultaneous visibility of three panels for clearer
  typography, larger writing surfaces, one predictable scroll context and easier navigation.
- **`case_clinical_history` starts empty for existing cases.** The doctor's panel states "not
  recorded" rather than rendering an empty section, so a case predating this change is visibly
  missing history rather than appearing to have none.

## Migration Plan

Apply the additive clinical-history/read-receipt, lifecycle-notification and public-reference migrations before starting the web build. Existing signed records remain unchanged. New JSONB fields are optional for historical records. Rollback the web deployment first and retain additive columns and enum values; do not delete clinical data to reverse the upgrade.

## Verification

Run strict OpenSpec validation, workspace type checking, unit and integration tests, production build, then browser walkthroughs with local compose services. Database tests use a separate test database. Record environmental blockers in tasks.md rather than marking unrun checks complete.
