# Markdown Oxc Spike Plan

## Purpose

Use this repo as a small, revisitable spike for testing whether Oxfmt can help with agent-authored Markdown formatting without weakening the current Markdown lint skill's safety guarantees.

This is not a GitHub repo yet. Keep the local repo clean and reviewable before publishing anywhere.

## Current direction

The repo is exploring a lighter Markdown formatter or guarded Oxfmt wrapper, not a new Markdown linter.

Stable framing lives in `docs/direction.md`.

Research findings live in `docs/findings.md`.

## External resources

<https://oxc.rs/docs/guide/usage/formatter.md>
<https://oxc.rs/docs/guide/usage/formatter/cli.md>
<https://oxc.rs/docs/guide/usage/formatter/config-file-reference.md>
<https://oxc.rs/docs/guide/usage/formatter/embedded-formatting.md>
<https://oxc.rs/docs/guide/usage/formatter/unsupported-features.md>
<https://deepwiki.com/oxc-project/oxc>
<https://deepwiki.com/oxc-project/oxc/8-code-formatting>
<https://deepwiki.com/oxc-project/oxc/8.1-formatter-architecture>
<https://deepwiki.com/oxc-project/oxc/10.2-oxfmt-cli>
<https://deepwiki.com/oxc-project/oxc/12.2-conformance-testing>
<https://api.github.com/repos/oxc-project/oxc/contents/apps/oxfmt/conformance/fixtures/edge-cases>

## Current conclusions

- Oxlint is out of scope for Markdown policy.
- Oxfmt is the candidate under test because it formats Markdown and MDX.
- Oxfmt should be treated as a formatter candidate, not a lint-rule engine.
- Do not add an active `.markdownlint.json`; Oxfmt does not read it.
- Keep `.oxfmtrc.json` formatter-only.
- Every fixture must pass a second-pass idempotence check and structural guard checks.
- Oxfmt is not a substitute for explicit table and fence safety validation.
- Structural guardrails for fence preservation and table structure have been implemented in the check-fixture.js wrapper.

## Current workflow

For each fixture:

1. Add a source fixture under `fixtures/source/`.
2. Add the fixture to `test/check-fixture.test.js`.
3. Run `npm test` and watch the fixture fail before the source file exists.
4. Add the source fixture.
5. Run the fixture harness (which now includes structural guards).
6. Record stable findings in `docs/findings.md`.

## Completed fixture coverage

| Fixture                                       | Status | Finding summary                                                                  |
| :-------------------------------------------- | :----- | :------------------------------------------------------------------------------- |
| `fixtures/source/html-comment-after-list.md`  | pass   | Oxfmt was idempotent on the issue `#21314` pattern                               |
| `fixtures/source/table-escaped-pipes.md`      | pass   | Escaped pipes preserved; unescaped inline-code pipe is hazardous                 |
| `fixtures/source/table-semantic-alignment.md` | pass   | `:---`, `---:`, and `:---:` markers preserved                                    |
| `fixtures/source/fence-blank.md`              | pass   | Blank fences preserved; empty fence gains blank line                             |
| `fixtures/source/fence-nested.md`             | pass   | Nested fences preserved; tilde fence normalized to backticks                     |
| `fixtures/source/fence-language-tags.md`      | pass   | Info strings preserved; tagged code content may be formatted                     |
| `fixtures/source/safe-formatting-basics.md`   | pass   | Oxfmt left trailing spaces, heading spacing, list spacing untouched              |
| `fixtures/source/markdown-in-js-template.md`  | pass   | Oxfmt preserved structure and formatted code inside JavaScript template literals |
| `fixtures/source/task-lists.md`               | pass   | Oxfmt preserved task list checkboxes and formatting; idempotent                  |

## Next steps

1. Structural guardrails for fence preservation and table structure have been implemented in check-fixture.js wrapper.
2. Benchmark Oxfmt with guards against the current Markdown lint skill pipeline for performance and safety comparison.
3. Document the validated architecture in project documentation.

## Open questions

- Is Oxfmt too broad for a lightweight Markdown formatter?
- Should this repo grow a tiny custom safe formatter for comparison?
- Should generated first-pass outputs become committed snapshots later, or stay ignored until the harness stabilizes?
