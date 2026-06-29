import assert from "node:assert/strict";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

function markdownFiles(dir) {
  return readdirSync(dir)
    .filter((name) => /\.(md|markdown|mdx)$/u.test(name))
    .sort()
    .map((name) => join(dir, name));
}

const cleanFixtures = [
  ...markdownFiles("fixtures/source"),
  ...markdownFiles("fixtures/current"),
];
const pipeSafetyFixtures = markdownFiles("fixtures/pipe-safety");
const violationFixtures = markdownFiles("fixtures/violations");

function runFixture(fixture, mode) {
  const args = ["scripts/check-fixture.js", fixture];
  if (mode) args.push(mode);
  return spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function resultFileFor(fixture) {
  const rel = fixture.replace(/^fixtures\//u, "");
  return `fixtures/results/${rel.replace(/\.(md|markdown|mdx)$/u, ".first-pass.$1")}`;
}

for (const fixture of cleanFixtures) {
  test(`clean fixture is guarded-format idempotent: ${fixture}`, async () => {
    rmSync("fixtures/work", { recursive: true, force: true });
    rmSync("fixtures/results", { recursive: true, force: true });

    const result = runFixture(fixture);

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /idempotence OK/i);

    const workFile = `fixtures/work/${fixture.replace(/^fixtures\//u, "")}`;
    const resultFile = resultFileFor(fixture);

    assert.equal(existsSync(workFile), true);
    assert.equal(existsSync(resultFile), true);

    const work = await readFile(workFile, "utf8");
    const firstPass = await readFile(resultFile, "utf8");
    assert.equal(work, firstPass);
  });

  test(`clean fixture validates structurally: ${fixture}`, () => {
    const result = runFixture(fixture, "--validate");
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /validate passed/i);
  });
}

for (const fixture of pipeSafetyFixtures) {
  test(`pipe-safety fixture is repaired and skips unsafe oxfmt: ${fixture}`, async () => {
    rmSync("fixtures/work", { recursive: true, force: true });
    rmSync("fixtures/results", { recursive: true, force: true });

    const result = runFixture(fixture, "--repair");

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Repaired .* adjacent pipe issue/i);
    assert.match(result.stdout, /Skipped oxfmt: table has empty cells/i);

    const output = await readFile(resultFileFor(fixture), "utf8");
    assert.match(output, /\| \| Name \| Age \|/u);
    assert.doesNotMatch(output, /\| \| Name {2}\| Age \|\n\| \| -----/u, "result should be normalized, not raw source");
  });

  test(`pipe-safety fixture blocks read-only check: ${fixture}`, () => {
    const result = runFixture(fixture, "--check");
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /adjacent pipes/i);
  });

  test(`pipe-safety fixture blocks structural validate for formatter safety: ${fixture}`, () => {
    const result = runFixture(fixture, "--validate");
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /adjacent pipes/i);
  });
}

for (const fixture of violationFixtures) {
  test(`violation fixture fails validation: ${fixture}`, () => {
    const result = runFixture(fixture, "--validate");
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
  });
}

test("fence-only mode catches fence violations", () => {
  const result = runFixture("fixtures/violations/fence-mismatch.md", "--fences");
  assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /unclosed|starts with whitespace|backtick fence/u);
});

test("fence-only mode counts nested fences without body-line inflation", () => {
  const result = runFixture("fixtures/source/fence-nested.md", "--fences");
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /fences validated \(3 fence\(s\)\)/i);
});
