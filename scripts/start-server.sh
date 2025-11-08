#!/usr/bin/env bash
#
# start-server.sh - Start a specific Minecraft server
#
# Usage: ./scripts/start-server.sh <server-name>
#
# Exit Codes:
#   0 - Success
#   1 - General error
#   2 - Invalid arguments
#   3 - Server configuration not found
#   4 - Validation error (port conflict, etc.)

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
    echo "Available servers:" >&2
    ls -1 config/modpacks/*.env 2>/dev/null | xargs -n1 basename | sed 's/.env$/  - /' >&2 || echo "  (none configured)" >&2
    exit 2
fi

SERVER_NAME="$1"
CONFIG_FILE="config/modpacks/${SERVER_NAME}.env"

# Validate server name format
if [[ ! "$SERVER_NAME" =~ ^[a-z0-9-]+$ ]]; then
    error "Invalid server name format: $SERVER_NAME"
    echo "Server names must contain only lowercase letters, numbers, and hyphens" >&2
    exit 2
fi

# Check if configuration exists
if [ ! -f "$CONFIG_FILE" ]; then
    error "Configuration not found: $CONFIG_FILE"
    echo "" >&2
    echo "Available servers:" >&2
    ls -1 config/modpacks/*.env 2>/dev/null | xargs -n1 basename | sed 's/.env$/  - /' >&2 || echo "  (none configured)" >&2
    exit 3
fi

# Extract SERVER_PORT from config file
if ! SERVER_PORT=$(grep "^SERVER_PORT=" "$CONFIG_FILE" | cut -d= -f2 | tr -d ' '); then
    error "Could not extract SERVER_PORT from $CONFIG_FILE"
    exit 4
fi

if [ -z "$SERVER_PORT" ]; then
    error "SERVER_PORT not defined in $CONFIG_FILE"
    exit 4
fi

# Validate port number
if ! [[ "$SERVER_PORT" =~ ^[0-9]+$ ]] || [ "$SERVER_PORT" -lt 1024 ] || [ "$SERVER_PORT" -gt 65535 ]; then
    error "Invalid port number: $SERVER_PORT (must be between 1024-65535)"
    exit 4
fi

# Check if port is already in use
if lsof -Pi :${SERVER_PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
    error "Port $SERVER_PORT is already in use"
    echo "Check with: lsof -i :${SERVER_PORT}" >&2
    exit 4
fi

# Check if container already exists and is running
CONTAINER_NAME="mc-${SERVER_NAME}"
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    error "Container $CONTAINER_NAME is already running"
    echo "Use './scripts/restart-server.sh $SERVER_NAME' to restart" >&2
    exit 4
fi

# Display startup information
info ""
info "Starting Minecraft server: ${YELLOW}${SERVER_NAME}${NC}"
success "Loading config from: $CONFIG_FILE"
success "Using port: $SERVER_PORT"
success "Container name: $CONTAINER_NAME"
info ""

# Start server using docker-compose with environment variables
export SERVER_NAME SERVER_PORT

if docker-compose up -d 2>&1; then
    success "Container created: $CONTAINER_NAME"
    success "Server started successfully"
    info ""
    info "View logs with: ${YELLOW}docker logs -f $CONTAINER_NAME${NC}"
    info "Stop server with: ${YELLOW}docker stop $CONTAINER_NAME${NC}"
    info ""
    info "Health check will begin in 30 seconds..."
    info "Server will be ready when logs show: 'Done! For help, type \"help\"'"
    exit 0
else
    error "Failed to start server"
    echo "Check docker-compose logs for details" >&2
    exit 1
fi
