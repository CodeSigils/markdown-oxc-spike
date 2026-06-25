# Evidence-Based Pain Points (Git History)

Real incidents from the three most actively maintained Markdown repositories.
Each entry links to a specific commit that documents the damage and the fix.

---

## Incident 1: Double-pipe `||` table rows (three repos, repeated pattern)

**What happened:** A leading `||` created a phantom empty first column in GFM tables.
The extra pipe is syntactically valid Markdown (empty first cell), so no tool warned.
The table rendered with a spurious blank column on the left.

**Evidence:**

- `hermes-skill-hq` commit `c027477` (2026-06-14): "fix: convert all table rows from
  `||` to `|` (standard GFM)" — the double-pipe prefix created a phantom empty first
  column in the pitfalls table. 3 tables fixed in `dev/hq-review/SKILL.md`.
- `hermes-skill-hq` commit `6207e6c` (2026-06-19): "fix double-pipe table rows and
  triple-backtick table-cell parser issue" — fixed 6 rows across
  `scripts-inventory.md` and `hermes-skill-hq-study.md`.
- `hermes-skill-hq` commit `21c6550` (2026-06-14): "table pipe syntax fix" — version
  bump for the same fix, documenting the pattern in the changelog.

**Root cause:** Merge conflicts, find-and-replace at row boundaries, and inconsistent
editor configuration all produce `||` instead of `|`. The GFM spec tolerates it, so
no tool flags it. The pattern recurred across 3 separate commits in the same repo
before detection tooling was added — and those are just the ones caught before commit.

**Pattern classification:** **Adjacent pipes (`||`).** Could not be caught by any
tool in the pipeline at the time. Now detected by `markdown-formatter --validate`.

---

## Incident 2: Table column count mismatch (doom-emacs-config)

**What happened:** The Quick Index table header declared 2 columns but the GFM
separator row had 3 columns (`|---||---||---|`). Seven data rows were missing their
third column. The table rendered with a ragged right edge — some rows had 3 columns,
others had 2.

**Evidence:**

- `~/.config/doom` commit `04456ea` (2026-06-24): "fix SKILL.md Quick Index table:
  add missing third column header" — header had 2 columns but separator had 3
  (malformed GFM). Added 'Reference file' header and empty trailing cells to 7 rows.
  Validated at 6 structural errors → 0.

**Root cause:** Someone added a third column to the separator row (to align the
pipe formatting) but forgot to update the header and the data rows. No tool warned
because each row individually was valid GFM — the mismatch across rows is a
structural inconsistency that no single-row lint rule catches.

**Pattern classification:** **Column count mismatch across rows.** GFM fills missing
cells with empty content, so the table renders without errors but with inconsistent
layout.

---

## Incident 3: Triple-backtick inside table cell — parser collapse (hermes-skill-hq)

**What happened:** A table cell containing a literal triple-backtick code fence
(`` ```bash ```) was interpreted by the Markdown parser as an unclosed code span.
The parser absorbed all subsequent column separators (`|`) into the "code span,"
collapsing the remaining table structure into a single mangled cell.

**Evidence:**

- `hermes-skill-hq` commit `6207e6c` (2026-06-19): The same commit that fixed the
  double-pipe issue also fixed "triple-backtick table-cell parser issue." The file
  `scripts-inventory.md` had a table cell describing the `validate-bash-blocks.py`
  purpose with a literal `` ```bash ``` reference. The Markdown parser treated the
backticks as an unclosed code span, absorbing all subsequent `|` column separators
  and producing a single-column table after that point.

**Root cause:** Literal backtick fences inside table cells are not safe in GFM.
The parser sees the opening fence and looks for a closing fence. If none is found
within the cell boundary (because the parser is greedy), it absorbs everything
until the next backtick match or the end of the document. The workaround is to
avoid literal backtick artifacts inside table cells entirely — rephrase to avoid
the backtick sequence.

**Pattern classification:** **Backticks inside table cells causing parser collapse.**
Related to pain point #10 (inline code with internal backticks) but specific to
table-cell context where the structural impact is more severe.

---

## How these map to the pain point catalog

| Pain point                          | Evidence from git                                                       | Incidence count                |
| :---------------------------------- | :---------------------------------------------------------------------- | :----------------------------- | ------------------------------------- | ---------------- |
| #1 Double `                         |                                                                         | ` in tables                    | 3 commits across 1 repo, same pattern | High — recurring |
| #8 Table column count mismatch      | 1 commit in doom config, 7 rows affected                                | Moderate                       |
| #10 Backticks in inline/table cells | 1 commit with parser collapse                                           | Moderate — severe when it hits |
| #4 Tilde→backtick                   | Not caught on these repos — tilde fences are rare in agent-written docs | Low                            |
| #9 Unclosed fences                  | Pre-existing guard scripts catch this (0 escaped incidents)             | Covered                        |

The double-pipe pattern is the most striking: it recurred 3 times in the same
repository in a 5-day window (June 14-19, 2026) before a structural validator was
added. That is the strongest signal to prioritize it.
