# Foundation Cloud verification record

**Partially verified — 21 September 2026.** The owner supplied separate Cloud demo/test
credentials and certificates. Both designated projects are healthy in Mumbai (`ap-south-1`),
verified using their Management API metadata. Before migration, both had no application
schemas or public tables. Two reviewed migrations are now applied to both projects, with
matching hash ledgers and TLS certificate verification enabled. Synthetic data only.

The owner saved hosted settings after Management API configuration writes returned 403.
Both projects now read back: signup disabled, anonymous disabled, TOTP enrol/verify enabled,
password minimum 12 and only `api` exposed. Test-specific Management API credentials are
used for test reads and type generation. Auth-admin fields were corrected to secret API keys.
No additional credential changes are currently requested.

Demo seed request `180bb82b-affa-418a-a4fc-0e33c6650c24` created the fixed six staff accounts
and six synthetic patients across two sites. Its owner-restricted credential file is under
`var/credentials/`; it is ignored and never printed. Test setup and Auth fixtures use the
separate `gi-cancer-diagnosis-test` project. GitHub environment settings remain unchanged.

Record project reference, demo/test purpose, region from the dashboard, date and named reviewer.
Keep credential screenshots out of Git. Before mutation, confirm the owner-designated project
is dedicated to this synthetic app and inspect existing contents. Demo and test must differ.

| Boundary | Required evidence | Status |
| --- | --- | --- |
| Target/TLS | Actual region, direct/session-pooler identity, certificate, marker, migration ledger | Both projects verified; no TLS bypass |
| Auth | Signup/anonymous disabled, TOTP, intended origin, password policy/rate limits | Settings read back; actual signup refusal, password sign-in and TOTP passed; rate-limit review outstanding |
| API/RLS | Only api exposed; non-owner roles, forced RLS, own-site/role access, admin views | 84 SQL assertions and 35 HTTP/Auth assertions passed |
| Audit | Allowed IDs match response; durable generic denials; failed writer returns no data | SQL fault injection and separate-connection HTTP denial verification passed |
| Sessions | Fresh MFA, idle/absolute deadlines, membership removal, logout replay, disable/recovery | Passed, including renewal blocked behind a row lock then refused after concurrent expiry; direct API expiry does not depend on client JavaScript |
| Shared browser | Warning, interaction, offline, Back, cross-tab logout | 46 production-browser assertions passed; keyboard/MFA errors at all three sizes, warning/absolute expiry, offline clearing/reconnect, selection-cookie cleanup, no persistent patient localStorage; account-switch scenario still needs an explicit exercise |
| Operator | Repeat seed preserves password/MFA, conflict stop, interrupted Auth recovery, unrelated data preserved | Five repeat-seed checks and 26 actual operator-command assertions passed, including failed recovery, interrupted disable and reconciliation; audit retained |
| Types | Generate against matching ledger, wire Database into clients, compare in CI | Generated from test project, integrated and matching remote output |
| CI | Environment reviewer, branch restriction, exact SHA, isolated secrets, fork rejection | Workflow file only; settings unverified |

## Security failures before an RPC

`src/lib/security-event.ts` emits only coded boundary events, a generated request ID and
timestamp. It records no URLs, bodies, cookies, patient IDs or unverified actors. The local
server console has **no configured durable sink or retention policy**; this is not a complete
audit service.

An entered protected RPC commits expected access denials and a request ID. Invalid signatures
rejected before RPC entry, malformed arguments and failed database transactions cannot be
recorded in that same patient audit transaction. Check the separate hosted Auth/API logs.

On the designated test project, exercise a forged JWT, blocked signup, password-only request,
hidden-schema request and disallowed HTTP method. Record which actual log contains each event,
retention, timestamp/request correlation and missing fields. Keep only controlled codes/counts
and synthetic correlation IDs in review evidence. Never assume retention from a pricing plan,
or assume the application and provider use the same request ID.

The HTTP runner checks forged-signature refusal, absence of patient identifiers and absence
of a fabricated record-audit event for that pre-RPC failure. The browser runner checks
origin rejection with a data-free correlation ID and malformed Auth-cookie refusal.
These checks do not certify provider log retention or correlation. If coverage is insufficient, select an approved redacted log
sink before real-data use. Missing security evidence blocks real-data readiness.

## Operator integrity

Both audit tables reject update/delete/truncate, but a trusted database administrator can
alter triggers/policies. Pilot planning must address operator access and independent export.
An operator request retains intent and outcome. Patient seed reads/writes also record IDs in
the same transaction. For interrupted Auth creation, inspect the synthetic identity key and
request before rerunning; no password/MFA reset is part of seeding. Verify repeat setup and
partial Auth failure on the test project before relying on them.

## Completion

Executed assertions and their commit/source hash are written under ignored `var/test-results`.
The invariant runner rejects stale, skipped or missing evidence; complete commands and review
limits are in foundation/design.md. A build or parsed SQL file is not policy-execution evidence.
Generated types, authenticated browser checks and operator failure exercises now pass.
Security-boundary log evidence, actual CI protections and Claude Code's independent
implementation review remain required before archive. No real-data readiness is claimed.

[GitHub environment documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
describes protection and secret release. An environment name in YAML alone does not establish
the required protection; repository settings must be verified before secrets are added.
