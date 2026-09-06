#!/usr/bin/env bash
#
# tui.sh - Build (when needed) and launch the mc-tui terminal interface
#
# Usage: ./scripts/tui.sh [--build] [mc-tui flags...]
#
# Options:
#   --build   Force recompilation even if the binary looks up to date

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

BIN_DIR="$PROJECT_ROOT/bin"
BINARY="$BIN_DIR/mc-tui"
TUI_DIR="$PROJECT_ROOT/apps/tui"

FORCE=false
if [[ "${1:-}" == "--build" ]]; then
  FORCE=true
  shift
fi

# Rebuild when the binary is missing or any Go source/module file is newer.
needs_build() {
  if [[ $FORCE == true ]] || [[ ! -x "$BINARY" ]]; then
    return 0
  fi
  local newer
  newer=$(find "$TUI_DIR" \( -name '*.go' -o -name 'go.mod' -o -name 'go.sum' \) -newer "$BINARY" -print -quit 2> /dev/null || true)
  if [[ -n "$newer" ]]; then
    return 0
  fi
  return 1
}

if needs_build; then
  echo "Building mc-tui..."
  mkdir -p "$BIN_DIR"
  (cd "$TUI_DIR" && go build -o "$BINARY" .)
fi

exec "$BINARY" -root "$PROJECT_ROOT" "$@"
