## Why

The clean-slate app needs working staff authentication, site isolation and trustworthy audited
access before clinical workflows. This foundation establishes those controls against the
owner's Supabase Cloud account and records exactly what has been verified.

## What Changes

- Next.js/TypeScript staff workspace on desktop, tablet and phone; Supabase Cloud only.
- Invited staff, TOTP, server/database-enforced session revocation and idle/absolute deadlines.
- Site-scoped records and role permissions through fixed audited RPCs, least-privilege
  non-owner executor roles and RLS; site-admin audit/membership views work without table grants.
- Atomic allowed-access audits; committed generic denials without foreign existence leakage;
  separately documented security events for failures before RPC entry.
- Controlled synthetic seed and scoped audited operator provisioning/membership/recovery.
- Hosted target checks, migrations without reset, isolated tests and evidence-aware CI.
- The owner's F9 product correction is recorded in config/brief: patient-visible preliminary
  AI diagnoses and reasoning before individual clinician review. Patient AI is implemented in
  later clinical changes; this foundation neither enables nor prohibits that workflow.

## Capabilities

### New Capabilities

- `staff-authentication`: invited staff, TOTP, active sessions, expiry, safe logout and recovery.
- `site-access-control`: site/role isolation, fixed operations and admin membership reads.
- `phi-audit-log`: atomic access, durable denials, append-only events and scoped admin reads.
- `synthetic-demo-environment`: designated hosted projects, guarded setup and fixed fixtures.
- `invariant-verification`: executed control evidence and honest partial/deferred coverage.

### Modified Capabilities

None; this change introduces the first application capabilities and published specs.

## Invariants touched

| Invariant | Foundation contribution and limits |
| --- | --- |
| D1 | Audited app/operator operations and separate boundary security-event coverage; privileged operator limits documented |
| D2 | Site/role isolation and staff sessions; patient encounter isolation/reset belongs to change 2 |
| D4 | Verified India Cloud target, no provider calls or local database fallback; wider pilot residency reviewed later |
| D5 | Fixed synthetic fixtures and no arbitrary intake; repository/log/process controls have separate evidence |
| S5 | Latest patient-visible preliminary assessment contract preserved; no AI screens in foundation |
| S6 | Safe public bootstrap leaves room for immediate advice without login |
| S10 | Clinical parameters absent; operational timeout defaults explicitly assumed |

Other clinical invariants and D3 are deferred to their owning clinical/consent changes.
No blanket claim that D1/D2/D5 are completely verified by a tagged test.

## Demo or pilot

Synthetic demo first, reusable controls for pilot. Local web/model, hosted Supabase. Owner
supplies designated project configuration in ignored environment files. No real-data activation.

## Non-goals

- Patient intake/accounts/consent, reports, clinical rules, AI or prescriptions
- Web membership administration; scoped operator commands cover this foundation
- Phone OTP, WhatsApp, SSO, paid resources or cloud project provisioning
- Reusing deleted application code or local Docker Supabase

## Impact

Root Next.js app, Supabase migrations, Node setup/test/operator scripts, unit/hosted/browser
tests and GitHub CI. Dependencies are pinned and justified in design D-1. No administration
secrets in app runtime/browser. Missing cloud configuration blocks hosted verification,
not independent local development. No reset of existing cloud databases.
