#!/usr/bin/env bash
#
# stop-all.sh - Stop all running Minecraft servers gracefully
#
# Usage: ./scripts/stop-all.sh [options]
#
# Options:
#   --prune             Remove containers, data, and backups for ALL servers (preserves configs)
#   -h, --help          Show this help message
#
# Exit Codes:
#   0 - All servers stopped successfully
#   1 - One or more servers had issues stopping
#   5 - Timeout waiting for graceful shutdown

# Load common functions
source "$(dirname "$0")/common.sh"

# Parse options
PRUNE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --prune             Stop running servers and remove containers, data, and backups for ALL configured servers (preserves configs)"
            echo "  -h, --help          Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                   # Stop all running servers normally"
            echo "  $0 --prune           # Stop all running servers and remove runtime data for ALL configured servers"
            exit 0
            ;;
        --prune)
            PRUNE=true
            shift
            ;;
        -*)
            error "Unknown option: $1"
            echo "Use --help for usage information" >&2
            exit 2
            ;;
        *)
            error "Unexpected argument: $1"
            echo "Use --help for usage information" >&2
            exit 2
            ;;
    esac
done

info ""
if [ "$PRUNE" = true ]; then
    info "${RED}PRUNE MODE: Runtime data will be permanently deleted for ALL configured servers!${NC}"
    info "This will:"
    info "  • Stop any running servers"
    info "  • Remove all containers and volumes"
    info "  • Remove all server data directories"
    info "  • Remove all backup directories"
    success "Configurations will be PRESERVED (source of truth)"
    info ""
    if ! confirm "Are you sure you want to prune runtime data for ALL configured servers?"; then
        info "Prune cancelled."
        exit 0
    fi
    info ""
fi

info "${BLUE}Stopping all Minecraft servers gracefully...${NC}"
info ""

# Determine which servers to process
if [ "$PRUNE" = true ]; then
    # In prune mode, process ALL configured servers
    ALL_SERVERS=$(list_available_servers)
    if [ -z "$ALL_SERVERS" ]; then
        info "No configured Minecraft servers found."
        info ""
        exit 0
    fi
    info "Processing all configured servers (${PRUNE:+with prune})..."
else
    # Normal mode: only process running servers
    ALL_SERVERS=$(list_running_servers)
    if [ -z "$ALL_SERVERS" ]; then
        info "No running Minecraft servers found."
        info ""
        exit 0
    fi
fi

STOPPED=0
FAILED=0
PRUNED=0
PRUNE_FAILED=0
declare -a STOPPED_SERVERS
declare -a FAILED_SERVERS
declare -a PRUNED_SERVERS
declare -a PRUNE_FAILED_SERVERS

# Process each server
for SERVER_NAME in $ALL_SERVERS; do
    CONTAINER_NAME=$(get_container_name "$SERVER_NAME")
    IS_RUNNING=$(container_running "$CONTAINER_NAME" && echo true || echo false)
    
    if [ "$IS_RUNNING" = true ]; then
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
    elif [ "$PRUNE" = true ]; then
        info "Processing stopped server: ${YELLOW}${SERVER_NAME}${NC}"
    else
        # Skip stopped servers in normal mode
        continue
    fi
    
    # If prune mode, remove data and backups regardless of stop success
    if [ "$PRUNE" = true ]; then
        if prune_server_data "$SERVER_NAME"; then
            success "  Runtime data pruned"
            PRUNED_SERVERS+=("${SERVER_NAME}")
            ((PRUNED++))
        else
            warning "  Failed to prune some data"
            PRUNE_FAILED_SERVERS+=("${SERVER_NAME}")
            ((PRUNE_FAILED++))
        fi
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

if [ "$PRUNE" = true ]; then
    if [ ${PRUNED} -gt 0 ]; then
        success "Pruned servers (${PRUNED}):"
        for server in "${PRUNED_SERVERS[@]}"; do
            echo "  • $server"
        done
        info ""
    fi
    
    if [ ${PRUNE_FAILED} -gt 0 ]; then
        error "Failed to prune (${PRUNE_FAILED}):"
        for server in "${PRUNE_FAILED_SERVERS[@]}"; do
            echo "  • $server"
        done
        info ""
    fi
fi

if [ "$PRUNE" = true ]; then
    success "All configured servers processed and runtime data pruned."
    info "Removed: containers, data directories, and backups"
    success "Configurations preserved for all servers"
    info ""
    info "To recreate servers with same configs:"
    info "  ${YELLOW}./scripts/start-all.sh${NC}"
else
    info "All running servers stopped. Worlds have been saved."
    info ""
    info "Start servers again with: ${YELLOW}./scripts/start-all.sh${NC}"
fi

info ""

[ ${FAILED} -eq 0 ] && [ ${PRUNE_FAILED} -eq 0 ] && exit 0 || exit 1
