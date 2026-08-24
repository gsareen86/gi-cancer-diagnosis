# GI Compass

An AI-assisted gastrointestinal diagnostic-support platform for patients in India.

A patient completes a guided, image-assisted, adaptive symptom questionnaire and uploads prior
reports. The system compiles a structured clinical summary, grounds an LLM call on a doctor-curated
knowledge base, and produces a **decision-support differential assessment for a Registered Medical
Practitioner** — never a diagnosis delivered to the patient.

> **The AI never diagnoses, never prescribes, and its raw output is never shown to the patient.**
> A registered doctor reviews, overrides, and explicitly releases every clinical conclusion.
> Emergency escalation is deterministic and never waits on a model call.

## Status

Phase 1 (MVP) — specified under OpenSpec, implementation in progress.

## Spec-driven development

This repository uses [OpenSpec](https://github.com/Fission-AI/OpenSpec). Behaviour is specified
before it is built, and the specs are the contract the implementation is verified against.

```bash
npx @fission-ai/openspec list              # active changes
npx @fission-ai/openspec show add-gi-compass-mvp
npx @fission-ai/openspec validate --strict # validate all specs and changes
```

| Artifact | Path |
|---|---|
| Why & scope | `openspec/changes/add-gi-compass-mvp/proposal.md` |
| Behaviour contract (16 capabilities) | `openspec/changes/add-gi-compass-mvp/specs/**/spec.md` |
| Architecture & decisions | `openspec/changes/add-gi-compass-mvp/design.md` |
| Implementation checklist | `openspec/changes/add-gi-compass-mvp/tasks.md` |
| Project conventions & context | `openspec/config.yaml` |

## Regulatory frame

Architecture is shaped by these, not retrofitted to them:

- **Telemedicine Practice Guidelines 2020** — AI may only support a Registered Medical Practitioner.
- **CDSCO / Medical Device Rules 2017** — Phase 1 ships as an internal clinical tool for affiliated
  doctors, not a marketed public diagnostic product. A legal opinion is a launch blocker.
- **DPDP Act 2023 + DPDP Rules 2025** — health data is sensitive personal data; consent is a
  versioned, per-purpose, revocable object, and processing is gated on it in the data-access layer.
- **Data residency** — patient data stays in an India cloud region.

## Layout

```
apps/web        Next.js 15 App Router — patient, doctor, and admin UI + core REST API
packages/core   Framework-free domain logic: questionnaire engine, red-flag rules,
                consent policy, clinical-summary compiler, AI output schema
packages/db     Prisma schema and the audited, consent-gated ClinicalRepository
services/ai     Python FastAPI — RAG, OCR/document parsing, guarded structured LLM call
openspec/       Specifications and change proposals
```

## Open product decisions

Seven decisions await the clinical co-founder. Each is implemented as the safer default and marked in
code — find them with:

```bash
grep -rn "TODO(confirm): Decision" .
```

See `openspec/changes/add-gi-compass-mvp/design.md` § D13 for the table of defaults taken.
