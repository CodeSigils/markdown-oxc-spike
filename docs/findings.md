# Findings

## 2026-05-19: Oxc repository reread

Source: `https://github.com/oxc-project/oxc`

Repository summary from GitHub:

| Field          | Value                                                                  |
| :------------- | :--------------------------------------------------------------------- |
| Repository     | `oxc-project/oxc`                                                      |
| Description    | A collection of high-performance JavaScript tools                      |
| Default branch | `main`                                                                 |
| Homepage       | `https://oxc.rs`                                                       |
| Stars          | 21201                                                                  |
| Forks          | 1040                                                                   |
| Last pushed    | `2026-05-19T07:12:48Z`                                                 |
| Topics         | compiler, javascript, linter, minifier, parser, typescript, transpiler |

README findings:

- Oxc is the Oxidation Compiler: a Rust-based toolchain for JavaScript and TypeScript.
- Oxc is part of VoidZero's unified high-performance JavaScript toolchain work.
- The top-level README positions Oxlint as the lint command: `npx oxlint@latest`.
- The top-level README positions Oxfmt as the format command: `npx oxfmt@latest`.
- Oxc powers or supports tools such as Rolldown, Nuxt parsing, Nova, swc-node, and knip.

Repository tree findings relevant to this spike:

- `apps/oxfmt/` contains the formatter application.
- `apps/oxfmt/src/` contains Rust formatter implementation code.
- `apps/oxfmt/src-js/` contains JavaScript bindings and CLI code.
- `apps/oxfmt/conformance/` contains formatter conformance fixtures and snapshots.
- `crates/oxc_formatter/` contains formatter crate docs and changelog.
- `crates/oxc_linter/` contains linter crate docs and changelog.
- Formatter fixture names include embedded Markdown cases such as `apps/oxfmt/conformance/fixtures/edge-cases/md-in-js/`.

NPM package snapshot:

| Package  | Version | Description                                     | Binary   |
| :------- | :------ | :---------------------------------------------- | :------- |
| `oxlint` | 1.65.0  | Linter for the JavaScript Oxidation Compiler    | `oxlint` |
| `oxfmt`  | 0.50.0  | Formatter for the JavaScript Oxidation Compiler | `oxfmt`  |

Interpretation:

- Oxlint is out of scope for Markdown policy enforcement because the project describes it as JavaScript and TypeScript linting.
- Oxfmt is the interesting candidate because it is the formatter path.
- The first spike should test Oxfmt behavior on simple Markdown, then on tables and fences, before touching copied Markdown lint skill fixtures.

## 2026-05-19: Oxfmt configuration findings

Sources:

- `apps/oxfmt/src/core/oxfmtrc.rs`
- `apps/oxfmt/src-js/config.generated.ts`
- `apps/oxfmt/src/core/config/mod.rs`

Findings:

- Oxfmt discovers `.oxfmtrc.json`, `.oxfmtrc.jsonc`, `oxfmt.config.ts`, and `vite.config.ts`.
- `oxfmt --init` currently creates a minimal config with `ignorePatterns`.
- Oxfmt config is formatter-oriented, closer to Prettier config than markdownlint config.
- Relevant options include `tabWidth`, `useTabs`, `endOfLine`, `printWidth`, `proseWrap`, `insertFinalNewline`, `overrides`, and `ignorePatterns`.
- Oxfmt config does not appear to encode markdownlint-style policy rules such as heading punctuation, table validation, or fence validation.

Spike impact:

- Add `.oxfmtrc.json`; do not add active `.markdownlint.json`.
- Treat markdownlint rules as fixture inspiration, not as runtime config for this repo.
- Keep formatter config minimal until fixtures prove a need for more options.

## 2026-05-19: Issue #21314 note

Source: `https://github.com/oxc-project/oxc/issues/21314`

Issue summary:

| Field     | Value                                                                          |
| :-------- | :----------------------------------------------------------------------------- |
| Issue     | `#21314`                                                                       |
| Title     | `oxfmt: non-idempotent formatting of HTML comments inside markdown list items` |
| State     | closed                                                                         |
| Label     | `A-formatter`                                                                  |
| Opened by | `SBoudrias`                                                                    |
| Created   | `2026-04-10T14:21:20Z`                                                         |
| Closed    | `2026-04-13T00:13:37Z`                                                         |
| Version   | `oxfmt 0.44.0`                                                                 |

Reported behavior:

- A Markdown HTML comment immediately following a list item could be treated as a list continuation.
- Each `oxfmt` pass increased the comment indentation by 2 spaces.
- The output did not converge, which is a hard stop for any auto-fix pipeline.
- The reported CI impact was an infinite loop of formatter commits on PR branches.

Minimal reproduction from the issue:

```markdown
- List item
<!-- html comment -->
```

Expected stable workaround from the issue:

```markdown
<!-- html comment -->

- List item
```

Maintainer response:

- Oxfmt currently delegates Markdown formatting to Prettier.
- A maintainer could not reproduce the report with `npx oxfmt@0.44.0 a.md`; their output stayed unchanged.
- The issue is closed, but it remains a useful regression fixture because idempotence is mandatory for this repo's lint/fix path.

Spike impact:

- Add an HTML-comment-after-list-item fixture to the first Oxfmt test set.
- Run Oxfmt at least twice on every Markdown fixture and assert the second pass has no diff.
- Treat non-idempotent formatting as a blocking failure even if the final text looks reasonable.

## 2026-05-19: First local harness result

Scope:

- Added pinned local `oxfmt@0.50.0` toolchain.
- Added minimal `.oxfmtrc.json`.
- Added the first source fixture: `fixtures/source/html-comment-after-list.md`.
- Added `scripts/check-fixture.js` and `test/check-fixture.test.js`.

Commands run:

```bash
npm run check:fixture -- fixtures/source/html-comment-after-list.md
npm run audit
npm test
npm run fmt:check -- README.md planning.md fixtures/source/html-comment-after-list.md
```

Results:

- The HTML-comment-after-list fixture was idempotent with `oxfmt@0.50.0`.
- `npm audit --audit-level=moderate` found 0 vulnerabilities.
- The Node test runner passed 1 test.
- Oxfmt reported `README.md`, `planning.md`, and the fixture as correctly formatted.

Implementation note:

- `fixtures/work/**` cannot be listed in Oxfmt `ignorePatterns` if the harness passes copied work files to Oxfmt directly. Oxfmt exits with "Expected at least one target file" when an explicitly passed file is ignored.
- Keep generated work/results paths ignored by Git instead: `fixtures/work/` and `fixtures/results/` are in `.gitignore`.

## 2026-05-19: Escaped-pipe table fixture result

Scope:

- Added `fixtures/source/table-escaped-pipes.md`.
- Extended `test/check-fixture.test.js` so each source fixture must pass the idempotence harness.

Commands run:

```bash
npm run check:fixture -- fixtures/source/table-escaped-pipes.md
npm run fmt:check -- README.md planning.md fixtures/source/html-comment-after-list.md fixtures/source/table-escaped-pipes.md
npm test
```

Results:

- The escaped-pipe table fixture was idempotent with `oxfmt@0.50.0`.
- Oxfmt preserved escaped pipe cells when all table-cell pipe characters were escaped.
- The Node test runner passed 2 fixture tests.
- Oxfmt reported `README.md`, `planning.md`, and both source fixtures as correctly formatted.

Important observation:

- A draft table row with an unescaped pipe inside an inline-code span, `` `alpha | beta` ``, was reformatted as an extra table column. For this spike, table fixtures that are meant to preserve literal pipe characters should escape those pipes explicitly as `\|`, including inside inline-code spans.
- This reinforces that Oxfmt formatting is not a substitute for table safety validation. The production skill still needs explicit table validation if Oxfmt is ever used as a formatter supplement.

## 2026-05-19: Semantic-alignment table fixture result

Scope:

- Added `fixtures/source/table-semantic-alignment.md`.
- Extended `test/check-fixture.test.js` so semantic table alignment is part of the fixture harness.

Commands run:

```bash
npm run check:fixture -- fixtures/source/table-semantic-alignment.md
npm run fmt:check -- fixtures/source/table-semantic-alignment.md
npm run fmt:check -- README.md planning.md fixtures/source/html-comment-after-list.md fixtures/source/table-escaped-pipes.md fixtures/source/table-semantic-alignment.md
npm run audit
npm test
```

Results:

- The semantic-alignment table fixture was idempotent with `oxfmt@0.50.0`.
- Oxfmt preserved left, right, and center separator markers: `:---`, `---:`, and `:---:`.
- Oxfmt preserved semantic cell padding for the tested rows.
- The Node test runner passed 3 fixture tests.
- `npm audit --audit-level=moderate` found 0 vulnerabilities.

## 2026-05-19: Blank fenced-code fixture result

Scope:

- Added `fixtures/source/fence-blank.md`.
- Extended `test/check-fixture.test.js` so blank fenced-code blocks are part of the fixture harness.

Commands run:

```bash
npm run check:fixture -- fixtures/source/fence-blank.md
npm run fmt:check -- README.md planning.md fixtures/source/html-comment-after-list.md fixtures/source/table-escaped-pipes.md fixtures/source/table-semantic-alignment.md fixtures/source/fence-blank.md
npm run audit
npm test
```

Results:

- The blank fenced-code fixture was idempotent with `oxfmt@0.50.0`.
- Oxfmt preserved language-less fences and `text` fences.
- Oxfmt preserved an empty language-less fence as valid fenced-code structure.
- The Node test runner passed 4 fixture tests.
- `npm audit --audit-level=moderate` found 0 vulnerabilities.

Important observation:

- Oxfmt normalizes a fully empty fence from adjacent opener/closer lines into a fence containing one blank line between opener and closer.
- That is probably acceptable for formatting, but a production safety wrapper should treat it as a content change worth recording. The existing custom fence validator remains relevant.

## 2026-05-19: Nested fenced-code fixture result

Scope:

- Added `fixtures/source/fence-nested.md`.
- Extended `test/check-fixture.test.js` so nested fenced-code blocks are part of the fixture harness.
- Added an explicit `AGENTS.md` rule not to run the Hermes `markdown-lint` skill or wrapper in this spike repo, because it can mask Oxfmt behavior.

Commands run:

```bash
npm run fmt:check -- fixtures/source/fence-nested.md
npm run fmt -- fixtures/source/fence-nested.md
npm run fmt:check -- fixtures/source/fence-nested.md
npm run check:fixture -- fixtures/source/fence-nested.md
diff -u fixtures/source/fence-nested.md fixtures/results/fence-nested.first-pass.md
npm run fmt:check -- AGENTS.md
npm run fmt:check -- planning.md
npm run fmt -- planning.md
npm run fmt:check -- planning.md
```

Results:

- The nested fenced-code fixture was idempotent with `oxfmt@0.50.0`.
- Oxfmt preserved a four-backtick outer Markdown fence containing an inner three-backtick text fence.
- Oxfmt preserved a list item containing an indented nested Markdown fence.
- Oxfmt normalized an outer tilde fence to a five-backtick fence when the content contained a four-backtick fence.
- The generated first-pass output matched the formatted source fixture.
- The Node test runner passed 5 fixture tests.
- The full Oxfmt check passed across README, AGENTS, planning, docs, and all source fixtures.
- `npm audit --audit-level=moderate` found 0 vulnerabilities.

Important observation:

- The tilde-to-backtick normalization is structurally valid and idempotent, but it is still a fence marker change. A guarded production wrapper should record or gate this kind of transformation if preserving author-chosen fence style matters.

## 2026-05-19: Fence language-tag fixture result

Scope:

- Added `fixtures/source/fence-language-tags.md`.
- Extended `test/check-fixture.test.js` so language-tagged fenced-code blocks are part of the fixture harness.

Commands run:

```bash
npm run fmt:check -- fixtures/source/fence-language-tags.md
npm run fmt -- fixtures/source/fence-language-tags.md
npm run fmt:check -- fixtures/source/fence-language-tags.md
npm run check:fixture -- fixtures/source/fence-language-tags.md
diff -u fixtures/source/fence-language-tags.md fixtures/results/fence-language-tags.first-pass.md
npm run fmt:check -- planning.md
npm run fmt -- planning.md
npm run fmt:check -- planning.md
```

Results:

- The language-tagged fenced-code fixture was idempotent with `oxfmt@0.50.0`.
- Oxfmt preserved common info strings such as `bash`, `javascript`, `json`, `js`, `TypeScript`, `python linenums="1"`, and `mermaid`.
- Oxfmt formatted code inside recognized tagged fences, including JSON spacing and JavaScript semicolon/style normalization.
- Oxfmt preserved the extra Python info string text after the language tag.
- The generated first-pass output matched the formatted source fixture.
- The Node test runner passed 6 fixture tests.
- The full Oxfmt check passed across README, AGENTS, planning, docs, and all source fixtures.
- `npm audit --audit-level=moderate` found 0 vulnerabilities.

Important observation:

- Oxfmt is not only formatting Markdown container syntax here; it can also format fenced-code contents based on the language tag. That is useful for real docs, but it is a much bigger blast radius than a conservative Markdown-only formatter. A production wrapper should either explicitly allow code-fence content formatting or detect and gate it.

## 2026-05-19: Safe-formatting basics fixture result

Scope:

- Added `fixtures/source/safe-formatting-basics.md`.
- Extended `test/check-fixture.test.js` so safe-formatting patterns are part of the fixture harness.

Commands run:

```bash
npm run check:fixture -- fixtures/source/safe-formatting-basics.md
npm test
npm run fmt:check -- README.md AGENTS.md planning.md docs/direction.md docs/findings.md fixtures/source/*.md
```

Results:

- The safe-formatting basics fixture was idempotent with `oxfmt@0.50.0`.
- Oxfmt made **zero changes** to the source file: trailing spaces, blank lines around headings, and blank lines around lists were all preserved.
- The Node test runner passed 7 fixture tests.
- `npm audit --audit-level=moderate` found 0 vulnerabilities.

Important observation:

- With `proseWrap: "preserve"`, Oxfmt is extremely conservative with intra-Markdown spacing. It did not strip trailing spaces, add blank lines around headings or lists, or normalize blank-line spacing.
- This means the "safe formatting" problem space (trailing spaces, missing final newlines, heading/list spacing) is **not addressed by Oxfmt** in the current config. These would still need a dedicated formatter step or a markdownlint auto-fix pass.
- The fixture intentionally tests patterns that the `planning.md` flagged as next steps. The finding is that Oxfmt leaves them alone — which is safe for idempotence, but means it does not help with these formatting tasks.

## 2026-05-19: Markdown-in-JS template fixture result

Scope:

- Added `fixtures/source/markdown-in-js-template.md`.
- Extended `test/check-fixture.test.js` so markdown-in-JS template literals are part of the fixture harness.

Commands run:

```bash
npm run check:fixture -- fixtures/source/markdown-in-js-template.md
npm run fmt:check -- README.md planning.md docs/direction.md docs/findings.md fixtures/source/*.md
```

Results:

- The markdown-in-js-template fixture was idempotent with `oxfmt@0.50.0`.
- Oxfmt preserved the overall structure of the JavaScript template literal.
- Oxfmt formatted the Markdown content inside the template literal (including list spacing, fence content, and table formatting).
- The generated first-pass output matched the formatted source fixture.
- The Node test runner passed 8 fixture tests.
- `npm audit --audit-level=moderate` found 0 vulnerabilities.

Important observation:

- Oxfmt can format Markdown content embedded in JavaScript template literals, which demonstrates its capability to handle MDX-like syntax.
- This behavior is useful for real-world MDX files but represents a broader scope than pure Markdown formatting.
- A production wrapper using Oxfmt for Markdown formatting should be aware that it will format content inside JavaScript template literals when used in MDX contexts.
- For pure Markdown use cases, this extended capability may be undesirable and would require additional guarding or scoping.

## 2026-05-19: Task lists fixture result

Scope:

- Added `fixtures/source/task-lists.md`.
- Extended `test/check-fixture.test.js` so task lists are part of the fixture harness.

Commands run:

```bash
npm run check:fixture -- fixtures/source/task-lists.md
npm run fmt:check -- README.md planning.md docs/direction.md docs/findings.md fixtures/source/*.md
```

Results:

- The task-lists fixture was idempotent with `oxfmt@0.50.0`.
- Oxfmt preserved task list checkboxes (`[ ]` and `[x]`) and formatting.
- Oxfmt preserved nested task lists and their indentation.
- Oxfmt preserved formatting within task list items (bold, italic, inline code, links).
- The generated first-pass output matched the formatted source fixture.
- The Node test runner passed 9 fixture tests.
- `npm audit --audit-level=moderate` found 0 vulnerabilities.

Important observation:

- Oxfmt preserves task list syntax correctly, treating `[ ]` and `[x]` as literal text to be preserved rather than interpreting them as structural Markdown elements.
- This behavior is consistent with how Oxfmt treats other special Markdown syntax that should remain unchanged for safety.
- Task lists represent another construct where Oxfmt's conservative approach helps maintain structural safety while still allowing formatting of content within the list items.

## 2026-05-19: Structural guard requirements for Oxfmt as Markdown formatting supplement

Based on testing Oxfmt on 9 fixture types, identified three structural transformations requiring guardrails for safe use:

**Reference:** Official Oxfmt conformance fixtures can be found at: https://api.github.com/repos/oxc-project/oxc/contents/apps/oxfmt/conformance/fixtures/edge-cases/
**Important Note:** Oxfmt delegates ALL Markdown formatting to Prettier. There are NO standalone Markdown fixtures in Oxfmt's conformance directory. For table formatting behavior, see Prettier's test fixtures at tests/format/markdown/table/ in the Prettier repository.

1. Fence marker normalization (tilde→backtick)
2. Code content formatting inside tagged fences
3. Table pipe handling that can alter structure (including the known Prettier/GFM spec violation where pipes inside inline code are treated as column delimiters)

Recommend minimal viable guardrails:

- Fence style preservation
- Fenced-code content integrity
- Table structure validation

Suggested architecture:

- Keep markdownlint-cli2 for policy enforcement
- Add custom fence/table validators for blocking safety
- Use Oxfmt as formatting supplement guarded by idempotence and structure checks

### Relationship to Oxc's conformance fixtures

Note that Oxc's conformance fixtures (like `apps/oxfmt/conformance/fixtures/edge-cases/md-in-js/`) test Oxfmt's _correctness_ when formatting Markdown embedded in JavaScript/TypeScript. Those fixtures ensure Oxfmt doesn't break when processing MDX-like syntax.

Our fixtures test Oxfmt's _structural safety_ as a formatting supplement in a Markdown linting workflow. We're evaluating whether Oxfmt can be safely integrated without weakening the current lint skill's safety guarantees - requiring guardrails around fence preservation, table structure, and idempotence, even when Oxfmt itself is functioning correctly.
