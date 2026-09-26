## Purpose

Turns the project's safety and data invariants into automated checks, so each change proves
the invariants it enforces and a regression fails before it is merged.

## ADDED Requirements

### Requirement: Automated checks run on every push and pull request
The project SHALL run typecheck, lint and unit checks on pushes and pull requests.
Database policy, integration and end-to-end smoke checks SHALL run against an explicitly
designated hosted synthetic test project using committed migrations and controlled
fixtures, without starting a Docker Supabase stack. Credentials SHALL be available only
to trusted, approved workflow executions. Untrusted fork code SHALL never receive them.
The pipeline SHALL distinguish not-run hosted checks from passing checks; completion
requires successful hosted verification for the exact reviewed commit.

#### Scenario: A check fails
- **WHEN** any automated check fails on a push or pull request
- **THEN** the pipeline reports failure and names the failing check

### Requirement: Every data table is covered by row-level security
The project SHALL fail its database tests when any table in an application data schema lacks
row-level security, or when a table holding protected records lacks the policy that requires a
completed second factor.

#### Scenario: Table added without row-level security
- **WHEN** a migration adds a table to an application data schema without enabling row-level security
- **THEN** the database tests fail and name the table

### Requirement: Invariant registry with required evidence
The project SHALL list every invariant (S1–S10, D1–D5) and decompose it into named controls
with owning change, rationale, status (pending, implemented, verified or deferred) and
automated/manual evidence. Verified automated controls SHALL require executed non-skipped
tests for the exact tested commit and artifact version. Tag presence alone SHALL NOT establish
verification. Invariants with deferred children SHALL report partial coverage. D2 encounter
reset SHALL remain deferred to encounters-and-consent; D5 process obligations SHALL retain
manual evidence requirements. The checker SHALL reject unknown identifiers and unsupported
verification claims, including stale or skipped evidence. Review SHALL assess whether tests
actually assert the behaviour; the checker SHALL NOT claim it proves clinical correctness.

#### Scenario: Verified control without executed evidence
- **GIVEN** a control marked verified
- **WHEN** its required test evidence is absent, skipped or from another commit
- **THEN** the invariant check fails and names that control

#### Scenario: Partial invariant
- **GIVEN** verified site isolation and deferred encounter reset under D2
- **WHEN** the registry reports D2
- **THEN** it reports partial coverage and names the deferred owner change

#### Scenario: Unknown tag
- **WHEN** a test is tagged with an invariant identifier that is not in the registry
- **THEN** the invariant check fails and names the test

### Requirement: Database contract types match the migrations
The project SHALL fail its checks when the committed application types for database operations
differ from those generated from the current migrations.

#### Scenario: Operation changed without regenerating types
- **WHEN** a migration changes a database operation's inputs or outputs and the committed types are not regenerated
- **THEN** the contract check fails
