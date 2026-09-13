# Start a clean GI Compass implementation session

Branch: `codex/gi-specialty-navigation`.
Current change: `establish-specialty-navigation-pilot`.
Product authority: [brief.md](brief.md), decisions dated 2026-09-13.

Read this file, `openspec/config.yaml`, the brief, and the selected change's artifacts.
Then read only code directly needed for the selected task. Use `openspec status` and
`openspec instructions apply` to discover current tasks; don't resume an old chat's list.

The product is **GI specialty navigation with clinician-only AI hypotheses**, initially
using tablets at the lead's clinic and a proposed Metro pilot. Keep optional reports.
Local demo uses synthetic data/local inference; the pilot needs approved India hosting
and Azure deployment evidence. No emergency calls/SOS, phone OTP, named-doctor directory
or e-prescribing in v1. Desktop and phone web must both work well.

The previous active changes are historical under `docs/history/2026-09-13` and preserved
on `codex/early-gi-care-journey` at `842cd47`. Do not load them by default. Existing code
is a candidate for reuse, not proof of current requirements or production readiness.

Work on one bounded OpenSpec change. Do not load the full roadmap or all clinical
worksheets unless the task needs them. After verified implementation, record exact
checks and remaining external gates, sync/archive only completed artifacts, and leave
a short handoff. Start the next change in a fresh conversation. An agent cannot claim
it cleared its context window merely by writing this file.

Suggested next-session instruction:

> Work in codex/gi-specialty-navigation. Read docs/specialty-navigation/START-HERE.md
> and apply establish-specialty-navigation-pilot using OpenSpec. Implement its tasks
> and verify them. Use synthetic data only; preserve the previous checkpoint and do
> not resume the superseded early-care backlog.
