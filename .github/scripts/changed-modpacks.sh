#!/usr/bin/env bash
# Decide which modpacks need testing based on the git diff between BASE_SHA and
# HEAD_SHA. Lets the BATS pipeline skip modpacks whose config did not change.
#
# Prints ONE of the following to stdout:
#   __ALL__              test every modpack. Emitted when shared/global code
#                        changed (a regression there could affect any server) or
#                        when the base ref can't be determined safely.
#   <name>\n<name>\n...  one modpack name per line: only these .env files changed.
#   (nothing)            no relevant change -> caller skips the test job.
#
# Diagnostics go to stderr so stdout stays parseable for the workflow.
#
# Env:
#   BASE_SHA  git sha/ref to diff from. Empty or all-zeros -> __ALL__.
#   HEAD_SHA  git sha/ref to diff to (default: HEAD).
#
# CI-only helper. Resolves paths relative to the repo root, so it works from any cwd.
set -euo pipefail

ALL_ZEROS="0000000000000000000000000000000000000000"
BASE_SHA="${BASE_SHA:-}"
HEAD_SHA="${HEAD_SHA:-HEAD}"

# Paths whose change forces the full suite: shared scripts, compose definition,
# the BATS tests themselves, CI plumbing, and pinned tool/dependency versions.
GLOBAL_PATTERNS=(
  '^scripts/'
  '^docker-compose.*\.ya?ml$'
  '^tests/bats/'
  '^config/templates/'
  '^\.github/actions/'
  '^\.github/scripts/'
  '^\.github/workflows/'
  '^package\.json$'
  '^pnpm-lock\.yaml$'
  '^\.nvmrc$'
)

emit_all() {
  echo "__ALL__"
}

if [ -z "$BASE_SHA" ] || [ "$BASE_SHA" = "$ALL_ZEROS" ]; then
  echo "No usable base ref (BASE_SHA='$BASE_SHA') -> testing all modpacks" >&2
  emit_all
  exit 0
fi

if ! changed=$(git diff --name-only "$BASE_SHA" "$HEAD_SHA" 2> /dev/null); then
  echo "git diff $BASE_SHA..$HEAD_SHA failed -> testing all modpacks" >&2
  emit_all
  exit 0
fi

echo "Changed files between $BASE_SHA and $HEAD_SHA:" >&2
printf '%s\n' "$changed" | sed 's/^/  /' >&2

# Any global change short-circuits to the full suite.
for pattern in "${GLOBAL_PATTERNS[@]}"; do
  if printf '%s\n' "$changed" | grep -Eq "$pattern"; then
    echo "Global path changed (matched /$pattern/) -> testing all modpacks" >&2
    emit_all
    exit 0
  fi
done

# Otherwise: only the modpacks whose .env changed. A no-match grep is fine here
# (no relevant change), so the pipeline failure is swallowed.
modpacks=$(printf '%s\n' "$changed" \
  | grep -E '^config/modpacks/.+\.env$' \
  | sed -E 's#^config/modpacks/(.+)\.env$#\1#' \
  | sort -u || true)

if [ -z "$modpacks" ]; then
  echo "No modpack .env files changed -> nothing to test" >&2
  exit 0
fi

echo "Changed modpacks -> $(printf '%s ' $modpacks)" >&2
printf '%s\n' "$modpacks"
