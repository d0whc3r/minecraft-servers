#!/usr/bin/env bash
# Generate the GitHub Actions matrix for the end-to-end BATS suite.
# Groups the modpack configs into chunks of CHUNK_SIZE modpacks per runner
# (default 2, to avoid per-job timeouts) and annotates each chunk with the
# Docker image tags (Java versions) its modpacks need, using
# scripts/analyze-java-versions.sh.
#
# Outputs (appended to $GITHUB_OUTPUT when set, stdout otherwise):
#   matrix=<json>        [{chunk, modpacks, pattern, count, java_versions}, ...]
#   total-modpacks=<n>
#   java-versions=<list> unique Java tags across all chunks

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

CHUNK_SIZE="${CHUNK_SIZE:-2}"

command -v jq > /dev/null 2>&1 || {
  echo "jq is required" >&2
  exit 1
}

cd "$PROJECT_ROOT"
mapfile -t modpacks < <(find config/modpacks -name '*.env' -type f -exec basename {} .env \; | sort)
total=${#modpacks[@]}
if [[ "$total" -eq 0 ]]; then
  echo "No modpack configs found in config/modpacks" >&2
  exit 1
fi

matrix='[]'
all_java_versions=''
for ((i = 0; i < total; i += CHUNK_SIZE)); do
  chunk=("${modpacks[@]:i:CHUNK_SIZE}")
  chunk_list=$(
    IFS=,
    echo "${chunk[*]}"
  )
  chunk_pattern=$(
    IFS='|'
    echo "${chunk[*]}"
  )
  java_versions=$(bash "$SCRIPT_DIR/../analyze-java-versions.sh" "${chunk[@]}")

  for version in $java_versions; do
    if [[ "$all_java_versions" != *"$version"* ]]; then
      all_java_versions="${all_java_versions:+$all_java_versions }$version"
    fi
  done

  matrix=$(jq -c \
    --argjson chunk "$((i / CHUNK_SIZE))" \
    --arg modpacks "$chunk_list" \
    --arg pattern "$chunk_pattern" \
    --argjson count "${#chunk[@]}" \
    --arg java_versions "$java_versions" \
    '. + [{chunk: $chunk, modpacks: $modpacks, pattern: $pattern, count: $count, java_versions: $java_versions}]' \
    <<< "$matrix")
done

echo "Generated matrix: $matrix" >&2
echo "Unique Java versions: $all_java_versions" >&2

write_output() {
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "$1" >> "$GITHUB_OUTPUT"
  else
    echo "$1"
  fi
}

write_output "matrix=$matrix"
write_output "total-modpacks=$total"
write_output "java-versions=$all_java_versions"
