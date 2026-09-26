# GI Compass

**26 September demo update:** report findings now inform preliminary AI automatically,
with document/page/date/type provenance and optional staff correction. Patient intake uses
shorter main topics with optional detail; urgent advice stays visible without preventing
continued answers. Clinician drafts survive report changes. See the
[current readiness assessment](docs/demo-readiness-2026-09-26.md) and
[configuration notes](docs/reference/ai-providers.md).

Clinic-based GI specialty navigation with clinician decision support, for India. Patients
answer a structured questionnaire and optionally add existing reports on a tablet. A clinician reviews
rule-based urgency flags and AI analysis. Patients can receive a clearly labelled preliminary
AI assessment with possible diagnoses and reasoning before the clinician's separate review.

**Status:** the complete fictional patient-to-clinician journey has passed in the actual
demo project with Gemini, including automatic blood/imaging report use, independent
assessment saving and separate clinician plan release. Fresh current-prompt examples and
generated laboratory/imaging PDFs are available for rehearsal. Clinical content is DRAFT;
real-patient use still requires clinical approval, approved privacy/data routing and
operational/security hardening. Broader independent review and release gates remain open.

Start with the **[hospital demo rehearsal guide](docs/demo-rehearsal.md)**:

```powershell
npm run demo:start -- -Production
npm run demo:preflight
npm run demo:status
```

Work continues only on `claude/gi-compass-clean-slate`. The web app and independent worker
run locally; the configured AI provider is Gemini. Local-model and compatible adapters
remain available without automatic fallback. Database/Auth use the owner's **Supabase Cloud**
account; report originals currently use bounded private database storage. Credentials stay
in ignored environment files. There is no local Docker Supabase setup. Reviewed migrations are applied
to both designated projects; see the verification record for each project's setup status.

The foundation has been cross-reviewed and its findings resolved in the specifications;
implementation and hosted verification remain tracked in its task list. See
[review resolutions](openspec/changes/foundation/design.md#review).

- [Product brief](docs/product-brief.md): purpose, scope, decisions, open questions
- [Roadmap](docs/roadmap.md): parallel tracks, extraction spike, change sequence
- [UI reference](docs/reference/ui-reference.md): the owner's 19 mockups and implementation adaptations
- [Agent working rules](AGENTS.md)
- Invariants: [`openspec/config.yaml`](openspec/config.yaml)

The earlier application is preserved on branch `codex/gi-specialty-navigation`.

## Run the public preview

Use Node 24 and npm. These commands work in PowerShell:

```powershell
npm ci
npm run dev
```

Open `http://localhost:3000`. Without configuration, the landing/setup screens work and
protected pages refuse access. No local Supabase instance is started.

## Configure Supabase Cloud

Use owner-designated, separate **synthetic demo** and **synthetic test** projects in Mumbai
(`ap-south-1`). No script creates projects. Confirm the region in actual project settings;
a project URL is not region evidence. Never target a pilot project or real patient records.

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path .env.operator)) { Copy-Item .env.operator.example .env.operator }
if (!(Test-Path .env.test)) { Copy-Item .env.test.example .env.test }
```

Populate values locally; never put credentials in chat or Git.

| File | Values |
| --- | --- |
| `.env` | Demo URL/publishable key, expected project reference, verified region/date (`YYYY-MM-DD`), `APP_ENVIRONMENT=demo`, exact `APP_ORIGIN` |
| `.env.operator` | Demo database connection/Auth secret key, management token for remote types, named operator ID, optional database CA path |
| `.env.test` | Separate test URL/publishable key, project reference, region/date, database connection/Auth secret key, optional CA path and `TEST_SUPABASE_ACCESS_TOKEN` |

Public patient entry reads its restricted administrative credential server-side, including
the `.env.operator` fallback. Operator/test scripts load that file explicitly. Routine
authenticated requests use a publishable key and caller JWT. Only `NEXT_PUBLIC_` values enter browser code.
The management token is not an LLM key. Phone OTP and paid messaging are deferred.
An Auth-admin key starts with `sb_secret_`; a publishable key cannot provision staff.
The test-specific Management API token takes precedence over the shared operator token.
Read permissions do not imply permission to update hosted Auth/API configuration.

Use the direct database host `db.<ref>.supabase.co:5432/postgres` with username `postgres`, or
the project's **session pooler** on port 5432 with username `postgres.<ref>`. Copy the exact
connection from Supabase and URL-encode password characters. Transaction pooling is refused.
TLS verification stays enabled; if required, supply the project CA's local PEM path.

Review hosted settings before sign-in:

- Disable public signup and anonymous sign-in; enable TOTP enrolment/verification.
- Set the Auth site URL and allowed redirects to the intended demo origin.
- After migration, expose **`api` only** in Data API settings. Keep `app`, `phi`, `audit` and
  `private` hidden. The migration supplies narrow grants; do not add broad grant-all permissions.
- Verify password policy, rate limits and Auth/API logging using the
  [Cloud verification record](docs/reference/foundation-cloud-verification.md).

Password minimum is in **Authentication → Sign In / Providers → Email** (set 12).
Exposed schemas are in **Integrations → Data API → Settings** (select `api` only).
After migrations, `npm run cloud:configure -- --test` verifies the desired settings without
changing them. Add `--apply` to apply missing settings with a suitably authorised Management
API token. Omit `--test` for the designated demo. Matching settings need no write permission.

Supabase documents API exposure in [Using custom schemas](https://supabase.com/docs/guides/api/using-custom-schemas).
Exposure settings alone do not establish database isolation; both layers need verification.

## Review migrations and seed

```powershell
npm run db:verify-target
npm run db:migrate
# Review pending SQL before applying to the designated synthetic demo:
npm run db:migrate -- --apply
npm run db:setup -- --reason INITIAL_DEMO_SETUP
```

Without `--apply`, migration planning is read-only. Hash drift, unknown migrations and
conflicting schemas/seed rows stop execution. No reset/drop command exists. Once applied,
fix a migration with a new reviewed migration rather than editing its recorded contents.

Seed creates two demo sites, six staff accounts (all three roles at each site), a clinician
at both sites and three synthetic patients per site. Generated credentials go to an
owner-restricted file under `var/credentials/`, never console output. Repeat seed preserves
passwords, factors and revoked memberships. Review its operator request before retrying an
interruption. Patient seed reads/writes have transactional operator audit records.

Sign in with a generated staff account and enrol an authenticator. Site admins can read
memberships/audit logs but need a separate clinical/coordinator role to read patient records.
The demo adds encounter creation for these fictional patients and optional report upload
inside the restricted patient handoff. It does not enrol real patients.

## Operator lifecycle

Commands require a named `OPERATOR_ID`, coded reason and synthetic target IDs:

```powershell
npm run operator:staff -- grant --user <uuid> --site <uuid> --role clinician --reason ACCESS_APPROVED
npm run operator:staff -- revoke --user <uuid> --site <uuid> --role clinician --reason ACCESS_REMOVED
npm run operator:staff -- disable --user <uuid> --reason ACCOUNT_DISABLED
npm run operator:staff -- recover-mfa --user <uuid> --identity-verified --reason IDENTITY_VERIFIED
```

Recovery requires documented identity verification. Disable/recovery revokes app sessions
before Auth administration; failure does not restore access. Restricted operator history
retains intent and completion/failure with the same request ID. Investigate pending requests
and Auth state before retrying; do not restore a revocation epoch or use ad-hoc bypasses.
These synthetic-only commands do not yet provide real staff onboarding.

## Verify

```powershell
npm run test:unit
npm run typecheck
npm run lint
npm run build
npm run check:invariants
npm run test:e2e
node node_modules/@fission-ai/openspec/bin/openspec.js validate foundation --strict
```

Install the test browser using `node node_modules/@playwright/test/cli.js install chromium`.
Alternatively, installed Chrome can be used with `$env:PLAYWRIGHT_CHANNEL='chrome'`.
Public and authenticated browser checks cover 1440×900, 1024×768 and 390×844.
The hosted browser runner requires the separate test setup. Patient screenshots/traces
and authenticator QR captures are not recorded.

For the isolated test project:

```powershell
npm run db:migrate -- --test
npm run db:migrate -- --test --apply
npm run db:test
npm run test:integration
npm run types:gen
npm run types:check
node scripts/operator-tests.mjs
node scripts/hosted-browser.mjs
npm run check:invariants -- --require-automated-foundation
```

pgTAP uses rolled-back transactions over TLS. HTTP fixtures are run-scoped and retain audit
history when cleaned up. Missing credentials produce nonzero **NOT RUN**, not a passing
substitute. Generate types from the verified hosted schema, wire them into app clients and
commit them. The generated `Database` types are now integrated into app clients; Zod validates
RPC response envelopes at runtime because JSON-returning functions do not supply row types.
Do not format the generated file; `types:check` compares its contents with the remote output.

`node scripts/verify-seed.mjs var/credentials/<test-seed-request-id>.json` verifies repeat
setup using the test seed credentials. It checks password/MFA preservation, conflict refusal
and unrelated data, restores its temporary site-name conflict and removes its temporary
authenticator factor. Run it separately from other tests/people using fixed test-seed accounts.
Credentials are never printed.
`node scripts/operator-tests.mjs` exercises actual grant/revoke, recovery and disable commands,
including narrowly injected Auth failures and process interruption on one temporary test account.
`node scripts/hosted-browser.mjs` exercises actual staff sign-in/MFA, patient/admin views and
logout, expiry and offline clearing against a separate production test build on port 3210.
It never reuses the demo server. It also checks browser bundles for privileged credentials.

The invariant checker distinguishes implemented/verified/deferred controls. Its source hash
and commit invalidate stale evidence. `--require-automated-foundation` requires current executed
unit, SQL, HTTP, browser and operator evidence for each named automated control. It does not
promote manual/deferred controls. `npm run check:invariants -- --require-foundation`
deliberately fails until every foundation control has evidence. It is not a clinical certificate.

CI is in `.github/workflows/foundation.yml`. Normal PR/push checks have no Cloud secrets.
Hosted runs require manual dispatch for the exact reviewed branch SHA and a protected
`synthetic-test` environment. Configure required reviewers/branch restrictions before adding
environment secrets. Those repository settings have not been changed or verified here.

Next's bundled ESLint plugins still declare ESLint 9 peer ranges. The official compatibility
adapter enables ESLint 10; lint and the install dry run pass with peer warnings. Keep this
visible until upstream support is declared. OpenSpec is pinned locally to the available 1.12.0.

Foundation stays open for the remaining security-log/CI evidence and cross-model implementation
review. The 19 UI references and their connected flow are mapped to the owning future changes;
the foundation implements staff authentication and administration only.
See the [task list](openspec/changes/foundation/tasks.md) for exact completion status.
