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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
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
  await copyFile(source, workFile);

  // Pre-check: extract structural information
  const sourceContent = await readFile(source, "utf8");
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
