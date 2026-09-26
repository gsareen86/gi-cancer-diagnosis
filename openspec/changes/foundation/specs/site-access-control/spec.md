## Purpose

Ensures staff can reach protected records only at sites where they hold an active membership,
and only for the operations their role permits.

## ADDED Requirements

### Requirement: Access comes only from active site memberships
The system SHALL grant access to protected records only through an active membership that
links a staff member, a site and a role. Roles in this change are clinician, coordinator and
site admin. A staff member MAY hold memberships at several sites and more than one role at a
site. Protected records SHALL each belong to exactly one site.

#### Scenario: Staff member with no active membership
- **GIVEN** a staff member who has signed in with both factors but has no active membership
- **WHEN** they open the workspace
- **THEN** no site and no protected records are shown
- **AND** they are told to contact their site admin

#### Scenario: Member of two sites
- **GIVEN** a clinician with active memberships at Demo Clinic and Demo Hospital OPD
- **WHEN** they select Demo Clinic as the active site
- **THEN** the workspace shows only Demo Clinic's records
- **AND** changing to the other site requires an explicit selection

### Requirement: Site isolation
The system SHALL return, and allow operations on, protected records only for sites where the
requester holds an active membership. A request for another site's record SHALL receive the
same response as a request for a record that does not exist, and SHALL be audited.

#### Scenario: List at own site
- **GIVEN** a clinician whose only membership is at Demo Clinic
- **WHEN** they list patients
- **THEN** only Demo Clinic patients are returned

#### Scenario: Another site's record requested by identifier
- **GIVEN** a clinician whose only membership is at Demo Clinic
- **WHEN** they request a Demo Hospital OPD patient by its record identifier
- **THEN** the response is a generic not-found result with no patient data
- **AND** an audit entry records the attempt with outcome denied_or_not_found and no foreign record identifiers

#### Scenario: Forged active site
- **GIVEN** a coordinator whose only membership is at Demo Clinic
- **WHEN** a request names Demo Hospital OPD as the active site, for example through an edited cookie or parameter
- **THEN** the request is denied without returning data
- **AND** an audit entry records the denial

### Requirement: Role permissions are deny-by-default
The system SHALL permit an operation only when the requester's role at that site is explicitly
allowed it. In this change: listing and viewing patient records is allowed for clinician and
coordinator; reviewing the audit log and viewing the site's memberships is allowed for site
admin. Every other combination SHALL be denied and audited.

#### Scenario: Site admin requests patient records
- **GIVEN** a staff member whose only role at Demo Clinic is site admin
- **WHEN** they request Demo Clinic's patient list
- **THEN** the request is denied without returning data
- **AND** an audit entry records the denial

#### Scenario: Coordinator requests the audit log
- **GIVEN** a coordinator at Demo Clinic
- **WHEN** they request Demo Clinic's audit log
- **THEN** the request is denied and audited

### Requirement: Membership changes take effect immediately
The system SHALL evaluate memberships at the time of each request, so that deactivating a
membership denies the next request without waiting for the staff member to sign in again.

#### Scenario: Membership deactivated during a session
- **GIVEN** a clinician signed in and viewing Demo Clinic's patient list
- **WHEN** an operator deactivates their Demo Clinic membership and the clinician refreshes the list
- **THEN** the request is denied and no patient data is returned

### Requirement: Protected data only through audited operations
The system SHALL NOT allow staff sessions to read or change protected tables directly through
the database API; protected data SHALL be reachable only through operations that enforce the
rules above and record an audit entry.

#### Scenario: Direct table query
- **GIVEN** a staff session that has completed both factors
- **WHEN** it queries the patient table directly through the database API instead of the permitted operation
- **THEN** the request is rejected and no data is returned

#### Scenario: Raw SQL client role
- **WHEN** an application role attempts to select a protected table directly using its database privileges
- **THEN** it lacks table read privileges; only authorised fixed operations can return rows

### Requirement: Site administrators can view site memberships
The system SHALL provide site admins an audited, paginated membership list for their sites.
It SHALL NOT grant them patient access merely because they administer a site. Staff with no
memberships SHALL receive an empty own-membership list without access to other users.

#### Scenario: Admin membership view
- **GIVEN** an active site admin
- **WHEN** they request their site's memberships for site_administration
- **THEN** the permitted list is returned and the read is audited

#### Scenario: No memberships
- **WHEN** an authenticated MFA-complete staff member has no memberships
- **THEN** only an empty workspace and contact instruction are shown
