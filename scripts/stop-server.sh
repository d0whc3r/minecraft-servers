#!/usr/bin/env bash
#
# stop-server.sh - Stop a specific Minecraft server
#
# Usage: ./scripts/stop-server.sh <server-name> [options]
#
# Options:
#   --purge              Remove EVERYTHING (container, data, backups, config)
#   --remove-data        Remove server data directory only
#   --remove-backups     Remove backup directory only
#   --remove-config      Remove configuration file only
#   --remove-container   Remove container and volumes only (keep data/backups/config)
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

warning() {
    echo -e "${YELLOW}WARNING: $1${NC}" >&2
}

confirm() {
    local prompt="$1"
    local response
    read -p "$prompt (yes/no): " response
    [[ "$response" =~ ^[Yy][Ee]?[Ss]?$ ]]
}

# Parse options
PURGE=false
REMOVE_DATA=false
REMOVE_BACKUPS=false
REMOVE_CONFIG=false
REMOVE_CONTAINER=false
SERVER_NAME=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            echo "Usage: $0 <server-name> [options]"
            echo ""
            echo "Options:"
            echo "  --purge              Remove container, data, and backups (preserves config)"
            echo "  --remove-data        Remove server data directory only"
            echo "  --remove-backups     Remove backup directory only"
            echo "  --remove-config      Remove configuration file only"
            echo "  --remove-container   Remove container and volumes only"
            echo "  -h, --help           Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 vanilla                          # Stop server normally"
            echo "  $0 vanilla --remove-data            # Stop and remove world data"
            echo "  $0 vanilla --remove-backups         # Stop and remove backups"
            echo "  $0 vanilla --purge                  # Stop and remove everything (keeps config)"
            echo "  $0 vanilla --purge --remove-config  # Stop and remove EVERYTHING including config"
            exit 0
            ;;
        --purge)
            PURGE=true
            shift
            ;;
        --remove-data)
            REMOVE_DATA=true
            shift
            ;;
        --remove-backups)
            REMOVE_BACKUPS=true
            shift
            ;;
        --remove-config)
            REMOVE_CONFIG=true
            shift
            ;;
        --remove-container)
            REMOVE_CONTAINER=true
            shift
            ;;
        -*)
            error "Unknown option: $1"
            echo "Use --help for usage information" >&2
            exit 2
            ;;
        *)
            if [ -z "$SERVER_NAME" ]; then
                SERVER_NAME="$1"
            else
                error "Multiple server names provided"
                exit 2
            fi
            shift
            ;;
    esac
done

# Check arguments
if [ -z "$SERVER_NAME" ]; then
    error "Missing server name argument"
    echo "Usage: $0 <server-name> [options]" >&2
    echo "" >&2
    echo "Options:" >&2
    echo "  --purge              Remove container, data, and backups (preserves config)" >&2
    echo "  --remove-data        Remove server data directory only" >&2
    echo "  --remove-backups     Remove backup directory only" >&2
    echo "  --remove-config      Remove configuration file only" >&2
    echo "  --remove-container   Remove container and volumes only" >&2
    echo "" >&2
    echo "Running servers:" >&2
    docker ps --filter "name=mc-" --format "table {{.Names}}\t{{.Ports}}" | grep mc- | sed 's/mc-//' | sed 's/  - /  - /' >&2 || echo "  (none running)" >&2
    exit 2
fi

CONTAINER_NAME="mc-${SERVER_NAME}"
CONFIG_FILE="config/modpacks/${SERVER_NAME}.env"
DATA_DIR="servers/${SERVER_NAME}"
BACKUP_DIR="backups/${SERVER_NAME}"

# If --purge is set, enable all removal flags EXCEPT config
# Config is the source of truth and should never be auto-deleted
if [ "$PURGE" = true ]; then
    REMOVE_DATA=true
    REMOVE_BACKUPS=true
    REMOVE_CONTAINER=true
    # REMOVE_CONFIG stays false - config is preserved
fi

# Validate server name format
if [[ ! "$SERVER_NAME" =~ ^[a-z0-9-]+$ ]]; then
    error "Invalid server name format: $SERVER_NAME"
    echo "Server names must contain only lowercase letters, numbers, and hyphens" >&2
    exit 2
fi

# Check if container exists and is running
CONTAINER_RUNNING=false
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    CONTAINER_RUNNING=true
fi

# Check if container exists (stopped or running)
CONTAINER_EXISTS=false
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    CONTAINER_EXISTS=true
fi

# If not running and no removal flags, error
if [ "$CONTAINER_RUNNING" = false ] && [ "$REMOVE_DATA" = false ] && [ "$REMOVE_BACKUPS" = false ] && [ "$REMOVE_CONFIG" = false ] && [ "$REMOVE_CONTAINER" = false ]; then
    error "Server '$SERVER_NAME' is not running"
    echo "" >&2
    echo "Running servers:" >&2
    docker ps --filter "name=mc-" --format "table {{.Names}}\t{{.Ports}}" | grep mc- | sed 's/mc-//' | sed 's/  - /  - /' >&2 || echo "  (none running)" >&2
    echo "" >&2
    echo "To remove server data, use: $0 $SERVER_NAME --purge" >&2
    exit 3
fi

# Display stop information
info ""
info "Stopping Minecraft server: ${YELLOW}${SERVER_NAME}${NC}"
success "Container name: $CONTAINER_NAME"

# Show what will be removed
if [ "$PURGE" = true ]; then
    warning "PURGE MODE: Server runtime data will be permanently deleted!"
    info "  • Container and volumes"
    info "  • Server data: $DATA_DIR"
    info "  • Backups: $BACKUP_DIR"
    success " Config PRESERVED: $CONFIG_FILE (source of truth)"
    echo ""
    if ! confirm "Are you sure you want to purge runtime data for $SERVER_NAME?"; then
        info "Purge cancelled."
        exit 0
    fi
elif [ "$REMOVE_DATA" = true ] || [ "$REMOVE_BACKUPS" = true ] || [ "$REMOVE_CONFIG" = true ] || [ "$REMOVE_CONTAINER" = true ]; then
    warning "The following will be removed:"
    [ "$REMOVE_CONTAINER" = true ] && info "  • Container and volumes"
    [ "$REMOVE_DATA" = true ] && info "  • Server data: $DATA_DIR"
    [ "$REMOVE_BACKUPS" = true ] && info "  • Backups: $BACKUP_DIR"
    [ "$REMOVE_CONFIG" = true ] && info "  • Config: $CONFIG_FILE"
    echo ""
    if ! confirm "Are you sure you want to remove these items for $SERVER_NAME?"; then
        info "Removal cancelled."
        exit 0
    fi
fi

info ""

# Stop the container using docker-compose (if running)
if [ "$CONTAINER_RUNNING" = true ] || [ "$CONTAINER_EXISTS" = true ]; then
    info "Stopping container..."
    if docker-compose -p "mc-${SERVER_NAME}" down -v 2>&1; then
        success "Container stopped and removed"
    else
        error "Failed to stop container"
        echo "Check docker-compose logs for details" >&2
        exit 1
    fi
fi

# Remove data directory
if [ "$REMOVE_DATA" = true ]; then
    if [ -d "$DATA_DIR" ]; then
        info "Removing server data directory: $DATA_DIR"
        rm -rf "$DATA_DIR"
        success "Server data removed"
    else
        warning "Data directory does not exist: $DATA_DIR"
    fi
fi

# Remove backups directory
if [ "$REMOVE_BACKUPS" = true ]; then
    if [ -d "$BACKUP_DIR" ]; then
        info "Removing backups directory: $BACKUP_DIR"
        rm -rf "$BACKUP_DIR"
        success "Backups removed"
    else
        warning "Backup directory does not exist: $BACKUP_DIR"
    fi
fi

# Remove config file
if [ "$REMOVE_CONFIG" = true ]; then
    if [ -f "$CONFIG_FILE" ]; then
        info "Removing configuration file: $CONFIG_FILE"
        rm -f "$CONFIG_FILE"
        success "Configuration removed"
    else
        warning "Config file does not exist: $CONFIG_FILE"
    fi
fi

# Final message
info ""
if [ "$PURGE" = true ]; then
    success "Server '$SERVER_NAME' runtime data has been purged"
    info "Removed: container, data, and backups"
    success "Configuration preserved: $CONFIG_FILE"
    info ""
    info "To recreate the server with same config:"
    info "  ${YELLOW}./scripts/start-server.sh $SERVER_NAME${NC}"
elif [ "$REMOVE_DATA" = true ] || [ "$REMOVE_BACKUPS" = true ] || [ "$REMOVE_CONFIG" = true ] || [ "$REMOVE_CONTAINER" = true ]; then
    success "Selected items removed for server '$SERVER_NAME'"
else
    success "Server stopped successfully"
    info "Container stopped. World data is preserved."
    info "Start again with: ${YELLOW}./scripts/start-server.sh $SERVER_NAME${NC}"
fi

info ""
exit 0