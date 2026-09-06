#!/usr/bin/env bash
#
# router.sh - Manage the mc-router proxy (single entry point for all servers)
#
# Players connect once to the router port and are routed by hostname to the
# right server (<server-name>.${MC_ROUTER_DOMAIN} - see the root .env).
# Backends are auto-discovered from the mc-router.* labels of running servers.
#
# Usage: ./scripts/router.sh <start|stop|restart|status|routes|logs>
#
# Commands:
#   start    Start mc-router (also auto-starts with every server - players have
#            no other path in, so the router is never optional)
#   stop     Stop mc-router (servers keep running; only hostname routing pauses)
#   restart  Restart mc-router
#   status   Router state plus the route table of every configured server
#   routes   Raw route table from the mc-router API (127.0.0.1:$MC_ROUTER_API_PORT)
#   logs     Follow mc-router container logs
#
# Exit Codes:
#   0 - Success
#   1 - Docker error or router not running
#   2 - Invalid arguments

# Load common functions
source "$(dirname "$0")/common.sh"

usage() {
  echo "Usage: $0 <start|stop|restart|status|routes|logs>" >&2
  echo "" >&2
  echo "Commands:" >&2
  echo "  start    Start mc-router" >&2
  echo "  stop     Stop mc-router" >&2
  echo "  restart  Restart mc-router" >&2
  echo "  status   Router state and route table" >&2
  echo "  routes   Route table from the mc-router API" >&2
  echo "  logs     Follow mc-router logs" >&2
  echo "" >&2
  echo "Settings: MC_ROUTER_* variables in .env (see .env.example)" >&2
}

ROUTER_PROJECT="minecraft-router"
ROUTER_CONTAINER="minecraft-router"
ROUTER_COMPOSE_FILE="docker-compose.router.yml"

router_up_down() {
  docker compose -p "$ROUTER_PROJECT" -f "$ROUTER_COMPOSE_FILE" "$@" 2>&1
}

# When MC_ROUTER_DOMAIN is still the placeholder default, hint at nip.io:
# <server>.<lan-ip>.nip.io resolves for every player with zero DNS/hosts setup
nip_io_tip() {
  [ "$MC_ROUTER_DOMAIN" = "mc.local" ] || return 0
  local lan_ip
  lan_ip=$(hostname -I 2> /dev/null | awk '{print $1}')
  [ -n "$lan_ip" ] || return 0
  info ""
  info "${YELLOW}TIP:${NC} '${MC_ROUTER_DOMAIN}' needs manual hosts entries on every player's machine."
  info "For zero-config LAN/internet play use nip.io instead - set in .env:"
  info "  MC_ROUTER_DOMAIN=${lan_ip}.nip.io"
  info "and players connect to e.g. vanilla.${lan_ip}.nip.io (no DNS setup at all)."
}

cmd_start() {
  load_router_settings
  if router_running; then
    success "mc-router is already running"
    return 0
  fi
  ensure_network
  if router_up_down up -d; then
    success "mc-router started - players connect via <server>.${MC_ROUTER_DOMAIN}"
    success "Route table: ./scripts/router.sh status"
    nip_io_tip
    return 0
  fi
  error "Failed to start mc-router"
  return 1
}

cmd_stop() {
  if ! router_running && ! container_exists "$ROUTER_CONTAINER"; then
    info "mc-router is not running"
    return 0
  fi
  if router_up_down down; then
    success "mc-router stopped (running servers are unaffected)"
    return 0
  fi
  error "Failed to stop mc-router"
  return 1
}

cmd_status() {
  load_router_settings

  if router_running; then
    success "mc-router: running"
    success "Entry point: port ${MC_ROUTER_PORT} (routes below)"
    nip_io_tip
  elif container_exists "$ROUTER_CONTAINER"; then
    warning "mc-router: stopped"
  else
    warning "mc-router: not created yet (start it with: $0 start)"
  fi

  info "${BLUE}Route table${NC}"
  printf "%-28s %-42s %s\n" "SERVER" "ROUTE" "CONTAINER"
  echo "--------------------------------------------------------------------------------"

  local containers
  containers=$(docker ps -a --filter "label=mc-router.host" --format "{{.Names}}" 2> /dev/null || true)
  if [ -z "$containers" ]; then
    info "  (no servers with mc-router labels found)"
    return 0
  fi

  local container server route state
  for container in $containers; do
    server=${container#mc-}
    route=$(docker inspect --format '{{index .Config.Labels "mc-router.host"}}' "$container" 2> /dev/null || echo "?")
    state=$(docker inspect --format '{{.State.Status}}' "$container" 2> /dev/null || echo "?")
    if [ "$state" = "running" ]; then
      state="${GREEN}running${NC}"
    else
      state="${RED}${state}${NC}"
    fi
    printf "%-28s %-42s %b\n" "$server" "$route" "$state"
  done
  return 0
}

cmd_routes() {
  load_router_settings
  if ! router_running; then
    error "mc-router is not running"
    return 1
  fi
  if ! command -v curl > /dev/null 2>&1; then
    error "curl is required for the routes API"
    return 1
  fi
  local api_url="http://127.0.0.1:${MC_ROUTER_API_PORT}/routes"
  if command -v jq > /dev/null 2>&1; then
    curl -sf -H "Accept: application/json" "$api_url" | jq . && return 0
  else
    curl -sf -H "Accept: application/json" "$api_url" && echo "" && return 0
  fi
  error "Could not reach the mc-router API at $api_url"
  return 1
}

cmd_logs() {
  if ! container_exists "$ROUTER_CONTAINER"; then
    error "mc-router container does not exist"
    return 1
  fi
  docker logs -f "$ROUTER_CONTAINER" 2>&1
}

COMMAND="${1:-}"

# Argument validation runs before any Docker access so bad inputs fail fast
case "$COMMAND" in
  "")
    error "Missing command argument"
    usage
    exit 2
    ;;
  -h | --help | help)
    usage
    exit 0
    ;;
  start | stop | restart | status | routes | logs) ;;
  *)
    error "Unknown command: $COMMAND"
    usage
    exit 2
    ;;
esac

check_docker_running || exit 1

case "$COMMAND" in
  start) cmd_start ;;
  stop) cmd_stop ;;
  restart) cmd_stop && cmd_start ;;
  status) cmd_status ;;
  routes) cmd_routes ;;
  logs) cmd_logs ;;
esac

exit $?
