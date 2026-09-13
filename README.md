# GI Compass

Clinic-based GI specialty navigation with clinician decision support, for India. Patients
answer a structured questionnaire and add existing reports on a tablet. A clinician reviews
rule-based urgency flags and a clinician-only AI analysis, then releases next steps to the patient.

**Status:** clean-slate rebuild started 2026-09-13. No application code yet; the first
OpenSpec change is `foundation`.

- [Product brief](docs/product-brief.md): purpose, scope, decisions, open questions
- [Roadmap](docs/roadmap.md): parallel tracks, extraction spike, change sequence
- [Agent working rules](AGENTS.md)
- Invariants: [`openspec/config.yaml`](openspec/config.yaml)

The earlier application is preserved on branch `codex/gi-specialty-navigation`.
