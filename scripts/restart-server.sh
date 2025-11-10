#!/usr/bin/env bash
#
# restart-server.sh - Restart a specific Minecraft server
#
# Usage: ./scripts/restart-server.sh <server-name>
#
# Exit Codes:
#   0 - Restart successful
#   2 - Missing server-name argument
#   3 - Server not found
#   5 - Restart timeout

# Load common functions
source "$(dirname "$0")/common.sh"

# Check arguments
if [ $# -lt 1 ]; then
    error "Missing server name argument"
    echo "Usage: $0 <server-name>" >&2
    exit 2
fi

SERVER_NAME="$1"

# Validate server name
if ! validate_server_name "$SERVER_NAME"; then
    exit 2
fi

# Get container name
CONTAINER_NAME=$(get_container_name "$SERVER_NAME")

# Check if container exists
if ! container_exists "$CONTAINER_NAME"; then
    error "Server not found: $SERVER_NAME"
    echo "Available servers:" >&2
    list_available_servers >&2
    exit 3
fi

info ""
info "Restarting server: ${YELLOW}${SERVER_NAME}${NC}"
info ""

# Restart with docker compose
if docker_compose_restart "$SERVER_NAME"; then
    success "Server restarted successfully"
    info ""
    info "View logs with: ${YELLOW}docker logs -f $CONTAINER_NAME${NC}"
    info "Check status with: ${YELLOW}./scripts/list-servers.sh${NC}"
    info ""
    exit 0
else
    error "Failed to restart server"
    exit 1
fi
