# Early-care implementation evidence

> Historical evidence for the earlier branch. The [2026-09-13 reset](specialty-navigation/planning-validation.md)
> preserves this work but does not treat these results as validation of the new scope.

## Branch and baseline

Implementation branch: `codex/early-gi-care-journey`. The original worktree had 382 source/planning files with substantial staged and unstaged work; an ignored local copy and patches were captured under `var/early-care-baseline-20260906/` before editing. No reset or baseline commit was performed by this implementation session.

Initial local verification: TypeScript passed; 546 JavaScript/TypeScript tests passed; production Next.js build passed. Logs remain in `var/`. These were engineering checks, not clinical validation.

After the user's consolidation, this branch was at `5a61196`, based on `a60d002`. Both worktrees were clean. The secondary worktree was detached at that same commit and the branch checked out in the primary workspace at the user's request. The initial resumed typecheck failed on missing brief contracts and obsolete emergency-contact props. Integration wiring is being restored and reverified; earlier passing results must not be presented as results for this new revision.

## Reproduced regressions

- Safety: the proposed five/nine universal seeds still miss reduced-urine follow-up after nonbloody vomiting and inability to retain fluids. Two legacy-path assertions pass; five entry-point safety assertions failed before shared follow-up scheduling and passed after. `var/early-care-red-test.log` records the red run. Fixtures remain fictional and clinically unapproved.
- Draft overwrite: a stale second save originally returned 200 and overwrote the first draft. `var/early-care-draft-red.log` records that failure. Revision checking now returns 409 and preserves the earlier physician notes. The API regression also reads the stored record to verify preservation.
- Existing emergency-contact expectations are superseded by the user's advice-only instruction. Updated assertions require an empty contact list; no calling or contact notification is implemented.

## Explicit limits

Clinical content approval, bilingual comprehension review, real clinic timings, continued use, willingness to pay and clinical effectiveness have not been established. Mobile OTP is deferred. Existing reports remain optional. No public clinical service, hospital endorsement or live notification provider was enabled by these checks.
