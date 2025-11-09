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

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check arguments
if [ $# -lt 1 ]; then
    error "Missing server name argument"
    echo "Usage: $0 <server-name>" >&2
    exit 2
fi

SERVER_NAME="$1"
CONTAINER_NAME="mc-${SERVER_NAME}"

# Check if container exists
if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    error "Server not found: $SERVER_NAME"
    echo "Available servers:" >&2
    docker ps -a --filter "name=mc-*" --format "  - {{.Names}}" | sed 's/mc-//' >&2
    exit 3
fi

info ""
info "Restarting server: ${YELLOW}${SERVER_NAME}${NC}"
info ""

# Load config file to set environment variables
CONFIG_FILE="config/modpacks/${SERVER_NAME}.env"
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# Set dynamic environment variables
export CONTAINER_NAME="mc-${SERVER_NAME}"
export SERVER_DATA_DIR="$(pwd)/servers/${SERVER_NAME}/data"
export SERVER_MODS_DIR="$(pwd)/servers/${SERVER_NAME}/mods"
export SERVER_BACKUP_DIR="$(pwd)/backups/${SERVER_NAME}"

# Restart with docker-compose
if docker-compose -p "mc-${SERVER_NAME}" --env-file "$CONFIG_FILE" restart 2>&1; then
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
