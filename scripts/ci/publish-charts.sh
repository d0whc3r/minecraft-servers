#!/usr/bin/env bash
# Lint, package and push the given charts to an OCI registry.
#
# Usage: publish-charts.sh <chart>...   (chart = folder name under charts/)
#
# Env:
#   OCI_REPO - full OCI repository prefix without the oci:// scheme,
#              e.g. ghcr.io/owner/repo/charts (required)
#
# Requires an authenticated `helm registry login` beforehand.
# Runs inside .github/workflows/charts-publish.yml.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 <chart>..." >&2
  exit 1
fi
: "${OCI_REPO:?OCI_REPO must be set (e.g. ghcr.io/owner/repo/charts)}"

for chart in "$@"; do
  echo "::group::$chart"
  helm lint "charts/$chart"
  helm package "charts/$chart"
  helm push "$chart"-*.tgz "oci://$OCI_REPO"
  echo "::endgroup::"
done
