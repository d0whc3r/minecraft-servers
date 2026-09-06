#!/usr/bin/env bash
# Load the CI pipeline configuration (.github/workflows/config) into
# $GITHUB_OUTPUT so steps can read it via steps.<id>.outputs.<KEY>.
# A missing config file is not an error: workflows fall back to their
# inline defaults.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

CONFIG_FILE="${1:-$PROJECT_ROOT/.github/workflows/config}"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Configuration file not found, using defaults: $CONFIG_FILE" >&2
  exit 0
fi

while IFS='=' read -r key value; do
  # Skip comments and empty lines
  [[ $key =~ ^[[:space:]]*# ]] && continue
  [[ -z "$key" ]] && continue
  key=$(echo "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  value=$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "$key=$value" >> "$GITHUB_OUTPUT"
  else
    echo "$key=$value"
  fi
done < "$CONFIG_FILE"
