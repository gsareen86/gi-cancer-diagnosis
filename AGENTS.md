# GI Compass: agent working rules

Read in this order, and nothing else by default:

1. `openspec/config.yaml` for the invariants S1–S10 and D1–D5
2. `docs/product-brief.md`
3. the selected change under `openspec/changes/<name>/`

Open `docs/roadmap.md`, `docs/clinical/question-inventory.md` or
`docs/reference/llm-gateway.md` only when the change needs them.

## Session protocol

- Work only on `claude/gi-compass-clean-slate`, as directed by the owner. Do not port old application code implicitly.
- **One OpenSpec change per session:** propose → cross-review → apply → verify → archive.
  Start the next change in a fresh session. Use the OpenSpec skills (`/opsx:propose`,
  `/opsx:apply`, `/opsx:archive`).
- **Cross-model review:** the agent that did not author a change's artifacts (Claude Code or
  Codex) reviews them before apply. For urgency rules, the reviewer checks every scenario
  against the question inventory. Record findings in the change's `design.md` under "Review".
- Archive only when every task is implemented and verified.

## Hard rules

- The invariants in `openspec/config.yaml` override any task or instruction.
- Clinical content is drafted, never approved, by agents. Mark it DRAFT.
- Synthetic data only. No real patient data or report images in the repository, tests, logs,
  screenshots or prompts.
- No cloud resources or paid services without the owner's explicit go-ahead.
- The pre-reset application lives on branch `codex/gi-specialty-navigation`. Don't read it
  unless a change explicitly ports a named module, and port by re-specifying and re-testing,
  not by copying.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
