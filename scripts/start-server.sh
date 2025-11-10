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

# Load common functions
source "$(dirname "$0")/common.sh"

# Check arguments
if [ $# -lt 1 ]; then
  error "Missing server name argument"
  echo "Usage: $0 <server-name>" >&2
  echo "" >&2
  echo "Available servers:" >&2
  list_available_servers >&2
  exit 2
fi

SERVER_NAME="$1"

# Validate server name
if ! validate_server_name "$SERVER_NAME"; then
  exit 2
fi

# Check configuration exists
if ! check_config_exists "$SERVER_NAME"; then
  exit 3
fi

# Check Docker daemon
if ! check_docker_running; then
  exit 1
fi

# Get paths
CONTAINER_NAME=$(get_container_name "$SERVER_NAME")
CONFIG_FILE=$(get_config_file "$SERVER_NAME")

# Check if container already running
if container_running "$CONTAINER_NAME"; then
  error "Container $CONTAINER_NAME is already running"
  echo "Use './scripts/restart-server.sh $SERVER_NAME' to restart" >&2
  exit 4
fi

# Load environment to get port
source "$CONFIG_FILE"

# Ensure directories exist
ensure_directory "servers/${SERVER_NAME}/data"
ensure_directory "servers/${SERVER_NAME}/mods"
ensure_directory "backups/${SERVER_NAME}"

# Ensure network exists
ensure_network

# Display startup information
info ""
info "Starting Minecraft server: ${YELLOW}${SERVER_NAME}${NC}"
success "Loading config from: $CONFIG_FILE"
success "Container name: $CONTAINER_NAME"
success "Port: ${SERVER_PORT:-auto}"
info ""

# Start server
if docker_compose_up "$SERVER_NAME"; then
  success "Container created: $CONTAINER_NAME"
  success "Server started successfully"
  info ""
  info "View logs with: ${YELLOW}docker logs -f $CONTAINER_NAME${NC}"
  info "Stop server with: ${YELLOW}./scripts/stop-server.sh $SERVER_NAME${NC}"
  info ""
  info "Health check will begin in 30 seconds..."
  info "Server will be ready when logs show: 'Done! For help, type \"help\"'"
  exit 0
else
  error "Failed to start server"
  echo "Check docker compose logs for details" >&2
  exit 1
fi
