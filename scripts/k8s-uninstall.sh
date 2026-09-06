#!/usr/bin/env bash
#
# k8s-uninstall.sh - Remove the Kubernetes stack: servers, panel, router.
#
# Uninstalls every mc-<server> Helm release plus minecraft-panel and
# minecraft-router. The PVCs (worlds, backups, panel state) carry the
# helm.sh/resource-policy: keep annotation, so data survives the uninstall;
# delete them explicitly for a clean slate within the namespace. The synced
# config objects (Secret/ConfigMap from k8s-sync-configs.sh) also survive and
# are re-used on the next install.
#
# Usage: ./scripts/k8s-uninstall.sh [namespace] [--purge] [--yes]
#
#   --purge   also delete the namespace afterwards: worlds, backups and the
#             synced configs are gone (irreversible)
#   --yes     answer yes to the --purge confirmation (non-interactive use)
#
# Exit Codes:
#   0 - success
#   1 - general error (missing tools, cluster unreachable, aborted purge,
#       helm failure)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

error() { echo -e "${RED}ERROR: $1${NC}" >&2; }
info() { echo -e "$1"; }
success() { echo -e "${GREEN}✓ $1${NC}"; }

PURGE=0
ASSUME_YES=0
POSITIONAL=()
for arg in "$@"; do
  case "$arg" in
    --purge) PURGE=1 ;;
    --yes | -y) ASSUME_YES=1 ;;
    -*)
      error "unknown flag: $arg"
      exit 1
      ;;
    *) POSITIONAL+=("$arg") ;;
  esac
done
NAMESPACE="${POSITIONAL[0]:-minecraft}"
PANEL_RELEASE="${PANEL_RELEASE:-minecraft-panel}"
ROUTER_RELEASE="${ROUTER_RELEASE:-minecraft-router}"

for tool in kubectl helm; do
  if ! command -v "$tool" > /dev/null 2>&1; then
    error "$tool is required (kubectl: https://k8s.dev/docs, helm: https://helm.sh)"
    exit 1
  fi
done

if ! kubectl get namespace "$NAMESPACE" > /dev/null 2>&1; then
  error "namespace '$NAMESPACE' does not exist; nothing to uninstall"
  exit 1
fi

uninstall_release() {
  local name="$1"
  if helm status "$name" -n "$NAMESPACE" > /dev/null 2>&1; then
    info "Uninstalling ${YELLOW}${name}${NC}..."
    helm uninstall "$name" -n "$NAMESPACE" > /dev/null
    success "$name uninstalled"
  fi
}

# Servers first, then the panel, then the router players connect through.
mapfile -t servers < <(helm list -n "$NAMESPACE" -q | grep '^mc-' || true)
if [ "${#servers[@]}" -gt 0 ]; then
  info "Found ${#servers[@]} server release(s) in '${NAMESPACE}'."
  for release in "${servers[@]}"; do
    uninstall_release "$release"
  done
else
  info "No mc-* server releases found."
fi
uninstall_release "$PANEL_RELEASE"
uninstall_release "$ROUTER_RELEASE"

# ---------------------------------------------------------------------------
# --purge: drop the namespace. Everything inside goes, including the PVCs
# helm deliberately kept (worlds, backups) and the synced config objects.
# ---------------------------------------------------------------------------
if [ "$PURGE" = "1" ]; then
  if [ "$ASSUME_YES" != "1" ]; then
    read -r -p "Delete namespace '$NAMESPACE' including ALL worlds and backups? [y/N] " reply
    case "$reply" in
      y | Y | yes | YES) ;;
      *)
        error "aborted (namespace kept; everything else already uninstalled)"
        exit 1
        ;;
    esac
  fi
  info "Deleting ${YELLOW}namespace ${NAMESPACE}${NC} (worlds, backups, configs)..."
  kubectl delete namespace "$NAMESPACE"
  success "namespace '$NAMESPACE' deleted"
  info ""
  info "───────────────────────────────────────────────────────"
  success "Kubernetes stack purged"
  info "───────────────────────────────────────────────────────"
  exit 0
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
remaining_pvcs=$(kubectl get pvc -n "$NAMESPACE" --no-headers 2> /dev/null | wc -l || true)
info ""
info "───────────────────────────────────────────────────────"
success "Kubernetes stack uninstalled from '${NAMESPACE}'"
info ""
info "Kept (helm uninstall preserves annotated PVCs):"
info "  ${remaining_pvcs} PVC(s) — worlds, backups, panel state"
info "  synced configs: secret + configmap (re-used on the next install)"
info ""
info "Wipe the data for a clean slate:"
info "  kubectl -n $NAMESPACE delete pvc --all"
info "Or remove everything at once: ./scripts/k8s-uninstall.sh $NAMESPACE --purge"
info "───────────────────────────────────────────────────────"
