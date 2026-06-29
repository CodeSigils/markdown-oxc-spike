/*
 * Structural guard helpers for the markdown-oxc-spike harness.
 *
 * These helpers intentionally mirror the production formatter primitives in
 * agents-markdown-formatter so the spike can test the same safety boundary
 * while remaining an evidence/reference repository.
 */

export function splitTableCellsForStyle(line, hasOuterPipes = true) {
  const trimmed = line.trim();
  const cells = [];
  let cell = "";
  let escaped = false;
  let codeSpanTicks = 0;
  let start = 0;
  let end = trimmed.length;

  if (hasOuterPipes && trimmed[start] === "|") start++;
  if (hasOuterPipes && end > start && trimmed[end - 1] === "|" && trimmed[end - 2] !== "\\") end--;

  for (let i = start; i < end; i++) {
    const ch = trimmed[i];

    if (escaped) {
      cell += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      cell += ch;
      escaped = true;
      continue;
    }

    if (ch === "`") {
      let ticks = 1;
      while (i + 1 < end && trimmed[i + 1] === "`") {
        ticks++;
        i++;
      }
      cell += "`".repeat(ticks);
      codeSpanTicks = codeSpanTicks === ticks ? 0 : (codeSpanTicks || ticks);
      continue;
    }

    if (ch === "|" && codeSpanTicks === 0) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }

    cell += ch;
  }

  cells.push(cell.trim());
  return cells;
}

export function splitTableCells(line) {
  return splitTableCellsForStyle(line, true);
}

export function isPotentialTableRow(line) {
  return splitTableCells(line).length > 1;
}

export function isDelimiterLine(line) {
  const cells = splitTableCells(line);
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{1,}:?$/.test(cell.trim()));
}

export function getFenceBoundary(line, currentFence = null) {
  if (!currentFence) {
    const opener = line.match(/^( {0,3})(`{3,}|~{3,})([^\n]*)$/);
    if (!opener) return null;
    return {
      indent: opener[1],
      opener: opener[2],
      length: opener[2].length,
      style: opener[2][0],
      info: opener[3] || "",
    };
  }

  const closerPattern = new RegExp(`^ {0,3}${currentFence.style}{${currentFence.length},}\\s*$`);
  return closerPattern.test(line) ? false : currentFence;
}

function isTableContext(lines, lineIndex) {
  const line = lines[lineIndex];
  if (lineIndex + 1 < lines.length && isDelimiterLine(lines[lineIndex + 1])) {
    return splitTableCells(line).length === splitTableCells(lines[lineIndex + 1]).length;
  }
  if (lineIndex > 1 && isDelimiterLine(lines[lineIndex - 1]) && isPotentialTableRow(lines[lineIndex - 2])) {
    return true;
  }
  return false;
}

export function detectAdjacentPipes(content) {
  const lines = content.split("\n");
  const issues = [];
  let currentFence = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceBoundary = getFenceBoundary(line, currentFence);
    if (fenceBoundary !== null) {
      currentFence = fenceBoundary || null;
      continue;
    }
    if (currentFence) continue;

    if (!line.includes("||")) continue;

    const trimmed = line.trim();
    const pipeCount = (line.match(/\|/g) || []).length;
    const tableLike = trimmed.startsWith("|") ? pipeCount >= 2 : pipeCount >= 3 || isTableContext(lines, i);
    if (!tableLike) continue;

    let escaped = false;
    let codeSpanTicks = 0;
    let adjPos = -1;
    for (let pos = 0; pos < line.length - 1; pos++) {
      const ch = line[pos];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === "\\") {
        escaped = true;
        continue;
      }

      if (ch === "`") {
        let ticks = 1;
        while (pos + 1 < line.length && line[pos + 1] === "`") {
          ticks++;
          pos++;
        }
        codeSpanTicks = codeSpanTicks === ticks ? 0 : (codeSpanTicks || ticks);
        continue;
      }

      if (ch === "|" && line[pos + 1] === "|" && codeSpanTicks === 0) {
        adjPos = pos;
        break;
      }
    }
    if (adjPos === -1) continue;

    issues.push({
      lineIndex: i,
      line,
      context: line.trim(),
      detail:
        trimmed.startsWith("||")
          ? "Leading adjacent pipes (creates empty first cell — valid GFM)"
          : trimmed.endsWith("||")
            ? "Trailing adjacent pipes (creates empty trailing cell — valid GFM)"
            : "Adjacent pipes between columns (creates empty cell — valid GFM)",
    });
  }

  return issues;
}

export function repairAdjacentPipes(content) {
  const issues = detectAdjacentPipes(content);
  if (issues.length === 0) return content;

  const lines = content.split("\n");
  for (const issue of issues) {
    const i = issue.lineIndex;
    let result = "";
    let escaped = false;
    let codeSpanTicks = 0;

    for (let pos = 0; pos < lines[i].length; pos++) {
      const ch = lines[i][pos];
      if (escaped) {
        result += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        result += ch;
        continue;
      }
      if (ch === "`") {
        let ticks = 1;
        while (pos + 1 < lines[i].length && lines[i][pos + 1] === "`") {
          ticks++;
          pos++;
        }
        codeSpanTicks = codeSpanTicks === ticks ? 0 : (codeSpanTicks || ticks);
        result += "`".repeat(ticks);
        continue;
      }
      if (ch === "|" && pos + 1 < lines[i].length && lines[i][pos + 1] === "|" && codeSpanTicks === 0) {
        result += "| |";
        pos++;
        continue;
      }
      result += ch;
    }

    lines[i] = result;
  }
  return lines.join("\n");
}

export function normalizeTableSpacing(content) {
  const lines = content.split("\n");
  let currentFence = null;
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    const fenceBoundary = getFenceBoundary(lines[i], currentFence);
    if (fenceBoundary !== null) {
      currentFence = fenceBoundary || null;
      continue;
    }
    if (currentFence) continue;

    const trimmed = lines[i].trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;

    const cells = splitTableCells(lines[i]);
    if (cells.length <= 1) continue;

    const normalized = "|" + cells.map((cell) => (cell === "" ? " " : ` ${cell} `)).join("|") + "|";
    if (normalized !== lines[i]) {
      lines[i] = normalized;
      modified = true;
    }
  }

  return modified ? lines.join("\n") : content;
}

function tableHasEmptyCells(lines, startIndex) {
  const header = lines[startIndex];
  const delimiter = lines[startIndex + 1];
  const hasOuterPipes = header.trim().startsWith("|") || delimiter.trim().startsWith("|");

  for (let j = startIndex; j < lines.length; j++) {
    if (j > startIndex + 1 && isDelimiterLine(lines[j])) break;
    if (j > startIndex + 1 && !isPotentialTableRow(lines[j]) && !lines[j].includes("|")) break;
    const cells = splitTableCellsForStyle(lines[j], hasOuterPipes);
    if (cells.some((cell) => cell.trim() === "")) return true;
  }

  return false;
}

export function hasTableWithEmptyCells(content) {
  const lines = content.split("\n");
  let currentFence = null;
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    const fenceBoundary = getFenceBoundary(line, currentFence);
    if (fenceBoundary !== null) {
      currentFence = fenceBoundary || null;
      continue;
    }
    if (currentFence) continue;

    if (line.trim().startsWith("|") && splitTableCellsForStyle(line, true).some((cell) => cell.trim() === "")) {
      return true;
    }

    if (!isPotentialTableRow(line) || !isDelimiterLine(lines[i + 1])) continue;
    if (tableHasEmptyCells(lines, i)) return true;
  }
  return false;
}

export function validateTables(content) {
  const errors = [];
  const lines = content.split("\n");
  let currentFence = null;

  for (let i = 0; i < lines.length - 1; i++) {
    const fenceBoundary = getFenceBoundary(lines[i], currentFence);
    if (fenceBoundary !== null) {
      currentFence = fenceBoundary || null;
      continue;
    }
    if (currentFence) continue;

    const header = lines[i];
    const delimiter = lines[i + 1];

    if (!isPotentialTableRow(header) || !isDelimiterLine(delimiter)) continue;

    const headerCols = splitTableCells(header).length;
    const delimiterCols = splitTableCells(delimiter).length;

    if (delimiterCols !== headerCols) {
      errors.push(`Line ${i + 2}: delimiter has ${delimiterCols} cols but header has ${headerCols}`);
    }

    let rowIndex = 1;
    for (let j = i + 2; j < lines.length && isPotentialTableRow(lines[j]); j++) {
      if (isDelimiterLine(lines[j])) break;
      const dataCols = splitTableCells(lines[j]).length;
      if (dataCols !== headerCols) {
        errors.push(`Line ${j + 1}: row ${rowIndex} has ${dataCols} cols but header has ${headerCols}`);
      }
      rowIndex++;
    }
  }

  return errors;
}
