# Markdown Light Formatter — Evidence-Based Plan

## Problem

AI agents write a lot of Markdown: READMEs, plans, runbooks, notes, review comments, and
MDX documentation. That output often has the same failure modes:

- very long prose lines
- inconsistent list and blockquote wrapping
- fragile tables
- fenced code blocks that should not be reformatted as if they were production source
  files

Generic Markdown formatting tools can either leave too much drift in place or expand
their blast radius into embedded examples. The existing `agents-markdown-formatter`
repository cures this specific problem by making Markdown normalization deterministic
while keeping structural safety explicit. It formats the Markdown container, bounds
AI-generated prose to readable lines, treats embedded code as opaque payload, and uses
repository-owned guards to detect table and fence drift before a formatter can silently
damage document structure.

**This plan evaluates whether the problem can be solved with a lighter tool** — one that
retains the same safety guarantees but eliminates the platform-binary dependency.

## Research evidence sources

Every decision below is informed by evidence found in these files. No claim is made
without a supporting source.

### `~/projects/markdown-oxc-spike` (this spike repo)

| File                   | What it contains                                                                                                                                                                                                          |
| :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/findings.md`     | Full research log: 9 fixture types tested across 3 Oxfmt versions (0.50.0, 0.54.0, 0.56.0), cross-config validation, structural guard verification, Oxc architecture audit, issue #21314 analysis, version drift checks   |
| `planning.md`          | Current conclusions, open questions (all closed), drift guard checklist, stale-claim audit table                                                                                                                          |
| `fixtures/source/*.md` | 9 source fixture files covering HTML comments after lists, escaped-pipe tables, semantic-alignment tables, blank fences, nested fences, fence language tags, safe formatting basics, Markdown-in-JS templates, task lists |
| `README.md`            | Decision rule: adopt Oxfmt only if it does not weaken invariants. All 9 fixtures pass structural guard scripts across both configs                                                                                        |

### `~/projects/agents-markdown-formatter` (production formatter repo)

| File           | What it contains                                                                                                                                                          |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SKILL.md`     | Canonical runtime behavior: prerequisites (Node >=20, oxfmt binary), CLI options (--check, --fix, --guard, --verify, --validate, --doctor), fence policy, severity levels |
| `README.md`    | Problem statement, positioning table (Prettier / markdownlint / oxfmt / this repo), quick start                                                                           |
| `CHANGELOG.md` | Release history: v1.0.0, v1.0.1 (superseded), v1.0.2, v1.0.3. Documents `repairTableColumns`, oxfmt pin 0.56.0, structural guard additions, --doctor diagnostics          |
| `notes.md`     | Future direction: do not rush packaging, let v1.0.x breathe, gather real usage friction, avoid standalone binary / npm package / pipx wrapper / pure JS formatter         |
| `package.json` | Single devDependency: `oxfmt@0.56.0` (pinned exact). No markdownlint dependency — guard scripts are independent                                                           |

### `~/labs/agent-concepts-study` (research context)

| File                                                           | What it contains                                                                                                                         |
| :------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `OPEN-QUESTIONS.md`                                            | Aggregated open research questions on skill measurement, loading mechanics, ecosystem, personalization, document drift                   |
| `2026-06-11-proportionate-anti-drift-from-observed-failure.md` | Build drift guards after observing the failure, not before                                                                               |
| `2026-06-12-duplicate-guidance-as-drift-surface.md`            | Every additional instruction file creates another drift surface; three classes of duplicate guidance                                     |
| `2026-06-11-ai-project-governance-archive-lessons.md`          | Governance tooling should follow observed patterns, not precede them. "Conversation not command, lens not law, influence not authority." |

## What the research proved

### Earlier repos (see Past work below) established

- **markdownlint-cli2 --fix** handles trailing spaces, final newlines, heading spacing,
  list spacing, list marker consistency. It does not handle table alignment, fence
  normalization, or indentation.
- **Oxfmt** (via Prettier) handles table alignment, fence normalization, indentation
  normalization, and optional code-content formatting. It does _not_ handle heading
  spacing, list spacing, or list markers under `proseWrap: preserve`.
- **The gap Oxfmt fills over markdownlint-cli2 is small:** table column alignment,
  fence normalization (tilde→backtick), and indentation normalization. Rough estimate
  including edge-case handling: ~30-40 LOC per operation. No upstream dependency.
- **Oxfmt's dependency cost is disproportionate to the gap:** platform-specific binary
  (8.3MB npm package, +16MB total `node_modules` installed), full Prettier Markdown/MDX/
  AST pipeline, 12 config options (only 4 relevant), version drift risk across minors.
- **The production guard scripts** (check-fences.js, check-tables.js, check-structure.js)
  catch the structural risks (fence style drift, table pipe count changes) that Oxfmt
  introduces. The spike validated these guards on all 9 fixture types.
- **With `embeddedLanguageFormatting: off` and `proseWrap: always`** (production config),
  Oxfmt is a safe formatter for GFM Markdown containers. But it's still a binary dependency.

### The governance study lesson

The archived `ai-project-governance` repo was instructive: before building new tooling,
let patterns accumulate. The spike collected evidence across 9 fixtures, 3 Oxfmt
versions, 2 configs. Before extending scope, real-world usage friction should be the
trigger.

---

## The landscape (what exists)

| Tool                                   | What it does                                                                | Dependencies                               | Token cost (agent invocation) |
| :------------------------------------- | :-------------------------------------------------------------------------- | :----------------------------------------- | :---------------------------- |
| **markdownlint-cli2 --fix**            | Trailing space, final newline, heading spacing, list spacing, list markers  | Node.js, npm package                       | Run as external CLI           |
| **Oxfmt** (via Prettier AST)           | Table alignment, fence normalization, indentation, optional code formatting | Node.js, platform binary (~10MB)           | Run as external CLI           |
| **agents-markdown-formatter (v1.0.3)** | Oxfmt + structural guards + rollback + idempotence check                    | Node.js, oxfmt binary (runtime dependency) | Run as external CLI           |

## Positioning

The `agents-markdown-formatter` README positions each tool by what it is useful for:

| Tool/use case                 | Fit                                                                                 |
| :---------------------------- | :---------------------------------------------------------------------------------- |
| **Prettier**                  | Great general formatter; broader embedded-language behavior than this repo needs    |
| **markdownlint**              | Great style checker; not formatter-first and does not run this repository's guards  |
| **oxfmt direct**              | Fast canonical formatter; no repository-specific rollback or structural guard layer |
| **agents-markdown-formatter** | Agent-safe GFM/MDX formatting with opaque fenced code and rollback-safe guards      |

This is the baseline. A micro-formatter candidate must fit into this table — either as a
replacement row or as a supplement. The question this plan answers is: **can we add a row
that eliminates the oxfmt binary dependency while keeping the same safety posture?**

## Proposed solution: targeted micro-formatter (explored and rejected)

_This section describes the path we considered in detail, researched, and then rejected
in favor of Options D-F below. It is documented here for completeness — the
recommendation starts at the "Updated recommendation" table._

Given the evidence, the right shape for a _lightweight_ agent-friendly Markdown formatter is:

> A small, zero-dependency Node.js script that applies exactly the safe formatting
> operations that markdownlint-cli2 does NOT cover, then delegates the rest.

### What it would do

1. Strip trailing whitespace from each line
2. Ensure final newline at end of file
3. Pad table columns to consistent alignment (preserve `:---`, `---:`, `:---:` markers)
4. Normalize fence style tilde→backtick (optional, could preserve author intent)
5. Normalize indent patterns to consistent spaces
6. **Stop there.** No prose reflow. No code-content formatting. No heading/list spacing
   (markdownlint already handles those).

### What it would NOT do

- Prose reflow / paragraph wrapping (keeps agent control over line layout)
- Code content formatting inside fences
- Heading spacing or list spacing (already covered by markdownlint-cli2 --fix)
- Structural validation (handled by dedicated guard scripts in the agent pipeline)

### Shape comparison

| Aspect                 | Tiny micro-formatter       | Oxfmt (via Prettier)      | markdownlint-cli2 --fix |
| :--------------------- | :------------------------- | :------------------------ | :---------------------- |
| Lines of code          | ~50-80                     | Thousands (Rust)          | Hundreds (JS)           |
| Dependencies           | Zero                       | Platform binary           | Node.js + npm           |
| Install time           | 0 (bundled)                | npm install (seconds)     | npm install             |
| Execution time         | <5ms/file                  | ~100ms/file               | ~50ms/file              |
| Running context        | In-process (no subprocess) | Subprocess                | Subprocess              |
| Token overhead (agent) | import/embed               | Shell command + stdio     | Shell command + stdio   |
| Blast radius           | Predictable per operation  | Full Prettier AST         | Rule-scoped             |
| Maintenance            | You own it                 | Upstream moves            | Upstream moves          |
| Version drift risk     | Zero (no upstream)         | Low (pinned, bump script) | Low (pinned)            |

### Relationship to existing tools

```text
markdownlint-cli2 --fix     ──>  trailing space, final newline,
                                  heading spacing, list spacing,
                                  list marker consistency

micro-formatter             ──>  table column alignment,
                                  fence style normalization,
                                  indent normalization,
                                  trailing space (belt-and-suspenders),
                                  final newline (belt-and-suspenders)

structural guard scripts    ──>  fence count, table column count,
                                  fence closure, structural drift
                                  (already exist in agents-markdown-formatter)

agents-markdown-formatter   ──>  full pipeline: oxfmt + guards
                                  (kept for users who want prose wrap
                                   and code-content formatting)
```

### Options for delivering the micro-formatter

| Option                    | What it means                                                                       | Upfront effort         | Ongoing maintenance                  |
| :------------------------ | :---------------------------------------------------------------------------------- | :--------------------- | :----------------------------------- |
| **A — Standalone script** | Single `.mjs` file, shipped with the agent skill, no npm package                    | ~1 hour write + commit | Near-zero                            |
| **B — Hermes skill**      | Packaged as a Hermes skill (SKILL.md + script), installable via hub                 | ~2 hours               | Low (testing across Hermes versions) |
| **C — Both**              | Standalone script + Hermes skill wrapper                                            | ~2.5 hours             | Low                                  |
| **D — Do nothing**        | Keep agents-markdown-formatter as-is, use its oxfmt + guard pipeline for everything | 0                      | Existing maintenance                 |

### Counterargument: are we re-inventing the wheel?

The proposed micro-formatter does table alignment, fence normalization, and indentation
— three formatting operations. That makes it a formatter. The spike already proved that
Oxfmt (via `agents-markdown-formatter`) can do those formatting operations safely behind
structural guard scripts. The only difference is dependency weight.

The honest question is:

> Did the spike uncover anything that could not have been learned by simply using the
> existing `agents-markdown-formatter` with a smaller config?

| What we learned                                                                        | Could we learn it by just using the existing formatter? |
| :------------------------------------------------------------------------------------- | :------------------------------------------------------ |
| Oxfmt is idempotent on 9 fixture types                                                 | Yes — `--verify` already checks this                    |
| Oxfmt leaves trailing spaces and heading spacing untouched under `proseWrap: preserve` | Yes — run it and diff                                   |
| Oxfmt normalizes tilde fences to backticks                                             | Yes — documented in findings                            |
| Oxfmt can add table columns from unescaped pipes in inline code                        | Yes — `check-tables.js` catches this                    |
| Oxfmt uses Prettier under the hood for Markdown                                        | Yes — official docs state this                          |
| Oxfmt is a ~8.3MB platform-specific binary                                             | Yes — `npm install` tells you this                      |

**Every finding the spike generated could have been learned from the production tool.**
The spike was useful as a controlled test environment, but the findings are not novel
enough to warrant building a new formatter from scratch.

The risk of the micro-formatter path is:

1. **Duplication of effort.** The operations are small but subtle. Table column alignment
   has edge cases (multi-line cells, inline-code segments that look like cells, escaped
   pipes). Building and testing these correctly is more involved than a loose estimate
   suggests — the caveats section above flags the same risk.
2. **Divergence.** Once the micro-formatter exists, it will inevitably differ from what
   Oxfmt does. You now have two formatting sources to maintain and reconcile.
3. **False economy.** The 8.3MB binary is downloaded once. The token cost of a subprocess
   call is negligible in an agent invocation that already runs dozens of tools.

### Updated recommendation

Given this counterargument, the recommendation shifts:

| Option                            | What                                                                                                                                                                     | Verdict                                                  |
| :-------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------- |
| **A — Standalone script**         | Build a micro-formatter from scratch                                                                                                                                     | Weak — re-inventing the wheel                            |
| **B — Hermes skill**              | Package micro-formatter as a skill                                                                                                                                       | Weaker — same wheel, more packaging                      |
| **C — Both**                      | Script + skill                                                                                                                                                           | Weakest — maximum wheel duplication                      |
| **D — Do nothing**                | Keep using agents-markdown-formatter as-is                                                                                                                               | **Strongest — proven, working, documented**              |
| **E — Accept the dependency**     | Keep Oxfmt but eliminate friction points around it (better docs, simpler CLI)                                                                                            | Strong — fixes the real pain without building a new tool |
| **F — markdownlint custom rules** | 3 custom rules (~80 lines) covering table alignment, fence normalization, indent. No new tool, no binary, no subprocess. Uses existing markdownlint-cli2 infrastructure. | **Strong** — covers the gap with no new dependencies     |

The spike was worth doing — it confirmed that Oxfmt is safe enough to use, and it
identified the specific guardrails needed. The evidence does not justify building a
replacement.

For the lightweight case, **Option F (markdownlint custom rules)** is the strongest
answer: covers the gap with no new dependencies, no binary, no subprocess. It uses
infrastructure that already exists in any markdownlint-enabled repo.

For improving the existing pipeline, **Option E** (simpler CLI, better `--doctor`,
one-command install+verify) addresses real friction points directly.

---

## Past work (re-evaluated)

### ~/projects/agents-markdown-formatter

Current shape: Shielded badge `v1.0.3`, `oxfmt@0.56.0` pinned, full CI, structural
guards, `--doctor` CLI, staged-install verification, clean release metadata.

**Do NOT rename or archive.** The notes.md correctly identifies that the next useful
move is not a new formatter architecture but either:

- a tiny "Troubleshooting" section based on real `--doctor` failures, or
- a stable invocation wrapper if Hermes gains a clean skill-command convention.

The production repo is stable. Let it breathe.

### ~/projects/markdown-oxc-spike

Current shape: 9 fixture types, 3 Oxfmt versions tested (0.50.0, 0.54.0, 0.56.0),
cross-config validation against production guards, version-bump script, categorized
diff summary in check-fixture.js, stale-assumption tracking in planning.md.

**Status:** Published reference. All three open questions closed:

- "Is Oxfmt too broad?" → Yes, proved with evidence.
- "Should the repo grow a custom formatter?" → No, answered.
- "Should first-pass outputs be committed snapshots?" → Only remaining question, low
  priority.

**Remains useful** as the test harness for future Oxfmt version bumps. When `oxfmt 0.57.0`
ships, run `bash scripts/bump-oxfmt.sh 0.57.0` to check for regressions.

### ~/labs/agent-concepts-study

Research context, not project authority. Relevant carry-forward:

- **Duplicate guidance as drift surface** (2026-06-12): Every additional instruction file
  and tool creates another place where guidance can become stale or contradictory.
  Relevant when considering adding a new formatter script — keep it single-purpose.
- **Proportionate anti-drift from observed failure** (2026-06-11): Build drift guards
  after observing the failure, not before. Don't pre-build governance for a micro-formatter
  that hasn't been used yet.
- **Research-practice loop across agent repos** (2026-06-11): Concepts emerge in one
  repository, become lenses for reading others. The spike's findings informed the
  production guard scripts. The recommendation options (E, F) in this document are the
  next iteration — not a new formatter architecture but targeted improvements to the
  existing pipeline.
- **AI project governance archive lessons** (2026-06-11): "Governance tooling should
  follow observed patterns. It should not precede them." The archive built taxonomies
  and checkers before the generator had proven itself. Applied here: the spike gathered
  evidence before shaping the recommendation, and Option F (custom rules) follows the
  same pattern — write rules, observe real friction, then package.

---

## Landscape beyond this repo — concise summary

The spike already surveyed the alternative-formatter landscape through direct testing.
The "Alternative solutions" placeholder earlier in this repo's life suggested evaluating
Prettier, dprint, mdformat, Pandoc, and "custom regex transforms" — but that last
entry was self-referential (the proposed micro-formatter), and the other candidates
confirm what the spike already proved:

| Candidate                  | Engine                          | Dependency                   | Markdown scope                | Why not the answer                                                                                                                                        |
| :------------------------- | :------------------------------ | :--------------------------- | :---------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prettier**               | Full parser (espree/remark)     | npm package + Node           | GFM + MDX                     | Same engine as Oxfmt — Oxfmt delegates Markdown to Prettier. Adding Prettier directly would be the same dependency weight without the oxfmt Rust wrapper. |
| **dprint-plugin-markdown** | dprint core (Rust)              | Platform binary + dprint CLI | GFM                           | Same shape as Oxfmt: Rust binary, config surface, version drift. Last release 0.22.1 (2026-05), 53 stars, smaller community.                              |
| **mdformat**               | CommonMark parser (markdown-it) | Python package + GFM plugin  | CommonMark (+ GFM via plugin) | Python dependency + pip install path. Requires `mdformat-gfm` plugin for GFM tables. Does not handle the fence/table structural guard layer.              |
| **Pandoc**                 | Full AST pipeline               | Haskell binary               | Any Markdown dialect          | Way too broad. AST pipeline, many moving parts, ~50MB binary.                                                                                             |

**Bottom line:** None of the alternatives solve the problem in a fundamentally lighter way
than Oxfmt. They all add a dependency chain — Python/pip, Rust/dprint, Haskell/Pandoc,
or the same npm+Node path. The existing `agents-markdown-formatter` (oxfmt + Node.js
guard scripts) is already the lightest viable shape that covers both formatting and
structural safety.

## What a markdownlint-custom-rules approach would look like

markdownlint-cli2 supports custom rules: JS modules with separate `lint` (validation) and
`fix` (auto-correction) functions. This means the three formatting operations Oxfmt covers
can be implemented as custom rules — no new tool, no platform binary, no subprocess.

### Gap coverage

| Formatting operation        | markdownlint built-in | Custom rule needed | Lines of code | Complexity |
| :-------------------------- | :-------------------- | :----------------- | :------------ | :--------- |
| Trailing whitespace         | MD009                 | No                 | 0             | Trivial    |
| Final newline               | MD047                 | No                 | 0             | Trivial    |
| Heading spacing             | MD022                 | No                 | 0             | Trivial    |
| List spacing / list markers | MD032, MD004          | No                 | 0             | Trivial    |
| **Table column alignment**  | Not covered           | Yes                | ~40           | Moderate   |
| **Fence normalization**     | Not covered           | Yes                | ~20           | Low        |
| **Indent normalization**    | Not covered           | Yes                | ~20           | Low        |
| Prose reflow                | Not covered           | Out of scope       | —             | —          |
| Code content formatting     | Not covered           | Out of scope       | —             | —          |

### Shape compared to other options

| Aspect                 | markdownlint custom rules                                               | Micro-formatter script     | Oxfmt via agents-markdown-formatter                 |
| :--------------------- | :---------------------------------------------------------------------- | :------------------------- | :-------------------------------------------------- |
| Lines of custom code   | ~80 (3 rule modules)                                                    | ~50-80                     | 0 (uses upstream)                                   |
| Dependencies           | markdownlint-cli2 (pure JS, 280KB pkg, +14MB installed transitive deps) | None                       | oxfmt (platform binary, 8.3MB pkg, +16MB installed) |
| Platform binary        | No                                                                      | No                         | Yes                                                 |
| Subprocess             | No                                                                      | No                         | Yes                                                 |
| Existing rule coverage | Free (MD009, MD047, MD022, MD032)                                       | Must re-implement          | Not covered under `proseWrap: preserve`             |
| Rule infrastructure    | Built-in (severity, config, exceptions, `--fix`)                        | Must write from scratch    | N/A (not rule-based)                                |
| Config surface         | Single `.markdownlint.jsonc`                                            | Script arguments or config | `.oxfmtrc.json` (12 options, 4 relevant)            |
| Agent invocation       | `markdownlint-cli2 --fix`                                               | `node micro-format.mjs`    | `agents-format --fix` (subprocess chain)            |
| Structural guards      | Could embed in same config                                              | Separate scripts           | Separate scripts                                    |
| Maintenance burden     | Low (3 rule modules, no upstream)                                       | Low (no upstream)          | Low (upstream pinned, bump script)                  |

### Caveats

- **Table alignment is not trivial in a custom rule.** markdownlint's parser provides
  tokens, not a full table AST. You would need to reconstruct table structure from raw
  lines, similar to what `check-tables.js` already does. The ~40 line estimate assumes
  a simple column-max-width approach — edge cases (multi-line cells, escaped pipes,
  inline code containing pipes) require the same care as any other implementation.
- **markdownlint fixes are line-oriented.** Each rule sees the document as an array of
  lines. Multi-line table alignment (adjusting pipes across rows) is feasible but
  requires accumulating per-column state across lines, then applying fixes.
- **Idempotence is guaranteed by design.** A markdownlint rule that applies its own
  fix format should converge in one pass, because each fix applies a deterministic
  transformation. This avoids the two-pass idempotence check Oxfmt needs.
- **No prose reflow.** markdownlint does not reflow paragraph text. If prose wrapping
  is desired, that remains an Oxfmt or Prettier job. The custom-rule approach is
  intentionally minimal.

### Assessment

This is the strongest light-weight option because:

1. **No new CLI dependency.** The agents-markdown-formatter repo does not currently
   depend on markdownlint-cli2 (only on oxfmt). But if markdownlint-cli2 is already
   present, custom rules add zero new package installs. If not (see below), adding it
   is a one-time pure-JS npm install — no platform binary.
2. **No platform binary.** markdownlint-cli2 is pure JS (280KB package, 14MB installed
   with transitive deps). Unlike oxfmt (8.3MB Rust binary), there is no platform-
   specific download — the installed size difference is marginal (~2MB), but the
   architecture matters: no Rust compilation, no WASM, no per-platform optional
   dependencies.
3. **Unified invocation.** One command (`markdownlint-cli2 --fix`) covers all safe
   formatting. No subprocess chain, no separate guard-script orchestration.
4. **Existing infrastructure for free.** Severity levels, config overrides, file
   exclusion, error reporting — all provided by markdownlint-cli2 without writing
   a single line of scaffolding.

The cost: writing and maintaining ~80 lines of custom rules, plus their edge-case
handling. This is the same maintenance burden as the micro-formatter script, but
riding on markdownlint's infrastructure instead of from-scratch.

### If markdownlint is not already installed

The agents-markdown-formatter repo currently does NOT depend on markdownlint-cli2
(`package.json` has only `oxfmt@0.56.0` as a devDependency). If adding custom rules,
the options are:

| Scenario                           | markdownlint-cli2 size                   | Impact                                                                           |
| :--------------------------------- | :--------------------------------------- | :------------------------------------------------------------------------------- |
| Already present in project         | 0 new bytes                              | Zero friction — rules drop into `.markdownlint.jsonc`                            |
| Not present, but Node.js available | 280KB package + 14MB installed (pure JS) | One-time npm install, no platform binary                                         |
| Not present, no Node.js            | N/A                                      | Cannot run markdownlint at all — Oxfmt also needs Node.js (its guard scripts do) |

If Node.js is available (which it is for any repo using the guard scripts), adding
markdownlint-cli2 is a pure-JS install — no Rust compilation, no platform binary,
no architecture-dependent build step.

---

## Plan of record

1. **Decide which problem to solve.** If the problem is "Oxfmt is too heavy for a
   lightweight formatter" → Option F (markdownlint custom rules) is the strongest
   answer: covers the gap with no new dependencies, no binary, no subprocess. If the
   problem is "using agents-markdown-formatter has friction points" → Option E
   addresses that without building a new tool.
2. **If Option F (recommended for the lightweight case):** Write 3 custom rule modules
   (~80 lines total):
   - Table column alignment (ride on `check-tables.js` edge-case logic)
   - Fence normalization (tilde→backtick)
   - Indent normalization (consistent leading spaces)
     Test against the spike's 9 fixtures. Validate byte-identical output to Oxfmt on the
     fixture set (within the scope of what the custom rules cover).
3. **If Option E:** Audit the friction points in the existing pipeline:
   - How many steps to go from zero to formatting a file?
   - Does `--doctor` catch all common failure modes it could?
   - Is there a one-command install + verify path?
   - Can the agent invoke the formatter with a shorter command?
4. **Avoid the micro-formatter path unless all other options are ruled out.** The
   counterargument and recommendation table show why Options A-C (micro-formatter in
   any form) are weaker than D, E, or F. If new evidence changes this calculus, the
   spike's fixtures and `check-fixture.js` harness are already in place to validate
   against.
5. **Let it breathe.** Collect real usage friction before adding more features or
   packaging.

---

## Strategy review

_Periodically re-evaluate this section against current pain points, actual friction,
and new tooling. Every claim below should be reassessed on each review._

### The three axes

Markdown formatting strategy decomposes into three independent dimensions. A position
must be chosen on each — picking "D" or "F" only answers the first.

| Axis           | Question                                                     | Current position                                                            | Viable alternatives                                                                      |
| :------------- | :----------------------------------------------------------- | :-------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| **Engine**     | What performs the formatting operations?                     | Oxfmt (pinned 0.56.0, `embeddedLanguageFormatting: off`)                    | Replace with 3 markdownlint custom rules (~80 LOC, no binary). Micro-formatter rejected. |
| **Detection**  | What structural problems are caught before/after formatting? | 3 guard scripts: `check-fences.js`, `check-tables.js`, `check-structure.js` | Add rules for the 7 uncovered pain points below                                          |
| **Ergonomics** | How frictionless is the pipeline to install and invoke?      | Stable (install, `--doctor`, CLI flags)                                     | Audit per Option E. Not yet triggered by real friction.                                  |

### Pain point coverage by the three options

Shows what each option actually addresses. Most gaps are in **Detection**, not Engine.

| #   | Pain point                                | Sev  | Option D (current)           | Option F (custom rules)       | Option E (friction fixes) | Real coverage gap       |
| :-- | :---------------------------------------- | :--: | :--------------------------- | :---------------------------- | :------------------------ | :---------------------- |
| 1   | Adjacent pipes (`&#124;&#124;`) in tables | Mod  | None                         | None                          | None                      | **New rule needed**     |
| 2   | Empty fences                              | Low  | None                         | None                          | None                      | **New rule needed**     |
| 3   | Inline-code pipes as columns              | Mod  | Post-hoc (`check-tables.js`) | Same post-hoc                 | Pre-format scan           | **Pre-format check**    |
| 4   | Tilde→backtick normalization              | Low  | None                         | Partial (preserve-style rule) | Diff category             | Small                   |
| 5   | Code-content formatting                   | Mod  | Config fix (`"off"`)         | N/A                           | `--doctor` check          | **Discoverability**     |
| 6   | Prose reflow on list continuations        | Low  | None                         | None                          | Partial (diff guard)      | **New guard**           |
| 7   | HTML comment after list item              | Hist | Regression fixture           | N/A                           | N/A                       | —                       |
| 8   | Table column count mismatch               | Low  | Silent padding               | Rule could warn               | Pre-format warn           | **Warn vs. silent fix** |
| 9   | Unclosed/mismatched fences                | High | `check-fences.js`            | N/A                           | N/A                       | —                       |
| 10  | Inline code with internal backticks       | Low  | None                         | None                          | None                      | **New rule needed**     |
| 11  | Backtick count escalation (nested)        | Low  | None                         | Partial (report count)        | Diff category             | Small                   |

Seven of eleven pain points are detection gaps, not engine gaps. Neither Option D, E,
nor F covers most of them today.

### Current honest recommendation

Evidence from git history across 3 repos shows that **pain point #1 (double pipes)
recurred 3 times in a 5-day window in the same repository** — actual damage, not
hypothetical risk. The remaining gaps (empty fences, inline-code pipes, backtick
issues) have zero recorded incidents. This shifts the priority:

1. **Keep the current engine (Option D).** The oxfmt binary dependency has not caused
   real pain in practice. Building Option F (custom markdownlint rules) swaps one
   engine for another without closing detection gaps.
2. **Fill detection gaps — start with #1 (double pipes).** This is the only pain
   point with proven recurrence. Three separate commits fixed `||` table artifacts
   before a structural validator caught them. Action: add a check to
   `markdown-formatter --validate` (or a dedicated guard script) that flags adjacent
   pipes in table rows.
3. **Next priority: #8 (table column count mismatch).** One incident in
   doom-emacs-config affected 7 rows. A pre-format structural warning would catch
   this before it reaches a formatter. Lower effort than the double-pipe check.
4. **No action on the remaining gaps until evidence surfaces.** Pain points #2
   (empty fences), #3 (inline-code pipes), #10 (backtick in inline code), and #11
   (backtick escalation) have zero recorded incidents across all three repos.
   Proactive work on these would be speculative.
5. **Do not launch a big Option E audit yet.** Wait for a specific friction incident
   (install failure, PATH confusion, invocation friction reported by a real user).

### When to re-evaluate

Revisit this strategy review when any of these triggers fire:

- A user reports a formatting result that damages document structure
- A real friction incident blocks installation or invocation
- A new version bump (oxfmt >=0.57.0) changes behavior on any fixture type
- A pain point currently marked Low severity causes actual document corruption
- The spike repo receives a pull request or external question (indicating broader usage)
- Six months pass since the last review (whichever is longer)
