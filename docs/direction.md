# Direction

## Purpose

This repo evaluated whether Oxfmt can help with agent-authored Markdown formatting without weakening the current Markdown lint skill's safety guarantees.

**Result: No — Oxfmt is the wrong shape.** See `planning.md` (Open questions section, 2026-06-25 entry) for the detailed verdict. The delta it provides over existing tooling is narrow enough that a purpose-built micro-formatter would be simpler, safer, and never surprise the user. This repo is retained as evidence, fixtures, and decision context for future Oxfmt version-bump testing.

## Reference framing

### This is not an Oxc Markdown linter

Oxlint is a JavaScript and TypeScript linter. It is useful for JS/TS repositories, but it is not a Markdown policy engine and should not be evaluated as a replacement for GitHub Flavored Markdown validation.

Oxfmt is the relevant tool because it formats Markdown and MDX. Treat it as a formatter candidate, not a lint-rule engine.

### Relationship to Oxc's conformance tests

The Oxc project maintains conformance fixtures (e.g., `apps/oxfmt/conformance/fixtures/edge-cases/md-in-js/`) that verify Oxfmt's correctness when formatting Markdown embedded in JavaScript, TypeScript, and other host languages. Those fixtures answer: "Does Oxfmt produce valid output for MDX-like syntax?"

This repo asked a different question: "Assuming Oxfmt works correctly, can we integrate it into a Markdown linting workflow without weakening safety guarantees?" The answer is no — the dependency cost outweighs the narrow formatting delta.

### Formatter and linter responsibilities stay separate

A formatter may normalize low-risk presentation details:

- final newline
- trailing whitespace
- simple table alignment when structure is preserved
- blank lines around Markdown blocks
- idempotent Oxfmt output

A linter or safety validator must still handle policy and structure:

- table column consistency
- unescaped pipe hazards
- fenced-code-block validity
- repo-specific markdownlint rules
- generated-content boundaries
- failure modes that should block autonomous fixes

## Evaluation results

| Gate                                              | Result                                                                                                       |
| :------------------------------------------------ | :----------------------------------------------------------------------------------------------------------- |
| Idempotent on representative Markdown fixtures    | Pass — all 9 source fixtures idempotent across 3 Oxfmt versions                                              |
| Preserves table structure                         | Pass with guard — Oxfmt preserves well-formed tables; inline-code pipes require pre-format blocking          |
| Preserves fenced-code-block structure             | Pass with guard — tilde-to-backtick normalization is idempotent but changes style; guard detects drift       |
| Understandable, configurable behavior             | Partial — 12 Prettier config options, only 4 relevant to Markdown; behavior can change across minor versions |
| Improves speed or simplicity for a clear use case | Fail — delta over existing tooling too narrow; dependency cost disproportionate                              |

Verdict: Oxfmt fills a small gap at a disproportionate cost. Keep it as reference evidence; do not adopt as a formatting supplement.

## Non-goals

- Do not replace `markdownlint-cli2` without fixture and benchmark evidence.
- Do not replace custom table and fence validators with Oxfmt.
- Do not add an active `.markdownlint.json`; Oxfmt does not read it.
- Do not install Oxlint unless this repo grows non-trivial JavaScript or TypeScript tooling.
- Do not trust formatter output unless repeated runs converge.
