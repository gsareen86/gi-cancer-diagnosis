## Purpose

Makes the locally served demonstration unmistakable: it uses an explicitly designated
Supabase Cloud project, controlled synthetic records and repeatable non-destructive setup.

## ADDED Requirements

### Requirement: The environment is explicit and visible
The system SHALL record whether it is running as a demo or a pilot environment, and SHALL
show a persistent label on every staff page in a demo environment stating that it contains
synthetic data only and must not receive real patient data.

#### Scenario: Staff page in the demo
- **GIVEN** a demo environment
- **WHEN** any staff page is displayed
- **THEN** a visible label states that the system is a synthetic demo and must not receive real patient data

### Requirement: Controlled fixtures and a synthetic marker guard
The system SHALL reject, at the database, any protected record in a demo environment that is
not marked synthetic. The foundation SHALL accept patient records only through the fixed,
reviewed seed and SHALL expose no arbitrary patient creation/upload operation. Documentation
SHALL distinguish this entry-point control from the marker, which cannot detect real details
falsely labelled synthetic. An environment flag SHALL NOT enable real-patient intake.

#### Scenario: Non-synthetic record in the demo
- **GIVEN** a demo environment
- **WHEN** any role, including the seed or an operator, stores a patient record not marked synthetic
- **THEN** the write is rejected and nothing is stored

#### Scenario: Arbitrary real details labelled synthetic
- **WHEN** a staff/API client attempts to create a patient record labelled synthetic
- **THEN** no arbitrary creation operation is available and the write is denied
- **AND** the system makes no claim that the marker classifies personal information

### Requirement: The demo uses the designated Supabase Cloud project
The system SHALL use the owner's explicitly designated hosted Supabase project, with a
verified India region and a project reference/environment marker matching configuration.
It SHALL reject missing, mismatched or unapproved targets and SHALL NOT start or fall
back to a local Docker Supabase instance. The refusal SHALL explain the configuration
problem without exposing secrets. Possession of a project URL alone SHALL NOT prove its region.

#### Scenario: Demo pointed at the designated cloud database
- **GIVEN** the application is configured as a demo
- **WHEN** the hosted project reference, approved region evidence and database environment match
- **THEN** the demo can serve staff pages after the normal authentication and authorisation checks
- **AND** no local Supabase container is required

#### Scenario: Wrong or unverified project
- **WHEN** configuration points to a different project, a pilot project, an unverified region or a loopback Supabase instance
- **THEN** staff pages and setup mutations are refused with a secret-free operator explanation

#### Scenario: Environment mismatch
- **WHEN** the application's configured environment differs from the one recorded in the database
- **THEN** staff pages are not served and an operator message explains the mismatch

### Requirement: Reproducible synthetic seed
The system SHALL provide a repeatable setup command that applies reviewed pending
migrations and a controlled synthetic seed to the explicitly designated cloud demo
project. It SHALL NOT drop/reset existing schemas or unrelated data. The seed SHALL
contain two demo sites, staff for every role at each site, one clinician with memberships
at both sites, and obviously synthetic patients. Conflicting existing rows SHALL stop
setup rather than be overwritten. Staff credentials SHALL be generated per environment,
not committed as public demo passwords.

#### Scenario: Set up the designated cloud demo
- **WHEN** a developer runs the setup command against the verified demo project
- **THEN** Demo Clinic and Demo Hospital OPD exist with clinician, coordinator and site admin accounts
- **AND** one clinician holds memberships at both sites
- **AND** every patient record is marked synthetic and uses the synthetic identifier pattern

#### Scenario: Seed never targets another environment
- **WHEN** setup is pointed at an unapproved project, the later pilot project or a mismatched environment
- **THEN** it stops without changing any database or Auth account

### Requirement: Hosted secrets and test state remain isolated
Runtime project URL and publishable key SHALL be separate from database passwords,
management tokens and Auth administration keys. Privileged credentials SHALL never be
included in browser bundles or logged. Database/integration tests SHALL use an explicitly
designated synthetic test project distinct from the demo and pilot. Missing test
credentials SHALL report that database verification did not run; they SHALL NOT cause a
fallback to another project, a local stack or a false passing result.

#### Scenario: Test target equals the demo or pilot
- **WHEN** a test runner is configured with the demo/pilot project reference or lacks a test target
- **THEN** it refuses database mutations and reports the configuration failure

#### Scenario: Repeat setup
- **WHEN** setup runs twice against the same approved synthetic demo
- **THEN** it does not duplicate staff/patients, reset MFA, change existing passwords or overwrite unrelated data
