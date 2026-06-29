# Markdown Oxc Spike Plan

## Purpose

Use this repo as a small, revisitable spike for testing whether Oxfmt can help with agent-authored Markdown formatting without weakening the current Markdown lint skill's safety guarantees.

This repo is published at `https://github.com/CodeSigils/markdown-oxc-spike`. Keep it clean, reviewable, and clearly labeled as a spike/reference repo rather than a production formatter package.

## Drift guard

When behavior, status, commands, paths, fixture policy, external resources, CI, or publication state changes, update every affected source of truth in the same change.

Check at least:

- `README.md`
- `AGENTS.md`
- `planning.md`
- `docs/direction.md`
- `docs/findings.md`
- `package.json`
- `.github/workflows/ci.yml`
- `fixtures/source/**`
- `fixtures/current/**`
- `fixtures/pipe-safety/**`
- `fixtures/violations/**`
- `scripts/**`
- `test/**`

Do not leave stale local-only, unpublished, unsupported, or production-ready claims in this repo.

## Stale factual claims

When revisiting this repo months later, these claims in `planning.md` may be stale
and need verification before acting on them:

| Claim                                                                 | Where                              | Risk                                                     | How to verify                                                                            |
| :-------------------------------------------------------------------- | :--------------------------------- | :------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| Clean fixture behavior (9 source fixtures pass)                       | Completed fixture coverage table   | Oxfmt version drift may change behavior                  | `bash scripts/bump-oxfmt.sh latest`                                                      |
| Expanded fixture taxonomy (`current/`, `pipe-safety/`, `violations/`) | Current workflow and tests         | Production fixture taxonomy may change                   | Compare against `~/projects/agents-markdown-formatter/test/fixtures/` and run `npm test` |
| Production guard scripts pass (cross-config)                          | Completed next steps, item 1       | Production `markdown-formatter` guard scripts may change | Re-run cross-config test with current production repo                                    |
| External resource URLs                                                | External resources section         | oxc.rs docs restructured; DeepWiki URLs stale            | Curl each URL, check 200                                                                 |
| `package.json` version pin                                            | (external, referenced by workflow) | If pin doesn't match installed binary, bump script fails | `bash scripts/bump-oxfmt.sh <current pin>`                                               |
| Open questions                                                        | Open questions section             | May have been answered or superseded                     | Search oxc changelog and production repo for relevant changes                            |

Note: the `Current workflow` section says the harness "now includes structural
guards" — that's a time-relative description. The structural guards are present;
drop the "now" when editing nearby.

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

For each clean Oxfmt fixture:

1. Add a direct-Oxfmt-clean fixture under `fixtures/source/`.
2. Let `test/check-fixture.test.js` discover it automatically.
3. Run the fixture harness, `npm test`, and `npm run fmt:check`.
4. Record stable findings in `docs/findings.md`.

For formatter-safety coverage copied from production:

1. Put broad clean regression fixtures under `fixtures/current/`.
2. Put valid GFM that must be repaired or skipped before Oxfmt under `fixtures/pipe-safety/`.
3. Put expected structural failures under `fixtures/violations/`.
4. Run `npm test`; do not include `pipe-safety/` or `violations/` in raw `fmt:check`.

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
| `fixtures/current/table-gfm-spec.md`          | pass   | Guard accepts representative GFM table forms and escaped inline-code pipes       |

## Expanded formatter-safety coverage

| Fixture class           | Files | Expected behavior                                                        |
| :---------------------- | :---- | :----------------------------------------------------------------------- |
| `fixtures/current/`     | 4     | Clean broad regression fixtures; guarded idempotence and validation pass |
| `fixtures/pipe-safety/` | 1     | Valid GFM adjacent-pipe table repairs, then skips unsafe Oxfmt pass      |
| `fixtures/violations/`  | 5     | Deliberately invalid fixtures fail structural validation                 |

## Completed next steps

1. ~~Benchmark Oxfmt with guards against the current Markdown lint skill pipeline for performance and safety comparison.~~ **Done (2026-06-12).** Cross-config test ran all 9 fixtures through the production `markdown-formatter` skill's guard scripts (`check-structure.js`, `check-tables.js`, `check-fences.js`). All guards pass; the spike's fixture set is validated as a production reference.
2. ~~Detail the validated architecture in project documentation — `docs/direction.md` has a summary but lacks integration workflow specifics and failure-mode handling.~~ **Done (2026-06-12).** Architecture is documented in `docs/direction.md` (Current recommended architecture section). Integration specifics (pinned local toolchain, structural guards, idempotence checks) are documented in the runnable workflow in `docs/findings.md` and `scripts/check-fixture.js`.

## Open questions

- ~~Is Oxfmt too broad for a lightweight Markdown formatter?~~ **Closed (2026-06-25).** Yes — based on evidence collected across 9 fixture types, 3 Oxfmt versions, and cross-config testing against production guard scripts.

  **What a lightweight Markdown formatter needs vs what exists:**

  | Operation                            | markdownlint-cli2 --fix | Oxfmt (proseWrap: preserve, embedded: off) |
  | :----------------------------------- | :---------------------- | :----------------------------------------- |
  | Trailing whitespace removal          | ✅                      | ✅                                         |
  | Final newline                        | ✅                      | ✅                                         |
  | Heading spacing                      | ✅                      | ❌                                         |
  | List spacing                         | ✅                      | ❌                                         |
  | List marker consistency              | ✅                      | ❌                                         |
  | Table column alignment               | ❌                      | ✅                                         |
  | Fence normalization (tilde→backtick) | ❌                      | ✅                                         |
  | Consistent indentation               | ❌                      | ✅                                         |
  | Code formatting inside fences        | ❌                      | gated via config                           |
  | Prose reflow                         | ❌                      | gated via config                           |

  **The gap Oxfmt fills is small:** table column alignment, fence normalization, and indentation normalization — each achievable in ~10 lines of regex transforms. The remaining operations it provides are either already covered by `markdownlint-cli2 --fix` or gated behind config options the lightweight profile disables.

  **The dependency cost is disproportionate:** Oxfmt pulls in the full Prettier Markdown/MDX/AST pipeline as a platform-specific binary (~10MB per platform). It has 12 Prettier config options (only 4 relevant to Markdown), and binary behavior can change across minor versions — requiring the bump script and structural guard scripts to detect regressions.

  **Verdict:** Oxfmt is the wrong shape for a lightweight Markdown formatter in agent workflows. The delta it provides over existing tooling is narrow enough that a purpose-built micro-formatter (zero dependencies, ~30 lines of transforms) would be simpler, safer, and never surprise the user. The spike's value was proving this conclusion with evidence rather than assumptions.

- ~~Should this repo grow a tiny custom safe formatter for comparison?~~ **Not useful (2026-06-25).** The safe formatting operations (trailing space, final newline, heading/list spacing) are already covered by `markdownlint-cli2 --fix`. The hard problems are structural (fence/table safety), which need validators, not formatters. A custom formatter would duplicate existing tooling; the spike is best kept as an Oxfmt test harness.
- Should generated first-pass outputs become committed snapshots later, or stay ignored until the harness stabilizes?
