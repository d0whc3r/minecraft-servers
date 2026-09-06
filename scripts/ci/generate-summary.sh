#!/usr/bin/env bash
# Build the GitHub step summary for the end-to-end BATS run (e2e-tests.yml).
# Inputs are passed through the environment:
#   TEST_RESULT    result of the test job: success | failure | cancelled | skipped
#   TOTAL_MODPACKS number of configured modpacks (from generate-test-matrix.sh)
#   JAVA_VERSIONS  unique Java tags required by the matrix
#   MATRIX_JSON    matrix JSON produced by generate-test-matrix.sh
# Writes to $GITHUB_STEP_SUMMARY when set, stdout otherwise.

set -euo pipefail

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  exec > "$GITHUB_STEP_SUMMARY"
fi

echo "## 🧪 End-to-end BATS Results"
echo ""
case "${TEST_RESULT:-unknown}" in
  success) echo "✅ **All tests passed!**" ;;
  failure) echo "❌ **Some tests failed**" ;;
  *) echo "⚠️ **Tests finished with status: ${TEST_RESULT:-unknown}**" ;;
esac

echo ""
echo "### 📊 Execution Statistics"
echo "- **Total modpacks:** ${TOTAL_MODPACKS:-0}"
echo "- **Required Java versions:** ${JAVA_VERSIONS:-n/a}"

if [[ -n "${MATRIX_JSON:-}" ]] && command -v jq > /dev/null 2>&1; then
  echo ""
  echo "### 📋 Test Matrix"
  jq -r '.include[] | "- Chunk \(.chunk): \(.modpacks) (\(.count) modpack(s), java: \(.java_versions))"' \
    <<< "$MATRIX_JSON"
fi

# List uploaded artifacts, if the summary job downloaded them
if [[ -d "test-artifacts" ]] && [[ -n "$(ls -A test-artifacts 2> /dev/null)" ]]; then
  echo ""
  echo "### 📁 Test Artifacts"
  find test-artifacts -type f | head -10 | while read -r file; do
    echo "- \`$file\`"
  done
  total_files=$(find test-artifacts -type f | wc -l)
  if [[ "$total_files" -gt 10 ]]; then
    echo "- ... and $((total_files - 10)) more files"
  fi
fi
