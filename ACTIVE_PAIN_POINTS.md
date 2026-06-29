# Active Markdown Pain Points

Problems we still encounter when working with Markdown that no single tool fully solves.
Covers formatting, structural, and tooling gaps.

## 1. Distinguishing intentional from spurious empty cells in tables

**What happens:** A table row acquires `||` (adjacent pipes), which per GFM §4.10
creates a valid empty cell. But it can be hard to tell whether the empty cell was
intentional or introduced by a merge conflict, find-and-replace, or patch tool.

**How we hit it:**

- Find-and-replace on a table row boundary can duplicate the leading pipe
- Merge conflicts in table-heavy files produce `||` at conflict boundaries
- Column deletion leaves a trailing/leading `||`
- Patch tools (sed, patch, find-and-replace) matched to line rather than to cell

**Detection:** markdownlint does not flag `||` — and correctly so, since it's valid
GFM. Oxfmt/Prettier cannot safely format multi-row empty-cell tables in all
cases; the guarded harness repairs adjacent pipes to `| |` and skips the raw
Oxfmt pass when empty cells remain. The GFM table validation in
`check-fixture.js` checks header/delimiter column count match (GFM Example 203)
and reports data row cell count variances (GFM Example 204), but cannot
distinguish intentional from spurious empty cells.

**What would help:** No tool can reliably distinguish intentional `||` from
spurious `||` without human judgment. The safest mitigation is to catch spurious
introductions at the merge/patch stage (diff review) rather than in the formatter
or linter.

---

## 2. Empty or near-empty fenced code blocks

**What happens:** A fence with no content (adjacent opener and closer) or content that
is only whitespace.

**How we hit it:**

- Agent generates a fence then leaves the body blank as a placeholder
- A fence is left abandoned after deleting its content
- `oxfmt` with default config turns a bare ` ``` ` ` ``` ` into ` ``` `
  <blank line> ` ``` ` — idempotent, but a content change from what the author wrote

**Detection:** markdownlint does not flag empty fences by default. `check-fences.js`
validates structural closure and info-string validity but not content emptiness.

**What would help:** A lint rule (`MD999`-style) that warns on fenced code blocks with
zero non-whitespace content. The guard script already tracks fence-content drift
between Oxfmt passes — that same check could flag emptiness on initial scan.

---

## 3. Inline-code pipes treated as table columns

**What happens:** A table row containing `` `alpha | beta` `` gets reformatted into
three columns because Oxfmt (via Prettier) treats the pipe inside inline code as a
column delimiter. This is a known Prettier/GFM spec violation.

**How we hit it:**

- Documenting CLI commands in a table: `` `command --flag | grep foo` ``
- Documenting pipe-separated values inside inline code
- Any table cell with a pipe character that the author thought was safe inside `` ` `

**Detection:** `check-tables.js` catches the resulting column count change, but only
after formatting has already altered the structure. The `--guard` flag rolls back the
change, but the detection is post-hoc — the file was modified and then restored.

**What would help:** A pre-format check that scans table rows for inline-code spans
containing unescaped pipes and warns before Oxfmt runs.

---

## 4. Fence style silently normalized (tilde → backtick)

**What happens:** Oxfmt normalizes tilde-delimited fences (`~~~`) to backtick fences
(` ``` `). Idempotent, consistent, and structurally safe — but it changes the
author's chosen style without warning.

**How we hit it:**

- Opening a file written by someone who prefers tilde fences
- Copying Markdown from a source that uses tilde notation
- Any tilde fence survives exactly one Oxfmt pass before becoming backticks

**Detection:** No guard script warns about this. The `check-fences.js` script validates
structural properties (closure, info-string format) but does not flag fence-delimiter
style changes.

**What would help:** A "preserve custom fence style" option, or a diff category in
`check-fixture.js` for fence-delimiter changes so they appear in the categorized diff
summary.

---

## 5. Code content formatting inside tagged fences

**What happens:** With `embeddedLanguageFormatting: auto` (the Oxfmt default), code
inside tagged fences gets formatted according to the language's rules. JSON gets
re-indented, JavaScript gains/removes semicolons, etc.

**How we hit it:**

- Running Oxfmt without an explicit `.oxfmtrc.json` (uses default `"auto"`)
- Setting `proseWrap` without also setting `embeddedLanguageFormatting`
- Processing a file with mixed fence types where some should be formatted and
  others should not

**Detection:** No guard flag. The production config (`"off"`) is correct for
Markdown-container formatting, but the default and the config documentation don't
make this an explicit choice — it's easy to accidentally leave at `"auto"`.

**What would help:** The production config is already right (`"off"`). The gap is
in discoverability: a one-time warning when Oxfmt runs without `.oxfmtrc.json`, or
a `--doctor` check that reports the current `embeddedLanguageFormatting` setting.

---

## 6. Prose reflow changing list continuation structure

**What happens:** Under `proseWrap: always`, Oxfmt reflows a paragraph that continues
a list item without a blank-line separator onto the list item's own line. The content
is preserved, but the structural separation between list item and continuation is lost.

**How we hit it:**

- AI agent writes a list item followed by an explanatory paragraph on the next line
  without a blank line (common in chat output)
- After formatting, the paragraph becomes part of the list item, changing how it
  renders and how it can be edited

**Detection:** No guard catches this. The content change is structurally valid and
idempotent — but it alters the document's semantic structure.

**What would help:** A guard similar to fence-drift detection: compare list-item
continuation relationships before and after formatting, and warn when a paragraph
loses its blank-line separation from the preceding list item.

---

## 7. HTML comment after list item (historical non-idempotence)

**What happens:** When an HTML comment immediately follows a list item without a
blank line, Oxfmt could (under version 0.44.0) treat the comment as a list
continuation, indenting it further on each pass. The output never converged.

**Status:** Fixed in later Oxfmt versions. All 3 tested versions (0.50.0, 0.54.0,
0.56.0) are idempotent on this pattern. The fixture exists as a regression guard.

**Lesson:** Non-idempotent formatting is a blocking failure even if the formatted
output looks reasonable. Idempotence checks must be part of any formatting pipeline
that runs in CI or auto-fix context.

---

## 8. Table column count mismatch (header/separator/data rows)

**What happens:** Header has N columns, separator has M columns, or data rows have
varying column counts. The table is still valid Markdown but renders with
inconsistent column layout.

**How we hit it:**

- Editing a table and forgetting to update one row
- AI agent generates a table with mismatched column counts
- Merging two versions of a document with different table schemas

**Detection:** `repairTableColumns` in agents-markdown-formatter v1.0.3 adds empty
trailing cells to match the largest column count. `check-tables.js` validates column
count uniformity but runs post-format.

**What would help:** A pre-format lint rule (`MD055` conceptually) that warns on
column-count mismatch and suggests the fix rather than silently padding.

---

## 9. Unclosed or mismatched fences

**What happens:** A fenced code block opener has no matching closer, or the closer
uses a different backtick count than the opener.

**How we hit it:**

- AI agent generates a fence with ` ``` ` and closes with ` ` ```` (mismatched count)
- Abruptly truncated output (common with agent-generated files)
- Nested fences where the inner and outer backtick counts collide

**Detection:** `check-fences.js` in agents-markdown-formatter catches this.
markdownlint has MD047 (missing final newline) but not a dedicated unclosed-fence
rule in the default set. The structural guard scripts are the reliable path here.

**What would help:** Already covered by existing guards. Listed here because it's a
recurring failure mode that the guards specifically address.

---

## 10. Single-backtick inline code with internal backticks

**What happens:** An AI agent writes `` `code with ``backticks`` inside` `` — using
single backticks to delimit inline code that itself contains backtick characters.
The result is an unclosed inline code span or premature closure, mangling the rest
of the line.

**How we hit it:**

- Describing backtick syntax inside inline code
- Inline code containing template literals or shell commands with backtick characters
- Inline code referencing code that itself uses backticks

**Detection:** markdownlint does not have a rule for this by default. The structured
parsing in the guard scripts doesn't scan for inline code spans, only block-level
fences.

**What would help:** A lint rule that checks the number of backtick characters inside
a single-backtick inline code span and warns if it's non-zero (suggesting the author
should use double backticks: ``` ``code `with` backticks`` ```).

---

## 11. Backtick count escalation in nested fences

**What happens:** When nesting a fenced code block inside another, the inner fence
needs more backticks than the outer. Getting this count wrong produces an unclosed
fence or prematurely closes the outer fence.

**How we hit it:**

- Documenting a Markdown fence inside a Markdown fence (common in agent docs)
- Showing CLI output that contains backtick-fence characters
- Template literals in MDX that contain Markdown fences

**Detection:** Oxfmt correctly escalates backtick counts when it normalizes tilde
fences — it adds more backticks when the content already contains the current fence
count. But it does this silently, and the author may not realize the fence delimiter
changed.

**What would help:** A categorized diff line that reports fence-delimiter count
changes separately from other formatting changes, similar to what
`check-fixture.js` already does for the spike's test harness.

## Summary

| #   | Problem                              | Severity   | Tool coverage                | Gap                                      |
| --- | ------------------------------------ | ---------- | ---------------------------- | ---------------------------------------- | ---- | --------------------------------------------------------- |
| 1   | Double `                             |            | ` in tables                  | Moderate                                 | None | No lint rule or normalization for adjacent-pipe artifacts |
| 2   | Empty fences                         | Low        | None                         | No lint rule for zero-content fences     |
| 3   | Inline-code pipes in tables          | Moderate   | Post-hoc (`check-tables.js`) | Pre-format scan missing                  |
| 4   | Tilde→backtick normalization         | Low        | None                         | No preserve-author-intent option         |
| 5   | Code-content formatting              | Moderate   | Config-driven (`"off"`)      | Discoverability gap, easy to miss        |
| 6   | Prose reflow on list continuations   | Low        | None                         | No structural-diff guard                 |
| 7   | HTML comment after list item         | Historical | Regression fixture           | Fixed, guarded                           |
| 8   | Table column count mismatch          | Low        | `repairTableColumns`         | Silent padding, no warning               |
| 9   | Unclosed/mismatched fences           | High       | `check-fences.js`            | Covered                                  |
| 10  | Inline code with internal backticks  | Low        | None                         | No inline-code span lint rule            |
| 11  | Backtick escalation in nested fences | Low        | None                         | No diff category for fence-count changes |
