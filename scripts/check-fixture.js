import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

function usage() {
  console.error("Usage: node scripts/check-fixture.js <fixtures/source/name.md>");
}

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
      fenceChar: match[2][0], // First character of fence (` or ~)
      fenceLength: match[2].length,
      infoString: match[3],
      content: match[4]
    });
  }
  
  return fences;
}

function extractTableInfo(content) {
  // Simple table detection: lines starting and ending with |, or having | separators
  const lines = content.split('\n');
  const tableInfo = {
    rows: [],
    headerColumns: 0,
    delimiterColumns: 0
  };
  
  let inTable = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const pipeCount = (line.match(/\|/g) || []).length;
    
    // Basic table row detection: at least 2 pipes (for simple tables)
    if (pipeCount >= 2) {
      // Check if it's a delimiter row (contains -:, :-, or ---)
      const isDelimiterRow = /^[\s|]*(:?-+:?|\s*:?-+:?\s*:?-+:?)[\s|]*$/.test(line);
      
      tableInfo.rows.push({
        lineIndex: i,
        content: line,
        pipeCount: pipeCount,
        isDelimiterRow: isDelimiterRow
      });
      
      if (isDelimiterRow) {
        tableInfo.delimiterColumns = pipeCount - 1; // Adjust for boundary pipes
      } else if (!inTable && !isDelimiterRow) {
        tableInfo.headerColumns = pipeCount - 1; // Adjust for boundary pipes
        inTable = true;
      }
    } else if (inTable && pipeCount < 2) {
      // End of table
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
    const bFence = before[i] || { fenceChar: 'MISSING', fenceLength: 0 };
    const aFence = after[i] || { fenceChar: 'MISSING', fenceLength: 0 };
    
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
  
  // Compare header columns
  if (before.headerColumns !== after.headerColumns) {
    changes.push(`Table header columns changed: ${before.headerColumns} → ${after.headerColumns}`);
  }
  
  // Compare delimiter columns
  if (before.delimiterColumns !== after.delimiterColumns) {
    changes.push(`Table delimiter columns changed: ${before.delimiterColumns} → ${after.delimiterColumns}`);
  }
  
  // Compare row count
  if (before.rows.length !== after.rows.length) {
    changes.push(`Table row count changed: ${before.rows.length} → ${after.rows.length}`);
  }
  
  // Compare pipe counts per row
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

function renderMismatch(before, after) {
  return [
    "Oxfmt was not idempotent on the second pass.",
    "--- before second pass ---",
    before,
    "--- after second pass ---",
    after,
  ].join("\n");
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
  const firstPassFile = join(
    "fixtures",
    "results",
    name.replace(/\.md$/u, ".first-pass.md"),
  );
  const secondPassFile = join(
    "fixtures",
    "results",
    name.replace(/\.md$/u, ".second-pass.md"),
  );

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
      ...structuralChanges.map(change => `  - ${change}`),
      "",
      "This violates GFM specification and may break document meaning.",
      "Consider using escaped pipes (\\|) in inline code or reviewing fence styles."
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