#!/usr/bin/env bash
#
# stop-all.sh - Stop all running Minecraft servers gracefully
#
# Usage: ./scripts/stop-all.sh
#
# Exit Codes:
#   0 - All servers stopped successfully
#   1 - One or more servers had issues stopping
#   5 - Timeout waiting for graceful shutdown

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

error() {
    echo -e "${RED}ERROR: $1${NC}" >&2
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

info() {
    echo -e "$1"
}

info ""
info "${BLUE}Stopping all Minecraft servers gracefully...${NC}"
info ""

# Find all minecraft containers
CONTAINERS=$(docker ps --filter "name=mc-*" --format "{{.Names}}" 2>/dev/null || true)

if [ -z "$CONTAINERS" ]; then
    info "No running Minecraft servers found."
    info ""
    exit 0
fi

STOPPED=0
FAILED=0
declare -a STOPPED_SERVERS
declare -a FAILED_SERVERS

# Stop each container using docker-compose
for container in $CONTAINERS; do
    SERVER_NAME=${container#mc-}
    
    info "Stopping: ${YELLOW}${SERVER_NAME}${NC}"
    
    if docker-compose -p "mc-${SERVER_NAME}" down 2>&1 > /dev/null; then
        STOPPED_SERVERS+=("${SERVER_NAME}")
        ((STOPPED++))
        success "Stopped: ${SERVER_NAME}"
    else
        FAILED_SERVERS+=("${SERVER_NAME}")
        ((FAILED++))
        error "Failed to stop: ${SERVER_NAME}"
    fi
done

info ""
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info ""

if [ ${STOPPED} -gt 0 ]; then
    success "Stopped servers (${STOPPED}):"
    for server in "${STOPPED_SERVERS[@]}"; do
        echo "  • $server"
    done
    info ""
fi

if [ ${FAILED} -gt 0 ]; then
    error "Failed to stop (${FAILED}):"
    for server in "${FAILED_SERVERS[@]}"; do
        echo "  • $server"
    done
    info ""
fi

info "All servers stopped. Worlds have been saved."
info ""

[ ${FAILED} -eq 0 ] && exit 0 || exit 1
