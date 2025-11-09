#!/usr/bin/env bash
#
# list-servers.sh - Display status of all configured Minecraft servers
#
# Usage: ./scripts/list-servers.sh [--format=table|json]
#
# Exit Codes:
#   0 - Status retrieved successfully
#   1 - Docker daemon not running

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Check Docker daemon
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker daemon is not running" >&2
    exit 1
fi

# Parse format argument (default: table)
FORMAT="table"
if [ $# -gt 0 ] && [[ "$1" == --format=* ]]; then
    FORMAT="${1#--format=}"
fi

# Get all mc-* containers
CONTAINERS=$(docker ps -a --filter "name=mc-*" --format "{{.Names}}" 2>/dev/null || true)

if [ "$FORMAT" == "json" ]; then
    # JSON output
    echo "{"
    echo '  "servers": ['
    
    FIRST=true
    for container in $CONTAINERS; do
        [ "$FIRST" = true ] || echo ","
        FIRST=false
        
        SERVER_NAME=${container#mc-}
        STATUS=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "unknown")
        
        if [ "$STATUS" == "running" ]; then
            PORT=$(docker port "$container" 25565 2>/dev/null | cut -d: -f2 || echo "N/A")
            UPTIME=$(docker inspect --format='{{.State.StartedAt}}' "$container" 2>/dev/null || echo "unknown")
            HEALTH=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}N/A{{end}}' "$container" 2>/dev/null || echo "N/A")
        else
            PORT="N/A"
            UPTIME="N/A"
            HEALTH="N/A"
        fi
        
        echo "    {"
        echo "      \"name\": \"$SERVER_NAME\","
        echo "      \"status\": \"$STATUS\","
        echo "      \"port\": \"$PORT\","
        echo "      \"uptime\": \"$UPTIME\","
        echo "      \"health\": \"$HEALTH\""
        echo -n "    }"
    done
    
    echo ""
    echo "  ]"
    echo "}"
    exit 0
fi

# Table output (default)
echo ""
echo -e "${BLUE}Minecraft Servers Status${NC}"
echo "================================================================================"
printf "%-15s %-12s %-8s %-8s %-12s %-10s\n" "Name" "Status" "Port" "Memory" "Uptime" "Health"
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
    SERVER_NAME=${container#mc-}
    STATUS=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "unknown")
    
    # Color code status
    if [ "$STATUS" == "running" ]; then
        STATUS_COLOR="${GREEN}running${NC}"
        ((RUNNING++))
        
        # Get additional info for running containers
        PORT=$(docker port "$container" 25565 2>/dev/null | cut -d: -f2 || echo "N/A")
        
        # Get memory from config
        CONFIG_FILE="config/modpacks/${SERVER_NAME}.env"
        if [ -f "$CONFIG_FILE" ]; then
            MEMORY=$(grep "^MEMORY=" "$CONFIG_FILE" | cut -d= -f2 | tr -d ' ' || echo "N/A")
        else
            MEMORY="N/A"
        fi
        
        # Calculate uptime
        START_TIME=$(docker inspect --format='{{.State.StartedAt}}' "$container" 2>/dev/null || echo "")
        if [ -n "$START_TIME" ]; then
            START_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${START_TIME%.*}" "+%s" 2>/dev/null || echo "0")
            NOW_EPOCH=$(date "+%s")
            UPTIME_SECONDS=$((NOW_EPOCH - START_EPOCH))
            
            if [ $UPTIME_SECONDS -ge 86400 ]; then
                UPTIME="$((UPTIME_SECONDS / 86400))d $((UPTIME_SECONDS % 86400 / 3600))h"
            elif [ $UPTIME_SECONDS -ge 3600 ]; then
                UPTIME="$((UPTIME_SECONDS / 3600))h $((UPTIME_SECONDS % 3600 / 60))m"
            else
                UPTIME="$((UPTIME_SECONDS / 60))m"
            fi
        else
            UPTIME="N/A"
        fi
        
        # Get health status
        HEALTH=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}N/A{{end}}' "$container" 2>/dev/null || echo "N/A")
        case "$HEALTH" in
            healthy) HEALTH="${GREEN}healthy${NC}" ;;
            unhealthy) HEALTH="${RED}unhealthy${NC}" ;;
            starting) HEALTH="${YELLOW}starting${NC}" ;;
            *) HEALTH="N/A" ;;
        esac
    else
        STATUS_COLOR="${RED}stopped${NC}"
        ((STOPPED++))
        PORT="-"
        MEMORY="-"
        UPTIME="-"
        HEALTH="-"
    fi
    
    printf "%-24s %-20s %-8s %-8s %-12s %-18s\n" "$SERVER_NAME" "$STATUS_COLOR" "$PORT" "$MEMORY" "$UPTIME" "$HEALTH"
done

echo "================================================================================"
echo -e "Total: ${CYAN}$((RUNNING + STOPPED))${NC} servers | Running: ${GREEN}${RUNNING}${NC} | Stopped: ${RED}${STOPPED}${NC}"
echo ""

exit 0
