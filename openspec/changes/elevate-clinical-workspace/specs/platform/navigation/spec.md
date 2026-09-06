## Purpose

Separates the patient's world from the clinician's at the route level, guards the boundary in
one place, and gives every signed-in person a persistent shell they can orient in and sign out
from.

## ADDED Requirements

### Requirement: India privacy and protection readiness

The release specification SHALL maintain a dated India applicability register covering the IT Act
2000 and SPDI Rules 2011, DPDP Act 2023 and final Rules 2025 with phased commencement, and CERT-In
directions. Future duties SHALL be identified separately from currently operative duties. Health
data's SPDI classification SHALL NOT be attributed to a separate sensitive-data category in DPDP.
Implementation evidence and open operational gates SHALL be explicit, with no unsupported HIPAA
or DPDP compliance claim. See `docs/india-privacy.md` for primary sources and release checks.

#### Scenario: India deployment review

- **WHEN** a production release is proposed
- **THEN** a legal/privacy owner verifies current commencement and applicability, notice/consent and rights handling, retention and erasure exceptions, processors, security and incident response against deployment evidence

#### Scenario: Residency policy

- **WHEN** a processor, backup destination or AI provider is configured for production
- **THEN** India-region processing and storage are verified as project policy, cross-border restrictions are reviewed separately, and no blanket DPDP localization mandate is asserted

#### Scenario: Consent, rights and audit

- **WHEN** a patient requests access, correction, withdrawal, erasure, grievance redressal or nomination handling
- **THEN** identity and authority are checked, the request and outcome are auditable, clinical access retains purpose-specific consent checks, and retention/legal-hold exceptions are explained rather than silently deleting signed records

#### Scenario: Incident readiness is not simulated compliance

- **WHEN** a security incident is assessed
- **THEN** the responsible owner applies the relevant CERT-In and commenced DPDP reporting duties separately, preserves controlled evidence and records actual notifications; a test event is never represented as a regulatory filing

### Requirement: Role-isolated workspaces

Patient-facing routes SHALL live under `/patient/*` and clinician-facing routes under
`/doctor/*`, each with its own layout, navigation, and branding. Public and authentication routes
SHALL remain at the top level.

#### Scenario: A patient signs in

- **WHEN** a patient with a complete profile and storage consent authenticates
- **THEN** they arrive at `/patient/dashboard`

#### Scenario: A doctor signs in

- **WHEN** a doctor authenticates and has satisfied their second factor
- **THEN** they arrive at `/doctor/dashboard`

### Requirement: The workspace boundary is guarded server-side, once

Each workspace layout SHALL resolve the session and refuse entry before any page beneath it
renders. No page SHALL be the only thing checking role.

#### Scenario: Unauthenticated access to a workspace

- **WHEN** a request with no valid session reaches any `/patient/*` or `/doctor/*` path
- **THEN** it redirects to `/login` carrying the requested path, and after authenticating the
  user arrives at the path they asked for

#### Scenario: Cross-role access is refused and explained

- **WHEN** an authenticated patient requests a `/doctor/*` path
- **THEN** they are redirected to `/patient/dashboard` and told that the area is not available to
  their role

#### Scenario: A session pending its second factor

- **WHEN** a doctor whose session is `mfaPending` requests any workspace path
- **THEN** they are redirected to the second-factor step and reach no clinical data

#### Scenario: The guard does not replace API authorization

- **WHEN** a request is made directly to an API route for another role's data, bypassing the
  interface entirely
- **THEN** the API route refuses it on its own declared roles, independently of any layout guard

### Requirement: A patient cannot reach the questionnaire before consent and profile

The patient workspace guard SHALL redirect to profile completion when the date of birth or name
is missing, and to consent when storage consent has not been granted.

#### Scenario: Incomplete profile

- **WHEN** a patient without a recorded date of birth requests any patient path other than the
  profile page
- **THEN** they are redirected to complete their profile first

#### Scenario: Consent not granted

- **WHEN** a patient with a complete profile but no active `account_processing` grant requests
  the intake
- **THEN** they are redirected to the consent page

### Requirement: A persistent application shell

Every authenticated workspace SHALL present a topbar carrying the product name, a breadcrumb
trail for the current location, a notification control, and an account control showing the
signed-in person's name and role.

#### Scenario: Role is visible

- **WHEN** a signed-in user looks at the topbar
- **THEN** their role is stated in words — patient or GI specialist — not implied by styling

#### Scenario: Breadcrumbs reflect the route

- **WHEN** a doctor opens a case from triage
- **THEN** the breadcrumb shows the path from the workspace root to that case, and each ancestor
  is a working link

### Requirement: Explicit sign-out

The account control SHALL offer a sign-out action that revokes the server-side session, clears
the access and refresh cookies, and returns the user to `/login`.

#### Scenario: Signing out

- **WHEN** a user signs out
- **THEN** their refresh-token family is revoked, both cookies are cleared, and they arrive at
  `/login`

#### Scenario: The back button after signing out

- **WHEN** a signed-out user navigates back to a workspace path
- **THEN** they are redirected to `/login`, because the guard runs server-side on every request

### Requirement: Legacy paths continue to resolve

Paths published before this change SHALL redirect to their new locations, preserving any case
identifier in the path.

#### Scenario: An old notification link

- **WHEN** a patient follows a link to `/cases/{caseId}` from an email sent before this change
- **THEN** they arrive at `/patient/case/{caseId}`

#### Scenario: An old doctor link

- **WHEN** a doctor follows a link to `/doctor/cases/{caseId}`
- **THEN** they arrive at `/doctor/case/{caseId}`
