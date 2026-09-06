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
#   MC_ROUTER_SERVICE_TYPE  LoadBalancer|NodePort|ClusterIP (default LoadBalancer)
#   K8S_PANEL_HOST        ingress host for the panel        (optional)
#   PANEL_IMAGE_REPO      panel image repository            (default chart value)
#   PANEL_IMAGE_TAG       panel image tag                   (default chart appVersion)
#   PANEL_IMAGE_PULLPOLICY  pull policy for the panel image (default IfNotPresent)
#   MCPANEL_USER          admin user                        (default admin)
#   MCPANEL_PASSWORD      admin password (generated + printed when empty)
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
MC_ROUTER_SERVICE_TYPE="${MC_ROUTER_SERVICE_TYPE:-LoadBalancer}"
MCPANEL_USER="${MCPANEL_USER:-$(get_env_value MCPANEL_USER)}"
MCPANEL_USER="${MCPANEL_USER:-admin}"

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
  fi
  echo "router:"
  echo "  port: ${MC_ROUTER_PORT}"
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
info ""
info "Panel:"
info "  kubectl -n $NAMESPACE port-forward svc/minecraft-panel 3777:3777"
info "  -> http://localhost:3777  (user: ${MCPANEL_USER})"
if [ -z "${MCPANEL_PASSWORD:-}" ] && [ -z "$(get_env_value MCPANEL_PASSWORD)" ]; then
  info "  Generated password (also printed by the pod logs on first boot):"
  info "    kubectl -n $NAMESPACE logs deploy/minecraft-panel | grep -i password"
fi
info ""
info "Then open the panel and start any modpack — each one becomes a Helm"
info "release: helm -n $NAMESPACE list shows every running server."
info "───────────────────────────────────────────────────────"
