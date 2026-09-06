#!/usr/bin/env bash
# Pre-pull the itzg/minecraft-server image tags required by the given
# modpacks, so E2E failures come from the servers themselves and not from
# registry timeouts during compose up.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <modpack1> [modpack2] ..." >&2
  exit 1
fi

# Accept both space- and comma-separated lists (the CI matrix uses commas)
modpacks=$(echo "$*" | tr ',' ' ')

for version in $(bash "$SCRIPT_DIR/../analyze-java-versions.sh" $modpacks); do
  image="itzg/minecraft-server:${version}"
  echo "Pulling ${image}..."
  docker pull "$image"
done
