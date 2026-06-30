# Markdown Oxc Spike

This repo is a published research spike that evaluated Oxfmt behavior on Markdown.

**Conclusion: Oxfmt is the wrong shape for a lightweight Markdown formatter in agent
workflows.** The delta it provides over existing tooling (table column alignment, fence
normalization, indentation normalization) is narrow enough that a purpose-built
micro-formatter (zero dependencies, ~30 lines of transforms) would be simpler, safer,
and never surprise the user. The spike's value was proving this conclusion with evidence
rather than assumptions. See `planning.md` (Open questions section, 2026-06-25 entry)
for the detailed verdict.

This is reference/prior-art material, not a production formatter package. The production
work lives in the `agents-markdown-formatter` repository; this repo exists to preserve
evidence, fixtures, and decision context for future Oxfmt version-bump testing.

## Reference artifacts

- Direction and non-goals: `docs/direction.md`
- Research findings: `docs/findings.md`
- Phase and decisions: `planning.md`
- Agent operating rules: `AGENTS.md`

When behavior, status, commands, paths, or external assumptions change, update the
affected source-of-truth files in the same change. At minimum, check `README.md`,
`AGENTS.md`, `planning.md`, `docs/direction.md`, `docs/findings.md`, `package.json`, CI,
fixtures, and scripts for drift.

## Quick start

```bash
# Install the pinned local toolchain
npm ci

# Run all fixture idempotence and structural guard checks
npm test

# Run one fixture through the harness (includes structural guards)
npm run check:fixture -- fixtures/source/html-comment-after-list.md

# Check Markdown formatting with pinned local Oxfmt (source fixtures only)
npm run fmt:check

# Check dependency audit status
npm run audit
```

## Files

| File or directory                  | Purpose                                                            |
| :--------------------------------- | :----------------------------------------------------------------- |
| `README.md`                        | Orientation and quick-start notes                                  |
| `AGENTS.md`                        | Operational rules for future agents                                |
| `planning.md`                      | Phase, decisions, and open questions                               |
| `docs/direction.md`                | Stable framing, non-goals, and evaluation results                  |
| `docs/findings.md`                 | Research log and fixture findings                                  |
| `ACTIVE_PAIN_POINTS.md`            | Markdown pain points the spike investigated                        |
| `SYNTHESIS_AND_RECOMMENDATIONS.md` | Synthesis of findings and recommendations                          |
| `fixtures/source/`                 | Clean source fixtures that must be direct-Oxfmt-checkable          |
| `fixtures/current/`                | Broader real-world regression fixtures copied from production      |
| `fixtures/pipe-safety/`            | Valid GFM fixtures that require repair/skip behavior before Oxfmt  |
| `fixtures/violations/`             | Deliberately invalid fixtures that must fail structural validation |
| `fixtures/work/`                   | Generated working copies, ignored by Git                           |
| `fixtures/results/`                | Generated first-pass outputs, ignored by Git                       |
| `scripts/`                         | Fixture harness and helper scripts                                 |
| `test/`                            | Node test runner coverage for the harness                          |
| `.oxfmtrc.json`                    | Oxfmt formatter config, not markdownlint policy                    |
| `package-lock.json`                | Pinned local Node/Oxfmt dependency graph                           |

## Fixture summary

- **9 source fixtures** — clean Oxfmt reference set covering fences, tables, task lists,
  markdown-in-JS templates, and safe formatting.
- **4 current/ fixtures** — real-world regression fixtures copied from production.
- **1 pipe-safety/ fixture** — valid GFM that requires repair/skip before Oxfmt.
- **7 violations/ fixtures** — deliberate structural failures that the guard must detect
  (fence mismatch, fence untitled, adjacent pipes, column-count mismatch, column drift,
  inline-code pipes, no-leading-pipe mismatch).

All source fixtures pass the production `markdown-formatter` skill's structural guard
scripts (`check-structure.js`, `check-tables.js`, `check-fences.js`) across both
`proseWrap: preserve` and `proseWrap: always` configs. See `docs/findings.md` for
detailed results.
