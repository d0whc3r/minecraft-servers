#!/usr/bin/env bash
# Select the modpacks an E2E chunk will test. The pattern is an extended
# regex matched against the config file paths; empty or '.*' selects every
# modpack. Publishes:
#   $GITHUB_OUTPUT: modpacks=<space-separated list> count=<n>
#   $GITHUB_ENV:    TEST_MODPACKS=<space-separated list>
#                   (consumed by tests/bats/server-startup.bats)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

pattern="${1:-.*}"

cd "$PROJECT_ROOT"
if [[ -n "$pattern" && "$pattern" != ".*" ]]; then
  modpacks=$(find config/modpacks -name '*.env' -type f | grep -E "$pattern" | sed 's|config/modpacks/||;s|\.env$||' | tr '\n' ' ')
else
  modpacks=$(find config/modpacks -name '*.env' -type f | sed 's|config/modpacks/||;s|\.env$||' | tr '\n' ' ')
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "modpacks=$modpacks" >> "$GITHUB_OUTPUT"
  echo "count=$(echo "$modpacks" | wc -w)" >> "$GITHUB_OUTPUT"
else
  echo "modpacks=$modpacks"
  echo "count=$(echo "$modpacks" | wc -w)"
fi

if [[ -n "${GITHUB_ENV:-}" ]]; then
  echo "TEST_MODPACKS=$modpacks" >> "$GITHUB_ENV"
fi
