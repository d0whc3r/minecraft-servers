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

# Load common functions
source "$(dirname "$0")/common.sh"

info ""
info "${BLUE}Stopping all Minecraft servers gracefully...${NC}"
info ""

# Find all minecraft containers
RUNNING_SERVERS=$(list_running_servers)

if [ -z "$RUNNING_SERVERS" ]; then
    info "No running Minecraft servers found."
    info ""
    exit 0
fi

STOPPED=0
FAILED=0
declare -a STOPPED_SERVERS
declare -a FAILED_SERVERS

# Stop each server
for SERVER_NAME in $RUNNING_SERVERS; do
    info "Stopping: ${YELLOW}${SERVER_NAME}${NC}"
    
    if docker_compose_down "$SERVER_NAME" > /dev/null 2>&1; then
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
