#!/usr/bin/env bash
#
# k8s-sync-configs.sh - Push the local configs and secrets to the cluster.
#
# Uploads what the panel and the servers read in one command:
#   .env                    -> Secret (shared server config: EULA, CF_API_KEY,
#                              RCON_PASSWORD, ...) mounted as /repo/.env
#   config/modpacks/*.env   -> ConfigMap (the modpack catalog) mounted over
#                              /repo/config/modpacks
# and points the web panel release at both, so a fresh panel install or a
# redeploy picks them up without baking them into the image or the helm
# values. Run it again any time a local file changes.
#
# Servers already running keep the env they were started with (each mc-<name>
# release renders its env on start): restart them from the panel to pick up
# changes.
#
# Usage: ./scripts/k8s-sync-configs.sh [namespace]
#
# Environment:
#   SHARED_ENV_SECRET   Secret name for .env         (default minecraft-shared-env)
#   MODPACKS_CONFIGMAP  ConfigMap name for modpacks  (default minecraft-modpacks)
#   PANEL_RELEASE       panel helm release to rewire (default minecraft-panel)
#
# Exit Codes:
#   0 - success
#   1 - general error (missing tools, cluster unreachable, missing files)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

error() { echo -e "${RED}ERROR: $1${NC}" >&2; }
info() { echo -e "$1"; }
success() { echo -e "${GREEN}✓ $1${NC}"; }

NAMESPACE="${1:-minecraft}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env"
MODPACKS_DIR="${REPO_ROOT}/config/modpacks"
SHARED_ENV_SECRET="${SHARED_ENV_SECRET:-minecraft-shared-env}"
MODPACKS_CONFIGMAP="${MODPACKS_CONFIGMAP:-minecraft-modpacks}"
PANEL_RELEASE="${PANEL_RELEASE:-minecraft-panel}"

for tool in kubectl helm; do
  if ! command -v "$tool" > /dev/null 2>&1; then
    error "$tool is required (kubectl: https://k8s.dev/docs, helm: https://helm.sh)"
    exit 1
  fi
done

if [ ! -f "$ENV_FILE" ]; then
  error ".env not found at $ENV_FILE (cp .env.example .env first)"
  exit 1
fi

if ! ls "$MODPACKS_DIR"/*.env > /dev/null 2>&1; then
  error "no .env files in $MODPACKS_DIR"
  exit 1
fi

if ! kubectl get namespace "$NAMESPACE" > /dev/null 2>&1; then
  error "namespace '$NAMESPACE' does not exist (run ./scripts/k8s-install.sh first, or create it)"
  exit 1
fi

apply_manifest() {
  kubectl apply -n "$NAMESPACE" -f -
}

# ---------------------------------------------------------------------------
# 1. Shared .env -> Secret. The panel mounts it at /repo/.env and merges it
#    into every server it starts (same role as .env in the docker setup).
# ---------------------------------------------------------------------------
info "Uploading ${YELLOW}.env${NC} -> Secret ${SHARED_ENV_SECRET}..."
kubectl create secret generic "$SHARED_ENV_SECRET" \
  --from-file=".env=$ENV_FILE" \
  --dry-run=client -o yaml \
  | apply_manifest > /dev/null
success "shared env uploaded ($(grep -cE '^[A-Z_]+=' "$ENV_FILE" || true) keys)"

# ---------------------------------------------------------------------------
# 2. Modpack catalog -> ConfigMap. One <server>.env key per file, mounted
#    over /repo/config/modpacks, replacing the catalog baked into the image.
#    Keep modpack files free of secrets: anything sensitive belongs in .env.
# ---------------------------------------------------------------------------
count=$(ls "$MODPACKS_DIR"/*.env | wc -l)
info "Uploading ${YELLOW}config/modpacks${NC} (${count} servers) -> ConfigMap ${MODPACKS_CONFIGMAP}..."
kubectl create configmap "$MODPACKS_CONFIGMAP" \
  --from-file="$MODPACKS_DIR" \
  --dry-run=client -o yaml \
  | apply_manifest > /dev/null
success "modpack catalog uploaded"

# kubectl label takes a single resource per invocation
kubectl label -n "$NAMESPACE" secret "$SHARED_ENV_SECRET" \
  app.kubernetes.io/part-of=minecraft-servers --overwrite > /dev/null
kubectl label -n "$NAMESPACE" configmap "$MODPACKS_CONFIGMAP" \
  app.kubernetes.io/part-of=minecraft-servers --overwrite > /dev/null

# ---------------------------------------------------------------------------
# 3. Point the panel release at both objects (idempotent: the chart skips its
#    own rendered Secret when existingSharedEnvSecret is set). The panel pod
#    restarts because /repo/.env is a subPath mount, which kubelet never
#    refreshes. The catalog mount updates by itself; the 30s registry TTL in
#    the panel covers it either way.
# ---------------------------------------------------------------------------
if helm status "$PANEL_RELEASE" -n "$NAMESPACE" > /dev/null 2>&1; then
  info "Rewiring ${YELLOW}${PANEL_RELEASE}${NC} to the synced objects and restarting it..."
  helm upgrade "$PANEL_RELEASE" "${REPO_ROOT}/charts/web-panel" \
    --namespace "$NAMESPACE" \
    --reuse-values \
    --set "existingSharedEnvSecret=${SHARED_ENV_SECRET}" \
    --set "modpacksConfigMap=${MODPACKS_CONFIGMAP}" > /dev/null
  kubectl rollout restart deployment/"$PANEL_RELEASE" -n "$NAMESPACE"
  kubectl rollout status deployment/"$PANEL_RELEASE" -n "$NAMESPACE" --timeout=300s
  success "panel restarted with the synced configs"
else
  info "Panel release '${PANEL_RELEASE}' not found in namespace '${NAMESPACE}';"
  info "objects uploaded. ./scripts/k8s-install.sh ${NAMESPACE} will wire them automatically."
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
info ""
info "───────────────────────────────────────────────────────"
success "Local configs synced to namespace '${NAMESPACE}'"
info ""
info "  .env                  -> secret/${SHARED_ENV_SECRET}"
info "  config/modpacks/*.env -> configmap/${MODPACKS_CONFIGMAP} (${count} servers)"
info ""
info "Servers already running keep their old env: restart them from the"
info "panel (or helm upgrade each mc-<server> release) to pick up changes."
info "───────────────────────────────────────────────────────"
