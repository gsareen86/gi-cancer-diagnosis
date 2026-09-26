Implementation follows the resolved design. Unchecked means not fully implemented and verified;
missing hosted credentials must not turn a database task green. F9–F13 are concretely assigned
in the roadmap/brief; foundation implements F1–F8 and does not create clinical AI output.

## 1. Scaffold and tooling

- [x] 1.1 Scaffold root Next.js 16/React 19, strict TypeScript, Tailwind 4 and ESLint; pin compatible dependencies and pass typecheck/lint/build.
- [x] 1.2 Configure Vitest, Playwright and Node scripts; verify meaningful configuration/permission-contract tests run locally.
- [x] 1.3 Add blank .env.example, separate runtime/operator/test scopes, project/region verification and no reset/Docker fallback; test invalid/missing/wrong environment refusal without secret output.
- [x] 1.4 Pin project-local OpenSpec and remote-only Supabase CLI; document hosted Auth/API settings and verify actual settings on the designated project when configured.

## 2. Evidence harness

- [x] 2.1 Implement invariant/control registry with owner, pending/implemented/verified/deferred state and manual/automated evidence; keep D2 encounter reset deferred and D5 process evidence explicit.
- [x] 2.2 Test checker rejection of unknown identifiers, missing/skipped/stale test evidence and false aggregate completion; consume actual executed results for the exact commit.

## 3. Database identity and isolation

- [x] 3.1 Implement TLS/target-verified pgTAP Node runner with TAP/plan validation, deliberate-failure checks and transaction rollback; verify on dedicated hosted synthetic test project.
- [x] 3.2 Write failing SQL tests for least-privilege role ownership/grants, FORCE RLS, MFA/site isolation, foreign IDs, multi-role staff and direct table/helper denial.
- [x] 3.3 Migrate app/phi/audit/private/api schemas and non-login executor/policy/audit roles per D-2; revoke default PUBLIC/app/service grants and pass tests from 3.2.
- [x] 3.4 Add staff accounts/sessions, memberships, role purposes, deployment settings and synthetic patients with a marker guard and no runtime write path; verify RLS and seed-only writes.

## 4. Audit and API

- [x] 4.1 Write failing tests for allowed-list/read audits, durable generic denials, missing/invalid purpose, foreign-log non-disclosure, audit failure, writer forgery and UPDATE/DELETE/TRUNCATE denial.
- [x] 4.2 Implement fixed-shape audit writer, append-only events/privileges/triggers, no cascade deletion and restricted operator events; pass ownership/provenance/mutation tests.
- [x] 4.3 Implement POST/VOLATILE patient, audit and membership RPCs using executor RLS and committed typed denials; pass SQL and real HTTP tests, checking committed evidence in a separate transaction.
- [x] 4.4 Implement metadata-only public environment RPC and explicit grant surface; verify prelogin, aal1, no-membership and site-admin membership views with no PHI leakage.
- [ ] 4.5 Document/test app and hosted Auth/API security-event paths for pre-RPC rejection; record actual retention/correlation limits and block real-data readiness on missing evidence.
- [x] 4.6 Generate remote API types from verified migration state and fail on drift; no local container/dump fallback.

## 5. Sessions and operator lifecycle

- [x] 5.1 Write failing tests for session activation, replay after logout/disable/recovery, idle/absolute deadlines, paused client, late touch, background polling and renewal races.
- [x] 5.2 Implement current-Auth-session/staff/aal2 checks plus non-resurrecting begin/touch/end operations and restrictive database access; pass expiry/replay tests using DB time.
- [x] 5.3 Implement project-scoped idempotent synthetic seeding and Auth provisioning with generated private credentials; verify repeat setup preserves passwords/MFA and rejects conflicts/wrong targets.
- [x] 5.4 Implement scoped operator membership grant/revoke, disable and MFA recovery with operator identity/reason, durable intent/outcome and fail-closed session revocation; test interrupted/failed Auth operations and old-token rejection.

## 6. Staff web experience

- [x] 6.1 Implement Supabase clients, proxy refresh, per-operation server guard and generic sign-in errors; verify forged cookies/no self-signup/no privileged runtime keys.
- [x] 6.2 Implement TOTP enrol/challenge and application-session activation; verify real Auth integration at aal1/aal2 and inactive/disabled-account refusal.
- [x] 6.3 Implement idle warning, interaction-only touch, logout, cross-tab clearing, no-store and server-mutation origin checks; test Back/pageshow, paused/offline tabs and absolute expiry without persistent PHI.
- [x] 6.4 Build responsive staff shell, safe setup/unavailable state and static public landing with persistent synthetic label; verify missing config does not disclose data.
- [x] 6.5 Implement site selection, patient list/details, site-admin membership/audit views and empty/no-membership states through audited RPCs; test role/site changes and functional admin reads.
- [x] 6.6 Verify readable keyboard-accessible layouts at 1440x900, 1024x768 and 390x844, MFA errors and no horizontal page scrolling.
- [x] 6.7 Apply the owner's login/MFA/logout wireframes (`7_*`) and desktop staff-shell direction; verify actual sign-out confirmation versus pending revocation. Keep the remaining clinical screen tasks assigned in docs/reference/ui-reference.md and docs/roadmap.md.

## 7. Verification and handoff

- [ ] 7.1 Configure unprivileged install/typecheck/lint/unit/build/evidence CI and protected exact-SHA hosted tests with concurrency, target/ledger checks and no fork secrets; verify missing credentials is NOT RUN.
- [x] 7.2 Document PowerShell-compatible Cloud quickstart, operator lifecycle, evidence limitations and no-reset recovery; verify setup preserves unrelated data.
- [x] 7.3 Run local and hosted tests, remote type comparison, invariant evidence and strict OpenSpec validation; record executed evidence and all remaining gaps accurately.
- [ ] 7.4 Cross-model implementation review against the resolved design/config; record findings and resolutions before archive. Do not substitute this artifact revision for runtime verification.

## Verification checkpoint — 21 September 2026

28 of 31 tasks are complete. The implemented staff UI uses the owner's login/MFA/logout
references; all 19 screens are mapped to future change tasks in docs/reference/ui-reference.md.

- 4.5: Coded application security events and refusal tests exist; provider-log correlation,
  actual retention and a durable application log destination remain unverified.
- 7.1: Workflow and missing-credential refusal are tested locally. The protected job now
  includes real operator/browser checks, but repository environment protections and a run
  of the exact committed SHA have not been verified. No secrets were added to GitHub.
- 7.3: Local/hosted checks, type comparison and the automated-control evidence check passed.
  Evidence is refreshed after this final checklist update to retain the exact source hash.
- 7.4: Claude Code implementation review is still required; Codex's artifact review does
  not replace it. Keep this change open and do not start the next change in this session.
