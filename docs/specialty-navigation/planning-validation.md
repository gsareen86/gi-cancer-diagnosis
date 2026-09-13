# Planning reset evidence — 2026-09-13

Scope: branch preservation, current product brief, OpenSpec proposal/specs/design/tasks
and a clean implementation handoff. **No application behaviour changed in this reset.**

## Preservation

- Original branch: `codex/early-gi-care-journey`, initially at `5a61196` with uncommitted work.
- Preserved that work in local checkpoint **`842cd47`** before switching branches.
- Created **`codex/gi-specialty-navigation`** from the checkpoint.
- Moved three old pending changes to `docs/history/2026-09-13/openspec/changes`.
  Their contents/checkmarks are unchanged; this is supersession, not completion/archive.
- Copied the previous root README into the same historical area before replacing it
  with a current entry page. No source, database, model, upload or environment file was removed.
- No cloud deployment, provider provisioning, real-patient import, external messaging or Git push.

## Validation

- `openspec validate --all --strict`: **1 change passed, 0 failed**.
- `openspec status --change establish-specialty-navigation-pilot --json`: proposal,
  three specs, design and tasks exist; planning complete. This is artifact completion,
  not implementation completion.
- Apply instructions report **ready, 0/20 implementation tasks complete**. Inspect `openspec instructions apply` for
  the current count/state rather than interpreting the status command's `isComplete`
  field as shipped software.
- `git diff --check`: passed for the planning changes.
- Local Markdown link check: 15 current entry/planning files checked, zero missing targets.
- Staged history moves were detected by Git as unchanged renames; the old spec bodies
  and task checkboxes were preserved exactly.
- Diff against checkpoint for `apps`, `packages`, `services`, `e2e` and dependency
  manifests: empty. Build, browser and clinical tests were **not rerun** for a docs-only
  reset. Prior pass counts are not evidence for the revised requirements.

## Content reconciliation

- Latest clinician-only differential answer takes precedence over the attached
  conversation's earlier patient-visible-cause discussion.
- Tablet self-service/assistance and desktop workspace are primary; phone means
  responsive web. Optional existing reports are retained; paid phone OTP remains deferred.
- Emergency advice is retained; calling, SOS and automatic contact notification are excluded.
- Company processing/IP intent recorded separately from patient-data authority.
- Clinic and Metro are the proposed first sites; no Metro endorsement or permission assumed.
- Local synthetic demo and future India Azure pilot separated; model/SKU/terms unverified.
- Retention and pilot-end disposition remain pre-pilot decisions, not silently defaulted.
- Clinical-lead supplied questions and proposed additions are distinct in the worksheet;
  no new clinical text, thresholds, rules or Hindi locale is marked approved.
- Chosen outcome measures have explicit definitions and exclusions, with no invented
  success targets, time savings, agreement percentages or willingness-to-pay estimates.

## Next session

Use [START-HERE.md](START-HERE.md). Apply only
`establish-specialty-navigation-pilot` after reading its artifacts. The new increment
has not been implemented; the full v1 roadmap is a sequence of later bounded changes.
The repository still contains inherited clinical workflows and their known unfinished
work. The proposed mode boundary is a requirement, **not an already enforced control**.
