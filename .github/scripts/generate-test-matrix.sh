#!/usr/bin/env bash
# Build the GitHub Actions test matrix from the modpacks in config/modpacks.
#
# Prints three KEY=VALUE lines to stdout; workflows redirect them into
# $GITHUB_OUTPUT:
#   matrix=<json>            fromJSON-able {"include":[{chunk,modpacks,pattern,count}, ...]}
#   total-modpacks=<n>
#   java-versions=<list>     space-separated unique image tags across all chunks
#
# All progress/diagnostics go to stderr so stdout stays clean for $GITHUB_OUTPUT.
#
# Env:
#   CHUNK_STRATEGY    small|medium|large  (default medium) -> 1|2|3 modpacks per chunk
#   SELECTED_MODPACKS space-separated names to test, or the "__ALL__" sentinel for
#                     every modpack. UNSET (local/manual runs) defaults to __ALL__;
#                     an explicitly EMPTY value means "nothing to test". Names not
#                     present in config/modpacks are dropped, so a stale/deleted
#                     selection can't break the matrix. When the resulting set is
#                     empty the matrix is "{\"include\":[]}" and has-tests=false,
#                     signalling the caller to skip the test job.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Chunk size from CHUNK_STRATEGY: smaller chunks = more, faster jobs.
CHUNK_STRATEGY="${CHUNK_STRATEGY:-medium}"
case "$CHUNK_STRATEGY" in
  small) CHUNK_SIZE=1 ;;
  medium) CHUNK_SIZE=2 ;;
  large) CHUNK_SIZE=3 ;;
  *)
    echo "Unknown CHUNK_STRATEGY '$CHUNK_STRATEGY', defaulting to medium (2)" >&2
    CHUNK_SIZE=2
    ;;
esac
echo "Chunk strategy: $CHUNK_STRATEGY -> chunk size: $CHUNK_SIZE" >&2

# All modpack names, sorted (names contain no spaces/globs, so word-splitting is safe).
ALL_MODPACKS=($("$SCRIPT_DIR/list-modpacks.sh"))
echo "Available modpacks: ${ALL_MODPACKS[*]:-(none)}" >&2

# Narrow to the requested selection. The no-colon default makes an UNSET var
# (local/manual runs) mean "every modpack", while an explicitly EMPTY value (CI
# found no relevant change) means "nothing to test". Word-splitting absorbs any
# stray spaces/newlines from the caller (e.g. a trailing space from `tr`).
read -ra REQUESTED <<< "${SELECTED_MODPACKS-__ALL__}"

if [ ${#REQUESTED[@]} -eq 0 ]; then
  MODPACK_ARRAY=()
  echo "Selection: none (no relevant change)" >&2
elif printf '%s\n' "${REQUESTED[@]}" | grep -qx '__ALL__'; then
  MODPACK_ARRAY=("${ALL_MODPACKS[@]}")
  echo "Selection: all modpacks" >&2
else
  MODPACK_ARRAY=()
  for name in "${REQUESTED[@]}"; do
    for existing in "${ALL_MODPACKS[@]}"; do
      if [ "$name" = "$existing" ]; then
        MODPACK_ARRAY+=("$name")
        break
      fi
    done
  done
  echo "Selection: changed modpacks -> ${MODPACK_ARRAY[*]:-(none)}" >&2
fi

TOTAL_MODPACKS=${#MODPACK_ARRAY[@]}
echo "Testing $TOTAL_MODPACKS modpack(s): ${MODPACK_ARRAY[*]:-(none)}" >&2

MATRIX_JSON='{"include":['
ALL_JAVA_VERSIONS=""
CHUNK_INDEX=0
i=0
while [ "$i" -lt "$TOTAL_MODPACKS" ]; do
  CHUNK_MODPACKS=("${MODPACK_ARRAY[@]:i:CHUNK_SIZE}")
  CHUNK_COUNT=${#CHUNK_MODPACKS[@]}
  echo "Chunk $CHUNK_INDEX: ${CHUNK_MODPACKS[*]} (count: $CHUNK_COUNT)" >&2

  MODPACK_LIST=$(
    IFS=,
    echo "${CHUNK_MODPACKS[*]}"
  )
  MODPACK_PATTERN=$(
    IFS='|'
    echo "${CHUNK_MODPACKS[*]}"
  )

  # Accumulate the unique set of Java image tags needed across all chunks.
  CHUNK_JAVA_VERSIONS=$("$PROJECT_ROOT/scripts/analyze-java-versions.sh" "${CHUNK_MODPACKS[@]}")
  echo "Chunk $CHUNK_INDEX Java versions: $CHUNK_JAVA_VERSIONS" >&2
  for version in $CHUNK_JAVA_VERSIONS; do
    if [[ "$ALL_JAVA_VERSIONS" != *"$version"* ]]; then
      ALL_JAVA_VERSIONS="${ALL_JAVA_VERSIONS:+$ALL_JAVA_VERSIONS }$version"
    fi
  done

  # Escape backslashes and quotes for safe embedding in JSON.
  MODPACK_LIST=$(echo "$MODPACK_LIST" | sed 's/\\/\\\\/g; s/"/\\"/g')
  MODPACK_PATTERN=$(echo "$MODPACK_PATTERN" | sed 's/\\/\\\\/g; s/"/\\"/g')

  MATRIX_JSON="${MATRIX_JSON}{\"chunk\":$CHUNK_INDEX,\"modpacks\":\"$MODPACK_LIST\",\"pattern\":\"$MODPACK_PATTERN\",\"count\":$CHUNK_COUNT},"

  i=$((i + CHUNK_SIZE))
  CHUNK_INDEX=$((CHUNK_INDEX + 1))
done

# Remove trailing comma and close the JSON array/object.
MATRIX_JSON="${MATRIX_JSON%,}]}"
echo "Generated matrix: $MATRIX_JSON" >&2

# Validate JSON when jq is available.
if command -v jq > /dev/null 2>&1; then
  echo "$MATRIX_JSON" | jq . > /dev/null || {
    echo "Invalid JSON generated" >&2
    exit 1
  }
fi

# has-tests lets the workflow gate prepare-images/test off when nothing changed.
HAS_TESTS=true
[ "$TOTAL_MODPACKS" -eq 0 ] && HAS_TESTS=false

echo "matrix=$MATRIX_JSON"
echo "total-modpacks=$TOTAL_MODPACKS"
echo "java-versions=$ALL_JAVA_VERSIONS"
echo "has-tests=$HAS_TESTS"
