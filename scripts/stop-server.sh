#!/usr/bin/env bash
#
# stop-server.sh - Stop a specific Minecraft server
#
# Usage: ./scripts/stop-server.sh <server-name> [options]
#
# Options:
#   --purge              Remove container and data (preserves config and backups)
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

# Load common functions
source "$(dirname "$0")/common.sh"

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
            echo "  --purge              Remove container and data (preserves config and backups)"
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
    echo "  --purge              Remove container and data (preserves config and backups)" >&2
    echo "  --remove-data        Remove server data directory only" >&2
    echo "  --remove-backups     Remove backup directory only" >&2
    echo "  --remove-config      Remove configuration file only" >&2
    echo "  --remove-container   Remove container and volumes only" >&2
    echo "" >&2
    echo "Running servers:" >&2
    list_running_servers | sed 's/^/  - /' >&2 || echo "  (none running)" >&2
    exit 2
fi

# Validate server name
if ! validate_server_name "$SERVER_NAME"; then
    exit 2
fi

# Get paths
CONTAINER_NAME=$(get_container_name "$SERVER_NAME")
CONFIG_FILE=$(get_config_file "$SERVER_NAME")
DATA_DIR=$(get_data_dir "$SERVER_NAME")
BACKUP_DIR=$(get_backup_dir "$SERVER_NAME")

# If --purge is set, enable removal flags EXCEPT config and backups
# Config and backups are preserved
if [ "$PURGE" = true ]; then
    REMOVE_DATA=true
    REMOVE_CONTAINER=true
    # REMOVE_BACKUPS stays false - backups are preserved
    # REMOVE_CONFIG stays false - config is preserved
fi

# Check container status
CONTAINER_RUNNING=$(container_running "$CONTAINER_NAME" && echo true || echo false)
CONTAINER_EXISTS=$(container_exists "$CONTAINER_NAME" && echo true || echo false)

# If not running and no removal flags, error
if [ "$CONTAINER_RUNNING" = false ] && [ "$REMOVE_DATA" = false ] && [ "$REMOVE_BACKUPS" = false ] && [ "$REMOVE_CONFIG" = false ] && [ "$REMOVE_CONTAINER" = false ]; then
    error "Server '$SERVER_NAME' is not running"
    echo "" >&2
    echo "Running servers:" >&2
    list_running_servers | sed 's/^/  - /' >&2 || echo "  (none running)" >&2
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
    success "Config and backups PRESERVED"
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

# Stop the container using docker compose (if running)
if [ "$CONTAINER_RUNNING" = true ] || [ "$CONTAINER_EXISTS" = true ]; then
    info "Stopping container..."
    if docker_compose_down "$SERVER_NAME"; then
        success "Container stopped and removed"
    else
        error "Failed to stop container"
        echo "Check docker compose logs for details" >&2
        exit 1
    fi
fi

# Prune server data if purge mode
if [ "$PURGE" = true ]; then
    if prune_server_data "$SERVER_NAME"; then
        success "Runtime data pruned"
    else
        warning "Some data may not have been removed"
    fi
else
    # Remove data directory
    if [ "$REMOVE_DATA" = true ]; then
        if remove_directory "$DATA_DIR"; then
            success "Server data removed"
        fi
    fi

    # Remove backups directory
    if [ "$REMOVE_BACKUPS" = true ]; then
        if remove_directory "$BACKUP_DIR"; then
            success "Backups removed"
        fi
    fi
fi

# Remove config file
if [ "$REMOVE_CONFIG" = true ]; then
    if remove_file "$CONFIG_FILE"; then
        success "Configuration removed"
    fi
fi

# Final message
info ""
if [ "$PURGE" = true ]; then
    success "Server '$SERVER_NAME' runtime data has been purged"
    info "Removed: container and data"
    success "Configuration and backups preserved"
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