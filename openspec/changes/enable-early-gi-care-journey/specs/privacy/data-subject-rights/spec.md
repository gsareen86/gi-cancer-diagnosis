## Purpose

Make access, correction, export and retention decisions operational and traceable.

## ADDED Requirements

### Requirement: Rights requests have owned fulfillment

Rights requests SHALL be identity-checked, assigned, tracked and fulfilled under the applicable authority and timelines. Withdrawal SHALL NOT make it impossible to process a lawful rights request.

#### Scenario: Verified export request

- **WHEN** an authorized subject or representative requests an export
- **THEN** the scope/authority is checked, fulfillment is assigned and audited, and access to the export is authenticated and time-limited

#### Scenario: Unverified requester

- **WHEN** a requester cannot establish authority for another patient's data
- **THEN** the data are not disclosed and the request records the verification issue

#### Scenario: Consent already withdrawn

- **WHEN** a verified request follows withdrawal of ordinary processing consent
- **THEN** the rights workflow uses its applicable authorized basis and does not demand re-consent to unrelated clinical processing

### Requirement: Retention and deletion respect recorded exceptions

Retention execution SHALL use the assessed applicable policy, record holds/exceptions and cover primary objects, derivatives and backup handling. It SHALL NOT promise immediate blanket deletion or erase clinical history merely because an acknowledgement occurred.

#### Scenario: Assessed deletion

- **WHEN** an approved deletion request has no applicable hold for the target data
- **THEN** the worker performs the scoped operation, records evidence and handles replicas/derivatives according to policy

#### Scenario: Required retention exception

- **WHEN** some records must be retained under the assessed policy
- **THEN** the exception and permitted residual processing are recorded and the requester receives an accurate outcome

#### Scenario: Audit preservation

- **WHEN** rights fulfillment changes access to clinical data
- **THEN** a minimized authorized audit of the action remains according to the assessed retention policy without unnecessarily copying clinical content
