#!/usr/bin/env bash
#
# stop-server.sh - Stop a specific Minecraft server
#
# Usage: ./scripts/stop-server.sh <server-name>
#
# Exit Codes:
#   0 - Success
#   1 - General error
#   2 - Invalid arguments
#   3 - Server not running

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
error() {
    echo -e "${RED}ERROR: $1${NC}" >&2
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

info() {
    echo -e "$1"
}

# Check arguments
if [ $# -lt 1 ]; then
    error "Missing server name argument"
    echo "Usage: $0 <server-name>" >&2
    echo "" >&2
    echo "Running servers:" >&2
    docker ps --filter "name=mc-" --format "table {{.Names}}\t{{.Ports}}" | grep mc- | sed 's/mc-//' | sed 's/  - /  - /' >&2 || echo "  (none running)" >&2
    exit 2
fi

SERVER_NAME="$1"
CONTAINER_NAME="mc-${SERVER_NAME}"

# Validate server name format
if [[ ! "$SERVER_NAME" =~ ^[a-z0-9-]+$ ]]; then
    error "Invalid server name format: $SERVER_NAME"
    echo "Server names must contain only lowercase letters, numbers, and hyphens" >&2
    exit 2
fi

# Check if container exists and is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    error "Server '$SERVER_NAME' is not running"
    echo "" >&2
    echo "Running servers:" >&2
    docker ps --filter "name=mc-" --format "table {{.Names}}\t{{.Ports}}" | grep mc- | sed 's/mc-//' | sed 's/  - /  - /' >&2 || echo "  (none running)" >&2
    exit 3
fi

# Display stop information
info ""
info "Stopping Minecraft server: ${YELLOW}${SERVER_NAME}${NC}"
success "Container name: $CONTAINER_NAME"
info ""

# Stop the container
if docker stop "$CONTAINER_NAME" >/dev/null 2>&1; then
    success "Server stopped successfully"
    info ""
    info "Container stopped. World data is preserved."
    info "Start again with: ${YELLOW}./scripts/start-server.sh $SERVER_NAME${NC}"
    exit 0
else
    error "Failed to stop server"
    echo "Check docker logs for details" >&2
    exit 1
fi