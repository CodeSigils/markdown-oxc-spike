import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------
function usage() {
  console.error("Usage: node scripts/check-fixture.js <fixtures/source/name.md>");
}

// ---------------------------------------------------------------------------
// Oxfmt runner
// ---------------------------------------------------------------------------
function runOxfmt(args) {
  const bin = process.platform === "win32" ? "oxfmt.cmd" : "oxfmt";
  const result = spawnSync(bin, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    throw new Error(
      [`oxfmt ${args.join(" ")} failed`, result.stdout, result.stderr]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Structural info extractors (fences, tables)
// ---------------------------------------------------------------------------
function extractFenceInfo(content) {
  // NOTE: \n anchors assume UNIX line endings (LF). If CRLF (\r\n) input is
  // expected, update the delimiter group to (\r?\n) in all four positions:
  // fence open, fence content tail, close-fence, and trailing break.
  const fenceRegex = /^( {0,3})(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n\1\2\n/gmu;
  const fences = [];
  let match;

  while ((match = fenceRegex.exec(content)) !== null) {
    fences.push({
      indent: match[1],
      fenceChar: match[2][0],
      fenceLength: match[2].length,
      infoString: match[3],
      content: match[4],
    });
  }

  return fences;
}

function extractTableInfo(content) {
  const lines = content.split("\n");
  const tableInfo = { rows: [], headerColumns: 0, delimiterColumns: 0 };
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const pipeCount = (line.match(/\|/g) || []).length;

    if (pipeCount >= 2) {
      const isDelimiterRow = /^[\s|]*(:?-+:?|\s*:?-+:?\s*:?-+:?)[\s|]*$/.test(line);

      tableInfo.rows.push({
        lineIndex: i,
        content: line,
        pipeCount,
        isDelimiterRow,
      });

      if (isDelimiterRow) {
        tableInfo.delimiterColumns = pipeCount - 1;
      } else if (!inTable && !isDelimiterRow) {
        tableInfo.headerColumns = pipeCount - 1;
        inTable = true;
      }
    } else if (inTable && pipeCount < 2) {
      inTable = false;
    }
  }

  return tableInfo;
}

function compareFenceInfo(before, after) {
  const changes = [];

  if (before.length !== after.length) {
    changes.push(`Fence count changed: ${before.length} → ${after.length}`);
  }

  for (let i = 0; i < Math.max(before.length, after.length); i++) {
    const bFence = before[i] || { fenceChar: "MISSING", fenceLength: 0 };
    const aFence = after[i] || { fenceChar: "MISSING", fenceLength: 0 };

    if (bFence.fenceChar !== aFence.fenceChar) {
      changes.push(`Fence ${i + 1} style changed: ${bFence.fenceChar} → ${aFence.fenceChar}`);
    }

    if (bFence.fenceLength !== aFence.fenceLength) {
      changes.push(`Fence ${i + 1} length changed: ${bFence.fenceLength} → ${aFence.fenceLength}`);
    }
  }

  return changes;
}

function compareTableInfo(before, after) {
  const changes = [];

  if (before.headerColumns !== after.headerColumns) {
    changes.push(`Table header columns changed: ${before.headerColumns} → ${after.headerColumns}`);
  }

  if (before.delimiterColumns !== after.delimiterColumns) {
    changes.push(`Table delimiter columns changed: ${before.delimiterColumns} → ${after.delimiterColumns}`);
  }

  if (before.rows.length !== after.rows.length) {
    changes.push(`Table row count changed: ${before.rows.length} → ${after.rows.length}`);
  }

  const maxRows = Math.max(before.rows.length, after.rows.length);
  for (let i = 0; i < maxRows; i++) {
    const bRow = before.rows[i] || { pipeCount: 0 };
    const aRow = after.rows[i] || { pipeCount: 0 };

    if (bRow.pipeCount !== aRow.pipeCount) {
      changes.push(`Table row ${i + 1} pipe count changed: ${bRow.pipeCount} → ${aRow.pipeCount}`);
    }
  }

  return changes;
}

// ---------------------------------------------------------------------------
// Line-diff engine (LCS-based)
// ---------------------------------------------------------------------------

/**
 * Compute a line-by-line diff between two strings.
 * Returns hunks, each with a type: 'equal', 'insert', 'delete', or 'replace'.
 */
function computeDiff(source, formatted) {
  const a = source.split("\n");
  const b = formatted.split("\n");
  const m = a.length;
  const n = b.length;

  // LCS length table
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to extract edit operations
  const ops = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ type: "equal", lineA: a[i - 1], lineB: b[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: "insert", lineA: null, lineB: b[j - 1] });
      j--;
    } else {
      ops.push({ type: "delete", lineA: a[i - 1], lineB: null });
      i--;
    }
  }
  ops.reverse();

  // Group consecutive operations into hunks
  const hunks = [];
  let current = null;

  for (const op of ops) {
    if (op.type === "equal") {
      if (current) {
        hunks.push(current);
        current = null;
      }
      continue;
    }

    if (!current || current.type !== op.type) {
      // If we were tracking a different operation type, close it first
      if (current) {
        hunks.push(current);
      }
      current = { type: op.type === "insert" && false ? "insert" : op.type, linesA: [], linesB: [] };
    }

    // Actually, let's simplify: adjacent inserts and deletes become a 'replace' hunk
    // We need to merge adjacent delete+insert into replace

    if (!current) {
      current = { type: op.type, linesA: [], linesB: [] };
    }

    if (op.type === "delete") {
      // If we're currently tracking inserts..., let me rethink
    }
  }

  // Let me redo this more cleanly
  const raw = [];
  for (const op of ops) {
    if (op.type === "equal") {
      if (raw.length > 0 && raw[raw.length - 1].type !== "equal") {
        raw.push({ type: "separator" });
      }
      continue;
    }
    raw.push(op);
  }

  // Merge adjacent delete+insert groups into replace hunks
  const hunks2 = [];
  let idx = 0;
  while (idx < raw.length) {
    if (raw[idx].type === "separator") {
      idx++;
      continue;
    }

    if (raw[idx].type === "delete" && idx + 1 < raw.length && raw[idx + 1].type === "insert") {
      // Merge into replace
      const linesA = [];
      const linesB = [];
      while (idx < raw.length && (raw[idx].type === "delete" || raw[idx].type === "insert")) {
        if (raw[idx].type === "delete") linesA.push(raw[idx].lineA);
        else linesB.push(raw[idx].lineB);
        idx++;
      }
      hunks2.push({ type: "replace", linesA, linesB });
    } else if (raw[idx].type === "delete") {
      hunks2.push({ type: "delete", linesA: [raw[idx].lineA], linesB: [] });
      idx++;
    } else if (raw[idx].type === "insert") {
      hunks2.push({ type: "insert", linesA: [], linesB: [raw[idx].lineB] });
      idx++;
    } else {
      idx++;
    }
  }

  return hunks2;
}

// ---------------------------------------------------------------------------
// Change categorization
// ---------------------------------------------------------------------------

/**
 * Classify a diff hunk into one or more categories.
 * Returns an array of { category, detail } objects.
 */
function classifyHunk(hunk) {
  const results = [];

  if (hunk.type === "equal") return results;

  // --- trailing-whitespace: lines that only differ by trailing spaces ---
  if (hunk.type === "replace" && hunk.linesA.length === 1 && hunk.linesB.length === 1) {
    const lineA = hunk.linesA[0];
    const lineB = hunk.linesB[0];
    const strippedA = lineA.replace(/[ \t]+$/u, "");
    if (strippedA === lineB) {
      results.push({ category: "trailing-whitespace", detail: `line had trailing whitespace removed` });
      return results;
    }
  }

  // --- joining hunks into a shared context string for pattern matching ---
  const contextA = hunk.linesA.join("\n");
  const contextB = hunk.linesB.join("\n");

  // --- fence-style: tilde → backtick ---
  if (/^~{3,}/mu.test(contextA) && /^`{3,}/mu.test(contextB)) {
    results.push({ category: "fence-tilde-to-backtick", detail: "tilde fence normalized to backticks" });
    return results;
  }

  // --- fence-length: backtick count changed ---
  const backtickA = contextA.match(/^`{3,}/mu);
  const backtickB = contextB.match(/^`{3,}/mu);
  if (backtickA && backtickB && backtickA[0].length !== backtickB[0].length) {
    results.push({ category: "fence-length", detail: `backtick count ${backtickA[0].length} → ${backtickB[0].length}` });
    return results;
  }

  // --- code-content: change entirely inside a fenced-code block ---
  // If all changed lines are between fence markers (not fence lines themselves)
  // We approximate: if contextA and contextB look like code, not prose
  if (
    !/^\s*[-*#>|]/.test(contextA) &&
    !/^#{1,6}\s/.test(contextA) &&
    !/^\s*[-*+] /.test(contextA) &&
    !/^\d+\.\s/.test(contextA) &&
    !/^`{3,}/.test(contextA) &&
    !/^~{3,}/.test(contextA)
  ) {
    // Could be inside a fence — check if preceding context was fence
    // But we don't have context here. Use heuristic: if it looks like code
    if (/[;{}()=>[\]/]/u.test(contextA) || /\b(const|let|var|function|import|export)\b/.test(contextA)) {
      results.push({ category: "code-content", detail: "code inside fenced block reformatted" });
      return results;
    }
  }

  // --- table-columns: pipe count changed in a table row ---
  const pipeCountsA = contextA.match(/\|/g);
  const pipeCountsB = contextB.match(/\|/g);
  const countA = pipeCountsA ? pipeCountsA.length : 0;
  const countB = pipeCountsB ? pipeCountsB.length : 0;
  if (countA !== countB && countA >= 2 && countB >= 2) {
    results.push({ category: "table-columns", detail: `pipe count ${countA} → ${countB} in table row` });
    return results;
  }

  // --- table-padding: pipe count same but content changed ---
  if (countA === countB && countA >= 2) {
    results.push({ category: "table-padding", detail: "table cell whitespace adjusted" });
    return results;
  }

  // --- heading-spacing: blank line added/removed near heading ---
  const headingPattern = /^#{1,6}\s/mu;
  if (headingPattern.test(contextA) || headingPattern.test(contextB)) {
    const diff = contextB.length - contextA.length;
    const action = diff > 0 ? "added" : diff < 0 ? "removed" : "adjusted";
    results.push({ category: "heading-spacing", detail: `blank lines ${action} around heading` });
    return results;
  }

  // --- list-spacing: blank line added/removed near list marker ---
  const listPattern = /^\s*[-*+]\s/mu;
  if (listPattern.test(contextA) || listPattern.test(contextB)) {
    const diff = contextB.length - contextA.length;
    const action = diff > 0 ? "added" : diff < 0 ? "removed" : "adjusted";
    results.push({ category: "list-spacing", detail: `blank lines ${action} around list` });
    return results;
  }

  // --- html-comment: HTML comment indentation or position changed ---
  if (/<!--/.test(contextA) || /<!--/.test(contextB)) {
    results.push({ category: "html-comment", detail: "HTML comment formatting changed" });
    return results;
  }

  // --- prose-reflow: paragraph text reflowed (insert+delete of prose lines) ---
  if (hunk.type === "replace" || hunk.type === "insert") {
    const isProse = (lines) =>
      lines.length > 0 &&
      lines.every((l) => l.length > 0 && !/^\s*$/.test(l) && !/^\s*[-*#>|`~]/.test(l) && !/^#{1,6}\s/.test(l));

    if (isProse(hunk.linesA) || isProse(hunk.linesB)) {
      // Check for reflow: word-level content overlap
      const wordsA = new Set(hunk.linesA.join(" ").split(/\s+/u));
      const wordsB = new Set(hunk.linesB.join(" ").split(/\s+/u));
      let overlap = 0;
      for (const w of wordsA) {
        if (wordsB.has(w)) overlap++;
      }
      const similarity = overlap / Math.max(wordsA.size, wordsB.size);
      if (similarity > 0.3) {
        results.push({ category: "prose-reflow", detail: "paragraph text reflowed" });
        return results;
      }
    }
  }

  // --- prose-wrap: single-line change that looks like prose ---
  if (hunk.type === "replace" && hunk.linesA.length === 1 && hunk.linesB.length === 1) {
    const a = hunk.linesA[0];
    const b = hunk.linesB[0];
    if (a.length > 0 && b.length > 0 && !/^\s*[-*#>|`~]/.test(a) && !/^#{1,6}\s/.test(a)) {
      results.push({ category: "prose-reflow", detail: "inline prose change" });
      return results;
    }
  }

  // --- final-newline: last line of file ---
  if (hunk.type === "insert" && hunk.linesB.length === 1 && hunk.linesB[0] === "") {
    results.push({ category: "final-newline", detail: "trailing newline added" });
    return results;
  }
  if (hunk.type === "delete" && hunk.linesA.length === 1 && hunk.linesA[0] === "") {
    results.push({ category: "final-newline", detail: "trailing newline removed" });
    return results;
  }

  // --- other: unclassified ---
  results.push({ category: "other", detail: `unclassified change (${hunk.type}, ${hunk.linesA.length}→${hunk.linesB.length} lines)` });
  return results;
}

/**
 * Produce a categorized summary string comparing source to formatted output.
 * Returns an empty string if no changes were detected.
 */
function categorizeChanges(sourceContent, formattedContent) {
  if (sourceContent === formattedContent) {
    return "";
  }

  const hunks = computeDiff(sourceContent, formattedContent);
  const classified = hunks.flatMap(classifyHunk);

  // Aggregate by category
  const counts = {};
  const details = {};
  for (const { category, detail } of classified) {
    counts[category] = (counts[category] || 0) + 1;
    if (!details[category]) details[category] = new Set();
    details[category].add(detail);
  }

  const lines = ["", "  Change classification (source vs formatted):"];

  // Sort by count descending
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (const [category, count] of sorted) {
    const sample = [...details[category]].slice(0, 2).join("; ");
    lines.push(`    ${count}x  ${category}${sample ? `  — ${sample}` : ""}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Structural guard renderers
// ---------------------------------------------------------------------------
function renderMismatch(before, after) {
  return [
    "Oxfmt was not idempotent on the second pass.",
    "--- before second pass ---",
    before,
    "--- after second pass ---",
    after,
  ].join("\n");
}

/**
 * Parse table rows into cells per GFM spec.
 *
 * GFM table rules (https://github.github.com/gfm/#tables-extension-):
 * - Cells separated by pipes (|). Leading/trailing pipe recommended.
 * - Spaces between pipes and cell content are trimmed.
 * - Include a pipe in a cell by escaping it: \|
 * - Header row and delimiter row MUST have same number of cells.
 *   If not, it's NOT a table (Example 203).
 * - Data rows may have fewer cells (empty cells inserted) or more
 *   cells (excess ignored) (Example 204).
 *
 * Returns null if the line isn't a table row. Otherwise returns
 * an array of cell strings (trimmed, with escaped pipes unescaped).
 */
function gfmSplitRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;

  // Strip leading and trailing pipes
  let inner = trimmed;
  if (inner.startsWith("|")) inner = inner.slice(1);
  if (inner.endsWith("|")) inner = inner.slice(0, -1);

  // Parse cells, handling escaped pipes and inline code
  const cells = [];
  let current = "";
  let escaped = false;
  let inCode = false;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    const next = i + 1 < inner.length ? inner[i + 1] : null;

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      current += ch;
      escaped = true;
      continue;
    }

    if (ch === "`" && !inCode) {
      inCode = true;
      current += ch;
      continue;
    }

    if (ch === "`" && inCode) {
      inCode = false;
      current += ch;
      continue;
    }

    if (ch === "|" && !inCode) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  // Push the last cell
  cells.push(current.trim());

  return cells;
}

/**
 * Check if a table row is a delimiter row (contains only hyphens, colons, pipes, spaces).
 */
function gfmIsDelimiterRow(cells) {
  return cells.every((cell) => /^:?-+:?$/.test(cell.trim()));
}

/**
 * Parse and validate GFM table structure for all table blocks in content.
 *
 * Returns an array of issues:
 *   { type: "not-a-table" | "cell-count-variance", detail, lineIndex, headerCount, rowCount }
 *
 * - "not-a-table": header/delimiter cell count mismatch (Example 203)
 * - "cell-count-variance": data row has more/fewer cells than header (Example 204)
 */
function validateGfmTableStructure(content) {
  const lines = content.split("\n");
  const issues = [];

  // Find table blocks: consecutive lines that look like table rows
  let tableStart = -1;
  let tableRows = [];

  for (let i = 0; i < lines.length; i++) {
    const cells = gfmSplitRow(lines[i]);

    if (cells !== null && !/^:?-+:?$/.test(lines[i].trim())) {
      // This line could be part of a table
      // Include delimiter rows too
      tableRows.push({ lineIndex: i, cells, raw: lines[i] });
      if (tableStart === -1) tableStart = i;
    } else if (cells !== null && gfmIsDelimiterRow(cells)) {
      // Delimiter row
      tableRows.push({ lineIndex: i, cells, raw: lines[i] });
      if (tableStart === -1) tableStart = i;
    } else {
      // Non-table line ends any potential table block
      if (tableRows.length >= 2) {
        // We have a potential table — validate it
        const result = validateGfmBlock(tableRows);
        issues.push(...result);
      }
      // Reset
      tableStart = -1;
      tableRows = [];
    }
  }

  // Handle EOF case
  if (tableRows.length >= 2) {
    const result = validateGfmBlock(tableRows);
    issues.push(...result);
  }

  return issues;
}

/**
 * Validate a single GFM table block.
 * Returns an array of issues found within this block.
 */
function validateGfmBlock(rows) {
  const issues = [];

  // Find header row and delimiter row
  const headerRow = rows[0];
  const delimiterRow = rows[1];

  if (!gfmIsDelimiterRow(delimiterRow.cells)) {
    // First row might be a delimiter itself (e.g., no header table)
    // Or second row isn't a delimiter — not a valid table
    return issues;
  }

  const headerCount = headerRow.cells.length;
  const delimiterCount = delimiterRow.cells.length;

  // GFM Example 203: header and delimiter MUST have same cell count
  // If not, it's NOT a table
  if (headerCount !== delimiterCount) {
    issues.push({
      type: "not-a-table",
      detail: `Header (${headerCount} cells) and delimiter (${delimiterCount} cells) column count mismatch — not recognized as a table per GFM Example 203`,
      lineIndex: headerRow.lineIndex,
      headerCount,
      delimiterCount,
    });
    return issues; // No point checking further
  }

  // Check data rows
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const dataCount = row.cells.length;

    if (dataCount !== headerCount) {
      issues.push({
        type: "cell-count-variance",
        detail: `Data row ${i - 1} has ${dataCount} cells vs ${headerCount} header cells — per GFM Example 204: ${
          dataCount < headerCount ? "fewer cells → empty cells inserted" : "more cells → excess ignored"
        }`,
        lineIndex: row.lineIndex,
        headerCount,
        rowCount: dataCount,
      });
    }
  }

  return issues;
}
function detectEmptyCells(content) {
  const lines = content.split("\n");
  const issues = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("||")) {
      // Must look like a table row (leading pipe after optional whitespace)
      if (!line.trim().startsWith("|")) continue;

      // Must have at least 2 pipe chars total to be a table row
      const pipeCount = (line.match(/\|/g) || []).length;
      if (pipeCount < 2) continue;

      // Check for escaped pipes that happen to be adjacent
      const plainLine = line.replace(/\\\|/g, ""); // strip escaped pipes
      const adjPos = plainLine.indexOf("||");
      if (adjPos === -1) continue;

      // Check if the adjacent pipes are inside inline code
      // Simple heuristic: if `||` is inside backticks, skip
      const before = plainLine.slice(0, adjPos);
      const backtickCount = (before.match(/`/g) || []).length;
      if (backtickCount % 2 === 1) continue; // inside inline code

      issues.push({
        lineIndex: i,
        line,
        detail: adjPos === 0
          ? "Leading double pipe (creates empty first cell — valid GFM)"
          : adjPos >= plainLine.length - 2
            ? "Trailing double pipe (creates empty trailing cell — valid GFM)"
            : "Adjacent double pipe (creates empty cell between columns — valid GFM)",
      });
    }
  }

  return issues;
}

async function main() {
  const source = process.argv[2];

  if (!source) {
    usage();
    process.exitCode = 2;
    return;
  }

  const name = basename(source);
  const workFile = join("fixtures", "work", name);
  const firstPassFile = join("fixtures", "results", name.replace(/\.md$/u, ".first-pass.md"));
  const secondPassFile = join("fixtures", "results", name.replace(/\.md$/u, ".second-pass.md"));

  await mkdir(dirname(workFile), { recursive: true });
  await mkdir(dirname(firstPassFile), { recursive: true });

  const sourceContent = await readFile(source, "utf8");

  // Pre-check: detect empty-table-cell patterns (valid GFM syntax — diagnostic only)
  const doublePipeIssues = detectEmptyCells(sourceContent);
  if (doublePipeIssues.length > 0) {
    console.log(`\n  Empty cell patterns (${doublePipeIssues.length}):`);
    for (const issue of doublePipeIssues) {
      console.log(`    Line ${issue.lineIndex + 1}: ${issue.detail}`);
      console.log(`      ${issue.line}`);
    }
  }

  // Pre-check: GFM table structure validation
  const gfmIssues = validateGfmTableStructure(sourceContent);
  if (gfmIssues.length > 0) {
    console.log(`\n  GFM table structure notes (${gfmIssues.length}):`);
    for (const issue of gfmIssues) {
      console.log(`    ${issue.detail}`);
    }
  }

  await copyFile(source, workFile);

  // Pre-check: extract structural information
  const sourceFences = extractFenceInfo(sourceContent);
  const sourceTables = extractTableInfo(sourceContent);

  runOxfmt(["--write", workFile]);
  const firstPass = await readFile(workFile, "utf8");
  await writeFile(firstPassFile, firstPass);

  // Classify and print changes
  const changeSummary = categorizeChanges(sourceContent, firstPass);
  if (changeSummary) {
    console.log(changeSummary);
  }

  runOxfmt(["--write", workFile]);
  const secondPass = await readFile(workFile, "utf8");

  // Post-check: extract structural information after formatting
  const secondPassFences = extractFenceInfo(secondPass);
  const secondPassTables = extractTableInfo(secondPass);

  // Check for structural changes
  const fenceChanges = compareFenceInfo(sourceFences, secondPassFences);
  const tableChanges = compareTableInfo(sourceTables, secondPassTables);

  const structuralChanges = [...fenceChanges, ...tableChanges];

  if (secondPass !== firstPass) {
    await writeFile(secondPassFile, secondPass);
    throw new Error(renderMismatch(firstPass, secondPass));
  }

  if (structuralChanges.length > 0) {
    throw new Error([
      "Oxfmt caused structural changes:",
      ...structuralChanges.map((change) => `  - ${change}`),
      "",
      "This violates GFM specification and may break document meaning.",
      "Consider using escaped pipes (\\|) in inline code or reviewing fence styles.",
    ].join("\n"));
  }

  runOxfmt(["--check", workFile]);
  runOxfmt(["--list-different", workFile]);

  console.log(`idempotent: ${source} -> ${workFile}`);
  console.log(`first pass: ${firstPassFile}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
