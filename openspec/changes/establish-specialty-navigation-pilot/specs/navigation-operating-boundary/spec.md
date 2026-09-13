## Purpose

Distinguish a synthetic local demonstration from an authorised patient-data pilot,
so inherited screens or environment settings cannot silently activate the new service.

## ADDED Requirements

### Requirement: Explicit operation mode with a closed patient-data boundary

The application SHALL distinguish local demonstration, automated test and pilot modes.
Missing mode configuration SHALL select local demonstration; an unknown value SHALL
prevent startup. In this increment, pilot mode SHALL remain unavailable regardless
of environment flags or supplied approval labels. Automated test mode SHALL be valid
only in the test runtime. The restriction SHALL apply on the server to clinical reads,
writes, uploads, model/extraction requests, document downloads and release paths,
including inherited APIs and server-rendered workspaces.

#### Scenario: Missing configuration
- **GIVEN** the deployment has no explicit operating mode
- **WHEN** the application starts
- **THEN** it offers only the labelled demonstration entry and authentication as needed
- **AND** it does not accept patient clinical records or invoke a clinical model job

#### Scenario: Direct request bypasses the screen
- **GIVEN** demonstration mode is active
- **WHEN** a caller directly sends a clinical upload, mutation, read or AI request
- **THEN** the server rejects the operation before parsing/storing clinical content or dispatching work
- **AND** existing credentials, roles or an asserted consent flag cannot bypass this restriction

#### Scenario: Configuration is not pilot authorisation
- **WHEN** an operator requests pilot mode or test mode in a non-test runtime
- **THEN** the application fails closed with an actionable operator error
- **AND** it does not claim that changing the mode establishes site permission

### Requirement: Demonstration data cannot be confused with pilot data

The demonstration SHALL use only bundled synthetic examples served through a separate
read-only projection. It SHALL not accept patient identifiers, clinical free text or
report uploads. Examples SHALL be labelled synthetic on the screen and any export;
illustrative AI text SHALL be labelled illustrative rather than a live model result.
This is the initial entry surface, not the completed clinical workflow.

#### Scenario: Open an example
- **WHEN** a visitor selects a bundled example
- **THEN** the displayed content is the selected synthetic fixture and is visibly labelled
- **AND** no patient record, consent ledger or clinical repository is read or mutated

#### Scenario: Attempt to substitute a patient record
- **WHEN** a visitor supplies an arbitrary encounter identifier or extra clinical payload to the example surface
- **THEN** the request cannot resolve a patient record or persist the payload
- **AND** it returns only the allowlisted fixture or a not-found/invalid-input response

### Requirement: Accountable pilot readiness information

An operator-readable readiness report SHALL state the current mode, current intended
use and unresolved pilot gates: company/contact and site authority; purposes/consent;
retention and pilot-end disposition; approved clinical content; reviewing staff;
model/deployment/processing and data minimisation; evaluation protocol; and applicable
regulatory/security review. It SHALL distinguish missing evidence from approved facts
and SHALL not contain patient data, keys or raw environment values.

#### Scenario: Owner has identified the company role but not the agreements
- **WHEN** the readiness report is inspected
- **THEN** it describes the company as the proposed primary operator
- **AND** it keeps the relevant authority and retention gates unresolved without inventing approvals

#### Scenario: India resource with unverified inference
- **WHEN** Azure deployment details are absent or describe Global/DataZone processing
- **THEN** India-only pilot processing is not reported as verified
- **AND** no alternate provider is selected automatically

### Requirement: Preserve independent safety information and audit boundaries

Generic advice to seek immediate assistance or visit a doctor/hospital SHALL be
available without authentication, report processing or AI. This change SHALL not
introduce new medical thresholds or publish clinical rules. Denied clinical access
SHALL retain the existing security/audit event path with actor, operation, time and
reason when available, without logging request content. Mode checks SHALL not replace
role, site, subject, consent and audit checks in later enabled workflows.

#### Scenario: AI unavailable or form not started
- **WHEN** the visitor cannot reach the model or has not authenticated
- **THEN** generic immediate-assistance guidance remains readable
- **AND** it offers no emergency call, SOS or automatic contact notification

#### Scenario: Attempted clinical access is denied
- **WHEN** a known actor attempts a blocked clinical operation, including another patient's or site's record
- **THEN** no clinical content is returned or read for display
- **AND** an access-denial event records the operation and reason without the clinical body
- **AND** possession of a record ID does not confer consent or access
