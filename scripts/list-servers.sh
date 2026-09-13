#!/usr/bin/env bash
#
# list-servers.sh - Display status of all configured Minecraft servers
#
# Usage: ./scripts/list-servers.sh [--format=table|json]
#
# Exit Codes:
#   0 - Status retrieved successfully
#   1 - Docker daemon not running

# Load common functions
source "$(dirname "$0")/common.sh"

# Check Docker daemon
if ! check_docker_running; then
  exit 1
fi

# Parse format argument (default: table)
FORMAT="table"
if [ $# -gt 0 ] && [[ "$1" == --format=* ]]; then
  FORMAT="${1#--format=}"
fi

# Container name prefix (CONTAINER_NAME_PREFIX keeps test containers separate)
PREFIX="${CONTAINER_NAME_PREFIX:-mc-}"

# Get all mc-* containers
CONTAINERS=$(docker ps -a --filter "name=${PREFIX}*" --format "{{.Names}}" 2> /dev/null || true)

if [ "$FORMAT" == "json" ]; then
  # JSON output: jq builds every object (proper escaping) and assembles the
  # final document
  declare -a OBJECTS=()
  for container in $CONTAINERS; do
    SERVER_NAME=${container#"$PREFIX"}
    STATUS=$(docker inspect --format='{{.State.Status}}' "$container" 2> /dev/null || echo "unknown")

    ROUTE=$(docker inspect --format '{{index .Config.Labels "mc-router.host"}}' "$container" 2> /dev/null || echo "")
    if [ "$STATUS" == "running" ]; then
      UPTIME=$(docker inspect --format='{{.State.StartedAt}}' "$container" 2> /dev/null || echo "unknown")
      HEALTH=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}N/A{{end}}' "$container" 2> /dev/null || echo "N/A")
    else
      UPTIME="N/A"
      HEALTH="N/A"
    fi

    OBJECTS+=("$(jq -n \
      --arg name "$SERVER_NAME" \
      --arg status "$STATUS" \
      --arg route "$ROUTE" \
      --arg uptime "$UPTIME" \
      --arg health "$HEALTH" \
      '{name: $name, status: $status, route: $route, uptime: $uptime, health: $health}')")
  done

  if [ ${#OBJECTS[@]} -gt 0 ]; then
    printf '%s\n' "${OBJECTS[@]}" | jq -s '{servers: .}'
  else
    echo '{"servers": []}'
  fi
  exit 0
fi

# The mc-router hostname players connect to (game ports are never published;
# RCON stays loopback-only and is not a player-facing address)
get_connect_address() {
  local container="$1"
  local route
  route=$(docker inspect --format '{{index .Config.Labels "mc-router.host"}}' "$container" 2> /dev/null || true)
  echo "${route:-N/A}"
}

echo ""
echo -e "${BLUE}Minecraft Servers Status${NC}"
echo "================================================================================"
printf "%-15s %-12s %-12s %-8s %-12s %-10s\n" "Name" "Status" "Connect" "Memory" "Uptime" "Health"
echo "--------------------------------------------------------------------------------"

RUNNING=0
STOPPED=0

if [ -z "$CONTAINERS" ]; then
  echo "No servers configured yet."
  echo ""
  echo "Add a server with: ./scripts/add-modpack.sh <name>"
  echo "Or start vanilla server: ./scripts/start-server.sh vanilla"
  echo ""
  exit 0
fi

for container in $CONTAINERS; do
  SERVER_NAME=${container#"$PREFIX"}
  STATUS=$(docker inspect --format='{{.State.Status}}' "$container" 2> /dev/null || echo "unknown")

  # Color code status
  if [ "$STATUS" == "running" ]; then
    STATUS_COLOR="${GREEN}running${NC}"
    ((RUNNING++)) || true

    # The mc-router hostname players connect to (static, from labels)
    PORT=$(get_connect_address "$container")

    # Get memory from config
    MEMORY=$(get_env_value "$(get_config_file "$SERVER_NAME")" MEMORY)
    MEMORY="${MEMORY:-N/A}"

    # Calculate uptime
    UPTIME=$(get_container_uptime "$container")

    # Get health status
    HEALTH=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}N/A{{end}}' "$container" 2> /dev/null || echo "N/A")
    case "$HEALTH" in
      healthy) HEALTH="${GREEN}healthy${NC}" ;;
      unhealthy) HEALTH="${RED}unhealthy${NC}" ;;
      starting) HEALTH="${YELLOW}starting${NC}" ;;
      *) HEALTH="N/A" ;;
    esac
  else
    STATUS_COLOR="${RED}stopped${NC}"
    ((STOPPED++)) || true
    # Route hostname is static (from labels) even when stopped
    PORT=$(get_connect_address "$container")
    MEMORY="-"
    UPTIME="-"
    HEALTH="-"
  fi

  # Print with echo -e to interpret color codes
  echo -e "$(printf "%-24s" "$SERVER_NAME")$(printf "%-20s" "$STATUS_COLOR")$(printf "%-12s" "$PORT")$(printf "%-8s" "$MEMORY")$(printf "%-12s" "$UPTIME")$(printf "%-18s" "$HEALTH")"
done

echo "================================================================================"
echo -e "Total: ${CYAN}$((RUNNING + STOPPED))${NC} servers | Running: ${GREEN}${RUNNING}${NC} | Stopped: ${RED}${STOPPED}${NC}"
echo ""

exit 0
