# Markdown Oxc Spike

This repo is a published research spike for testing Oxfmt behavior on Markdown.

The goal is not to replace the current Markdown lint pipeline quickly. The goal is to collect evidence about whether Oxfmt can help with lighter Markdown formatting while preserving the current skill's safety guarantees.

This is reference/prior-art material, not the production formatter package. The production work lives in the formatter skill repository; this repo exists to preserve evidence, fixtures, and decision context.

## Current framing

This repo is exploring a lighter Markdown formatter or guarded formatter wrapper, not a new Markdown linter.

- Direction and non-goals: `docs/direction.md`
- Research findings: `docs/findings.md`
- Current phase and next steps: `planning.md`
- Agent operating rules: `AGENTS.md`

When behavior, status, commands, paths, or external assumptions change, update the affected source-of-truth files in the same change. At minimum, check `README.md`, `AGENTS.md`, `planning.md`, `docs/direction.md`, `docs/findings.md`, `package.json`, CI, fixtures, and scripts for drift.

## Current assumptions

- Oxlint is useful for JavaScript and TypeScript projects, but it is not a Markdown policy engine.
- Oxfmt is the interesting candidate because it formats Markdown and MDX.
- The production Markdown lint skill should keep `markdownlint-cli2`, custom fence checks, and table validation unless this spike proves a safer supplement.

## Quick start

```bash
# Install the pinned local toolchain
npm ci

# Run all fixture idempotence and structural guard checks
npm test

# Run one fixture through the harness (includes structural guards)
npm run check:fixture -- fixtures/source/html-comment-after-list.md

# Check Markdown formatting with pinned local Oxfmt
npm run fmt:check:docs

# Check dependency audit status
npm run audit
```

## Files

| File or directory   | Purpose                                         |
| :------------------ | :---------------------------------------------- |
| `README.md`         | Orientation and quick-start notes               |
| `AGENTS.md`         | Operational rules for future agents             |
| `planning.md`       | Current phase, next steps, and open questions   |
| `docs/direction.md` | Stable framing, non-goals, and evaluation gates |
| `docs/findings.md`  | Research log and fixture findings               |
| `fixtures/source/`  | Tracked source fixtures                         |
| `fixtures/work/`    | Generated working copies, ignored by Git        |
| `fixtures/results/` | Generated first-pass outputs, ignored by Git    |
| `scripts/`          | Fixture harness and helper scripts              |
| `test/`             | Node test runner coverage for the harness       |
| `.oxfmtrc.json`     | Oxfmt formatter config, not markdownlint policy |
| `package-lock.json` | Pinned local Node/Oxfmt dependency graph        |

## Decision rule

Adopt Oxfmt only if tests show it improves the workflow without weakening these invariants:

- escaped pipes inside tables stay safe or structural changes are blocked
- semantic table alignment is preserved or intentionally replaced
- blank and nested fenced code blocks remain valid
- repeated formatter runs are idempotent
- formatter behavior is observable without Markdown lint auto-fixes masking the result

All 9 spike fixtures pass the production `markdown-formatter` skill's structural
guard scripts (`check-structure.js`, `check-tables.js`, `check-fences.js`) across
both `proseWrap: preserve` and `proseWrap: always` configs. See `docs/findings.md`
(2026-06-12 entry) for the cross-config results.
