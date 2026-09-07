#!/usr/bin/env bash
# Select the charts to publish for a push, into $GITHUB_OUTPUT as
# "charts=<space-separated names>" so steps can read it via
# steps.<id>.outputs.charts.
#
# A chart is selected when its folder changed AND the diff bumps the
# version field of its Chart.yaml; a changed folder without a version
# bump is an error (publishing without a bump would overwrite the
# released OCI tag).
#
# On workflow_dispatch (or the first push) there is no previous commit:
# every chart is selected as-is.
#
# Env:
#   BEFORE         - previous commit sha (empty or all-zeros when unavailable)
#   SHA            - current commit sha
#   CHARTS         - chart folder names to consider
#   GITHUB_OUTPUT  - GitHub Actions step output file (stdout when unset)
#
# Runs inside .github/workflows/charts-publish.yml.

set -eu

if [ -z "${BEFORE:-}" ] || [ "$BEFORE" = "0000000000000000000000000000000000000000" ]; then
  echo "charts=${CHARTS:-}" >> "${GITHUB_OUTPUT:-/dev/stdout}"
  exit 0
fi

publish=""
for chart in ${CHARTS:-}; do
  if [ -z "$(git diff --name-only "$BEFORE" "$SHA" -- "charts/$chart")" ]; then
    continue
  fi
  if git diff "$BEFORE" "$SHA" -- "charts/$chart/Chart.yaml" \
      | grep -qE '^\+version:'; then
    publish+=("$chart")
  else
    echo "::error::charts/$chart changed without bumping 'version' in its Chart.yaml — bumping version is required to publish to OCI"
    exit 1
  fi
done
echo "charts=${publish[*]}" >> "${GITHUB_OUTPUT:-/dev/stdout}"
