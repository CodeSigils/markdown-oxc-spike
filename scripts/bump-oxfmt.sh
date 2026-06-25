#!/usr/bin/env bash
set -euo pipefail

# bump-oxfmt.sh — verify a new oxfmt version against the spike fixture suite
#
# Usage:
#   bash scripts/bump-oxfmt.sh <version>   # test a specific version
#   bash scripts/bump-oxfmt.sh latest       # resolve and test latest available
#
# Exits 0 on full pass, 1 on any failure.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_DIR"

# ---------------------------------------------------------------------------
# Helpers
# NOTE: avoid post-increment (count++) in arithmetic expressions under set -e.
# ((count++)) evaluates to 0 when count is 0, which triggers errexit.
# Use prefix increment or explicit assignment instead.
# ---------------------------------------------------------------------------
setup_colors() {
  if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    BOLD='\033[1m'
    RESET='\033[0m'
  fi
}

RED=
GREEN=
BOLD=
RESET=
setup_colors

pass_count=0
fail_count=0

pass() {
  echo -e "  ${GREEN}✓${RESET} $1"
  pass_count=$((pass_count + 1))
}

fail() {
  echo -e "  ${RED}✗${RESET} $1"
  fail_count=$((fail_count + 1))
}

check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    pass "$label"
  else
    local msg="$*"
    fail "$label"
    echo "      command: $msg"
    # Re-run with stderr visible for diagnostics
    "$@" 2>&1 | sed 's/^/      | /' || true
  fi
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/bump-oxfmt.sh <version | latest>"
  exit 2
fi

REQUESTED="$1"

# ---------------------------------------------------------------------------
# Resolve target version
# ---------------------------------------------------------------------------
echo "=== Resolving oxfmt version ==="

if [ "$REQUESTED" = "latest" ]; then
  TARGET="$(npm view oxfmt version 2>/dev/null)"
  if [ -z "$TARGET" ]; then
    fail "could not resolve latest oxfmt version from npm"
    exit 1
  fi
  echo "  latest available: $TARGET"
else
  TARGET="$REQUESTED"
  # Check npm registry has this version
  AVAILABLE="$(npm view oxfmt versions --json 2>/dev/null \
    | tr -d '[],"' \
    | tr ' ' '\n' \
    | grep -c "^${TARGET}$" || true)"
  if [ "$AVAILABLE" -eq 0 ]; then
    fail "oxfmt version ${TARGET} not found in npm registry"
    exit 1
  fi
  echo "  requested: $TARGET (confirmed on npm)"
fi

# ---------------------------------------------------------------------------
# Update package.json
# ---------------------------------------------------------------------------
echo ""
echo "=== Updating package.json ==="

node -e "
const p = require('./package.json');
p.devDependencies.oxfmt = '$TARGET';
require('fs').writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
"
pass "package.json pin set to $TARGET"

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------
echo ""
echo "=== Installing dependencies ==="
npm install --silent 2>&1 | tail -2 || true
check "npm install" npm install --silent

# ---------------------------------------------------------------------------
# Verify installed binary version
# ---------------------------------------------------------------------------
echo ""
echo "=== Verifying oxfmt binary ==="

INSTALLED="$(node_modules/.bin/oxfmt --version 2>&1 \
  | head -1 \
  | sed 's/^[^0-9]*//')"
if [ "$INSTALLED" = "$TARGET" ]; then
  pass "oxfmt binary version matches $TARGET"
else
  fail "oxfmt binary version is $INSTALLED (expected $TARGET)"
fi

# ---------------------------------------------------------------------------
# Run test suite
# ---------------------------------------------------------------------------
echo ""
echo "=== Running fixture tests ==="
check "npm test" npm test

# ---------------------------------------------------------------------------
# Formatting checks
# ---------------------------------------------------------------------------
echo ""
echo "=== Running formatting checks ==="
check "fmt:check (source fixtures)" npm run fmt:check
check "fmt:check:docs (documentation)" npm run fmt:check:docs

# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------
echo ""
echo "=== Running dependency audit ==="
check "npm audit" npm run audit

# ---------------------------------------------------------------------------
# Show what changed
# ---------------------------------------------------------------------------
echo ""
echo "=== Changes ==="
git diff --stat -- package.json package-lock.json || true

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo -e "  ${BOLD}Results${RESET}"
echo -e "  Passed: ${GREEN}${pass_count}${RESET}   Failed: ${RED}${fail_count}${RESET}"
echo "========================================"

if [ "$fail_count" -gt 0 ]; then
  echo ""
  echo "oxfmt $TARGET: SOME CHECKS FAILED"
  exit 1
else
  echo ""
  echo "oxfmt $TARGET: ALL CHECKS PASSED"
fi
