import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const fixtures = [
  "fixtures/source/html-comment-after-list.md",
  "fixtures/source/table-escaped-pipes.md",
  "fixtures/source/table-semantic-alignment.md",
  "fixtures/source/double-pipe-table.md",
  "fixtures/source/fence-blank.md",
  "fixtures/source/fence-nested.md",
  "fixtures/source/fence-language-tags.md",
  "fixtures/source/safe-formatting-basics.md",
  "fixtures/source/markdown-in-js-template.md",
  "fixtures/source/task-lists.md",
];

for (const fixture of fixtures) {
  test(`check-fixture verifies Oxfmt idempotence for ${fixture}`, async () => {
    rmSync("fixtures/work", { recursive: true, force: true });
    rmSync("fixtures/results", { recursive: true, force: true });

    const result = spawnSync(process.execPath, ["scripts/check-fixture.js", fixture], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /idempotent/i);

    const name = basename(fixture);
    const workFile = `fixtures/work/${name}`;
    const resultFile = `fixtures/results/${name.replace(/\.md$/u, ".first-pass.md")}`;

    assert.equal(existsSync(workFile), true);
    assert.equal(existsSync(resultFile), true);

    const work = await readFile(workFile, "utf8");
    const firstPass = await readFile(resultFile, "utf8");

    assert.equal(work, firstPass);
  });
}
