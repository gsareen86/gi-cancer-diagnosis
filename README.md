# GI Compass

GI specialty navigation and clinician decision support for a clinic-based workflow
in India. The planned application combines patient history and symptoms with optional
existing reports, lets a clinician review AI hypotheses and urgency, and provides
clinician-approved next steps and the appropriate **type of doctor** to the patient.
AI differentials remain clinician-only in v1.

## Current branch and status

The product direction was reset on **2026-09-13** on
`codex/gi-specialty-navigation`. The revised OpenSpec package is ready for implementation;
this reset changes planning/context only. The inherited application is not certified
against the new scope, and no real-patient pilot is enabled or approved by these files.

Previous work is preserved on `codex/early-gi-care-journey` at checkpoint `842cd47`.
Historical changes were moved out of the active OpenSpec backlog without marking them
completed. Source and database contents were preserved.

## Start here

- [Clean implementation handoff](docs/specialty-navigation/START-HERE.md)
- [Current product brief and decisions](docs/specialty-navigation/brief.md)
- [Bounded implementation sequence](docs/specialty-navigation/implementation-plan.md)
- [Clinical content review worksheet](docs/specialty-navigation/clinical-content-review.md)
- [Pilot measurement protocol](docs/specialty-navigation/pilot-measurement.md)
- [Evidence and unresolved assumptions](docs/specialty-navigation/evidence-notes.md)
- [Current OpenSpec change](openspec/changes/establish-specialty-navigation-pilot/proposal.md)

The first sites are the clinical lead's clinic and a **proposed** Metro pilot. Intake
is planned for patient self-service or coordinator-assisted tablets, with a complete
desktop clinician workspace and responsive phone web. Existing PDFs and readable
scans/photos remain optional. Phone OTP, emergency calling/SOS, named-doctor directories
and e-prescribing are outside v1. Immediate-assistance advice remains part of the design.

## Engineering baseline

Retain the npm workspace monorepo: Next.js/TypeScript/Tailwind, PostgreSQL/Drizzle,
and the Python AI service. Local demonstrations use synthetic data; the pilot requires
approved India processing and Azure deployment evidence. No paid cloud resources have
been provisioned by this reset.

Existing local development commands are preserved:

```text
npm ci
npm run dev
npm run dev:status
npm run dev:down
npm run typecheck
npm test
```

See the [previous setup reference](docs/history/2026-09-13/README-before-reset.md) for
inherited setup details. It is historical: its feature/readiness statements are not
claims about the new product. Do not import real patient data into development.
