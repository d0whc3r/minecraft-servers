#!/usr/bin/env bash
# List modpack names (basename without the .env extension) from config/modpacks,
# sorted alphabetically, one per line.
#
# Usage: list-modpacks.sh [filter_regex]
#   filter_regex  Optional extended-regex applied to the modpack names. A missing
#                 filter or the literal ".*" returns every modpack.
#
# CI-only helper. Resolves paths relative to the repo root, so it works from any cwd.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MODPACK_DIR="$PROJECT_ROOT/config/modpacks"

filter="${1:-}"

names=$(find "$MODPACK_DIR" -name '*.env' -type f -exec basename {} .env \; | sort)

if [ -n "$filter" ] && [ "$filter" != ".*" ]; then
  names=$(printf '%s\n' "$names" | grep -E "$filter" || true)
fi

# Drop any blank lines (e.g. when the filter matches nothing).
printf '%s\n' "$names" | sed '/^[[:space:]]*$/d'
