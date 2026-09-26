## Context

Greenfield foundation on `claude/gi-compass-clean-slate`; see proposal.md. Owner-approved
Supabase Cloud only; local Next.js app and later local model. This revision resolves the
cross-model findings F1–F8 and assigns F9–F13 to later changes. Decisions are specified,
not proven until implemented and tested. The foundation does not expose patient AI yet.

## Goals / Non-Goals

**Goals:** working staff identity, site isolation, audited data access and honest verification
on the hosted database, with readable desktop/tablet/phone layouts.
**Non-goals:** clinical intake, patient accounts, AI, prescribing, real-data activation,
cloud project creation, a web administration console or reuse of the deleted application.

## Decisions

### D-1 App and dependencies

One Next.js 16 App Router/React 19 application at the repository root, strict TypeScript,
Tailwind 4, official Supabase JS/SSR clients. Pin compatible versions and lockfile.
Vitest for units/integration; Playwright for browser tests; pg and tap-parser for hosted
pgTAP; otpauth for synthetic MFA tests; Supabase and OpenSpec CLIs as pinned dev tools.
Generated API input types are paired with Zod validation of JSON RPC responses; malformed
envelopes/deadlines fail closed and unexpected fields are removed before use.
Prettier formats reviewable source (generated database types are excluded). ESLint 10 uses the official @eslint/compat adapter for
Next's plugins, whose declared peer ranges still target ESLint 9. Keep the adapter and
record the peer warnings until upstream plugins support 10; do not disable their checks.
Use proxy.ts for session refresh, plus a server guard on every protected operation.
No privileged database/Auth administration key in routine Next.js requests or browser code.
Rejected: monorepo before a second service exists, Docker Supabase, unaudited ORM access.

### D-2 Database roles and ownership (F1, F4)

Use narrowly privileged SECURITY DEFINER RPCs owned by `gi_api_executor`, a NOLOGIN,
NOINHERIT, NOBYPASSRLS role that owns no tables and is not granted to application roles.
All names are schema-qualified; function search_path is empty. Table owner is the migration
role; enable AND FORCE RLS on application tables. Caller identity always comes from verified
JWT claims (`auth.uid()` and session_id), never the SQL function owner's identity or inputs.

| Surface | Objects | Grants and enforcement |
| --- | --- | --- |
| app | sites, site_memberships, settings, staff_accounts, staff_sessions, role_purposes | executor gets only needed SELECT or session UPDATE/INSERT; RLS per identity, role and active session |
| phi | synthetic patients | executor SELECT through restrictive session/aal2 and site/role RLS; no runtime writes |
| audit | audit_events, operator_events | executor SELECT through site-admin RLS; audit writer INSERT only; no runtime UPDATE/DELETE/TRUNCATE |
| private | policy/session checks, fixed-shape audit writer | hidden; EXECUTE only to the specific executor/policy roles that require it |
| api | explicitly listed RPCs below | only exposed Data API schema; no tables/views; explicit EXECUTE grants only |

`gi_policy_reader` is another NOLOGIN/NOBYPASSRLS role: minimal SELECT on the columns needed
from app memberships/staff/session state. Its explicit RLS
policy allows those internal reads; no client may assume it. Privileged helpers return only
an authorisation decision for the current identity, not rows, email addresses or arbitrary
user lookups. Avoid policy recursion by separating these helper reads from executor policies.
On hosted Supabase, the migration role cannot delegate USAGE on the managed `auth` schema
to these custom roles. Migration 002 therefore supplies three tightly scoped, private,
migration-owned SECURITY DEFINER adapters: current request UID, current session ID, and the
eligible current Auth session's creation timestamp. They take no inputs and return no user
records, emails, tokens or PHI. They check the caller's JWT context, not the function owner.
Only the internal policy/executor/audit roles receive the specific EXECUTE grants they need;
PUBLIC, anon, authenticated and service_role cannot invoke them. These adapters are the
explicit owner-privilege exception; patient/audit access still uses non-owner FORCE RLS roles.
SQL tests verify adapter grants and removal of custom roles' direct managed Auth table grants.
`gi_audit_writer` has INSERT only on audit events, no SELECT/mutation, and RLS WITH CHECK
validates the fixed event contract. All new tables/functions/default privileges deny PUBLIC,
anon, authenticated and service_role unless a named operation needs a specific grant.

Authenticated/anon/service_role have no direct app/phi/audit table access, including raw
SQL role tests. No broad service key, owner-backed view or arbitrary-SQL RPC bypass exists.
Grant schema USAGE as needed, not CREATE. Audit admin reads use the same executor + RLS
pattern as patient reads: own site only, declared audit_review purpose, successful audit
of the read itself. This resolves the missing audit SELECT permission without making an
admin a database owner. Site membership viewing has its own read RPC.
Rejected: all invoker functions with contradictory table grants; owner-backed patient/audit
access functions; broad managed Auth access; user-supplied actor/role authorisation.

### D-3 RPC and audit transaction contract (F2)

Protected reads are POST RPCs marked VOLATILE because they append audit events. Result:
`{ok, data, error: {code}|null, requestId}`. Request IDs and timestamps are server assigned.
Expected access denial commits an audit entry then returns a typed, data-free envelope;
Next maps it to a generic status. Do not RAISE after inserting an expected denial. Unexpected
SQL/audit errors abort and return no PHI, without logging raw DB arguments or result bodies.

Authorisation and row lookup never probe another site's record existence. A missing or
unauthorised record has the SAME `unavailable` response and `denied_or_not_found` audit
outcome. Denied events carry no record IDs. Site ID is retained only when the actor is an
active member of that site; otherwise null and visible only through operator security review.
Do not retain a guessed foreign record/site identifier in the requesting site's audit view.
Returned records alone populate allowed event record_ids. Zero-row authorised lists are
allowed audited operations. Purpose/role/action codes are allowlisted and derived/validated
inside fixed operation wrappers; the generic writer is not executable by clients.

Auth/signature/schema rejections before RPC entry cannot be part of the record transaction.
Document and verify the hosted Auth/API security-log path for those failures, with request
correlation and no clinical bodies/query values. App boundary failures use structured security
logging. Do not claim all platform failures create a patient audit row. If the hosted platform
cannot supply required security evidence, record the gap and block real-data readiness.

Audit shape: id, occurred_at, actor_user_id (nullable only for security failures), actor_role,
site_id, purpose, action, resource_type, record_ids, outcome, request_id. No clinical free text.
Revoke UPDATE/DELETE/TRUNCATE for all app/service roles; deny UPDATE/DELETE and TRUNCATE with
triggers, including accidental operator cleanup. No cascading audit deletion. Audit-write
helper ownership/EXECUTE tests prevent forged events. Superuser compromise is explicitly
outside in-database tamper resistance; pilot requires restricted operators and separate export.
[PostgREST transactions](https://postgrest.org/en/stable/references/transactions.html),
[PostgreSQL function security](https://www.postgresql.org/docs/current/sql-createfunction.html).

### D-4 Staff sessions and recovery (F3, F8)

Operator-created email/password accounts; hosted self-signup disabled. TOTP required before
protected data. getClaims verifies the JWT; it is not the active-session check. Every RPC
and protected server guard also checks current staff active state, membership, aal2, linked
Supabase session, revocation epoch and application idle/absolute deadlines.

Application session rows are keyed by Supabase session_id plus user_id. After fresh MFA,
`begin_staff_session` accepts only a current Auth session created within the configured idle
window; records first activation, last_activity_at and expires_at. It is idempotent and can
never revive an expired/revoked row or extend its original absolute deadline. A new sign-in
and new Auth session are required to reactivate. These are application access controls on
Supabase sessions, not a replacement credential/password system.

Defaults: idle 15 minutes, absolute 8 hours, warning 60 seconds before idle expiry; operational
assumptions, configurable. Use database time. A dedicated touch operation follows actual
interaction (throttled to once per 60 seconds); polling/token refresh never counts as activity.
Check the deadline BEFORE updating last activity; row locking prevents expiry/renewal races.
A holder of a valid session can make activity requests; this is not proof of human presence.
Absolute expiry, MFA and revocation limit that risk. Client timers clear visible content and
coordinate tabs, but database checks enforce the deadline even with suspended JavaScript.

Sign-out first commits app session revocation, then calls Supabase signOut and clears local
cookies/caches; if offline, clear locally and explicitly distinguish pending server revocation.
Fresh protected access checks Auth session existence and app revocation. Account disabling
and MFA recovery set a staff revocation epoch and revoke app sessions BEFORE attempting Auth
administration, so a partial Auth failure leaves access blocked. Membership revocation takes
effect on the next operation; do not imply a response already in flight can be recalled.

Protected responses are no-store; no PHI in localStorage, service-worker caches or URL params.
Use secure production cookies, origin/CSRF checks on server mutations, bounded request bodies
and redacted errors. Back/pageshow and multi-tab tests verify cached DOM is cleared on logout.
Hosted idle-plan settings are supplementary, not the enforcement mechanism.
[Supabase sessions](https://supabase.com/docs/guides/auth/sessions),
[OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

### D-5 API surface and bootstrap (F6)

| Operation | Caller and scope |
| --- | --- |
| environment | anon/authenticated; definer owned by a separate metadata-only role, returns only project reference, environment, schema version; no membership/PHI/secrets |
| begin_staff_session | authenticated aal2 with fresh eligible Auth session; no protected record return |
| touch_staff_session, end_staff_session | current identity's own session; touch cannot resurrect; end idempotent |
| session_status | current identity only; server-checked validity and deadlines, no patient data |
| my_memberships | active aal2 app session; own memberships only; no-membership gives empty list |
| list_site_memberships | active site admin, site_administration purpose; audited |
| list_patients, get_patient | clinician/direct_care or coordinator/intake_support for that site; audited |
| list_audit_events | active site admin/audit_review; audited, bounded date range/pagination |

Only landing/sign-in/MFA and safe environment metadata are available pre-MFA. Startup checks
expected project/environment and operator region evidence without accessing protected tables
or using a privileged runtime client. Missing config shows a safe setup message; the static
landing page still loads without identifiers. A signed-in user with no membership sees an
empty workspace and an operator contact instruction. Active-site cookie is a UI preference;
every operation rechecks explicit site membership. A role argument may select an authorised
purpose, but cannot grant a role; effective role is computed from allowed memberships.

### D-6 Cloud setup, operator lifecycle and synthetic data (F7, F8)

Use the owner's designated Cloud projects: separate demo and test, later separate pilot,
verified India region. Never create a paid resource or infer authorisation from a URL/key.
Verify project identity, actual hosted Auth/API settings, migration ledger and existing
contents before writes. Dry-run migrations; no drop/reset, local stack or automatic fallback.
Use remote CLI type generation; pgTAP via a TLS-verified Node connection, not container tests.

Runtime uses project URL/publishable key and caller JWT. Ignored .env/.env.operator/.env.test hold separate
scopes; corresponding example files have blanks. Operator scripts alone hold database/management/Auth-admin
credentials. CI secrets belong only to protected trusted executions. No key values in output.
TEST_SUPABASE_ACCESS_TOKEN takes precedence for test-project Management API access; the
shared operator token is only a fallback. Auth-admin keys must be secret API keys (or a
project-matching legacy service-role key), never publishable keys or management tokens.
Validate environment refs are different and query remote metadata on the same connection used
for migrations/tests. Region evidence includes operator-confirmed project settings, not the
hostname. Recheck storage/backups/logs/egress and contracts before pilot, not just DB location.

Seed uses fixed reviewed SYN identifiers and synthetic names, and supported Auth admin APIs
with generated credentials delivered to an ignored local file with owner-only access.
Repeat setup does not reset passwords/MFA or overwrite conflicts. A synthetic flag prevents
unmarked records; it cannot detect disguised real data. No arbitrary patient create/upload
UI/RPC exists in foundation. Provisioning/seed reads and writes are audited through controlled
operator transactions; normal app code has no operator capability.

Provide named project- and synthetic-user-scoped commands: provision, grant/revoke membership,
disable account, recover MFA. Operator identity, coded reason, request ID and target are
mandatory. Record intent before external Auth changes and completion/failure afterward; the
intent remains if the process crashes. Commands are idempotent and fail closed. Recovery
requires documented identity verification, not just knowing an email; no authentication-bypass
or shared recovery password. Pending Auth operations are reconciled before re-enabling staff.
No web admin console in this change. Privileged database operators remain trusted and must
not use ad-hoc scripts to circumvent the documented audit path.

### D-7 Tests, evidence and CI (F5)

Tests first for permissions, atomicity, sessions and output boundaries. pgTAP tests use
transaction-scoped fixtures on the designated hosted test project; the Node runner parses
actual TAP assertions and plans, fails on SQL/TAP errors, and rolls back in finally. Auth API
fixtures are run-scoped and cleaned up through supported APIs. Never truncate audit history.
HTTP tests verify committed denial evidence from another request/connection. SQL tests check
roles/grants/RLS independently of API exposure. Include crafted RPC/helper calls and revoked
JWTs. Test no PHI on errors or missing config.

Registry contains every S1–S10/D1–D5 invariant, decomposed into named controls with owner
change, status (pending, implemented, verified, deferred), and automated/manual evidence.
Automated verification requires executed non-skipped assertion evidence for the exact commit
and relevant artifact/content version. Tag presence alone is only traceability; review confirms
assertions test the behaviour. Aggregate invariants report partial when children are deferred.
Foundation verifies site/role/audit/session controls; D2 tablet reset remains deferred to change
2 and D5 process requirements remain manual evidence, never blanket green.

Unprivileged CI runs install/typecheck/lint/unit/build/evidence checks. Protected CI runs target
and ledger checks, reviewed migrations, pgTAP, remote type diff, integration and browser tests
for the exact reviewed SHA with concurrency protection. No fork code with secrets or
pull_request_target checkout. Missing cloud credentials means NOT RUN, not PASS. Hosted
verification must pass before archive/release; local checks may run while configuration is absent.
Screens: 1440x900 desktop, 1024x768 tablet, 390x844 phone; keyboard, MFA error/recovery, multi-tab
logout and readable content, not only screenshots. No horizontal page scrolling.

### D-8 Cross-platform tooling

Node-backed npm commands: dev, build, typecheck, lint, test:unit, db:verify-target, db:migrate,
db:setup, db:test, test:integration, test:e2e, types:gen, types:check, check:invariants,
operator:staff. No bash-only requirement; verify on PowerShell and CI. Missing secrets list
setting names only. Schema/API types are generated from the verified test migration state.

## Risks / Trade-offs

- Privileged helper mistakes: minimal non-owner roles, FORCE RLS, fixed RPC surface and tests.
- Cloud offline: unavailable state, no local PHI persistence/fallback; no false verification.
- Server session checks add reads: indexed session/membership keys, no stale role caching.
- Security logs cannot make a failed DB transaction durable: separate boundary events and
  fail-closed PHI access; documented coverage, tested before real-data activation.
- No universal certification: these choices implement specific controls; passing tests
  proves tested behaviours, not regulatory compliance or clinical correctness.

## Migration Plan

Verify owner-designated target first; apply reviewed additive migrations and fixed seed.
Stop on drift/conflicts. Rollback is a reviewed forward correction or tested restoration,
not a Git revert assumed to undo database changes. No remote mutation without configuration.
Cloud project creation and real-data activation are separate owner actions.

## Review

Cross-model review by Codex on 2026-09-13 found 13 issues. The owner authorised technical
resolutions and changed F9 to patient-visible preliminary AI assessments. The earlier review
remains in conversation/Git history or the ignored review backup; current decisions above
are authoritative. This table records specification resolution, not implementation completion.

| Finding | Resolution | Verification owner |
| --- | --- | --- |
| F1 audit read grants | D-2 non-owner executor with SELECT + RLS; no client table grants | foundation SQL/HTTP role tests |
| F2 denial durability/disclosure | D-3 committed generic envelope, no foreign existence probe, separate boundary events | foundation independent-transaction tests |
| F3 session expiry | D-4 DB session state, revocation and idle/absolute deadlines | foundation replay/expiry/paused-tab tests |
| F4 append-only | D-2/D-3 revoke and test TRUNCATE, fixed audit writer, no cascade | foundation privilege/forgery tests |
| F5 evidence | D-7 decomposed controls and executed evidence; partial status | foundation checker tests |
| F6 bootstrap | D-5 minimal public metadata + explicit membership RPC | foundation prelogin/no-membership tests |
| F7 synthetic provenance | D-6 fixed seed and no arbitrary intake; marker limitation explicit | foundation seed/access tests |
| F8 operator lifecycle | D-4/D-6 scoped audited commands and fail-closed recovery | foundation operator tests |
| F9 patient AI | Config S5 and product brief now explicitly permit preliminary AI diagnoses/reasoning before clinician review | changes 2, 8–10 patient isolation/content tests |
| F10 jobs/versions | Roadmap assigns durable jobs, consent/snapshot checks and separate AI/reviewed releases | changes 6–10 restart/stale-output tests |
| F11 reports/devices | Brief/roadmap define optional reports, manual fallback, source verification and device acceptance | changes 2–4, 7, 9–10 |
| F12 evidence/metrics | Brief/clinical inventory define source adaptations, first-contact cases, unblinding and time denominators | content lead and telemetry/readiness |
| F13 gateway | Reference rewritten as requirements to reverify, no truncation or silent fallback | gateway contract tests |

Prior structural validation used cached OpenSpec 1.12.0; reported global 1.13.0 was not
reproducible. Pin local tooling. No statement here substitutes for successful hosted tests.

### Implementation checkpoint — 14 September 2026

Codex continued the authorised implementation in this branch. No old application modules
were copied. App/tooling, fixed SQL/RLS/RPC contracts, operator scripts, public/staff UI and
CI configuration are present. This is an implementation checkpoint, not Claude Code's final
cross-model implementation review.

Local evidence:

| Check | Result and limit |
| --- | --- |
| Unit suite | 27 passed: runtime/operator target refusal, TAP rejection, bounded audit filters, invariant evidence integrity |
| Typecheck/lint | Passed; no current lint warnings |
| Production build | Passed; landing, setup, sign-in/MFA, staff, patient record and admin routes compile |
| Browser smoke | 9 passed across 1440×900, 1024×768, 390×844; public navigation, keyboard access, missing-config protection, no horizontal overflow |
| Visual inspection | Public desktop and phone captures reviewed; authenticated layouts await configured accounts |
| Dependency reproducibility | npm ci dry run passed; upstream ESLint plugin peer warnings remain, with the compatibility adapter documented in D-1 |
| OpenSpec | Strict foundation validation passed with the pinned local CLI |
| Hosted guard | db:test and protected CI entry both reported NOT RUN with missing configuration, without fallback |

The public browser checks used installed Chrome after the pinned Chromium download timed
out. They are not authenticated browser or medical usability tests. Unit evidence is written
under ignored var/test-results with the commit and source hash; task/spec edits invalidate an
older hash and require regenerating evidence. No control is upgraded to verified just because
its SQL exists.

Six tasks are fully implemented and locally verified. Remaining tasks stay unchecked, including
ones whose code exists but has never run against the managed Auth/database. No cloud project
or GitHub setting was mutated, and no credentials were present during this checkpoint.

Next, using owner-designated demo/test settings: inspect hosted contents/settings, review/apply
the migration, run SQL and HTTP tests, repair any managed-schema/permission issues, verify
seed repeat/recovery, generate and integrate API types, and exercise authenticated browser
expiry/logout/admin flows. Connect SQL/HTTP/browser evidence to the invariant registry before
claiming those controls verified. The exact hosted log coverage and CI protections remain
unverified; see docs/reference/foundation-cloud-verification.md. Independent Claude Code
implementation review and all remaining task verification are required before archive.

### Implementation checkpoint — 21 September 2026

Both owner-designated Cloud projects now have the two reviewed migrations, verified TLS,
matching ledgers and invite-only Auth/TOTP settings. Both expose `api` only and require
12-character passwords. Runtime requests use publishable credentials; privileged keys are
scoped to operator/test processes. The existing secret-key and management-token problems
are resolved. No Docker setup, new project or paid provider was introduced.

The source now includes generated API types with runtime response validation, SQL and
Auth/API tests, actual operator lifecycle fault tests, repeat-seed verification, production
authenticated browser tests, and named invariant evidence. Evidence records the commit plus
source hash, including uncommitted changes. Generated reports live under ignored
`var/test-results`; no credentials, QR images or protected page captures enter those reports.

The owner's 19 UI mockups were inspected and mapped to delivery/acceptance tasks in
`docs/reference/ui-reference.md` and the roadmap. Foundation adopts login/MFA/logout and
the desktop shell direction; later changes own the patient/clinical screens. Adaptations
include no probability language, no invented saved/reviewed state, optional reports, scoped
patient sessions, explicit extraction verification, and no emergency calling/dispatch.

Runtime issues found and corrected during verification:

- Supabase's raw SVG QR payload needed encoding before passing to Next/Image. Two unit
  tests cover preserved payloads and rejection of external image URLs.
- Concurrent tab logout messages could interrupt server revocation. The initiating tab
  now ignores logout echoes; peers clear without starting a second logout loop.
- Offline logout now stays on a locally cleared pending-revocation screen if a confirmation
  cannot load. Returning to sign-in removes HttpOnly patient/site selection cookies too.
- The expiry browser fixture originally allowed too little time for Cloud page loading;
  a 25-second absolute deadline now tests a visible warning and expiry without timing the
  assertion against an already-expired page. Production deadlines remain unchanged.

Executed checks before the final source-snapshot refresh: 36 unit, 84 SQL, 35 Auth/HTTP,
46 authenticated browser, 26 operator lifecycle and five seed assertions. Typecheck/lint,
production test build, generated remote types and strict OpenSpec validation pass. Public
sign-in was visually reviewed at desktop/phone and captured at all three required sizes.
Hosted tests retain audit history while removing only their own temporary synthetic fixtures.
The full automated-control check must consume fresh evidence after artifact changes.

The source registry keeps controls implemented until a run verifies their named assertions;
`check:invariants -- --require-automated-foundation` validates that source snapshot without
promoting manual or deferred controls. Unprivileged CI has no hosted secrets. The protected
job includes operator and browser suites, with browser installation before secret injection.
Missing credentials are explicitly NOT RUN. Actual GitHub environment protections and
workflow execution remain unverified; do not release secrets based on YAML alone.

Remaining external evidence: durable application security-log destination/retention and actual
hosted Auth/API event correlation, GitHub protections/executed reviewed SHA, and independent
Claude Code implementation review. The explicit browser account-switch scenario also remains
a review follow-up. Clinical/patient-session controls remain with their later changes. This
checkpoint is not a pilot approval or cross-model implementation sign-off.

Final verification: local typecheck/lint/build, 9 public browser tests, 36 unit assertions,
84 SQL assertions (including deliberate runner-failure/rollback checks), 35 Auth/HTTP,
46 authenticated browser, 26 operator lifecycle and five seed checks passed. Remote types
match, both projects' required Auth/API settings read back unchanged, and strict OpenSpec
validation passed. The aggregate automated-foundation check passed with D1/D2/D4/D5 still
correctly partial overall because manual/patient/pilot controls are not implied. The three
open tasks are 4.5, 7.1 and 7.4. The evidence suites are refreshed after this checklist record
so their source hashes remain current. No commit, push, archive or real-data activation was made.
