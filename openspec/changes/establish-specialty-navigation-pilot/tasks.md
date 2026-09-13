## 1. Baseline and boundary inventory

- [ ] 1.1 Read START-HERE, the brief and this change; record branch/commit and current typecheck/test results in a new evidence file, distinguishing inherited failures from changes (verification: saved commands/results, no reused historical pass counts).
- [ ] 1.2 Inventory every clinical API, server-rendered workspace, background entry and direct AI/extraction endpoint that needs the operating guard; verify the inventory covers all clinical access paths through route discovery and service call sites.

## 2. Operating boundary

- [ ] 2.1 Add failing tests for default demo mode, unknown mode, pilot denial, test-mode denial outside test runtime and request-level override attempts; verify each unsafe path fails before implementing the guard.
- [ ] 2.2 Implement strict shared operating configuration and the server guard; verify missing configuration enters local_demo and pilot remains closed regardless of flags or claimed evidence.
- [ ] 2.3 Wire the guard to clinical APIs and server components before clinical input parsing/access or job dispatch; verify direct requests cannot read/write another patient's/site's record or bypass with existing credentials/consent.
- [ ] 2.4 Wire the same boundary into direct AI-service and extraction endpoints; verify no network/model/storage operation is reached for blocked clinical requests and isolated test mode remains explicit.
- [ ] 2.5 Preserve content-free access-denial audit/security events and generic immediate-assistance information; verify denial metadata excludes request bodies and the advice works without authentication or AI, with no call/SOS affordance.
- [ ] 2.6 Provide an operator readiness report with unresolved D01–D09 gates and safe mode/provider information; verify it exposes no keys, raw environment values, patient data or invented approvals, and India processing is never inferred from an unverified resource location.

## 3. Current-purpose entry and synthetic examples

- [ ] 3.1 Update the product entry translations/copy to specialty navigation, optional reports and clinician-only hypotheses; verify no early-detection, active Metro partnership, unapproved Hindi, named-doctor or response-time promise remains on the changed surface.
- [ ] 3.2 Add allowlisted read-only no-report and existing-report synthetic examples with separate patient/clinician projections; verify arbitrary record IDs and extra clinical payloads cannot reach repositories or storage and illustrative AI content is labelled accurately.
- [ ] 3.3 Implement the desktop/tablet/phone layouts and honest image placeholders; verify screenshots at 1440×900, 1024×768, 768×1024 and 390×844, no page overflow, 44px primary targets, keyboard focus and 200 percent zoom.
- [ ] 3.4 Add browser coverage for default entry, examples, blocked inherited clinical routes and patient-preview differential exclusion; verify examples are visibly synthetic and create no clinical records or model jobs.

## 4. Pure evaluation contracts

- [ ] 4.1 Define strict versioned measurement schemas with synthetic codes, source/version identity, independent-reference exposure and exclusive accounting dispositions; verify extra identifiers/narrative/report fields and incompatible versions are rejected or explicitly unevaluable as specified.
- [ ] 4.2 Implement primary/acceptable-route agreement and structured urgency comparison; verify fixtures distinguish primary disagreement from acceptable-route agreement, exposed references, missing AI/reference, abstention, withdrawal and incompatible constraints.
- [ ] 4.3 Implement reconciled denominators and unavailable rates; verify all-AI-failure and zero-evaluable fixtures return null rates with reason counts, and every eligible case is accounted for exactly once.
- [ ] 4.4 Implement explicit active-time event validation and calculation; verify pauses, interruptions, incomplete sessions, duplicate IDs, negative/order errors, same-actor overlaps and concurrent clinician/coordinator work.
- [ ] 4.5 Implement baseline comparison outputs without invented targets; verify missing/incompatible baselines yield unavailable savings and clinician effort, staff effort and AI wait remain separate, with no persistence/API added.

## 5. Integration evidence and handoff

- [ ] 5.1 Run typecheck, affected core/web/Python tests, broader access/release regressions and production build appropriate to the changed boundaries; record results and resolve regressions without weakening the mode or clinical-access tests.
- [ ] 5.2 Validate this change with OpenSpec strict validation and reconcile every requirement/scenario to implementation evidence; verify clinical/site/provider approvals and real-data pilot tasks remain explicitly unfulfilled.
- [ ] 5.3 Update the short handoff with implementation commit, commands/results, manual UI evidence and next bounded change; verify no patient data is included and archive/sync only after all this change's tasks are actually complete.
