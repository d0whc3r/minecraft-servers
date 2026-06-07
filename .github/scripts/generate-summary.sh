#!/usr/bin/env bash
# Render the BATS Test Suite run summary as Markdown to stdout. The workflow
# redirects it into $GITHUB_STEP_SUMMARY:
#
#   - name: Generate summary report
#     env: { TEST_RESULT: ..., TOTAL_MODPACKS: ..., MATRIX_JSON: ..., ... }
#     run: ./.github/scripts/generate-summary.sh >> "$GITHUB_STEP_SUMMARY"
#
# All inputs are env vars (optional, with sensible fallbacks); versions are read
# from the repo so the summary never drifts from the real config.
#
# Env:
#   TEST_RESULT     test job result (success|failure|...)   default: unknown
#   TOTAL_MODPACKS  number of modpacks tested               default: ?
#   JAVA_VERSIONS   space-separated Java image tags          default: (empty)
#   MATRIX_JSON     the generated matrix JSON                default: (empty)
#   DOCKER_VERSION  docker version used                      default: 28.5.2
#   CHUNK_STRATEGY  small|medium|large                       default: medium
#   MAX_PARALLEL    max concurrent test jobs                 default: 2
#   ARTIFACTS_DIR   downloaded-artifacts directory           default: test-artifacts
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TEST_RESULT="${TEST_RESULT:-unknown}"
TOTAL_MODPACKS="${TOTAL_MODPACKS:-?}"
JAVA_VERSIONS="${JAVA_VERSIONS:-}"
MATRIX_JSON="${MATRIX_JSON:-}"
DOCKER_VERSION="${DOCKER_VERSION:-28.5.2}"
CHUNK_STRATEGY="${CHUNK_STRATEGY:-medium}"
MAX_PARALLEL="${MAX_PARALLEL:-2}"
ARTIFACTS_DIR="${ARTIFACTS_DIR:-test-artifacts}"

# Versions sourced from the repo so the summary never drifts from reality.
NODE_VERSION=$(cat "$PROJECT_ROOT/.nvmrc" 2> /dev/null || echo "unknown")
PNPM_VERSION=$(grep -oE 'pnpm@[0-9.]+' "$PROJECT_ROOT/package.json" 2> /dev/null | cut -d@ -f2 || echo "unknown")
BATS_VERSION=$(grep -oE '"bats": *"[^"]*"' "$PROJECT_ROOT/package.json" 2> /dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")

# Actual max modpacks per job, read from the generated matrix (reflects CHUNK_STRATEGY).
CHUNK_SIZE="?"
if [ -n "$MATRIX_JSON" ] && command -v jq > /dev/null 2>&1; then
  CHUNK_SIZE=$(echo "$MATRIX_JSON" | jq -r '([.include[].count] | max) // "?"' 2> /dev/null || echo "?")
fi

echo "## 🧪 BATS Test Suite Results"
echo ""

case "$TEST_RESULT" in
  success) echo "✅ **All tests passed!**" ;;
  failure) echo "❌ **Some tests failed**" ;;
  *) echo "⚠️ **Tests completed with issues**" ;;
esac

echo ""
echo "### 📊 Execution Statistics"
echo "- **Total Modpacks:** $TOTAL_MODPACKS"
echo "- **Parallel Jobs:** Max $MAX_PARALLEL concurrent jobs"
echo "- **Chunk Strategy:** $CHUNK_STRATEGY (up to $CHUNK_SIZE modpacks per job)"
echo "- **Required Java Versions:** $JAVA_VERSIONS"
echo "- **Test Duration:** Check individual job timings"

echo ""
echo "### ⚡ Performance Optimizations"
echo "- ✅ Parallel test execution: max $MAX_PARALLEL concurrent jobs for GitHub free runners"
echo "- ✅ Smart Docker image caching (only required Java versions: $JAVA_VERSIONS)"
echo "- ✅ Pre-download images in dedicated job to avoid duplication"
echo "- ✅ Server data caching for faster test startup"
echo "- ✅ pnpm dependencies caching with node_modules"
echo "- ✅ Docker temporary files caching"
echo "- ✅ Test artifacts and logs caching"
echo "- ✅ Network and volume cleanup between tests"
echo "- ✅ Reusable GitHub Actions for maintainability"
echo "- ✅ Configurable chunking: $CHUNK_STRATEGY strategy ($CHUNK_SIZE modpacks per job)"

echo ""
echo "### 🔧 Technical Details"
echo "- **Docker Version:** $DOCKER_VERSION"
echo "- **Node.js Version:** $NODE_VERSION (from .nvmrc)"
echo "- **pnpm Version:** $PNPM_VERSION (from packageManager)"
echo "- **BATS Version:** $BATS_VERSION (from package.json devDependencies)"

echo ""
echo "### 📋 Test Matrix"
if [ -n "$MATRIX_JSON" ]; then
  if command -v jq > /dev/null 2>&1; then
    echo "$MATRIX_JSON" | jq -r '.include[] | "- Chunk \(.chunk): \(.modpacks) (\(.count) modpacks)"'
  else
    echo "Matrix data available (jq not installed for formatting)"
  fi
fi

# List downloaded artifacts, if any (here-string + break avoids SIGPIPE under pipefail).
if [ -d "$ARTIFACTS_DIR" ] && [ -n "$(ls -A "$ARTIFACTS_DIR" 2> /dev/null)" ]; then
  artifact_files=$(find "$ARTIFACTS_DIR" -type f)
  total=$(printf '%s\n' "$artifact_files" | grep -c . || true)
  if [ "$total" -gt 0 ]; then
    echo ""
    echo "### 📁 Test Artifacts"
    shown=0
    while IFS= read -r file; do
      [ -z "$file" ] && continue
      shown=$((shown + 1))
      [ "$shown" -gt 10 ] && break
      echo "- \`$file\`"
    done <<< "$artifact_files"
    if [ "$total" -gt 10 ]; then
      echo "- ... and $((total - 10)) more files"
    fi
  fi
fi
