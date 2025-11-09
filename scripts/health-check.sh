#!/bin/bash
# health-check.sh - Server health monitoring and status checking
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
Usage: $0 [OPTIONS] [SERVER_NAME]

Check health status of Minecraft servers.

OPTIONS:
    -a, --all              Check all configured servers
    -v, --verbose          Show detailed health information
    -j, --json             Output in JSON format
    -h, --help             Show this help message

ARGUMENTS:
    SERVER_NAME            Name of specific server to check (optional with --all)

EXAMPLES:
    $0 atm8                 # Check specific server
    $0 --all                # Check all servers
    $0 --all --json         # Check all servers, JSON output
    $0 --all --verbose      # Check all servers with details

EXIT CODES:
    0  Success - all servers healthy
    1  Error - script execution failed
    2  Invalid arguments
    3  Server not found
    4  Health check failed (one or more servers unhealthy)
EOF
}

# Parse command line arguments
ALL_SERVERS=false
VERBOSE=false
JSON_OUTPUT=false
SERVER_NAME=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -a|--all)
            ALL_SERVERS=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -j|--json)
            JSON_OUTPUT=true
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
            if [[ -n "$SERVER_NAME" ]]; then
                log_error "Multiple server names specified"
                usage
                exit 2
            fi
            SERVER_NAME="$1"
            shift
            ;;
    esac
done

# Validate arguments
if [[ "$ALL_SERVERS" == false && -z "$SERVER_NAME" ]]; then
    log_error "Must specify either --all or a server name"
    usage
    exit 2
fi

if [[ "$ALL_SERVERS" == true && -n "$SERVER_NAME" ]]; then
    log_error "Cannot specify both --all and a server name"
    usage
    exit 2
fi

# Get list of servers to check
get_server_list() {
    if [[ "$ALL_SERVERS" == true ]]; then
        # Get all configured servers
        for config_file in "$CONFIG_DIR"/*.env; do
            if [[ -f "$config_file" ]]; then
                basename "$config_file" .env
            fi
        done | sort
    else
        echo "$SERVER_NAME"
    fi
}

# Check if server is configured
server_exists() {
    local server_name="$1"
    [[ -f "$CONFIG_DIR/${server_name}.env" ]]
}

# Get server configuration
get_server_config() {
    local server_name="$1"
    local key="$2"
    local config_file="$CONFIG_DIR/${server_name}.env"

    if [[ ! -f "$config_file" ]]; then
        return 1
    fi

    grep "^${key}=" "$config_file" | cut -d'=' -f2- | sed 's/^"//' | sed 's/"$//'
}

# Check if Docker container is running
check_container_running() {
    local server_name="$1"
    local container_name="mc-${server_name}"

    if docker ps --format "table {{.Names}}" | grep -q "^${container_name}$"; then
        return 0
    else
        return 1
    fi
}

# Check if server is responding on configured port
check_server_port() {
    local server_name="$1"
    local port

    port=$(get_server_config "$server_name" "SERVER_PORT")
    if [[ -z "$port" ]]; then
        return 1
    fi

    # Use timeout to avoid hanging
    if timeout 5 bash -c "</dev/tcp/localhost/$port" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Check server process health via Docker logs
check_server_logs() {
    local server_name="$1"
    local container_name="mc-${server_name}"

    # Get recent logs (last 50 lines)
    local logs
    logs=$(docker logs --tail 50 "$container_name" 2>/dev/null)

    # Check for error patterns
    if echo "$logs" | grep -qi "error\|exception\|failed\|crash"; then
        return 1
    fi

    # Check for successful startup indicators
    if echo "$logs" | grep -q "Done.*For help"; then
        return 0
    fi

    # If container is running but no clear indicators, assume healthy
    return 0
}

# Check disk space for server data
check_disk_space() {
    local server_name="$1"
    local server_dir="$SERVERS_DIR/$server_name"

    if [[ ! -d "$server_dir" ]]; then
        return 1
    fi

    # Check if disk usage is over 90%
    local usage
    usage=$(df "$server_dir" | tail -1 | awk '{print $5}' | sed 's/%//')

    if [[ "$usage" -gt 90 ]]; then
        return 1
    fi

    return 0
}

# Perform comprehensive health check for a server
check_server_health() {
    local server_name="$1"
    local health_status="healthy"
    local issues=()
    local details=()

    # Check if server is configured
    if ! server_exists "$server_name"; then
        echo "error:server_not_found"
        return 1
    fi

    # Check container running
    if check_container_running "$server_name"; then
        details+=("container:running")
    else
        health_status="unhealthy"
        issues+=("container_not_running")
        details+=("container:stopped")
    fi

    # Check port connectivity (only if container is running)
    if check_container_running "$server_name"; then
        if check_server_port "$server_name"; then
            details+=("port:responsive")
        else
            health_status="unhealthy"
            issues+=("port_not_responding")
            details+=("port:unresponsive")
        fi
    else
        details+=("port:unknown")
    fi

    # Check logs for errors (only if container is running)
    if check_container_running "$server_name"; then
        if check_server_logs "$server_name"; then
            details+=("logs:healthy")
        else
            health_status="warning"
            issues+=("logs_show_errors")
            details+=("logs:errors_detected")
        fi
    else
        details+=("logs:unknown")
    fi

    # Check disk space
    if check_disk_space "$server_name"; then
        details+=("disk:healthy")
    else
        health_status="warning"
        issues+=("low_disk_space")
        details+=("disk:low_space")
    fi

    # Format output
    if [[ "$JSON_OUTPUT" == true ]]; then
        local issues_json="[]"
        local details_json="[]"

        if [[ ${#issues[@]} -gt 0 ]]; then
            issues_json=$(printf '%s\n' "${issues[@]}" | jq -R . | jq -s .)
        fi

        if [[ ${#details[@]} -gt 0 ]]; then
            details_json=$(printf '%s\n' "${details[@]}" | jq -R . | jq -s .)
        fi

        jq -n \
            --arg server "$server_name" \
            --arg status "$health_status" \
            --argjson issues "$issues_json" \
            --argjson details "$details_json" \
            '{server: $server, status: $status, issues: $issues, details: $details}'
    else
        if [[ "$VERBOSE" == true ]]; then
            echo "$server_name:$health_status"
            if [[ ${#issues[@]} -gt 0 ]]; then
                echo "  Issues: ${issues[*]}"
            fi
            echo "  Details: ${details[*]}"
        else
            echo "$server_name:$health_status"
        fi
    fi

    # Return health status as exit code
    case "$health_status" in
        healthy) return 0 ;;
        warning) return 0 ;;  # Warnings don't fail the check
        unhealthy) return 1 ;;
    esac
}

# Main execution
main() {
    local servers
    servers=$(get_server_list)
    local overall_status=0
    local results=()

    if [[ "$JSON_OUTPUT" == true ]]; then
        echo "[" >&2
        local first=true
    fi

    for server in $servers; do
        if [[ "$JSON_OUTPUT" == true ]]; then
            if [[ "$first" == false ]]; then
                echo "," >&2
            fi
            first=false
        fi

        if ! check_server_health "$server"; then
            overall_status=4  # Health check failed
        fi
    done

    if [[ "$JSON_OUTPUT" == true ]]; then
        echo "]" >&2
    fi

    return $overall_status
}

# Run main function
main "$@"