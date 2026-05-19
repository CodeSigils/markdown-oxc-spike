# Direction

## Purpose

This repo evaluates whether Oxfmt can help with agent-authored Markdown formatting without weakening the current Markdown lint skill's safety guarantees.

The working direction is a lighter Markdown formatter or guarded formatter wrapper, not a new Markdown linter.

## Framing

### This is not an Oxc Markdown linter

Oxlint is a JavaScript and TypeScript linter. It is useful for JS/TS repositories, but it is not a Markdown policy engine and should not be evaluated as a replacement for GitHub Flavored Markdown validation.

Oxfmt is the relevant tool because it formats Markdown and MDX. Treat it as a formatter candidate, not a lint-rule engine.

### Relationship to Oxc's conformance tests

The Oxc project maintains conformance fixtures (e.g., `apps/oxfmt/conformance/fixtures/edge-cases/md-in-js/`) that verify Oxfmt's correctness when formatting Markdown embedded in JavaScript, TypeScript, and other host languages. Those fixtures answer: "Does Oxfmt produce valid output for MDX-like syntax?"

This repo asks a different question: "Assuming Oxfmt works correctly, can we integrate it into a Markdown linting workflow without weakening safety guarantees?" Our fixtures test structural preservation (fence style, table structure, idempotence) to determine what guardrails would be needed for safe use as a formatting supplement.

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

## Current recommended architecture

Based on testing, the validated architecture is:

```text
markdownlint-cli2        -> policy rules
custom fence validator   -> blocking safety
custom table validator   -> blocking safety
guarded Oxfmt wrapper    -> formatting supplement with idempotence and structure checks
```

If Oxfmt does not prove useful, keep the current Markdown lint skill unchanged and retain this repo as evidence.

## Non-goals

- Do not replace `markdownlint-cli2` without fixture and benchmark evidence.
- Do not replace custom table and fence validators with Oxfmt.
- Do not add an active `.markdownlint.json`; Oxfmt does not read it.
- Do not install Oxlint unless this repo grows non-trivial JavaScript or TypeScript tooling.
- Do not trust formatter output unless repeated runs converge.

## Evaluation gates

Oxfmt is only useful for this project if tests show that it:

- is idempotent on representative Markdown fixtures
- preserves table structure or lets a wrapper detect structural changes
- preserves fenced-code-block structure or lets a wrapper detect structural changes
- has understandable, configurable behavior for agents
- improves speed or simplicity for a clear use case

Failure in any safety area means Oxfmt remains research-only or optional behind guardrails.
