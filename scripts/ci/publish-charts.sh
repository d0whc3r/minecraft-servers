#!/usr/bin/env bash
# Lint, package and push the given charts to an OCI registry.
#
# Each chart is pushed under its Chart.yaml version, and the same manifest is
# additionally re-tagged as "latest" so non-helm tooling (crane, skopeo...)
# can always address the most recent publish. Helm itself ignores the tag:
# it only resolves semver tags, and "no --version" already means newest.
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

if ! command -v skopeo > /dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq skopeo
fi

for chart in "$@"; do
  echo "::group::$chart"
  helm lint "charts/$chart"
  helm package "charts/$chart"
  helm push "$chart"-*.tgz "oci://$OCI_REPO"
  version="$(awk '$1 == "version:" {print $2; exit}' "charts/$chart/Chart.yaml")"
  # helm registry login stores credentials in helm's own registry config
  # (docker config format), not in ~/.docker/config.json — point the
  # containers-image client (skopeo) at the file helm actually uses.
  REGISTRY_AUTH_FILE="${REGISTRY_AUTH_FILE:-$(helm env | sed -n 's/^HELM_REGISTRY_CONFIG="\(.*\)"$/\1/p')}" \
    skopeo copy "docker://$OCI_REPO/$chart:$version" "docker://$OCI_REPO/$chart:latest"
  echo "Tagged $OCI_REPO/$chart:latest (=$version)"
  echo "::endgroup::"
done
