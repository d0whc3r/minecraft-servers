#!/usr/bin/env bash
#
# k8s-install.sh - Bring up the Kubernetes stack: mc-router + web panel.
#
# Reads the repo .env (same file the docker setup uses) and turns it into
# chart values, so afterwards everything happens from the panel: every server
# you start there becomes a Helm release (mc-<server>) of
# charts/minecraft-server. No Docker socket, no bind mounts.
#
# Usage: ./scripts/k8s-install.sh [namespace]
#
# Environment (from .env or the environment):
#   MC_ROUTER_DOMAIN      player routes <server>.<domain>   (default mc.local)
#   MC_ROUTER_PORT        public router port                (default 25565)
#   MC_ROUTER_NODE_PORT   fixed nodePort, forwarded by      (default 30065,
#                         kind-config.yaml to host 25565     overridable)
#   MC_ROUTER_SERVICE_TYPE  LoadBalancer|NodePort|ClusterIP (default LoadBalancer)
#   K8S_PANEL_HOST        ingress host for the panel        (optional)
#   K8S_PANEL_INGRESS_CLASS ingress class for the panel     (default contour)
#   PANEL_IMAGE_REPO      panel image repository            (default chart value)
#   PANEL_IMAGE_TAG       panel image tag                   (default chart appVersion)
#   PANEL_IMAGE_PULLPOLICY  pull policy for the panel image (default IfNotPresent)
#   MCPANEL_USER          admin user                        (default admin)
#   MCPANEL_PASSWORD      admin password (generated + printed when empty)
#   SHARED_ENV_SECRET     existing Secret with the shared .env created by
#                         k8s-sync-configs.sh; auto-detected when present
#                         (default name minecraft-shared-env)
#   MODPACKS_CONFIGMAP    existing ConfigMap with the modpack catalog created
#                         by k8s-sync-configs.sh; auto-detected when present
#                         (default name minecraft-modpacks)
#
# Exit Codes:
#   0 - success
#   1 - general error (missing tools, cluster unreachable, helm failure)

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

for tool in helm kubectl; do
  if ! command -v "$tool" > /dev/null 2>&1; then
    error "$tool is required (kubectl: https://k8s.dev/docs, helm: https://helm.sh)"
    exit 1
  fi
done

if ! kubectl get namespace "$NAMESPACE" > /dev/null 2>&1; then
  info "Creating namespace: $NAMESPACE"
  kubectl create namespace "$NAMESPACE"
fi

# inotify instances are a kernel-wide per-user budget (kubelet, containerd and
# every pod share it). The default 128 makes big modpacks crash their init
# with "failed to create fsnotify watcher: too many open files".
INOTIFY_MIN=512
if [ -r /proc/sys/fs/inotify/max_user_instances ]; then
  INOTIFY_NOW="$(cat /proc/sys/fs/inotify/max_user_instances)"
  if [ "$INOTIFY_NOW" -lt "$INOTIFY_MIN" ]; then
    if sysctl -w "fs.inotify.max_user_instances=${INOTIFY_MIN}" > /dev/null 2>&1; then
      success "Raised fs.inotify.max_user_instances: ${INOTIFY_NOW} -> ${INOTIFY_MIN}"
      info "  Make it persistent: echo 'fs.inotify.max_user_instances=${INOTIFY_MIN}' | sudo tee /etc/sysctl.d/90-minecraft-inotify.conf"
    else
      error "fs.inotify.max_user_instances is ${INOTIFY_NOW} (< ${INOTIFY_MIN}); server pods may fail"
      error "  with 'failed to create fsnotify watcher: too many open files'."
      error "  Fix: sudo sysctl -w fs.inotify.max_user_instances=${INOTIFY_MIN}"
    fi
  fi
fi

# Read a variable from .env (strips surrounding quotes; empty when unset)
get_env_value() {
  local key="$1"
  local value=""
  if [ -f "$ENV_FILE" ]; then
    value=$(grep -m1 "^${key}=" "$ENV_FILE" 2> /dev/null | cut -d= -f2- || true)
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
  fi
  echo "$value"
}

MC_ROUTER_DOMAIN="${MC_ROUTER_DOMAIN:-$(get_env_value MC_ROUTER_DOMAIN)}"
MC_ROUTER_DOMAIN="${MC_ROUTER_DOMAIN:-mc.local}"
MC_ROUTER_PORT="${MC_ROUTER_PORT:-$(get_env_value MC_ROUTER_PORT)}"
MC_ROUTER_PORT="${MC_ROUTER_PORT:-25565}"
# Fixed nodePort expected by kind-config.yaml's extraPortMapping (host 25565).
MC_ROUTER_NODE_PORT="${MC_ROUTER_NODE_PORT:-$(get_env_value MC_ROUTER_NODE_PORT)}"
MC_ROUTER_NODE_PORT="${MC_ROUTER_NODE_PORT:-30065}"
MC_ROUTER_SERVICE_TYPE="${MC_ROUTER_SERVICE_TYPE:-LoadBalancer}"
MCPANEL_USER="${MCPANEL_USER:-$(get_env_value MCPANEL_USER)}"
MCPANEL_USER="${MCPANEL_USER:-admin}"

# Objects uploaded by k8s-sync-configs.sh: when they exist, the panel
# references them instead of this script rendering .env into chart values.
SHARED_ENV_SECRET="${SHARED_ENV_SECRET:-minecraft-shared-env}"
MODPACKS_CONFIGMAP="${MODPACKS_CONFIGMAP:-minecraft-modpacks}"
HAVE_SHARED_ENV_SECRET=0
if kubectl get secret "$SHARED_ENV_SECRET" -n "$NAMESPACE" > /dev/null 2>&1; then
  HAVE_SHARED_ENV_SECRET=1
fi
HAVE_MODPACKS_CONFIGMAP=0
if kubectl get configmap "$MODPACKS_CONFIGMAP" -n "$NAMESPACE" > /dev/null 2>&1; then
  HAVE_MODPACKS_CONFIGMAP=1
fi

# YAML double-quoted scalar escaping (backslash + quote); values come from the
# operator's .env so nothing else is expected inside.
yaml_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

# ---------------------------------------------------------------------------
# 1. mc-router: the single entry point. Backends appear automatically when a
#    mc-<server> release starts (Service annotations).
# ---------------------------------------------------------------------------
info ""
info "Installing ${YELLOW}mc-router${NC} (players connect to <server>.${MC_ROUTER_DOMAIN})..."
ROUTER_ARGS=(--set "service.type=$MC_ROUTER_SERVICE_TYPE" --set "service.port=$MC_ROUTER_PORT")
if [ -n "${MC_ROUTER_NODE_PORT:-}" ]; then
  ROUTER_ARGS+=(--set "service.nodePort=$MC_ROUTER_NODE_PORT")
fi
helm upgrade --install minecraft-router "${REPO_ROOT}/charts/mc-router" \
  --namespace "$NAMESPACE" \
  "${ROUTER_ARGS[@]}"
success "mc-router installed"

# ---------------------------------------------------------------------------
# 2. Web panel (kubernetes runtime): starts/stops servers as Helm releases.
#    The whole .env becomes the servers' shared configuration (EULA, CF API
#    key, RCON password...), like the docker setup's shared .env.
# ---------------------------------------------------------------------------
PANEL_VALUES="$(mktemp /tmp/mcpanel-values.XXXXXX.yaml)"
trap 'rm -f "$PANEL_VALUES"' EXIT

{
  echo "admin:"
  echo "  user: \"$(yaml_escape "$MCPANEL_USER")\""
  if [ -n "${MCPANEL_PASSWORD:-}" ] || [ -n "$(get_env_value MCPANEL_PASSWORD)" ]; then
    MCPANEL_PASSWORD="${MCPANEL_PASSWORD:-$(get_env_value MCPANEL_PASSWORD)}"
    echo "  password: \"$(yaml_escape "$MCPANEL_PASSWORD")\""
  fi
  if [ -n "${K8S_PANEL_HOST:-}" ]; then
    echo "ingress:"
    echo "  enabled: true"
    echo "  host: \"$(yaml_escape "$K8S_PANEL_HOST")\""
    # No default IngressClass is guaranteed (kind + Contour has none marked
    # default), so the class must be explicit or the Ingress never programs.
    K8S_PANEL_INGRESS_CLASS="${K8S_PANEL_INGRESS_CLASS:-contour}"
    echo "  className: \"$(yaml_escape "$K8S_PANEL_INGRESS_CLASS")\""
  fi
  echo "router:"
  echo "  port: ${MC_ROUTER_PORT}"
  if [ "$HAVE_SHARED_ENV_SECRET" = "1" ]; then
    # k8s-sync-configs.sh already uploaded .env as a Secret; mount that
    # instead of duplicating the values here.
    echo "existingSharedEnvSecret: \"${SHARED_ENV_SECRET}\""
  else
    echo "sharedEnv:"
    if [ -f "$ENV_FILE" ]; then
      # Every KEY=VALUE of .env -> sharedEnv.KEY ("VALUE")
      while IFS='=' read -r key value; do
        case "$key" in '' | \#*) continue ;; esac
        key="$(echo "$key" | tr -d ' ')"
        value="${value%\"}"
        value="${value#\"}"
        value="${value%\'}"
        value="${value#\'}"
        [ -n "$key" ] || continue
        echo "  \"${key}\": \"$(yaml_escape "$value")\""
      done < "$ENV_FILE"
    else
      echo "  EULA: \"TRUE\""
      echo "  MC_ROUTER_DOMAIN: \"$(yaml_escape "$MC_ROUTER_DOMAIN")\""
    fi
  fi
} > "$PANEL_VALUES"

info "Installing ${YELLOW}web panel${NC} (kubernetes runtime)..."
IMAGE_ARGS=()
if [ -n "${PANEL_IMAGE_REPO:-}" ]; then
  IMAGE_ARGS+=(--set "image.repository=$PANEL_IMAGE_REPO")
fi
if [ -n "${PANEL_IMAGE_TAG:-}" ]; then
  IMAGE_ARGS+=(--set "image.tag=$PANEL_IMAGE_TAG")
fi
if [ -n "${PANEL_IMAGE_PULLPOLICY:-}" ]; then
  IMAGE_ARGS+=(--set "image.pullPolicy=$PANEL_IMAGE_PULLPOLICY")
fi
if [ "$HAVE_MODPACKS_CONFIGMAP" = "1" ]; then
  # Synced modpack catalog (k8s-sync-configs.sh) overrides the one baked
  # into the panel image.
  IMAGE_ARGS+=(--set "modpacksConfigMap=$MODPACKS_CONFIGMAP")
fi
helm upgrade --install minecraft-panel "${REPO_ROOT}/charts/web-panel" \
  --namespace "$NAMESPACE" \
  "${IMAGE_ARGS[@]}" \
  --values "$PANEL_VALUES"
success "web panel installed"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
info ""
info "───────────────────────────────────────────────────────"
success "Stack ready in namespace '${NAMESPACE}'"
info ""
info "Router address (what players connect to):"
kubectl get svc minecraft-router -n "$NAMESPACE" 2> /dev/null | sed 's/^/  /' || true
info "  kind: players use <host-LAN-IP>:25565 (extraPortMapping in"
info "        kind-config.yaml -> nodePort ${MC_ROUTER_NODE_PORT}). The"
info "        LoadBalancer EXTERNAL-IP stays <pending> in kind by design."
info ""
info "Panel:"
info "  kubectl -n $NAMESPACE port-forward svc/minecraft-panel 3777:3777"
info "  -> http://localhost:3777  (user: ${MCPANEL_USER})"
if [ -n "${K8S_PANEL_HOST:-}" ]; then
  info "  or http://<host>:9090 with Host: ${K8S_PANEL_HOST}"
  info "  (ingress HTTP: kind-config.yaml maps host 9090 -> envoy 80)"
fi
if [ -z "${MCPANEL_PASSWORD:-}" ] && [ -z "$(get_env_value MCPANEL_PASSWORD)" ]; then
  info "  Generated password (also printed by the pod logs on first boot):"
  info "    kubectl -n $NAMESPACE logs deploy/minecraft-panel | grep -i password"
fi
info ""
info "Then open the panel and start any modpack — each one becomes a Helm"
info "release: helm -n $NAMESPACE list shows every running server."
info ""
info "After editing local .env or config/modpacks/*.env, push the changes:"
info "  ./scripts/k8s-sync-configs.sh $NAMESPACE"
info "───────────────────────────────────────────────────────"
