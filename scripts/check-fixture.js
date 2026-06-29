#!/usr/bin/env node
/*
 * Oxfmt fixture harness with production-style structural guards.
 *
 * Clean fixtures (`fixtures/source/`) are formatted with oxfmt and checked for
 * idempotence. Pipe-safety fixtures are repaired and normalized, then skip
 * oxfmt when empty cells remain because oxfmt 0.56.0 corrupts that shape.
 */

import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

import {
  detectAdjacentPipes,
  getFenceBoundary,
  hasTableWithEmptyCells,
  normalizeTableSpacing,
  repairAdjacentPipes,
  validateTables,
} from "./guard/oxfmt-guard.js";

const FIXTURES_DIR = resolve("fixtures");
const WORK_DIR = join(FIXTURES_DIR, "work");
const RESULTS_DIR = join(FIXTURES_DIR, "results");
const OXFMT_BIN = process.platform === "win32" ? "oxfmt.cmd" : "oxfmt";

function runOxfmt(args) {
  const result = spawnSync(OXFMT_BIN, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    throw new Error([`oxfmt ${args.join(" ")} failed`, result.stdout, result.stderr].filter(Boolean).join("\n"));
  }

  return result;
}

function fixtureRelativePath(fixturePath) {
  return relative(FIXTURES_DIR, fixturePath);
}

function outputPaths(fixturePath) {
  const rel = fixtureRelativePath(fixturePath);
  return {
    rel,
    workPath: join(WORK_DIR, rel),
    resultPath: join(RESULTS_DIR, rel.replace(/\.(md|markdown|mdx)$/u, ".first-pass.$1")),
  };
}

function extractFenceInfo(content) {
  const lines = content.split("\n");
  const fences = [];
  let currentFence = null;

  for (let i = 0; i < lines.length; i++) {
    const boundary = getFenceBoundary(lines[i], currentFence);
    if (boundary === null) continue;

    if (!currentFence && boundary) {
      currentFence = { ...boundary, startLine: i };
      continue;
    }

    if (currentFence && boundary === false) {
      fences.push({
        ...currentFence,
        endLine: i,
        content: lines.slice(currentFence.startLine + 1, i).join("\n"),
      });
      currentFence = null;
    }
  }

  return { fences, unclosed: currentFence };
}

function validateFences(content) {
  const lines = content.split("\n");
  const errors = [];
  const warnings = [];
  let currentFence = null;

  for (let i = 0; i < lines.length; i++) {
    const boundary = getFenceBoundary(lines[i], currentFence);
    if (boundary === null) continue;

    if (!currentFence && boundary) {
      if (/^\s+/.test(boundary.info)) {
        errors.push(`Line ${i + 1}: fence info string starts with whitespace`);
      }
      if (boundary.style === "`" && boundary.info.includes("`")) {
        errors.push(`Line ${i + 1}: backtick fence info string contains backtick`);
      }
      if (boundary.info.trim() === "" && boundary.info.length > 0) {
        errors.push(`Line ${i + 1}: fence info string is whitespace-only`);
      }
      if (boundary.info === "") {
        warnings.push(`Line ${i + 1}: language-less fence`);
      }
      currentFence = { ...boundary, startLine: i };
      continue;
    }

    if (currentFence && boundary === false) {
      currentFence = null;
    }
  }

  if (currentFence) {
    errors.push(`Line ${currentFence.startLine + 1}: unclosed ${currentFence.style.repeat(currentFence.length)} fence`);
  }

  return { errors, warnings };
}

async function applyGuardedFormatting(filePath) {
  const original = await readFile(filePath, "utf8");
  const formatterUnsafeTableErrors = validateTables(original).filter((error) => error.includes("inline code span contains unescaped pipe"));
  if (formatterUnsafeTableErrors.length > 0) {
    throw new Error(`inline-code table pipe would corrupt oxfmt output:\n${formatterUnsafeTableErrors.join("\n")}`);
  }

  const pipeIssues = detectAdjacentPipes(original);
  const afterPipeRepair = repairAdjacentPipes(original);
  const afterSpacing = normalizeTableSpacing(afterPipeRepair);
  const emptyCellTable = hasTableWithEmptyCells(afterSpacing);

  await writeFile(filePath, afterSpacing);

  if (!emptyCellTable) {
    runOxfmt(["--write", filePath]);
  }

  return {
    pipeIssueCount: pipeIssues.length,
    normalized: afterSpacing !== afterPipeRepair,
    skippedOxfmt: emptyCellTable,
    content: await readFile(filePath, "utf8"),
  };
}

function compareFenceInfo(beforeContent, afterContent) {
  const before = extractFenceInfo(beforeContent);
  const after = extractFenceInfo(afterContent);
  const changes = [];

  if (before.fences.length !== after.fences.length) {
    changes.push(`Fence count changed: ${before.fences.length} → ${after.fences.length}`);
  }

  for (let i = 0; i < Math.max(before.fences.length, after.fences.length); i++) {
    const b = before.fences[i];
    const a = after.fences[i];
    if (!b || !a) continue;
    if (b.style !== a.style) changes.push(`Fence ${i + 1} style changed: ${b.style} → ${a.style}`);
    if (b.length !== a.length) changes.push(`Fence ${i + 1} length changed: ${b.length} → ${a.length}`);
  }

  return changes;
}

async function runRepair(fixturePath) {
  const { workPath, resultPath } = outputPaths(fixturePath);
  await mkdir(dirname(workPath), { recursive: true });
  await mkdir(dirname(resultPath), { recursive: true });

  const source = await readFile(fixturePath, "utf8");
  await writeFile(workPath, source);

  const first = await applyGuardedFormatting(workPath);
  await writeFile(resultPath, first.content);

  const secondPassPath = join(WORK_DIR, "second-pass", fixtureRelativePath(fixturePath));
  await mkdir(dirname(secondPassPath), { recursive: true });
  await copyFile(workPath, secondPassPath);
  const second = await applyGuardedFormatting(secondPassPath);

  if (first.content !== second.content) {
    throw new Error(`Guarded formatter was not idempotent on second pass:\n--- first ---\n${first.content}\n--- second ---\n${second.content}`);
  }

  const fenceChanges = compareFenceInfo(source, first.content);
  if (fenceChanges.length > 0) {
    console.log("  Fence changes:");
    for (const change of fenceChanges) console.log(`    - ${change}`);
  }
  if (first.pipeIssueCount > 0) console.log(`  Repaired ${first.pipeIssueCount} adjacent pipe issue(s)`);
  if (first.normalized) console.log("  Normalized table spacing");
  if (first.skippedOxfmt) console.log("  Skipped oxfmt: table has empty cells after repair");

  console.log(`  ✓ ${basename(fixturePath)} — repair + format + idempotence OK`);
  return true;
}

async function runCheck(fixturePath) {
  const source = await readFile(fixturePath, "utf8");
  const pipeIssues = detectAdjacentPipes(source);
  if (pipeIssues.length > 0) {
    console.error(`  ✗ ${basename(fixturePath)} — adjacent pipes (||) would corrupt oxfmt output:`);
    for (const issue of pipeIssues) {
      console.error(`    Line ${issue.lineIndex + 1}: ${issue.detail}`);
      console.error(`      ${issue.context}`);
    }
    return false;
  }

  if (hasTableWithEmptyCells(source)) {
    console.error(`  ✗ ${basename(fixturePath)} — table with empty cells detected; oxfmt cannot safely format it`);
    return false;
  }

  const formatterUnsafeTableErrors = validateTables(source).filter((error) => error.includes("inline code span contains unescaped pipe"));
  if (formatterUnsafeTableErrors.length > 0) {
    console.error(`  ✗ ${basename(fixturePath)} — inline-code table pipe would corrupt oxfmt output:`);
    for (const error of formatterUnsafeTableErrors) console.error(`    ${error}`);
    return false;
  }

  try {
    runOxfmt(["--check", fixturePath]);
  } catch (err) {
    console.error(`  ✗ ${basename(fixturePath)} — oxfmt --check failed: ${err.message}`);
    return false;
  }

  console.log(`  ✓ ${basename(fixturePath)} — check passed`);
  return true;
}

async function runDryRun(fixturePath) {
  const source = await readFile(fixturePath, "utf8");
  const pipeIssues = detectAdjacentPipes(source);
  if (pipeIssues.length > 0) console.log(`  ${basename(fixturePath)} — would repair ${pipeIssues.length} adjacent pipe issue(s)`);

  const afterRepairs = normalizeTableSpacing(repairAdjacentPipes(source));
  if (afterRepairs !== source) console.log(`  ${basename(fixturePath)} — would normalize/repair table text`);
  if (hasTableWithEmptyCells(afterRepairs)) console.log(`  ${basename(fixturePath)} — would skip oxfmt because empty cells remain`);
  else {
    try {
      runOxfmt(["--check", fixturePath]);
      console.log(`  ${basename(fixturePath)} — oxfmt --check clean`);
    } catch {
      console.log(`  ${basename(fixturePath)} — would be formatted by oxfmt`);
    }
  }
  return true;
}

async function runValidate(fixturePath) {
  const source = await readFile(fixturePath, "utf8");
  let ok = true;

  const pipeIssues = detectAdjacentPipes(source);
  if (pipeIssues.length > 0) {
    console.error(`  ✗ ${basename(fixturePath)} — adjacent pipes (||):`);
    for (const issue of pipeIssues) console.error(`    Line ${issue.lineIndex + 1}: ${issue.detail}`);
    ok = false;
  }

  for (const error of validateTables(source)) {
    console.error(`  ✗ ${basename(fixturePath)} — ${error}`);
    ok = false;
  }

  const fenceResult = validateFences(source);
  for (const error of fenceResult.errors) {
    console.error(`  ✗ ${basename(fixturePath)} — ${error}`);
    ok = false;
  }
  for (const warning of fenceResult.warnings) {
    console.warn(`  ⚠ ${basename(fixturePath)} — ${warning}`);
  }

  if (ok) console.log(`  ✓ ${basename(fixturePath)} — validate passed`);
  return ok;
}

async function runFences(fixturePath) {
  const source = await readFile(fixturePath, "utf8");
  const fenceResult = validateFences(source);
  for (const error of fenceResult.errors) console.error(`  ✗ ${basename(fixturePath)} — ${error}`);
  for (const warning of fenceResult.warnings) console.warn(`  ⚠ ${basename(fixturePath)} — ${warning}`);
  const { fences } = extractFenceInfo(source);
  if (fenceResult.errors.length === 0) console.log(`  ✓ ${basename(fixturePath)} — fences validated (${fences.length} fence(s))`);
  return fenceResult.errors.length === 0;
}

function printHelp() {
  console.log(`
Usage: node scripts/check-fixture.js <fixture-path> [mode]

Modes:
  --repair    Repair pipes, normalize tables, run oxfmt when safe (default)
  --check     Read-only: block on hazards, run oxfmt --check
  --dry-run   Read-only: preview repair/format actions
  --validate  Structural validation (fences, tables, pipes)
  --fences    Validate fenced code blocks only
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const fixturePath = resolve(args[0]);
  const mode = args[1] || "--repair";
  if (!fixturePath.startsWith(FIXTURES_DIR)) {
    console.error(`Error: Fixture must be under ${FIXTURES_DIR}/`);
    process.exit(1);
  }

  try {
    let ok;
    switch (mode) {
      case "--repair": ok = await runRepair(fixturePath); break;
      case "--check": ok = await runCheck(fixturePath); break;
      case "--dry-run": ok = await runDryRun(fixturePath); break;
      case "--validate": ok = await runValidate(fixturePath); break;
      case "--fences": ok = await runFences(fixturePath); break;
      default:
        console.error(`Unknown mode: ${mode}`);
        process.exit(1);
    }
    process.exit(ok ? 0 : 1);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
