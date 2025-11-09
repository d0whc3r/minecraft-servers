#!/bin/bash
# auto-restart.sh - Automatically restart unhealthy Minecraft servers
# Part of minecraft-servers multi-configuration system
# Contract: contracts/management-api.md

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="$PROJECT_ROOT/config/modpacks"
SERVERS_DIR="$PROJECT_ROOT/servers"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Show usage information
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Automatically restart unhealthy Minecraft servers.

OPTIONS:
    -d, --daemon           Run in daemon mode (continuous monitoring)
    -i, --interval=SECONDS Interval between health checks (default: 300)
    -t, --timeout=SECONDS  Timeout for restart operations (default: 300)
    -f, --force            Force restart even if health check passes
    -n, --dry-run          Show what would be done without making changes
    -v, --verbose          Show detailed output
    -h, --help             Show this help message

EXAMPLES:
    $0                      # One-time check and restart unhealthy servers
    $0 --daemon             # Run continuously every 5 minutes
    $0 --interval=600       # Check every 10 minutes
    $0 --dry-run --verbose  # Show what would be restarted

EXIT CODES:
    0  Success - no restarts needed or all restarts successful
    1  Error - script execution failed
    2  Invalid arguments
    3  Restart failed for one or more servers
EOF
}

# Default values
DAEMON_MODE=false
INTERVAL=300
TIMEOUT=300
FORCE_RESTART=false
DRY_RUN=false
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--daemon)
            DAEMON_MODE=true
            shift
            ;;
        -i|--interval=*)
            INTERVAL="${1#*=}"
            if ! [[ "$INTERVAL" =~ ^[0-9]+$ ]] || [[ "$INTERVAL" -lt 30 ]]; then
                log_error "Interval must be a number >= 30 seconds"
                exit 2
            fi
            shift
            ;;
        -t|--timeout=*)
            TIMEOUT="${1#*=}"
            if ! [[ "$TIMEOUT" =~ ^[0-9]+$ ]] || [[ "$TIMEOUT" -lt 30 ]]; then
                log_error "Timeout must be a number >= 30 seconds"
                exit 2
            fi
            shift
            ;;
        -f|--force)
            FORCE_RESTART=true
            shift
            ;;
        -n|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        -*)
            log_error "Unknown option: $1"
            usage
            exit 2
            ;;
        *)
            log_error "Unexpected argument: $1"
            usage
            exit 2
            ;;
    esac
done

# Get list of configured servers
get_configured_servers() {
    for config_file in "$CONFIG_DIR"/*.env; do
        if [[ -f "$config_file" ]]; then
            basename "$config_file" .env
        fi
    done | sort
}

# Check if server container exists
server_container_exists() {
    local server_name="$1"
    local container_name="mc-${server_name}"
    docker ps -a --format "table {{.Names}}" | grep -q "^${container_name}$"
}

# Check server health status
get_server_health() {
    local server_name="$1"
    local container_name="mc-${server_name}"

    if ! server_container_exists "$server_name"; then
        echo "not_deployed"
        return
    fi

    # Get container status
    local status
    status=$(docker inspect --format='{{.State.Status}}' "$container_name" 2>/dev/null || echo "unknown")

    if [[ "$status" != "running" ]]; then
        echo "stopped"
        return
    fi

    # Get health status
    local health
    health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' "$container_name" 2>/dev/null || echo "unknown")

    echo "$health"
}

# Restart a server
restart_server() {
    local server_name="$1"
    local reason="$2"

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would restart $server_name (reason: $reason)"
        return 0
    fi

    log_warning "Restarting $server_name (reason: $reason)"

    # Use existing restart script
    if [[ -x "$SCRIPT_DIR/restart-server.sh" ]]; then
        if timeout "$TIMEOUT" "$SCRIPT_DIR/restart-server.sh" "$server_name"; then
            log_success "Successfully restarted $server_name"
            return 0
        else
            log_error "Failed to restart $server_name"
            return 1
        fi
    else
        # Fallback to direct docker commands
        local container_name="mc-${server_name}"

        if docker restart "$container_name" >/dev/null 2>&1; then
            log_success "Successfully restarted $server_name"
            return 0
        else
            log_error "Failed to restart $server_name"
            return 1
        fi
    fi
}

# Check and restart unhealthy servers
check_and_restart() {
    local servers
    servers=$(get_configured_servers)
    local restart_count=0
    local failed_count=0

    for server in $servers; do
        local health
        health=$(get_server_health "$server")

        if [[ "$VERBOSE" == true ]]; then
            log_info "Server $server health: $health"
        fi

        local needs_restart=false
        local reason=""

        case "$health" in
            unhealthy)
                needs_restart=true
                reason="unhealthy"
                ;;
            stopped)
                needs_restart=true
                reason="stopped"
                ;;
            unknown)
                # If health is unknown but container exists, it might be a health check issue
                if server_container_exists "$server"; then
                    needs_restart=true
                    reason="health_check_unknown"
                fi
                ;;
        esac

        if [[ "$FORCE_RESTART" == true && "$health" != "not_deployed" ]]; then
            needs_restart=true
            reason="force_restart"
        fi

        if [[ "$needs_restart" == true ]]; then
            if restart_server "$server" "$reason"; then
                ((restart_count++))
            else
                ((failed_count++))
            fi
        fi
    done

    # Report results
    if [[ "$restart_count" -gt 0 ]]; then
        log_success "Restarted $restart_count server(s)"
    fi

    if [[ "$failed_count" -gt 0 ]]; then
        log_error "Failed to restart $failed_count server(s)"
        return 3
    fi

    if [[ "$restart_count" -eq 0 && "$failed_count" -eq 0 ]]; then
        if [[ "$VERBOSE" == true ]]; then
            log_info "No servers needed restarting"
        fi
    fi

    return 0
}

# Daemon mode - run continuously
run_daemon() {
    log_info "Starting auto-restart daemon (interval: ${INTERVAL}s)"

    while true; do
        local start_time
        start_time=$(date +%s)

        if ! check_and_restart; then
            log_error "Health check cycle failed"
        fi

        local end_time
        end_time=$(date +%s)
        local elapsed=$((end_time - start_time))
        local sleep_time=$((INTERVAL - elapsed))

        if [[ "$sleep_time" -gt 0 ]]; then
            if [[ "$VERBOSE" == true ]]; then
                log_info "Sleeping for ${sleep_time}s until next check"
            fi
            sleep "$sleep_time"
        else
            log_warning "Health check took longer than interval (${elapsed}s > ${INTERVAL}s)"
        fi
    done
}

# Main execution
main() {
    if [[ "$DAEMON_MODE" == true ]]; then
        run_daemon
    else
        check_and_restart
    fi
}

# Run main function
main "$@"