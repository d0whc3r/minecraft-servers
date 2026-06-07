#!/usr/bin/env bash
# Emit the KEY=VALUE pairs from .github/workflows/config to stdout.
#
# Workflows redirect this into $GITHUB_OUTPUT so the values become available as
# steps.<id>.outputs.<KEY>:
#
#   - name: Load configuration
#     id: config
#     run: ./.github/scripts/load-pipeline-config.sh >> "$GITHUB_OUTPUT"
#
# Only KEY=VALUE lines go to stdout; comments, blank lines and any diagnostics
# go to stderr so the output stays clean for $GITHUB_OUTPUT.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/../workflows/config"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Configuration file not found at $CONFIG_FILE, using defaults" >&2
  exit 0
fi

echo "Loading configuration from $CONFIG_FILE" >&2

while IFS='=' read -r key value; do
  # Skip comments and empty lines
  [[ $key =~ ^[[:space:]]*# ]] && continue
  [[ -z "$key" ]] && continue
  # Trim surrounding whitespace
  key=$(echo "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  value=$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  echo "$key=$value"
done < "$CONFIG_FILE"
