#!/usr/bin/env bash
#
# start-all.sh - Start all configured Minecraft servers
#
# Usage: ./scripts/start-all.sh
#
# Exit Codes:
#   0 - All servers started successfully
#   1 - One or more servers failed to start
#   4 - No configuration files found

# Load common functions
source "$(dirname "$0")/common.sh"

# Check if config directory exists
if [ ! -d "config/modpacks" ]; then
  error "Configuration directory not found: config/modpacks/"
  exit 4
fi

# Find all .env files
CONFIG_FILES=(config/modpacks/*.env)

# Check if any configs exist
if [ ! -e "${CONFIG_FILES[0]}" ]; then
  error "No server configurations found in config/modpacks/"
  echo "Create a server configuration first or run: ./scripts/add-modpack.sh <name>" >&2
  exit 4
fi

info ""
info "${BLUE}Starting all Minecraft servers...${NC}"
info ""

STARTED=0
FAILED=0
declare -a STARTED_SERVERS
declare -a FAILED_SERVERS

# Router settings for the per-server route hostnames
load_router_settings

# Iterate through each config file
for config in "${CONFIG_FILES[@]}"; do
  SERVER_NAME=$(basename "$config" .env)

  info "Starting: ${YELLOW}${SERVER_NAME}${NC}"

  # Use start-server.sh script for each server
  if ./scripts/start-server.sh "$SERVER_NAME" > /dev/null 2>&1; then
    STARTED_SERVERS+=("${SERVER_NAME} ($(get_route_host "$SERVER_NAME"))")
    ((STARTED++))
  else
    FAILED_SERVERS+=("${SERVER_NAME}")
    ((FAILED++))
  fi

  info ""
done

# Summary
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info ""

if [ ${STARTED} -gt 0 ]; then
  success "Started servers (${STARTED}):"
  for server in "${STARTED_SERVERS[@]}"; do
    echo "  • $server"
  done
  info ""
fi

if [ ${FAILED} -gt 0 ]; then
  error "Failed servers (${FAILED}):"
  for server in "${FAILED_SERVERS[@]}"; do
    echo "  • $server"
  done
  info ""
fi

info "Total: ${GREEN}${STARTED} started${NC}, ${RED}${FAILED} failed${NC}"
info ""
info "View status with: ${YELLOW}./scripts/list-servers.sh${NC}"
info ""

[ ${FAILED} -eq 0 ] && exit 0 || exit 1
