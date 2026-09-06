#!/bin/bash
# health-check.sh - Server health monitoring and status checking
# Part of minecraft-servers multi-configuration system
# Contract: contracts/management-api.md

set -euo pipefail

# Load common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
source "$SCRIPT_DIR/common.sh"

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
    -a | --all)
      ALL_SERVERS=true
      shift
      ;;
    -v | --verbose)
      VERBOSE=true
      shift
      ;;
    -j | --json)
      JSON_OUTPUT=true
      shift
      ;;
    -h | --help)
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
    for config_file in config/modpacks/*.env; do
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
  check_config_exists "$server_name"
}

# Get server configuration
get_server_config() {
  local server_name="$1"
  local key="$2"
  local config_file
  config_file=$(get_config_file "$server_name")

  if [[ ! -f "$config_file" ]]; then
    return 1
  fi

  grep "^${key}=" "$config_file" | cut -d'=' -f2- | sed 's/^"//' | sed 's/"$//'
}

# Check if Docker container is running
check_container_running() {
  local server_name="$1"
  local container_name
  container_name=$(get_container_name "$server_name")
  container_running "$container_name"
}

# Check the shared mc-router entry point. A down router means players cannot
# connect to any server, but the servers themselves are fine — reported as a
# warning instead of failing every per-server health check.
check_router_entry() {
  load_router_settings

  if check_port_open "$MC_ROUTER_PORT"; then
    success "mc-router entry point responsive on port $MC_ROUTER_PORT"
  else
    warning "mc-router entry point NOT responding on port $MC_ROUTER_PORT - players cannot connect (try: ./scripts/router.sh start)"
  fi
  return 0
}

# Check server process health via Docker logs
check_server_logs() {
  local server_name="$1"
  local container_name="mc-${server_name}"

  # Get recent logs (last 50 lines)
  local logs
  logs=$(docker logs --tail 50 "$container_name" 2> /dev/null)

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
  local server_dir="servers/$server_name"

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

  # Settings feed the reachability check below
  load_router_settings

  # Check if server is configured
  if ! server_exists "$server_name"; then
    echo "error:server_not_found"
    return 1
  fi

  # Check if server directory exists (is deployed)
  local server_dir="servers/$server_name"
  if [[ ! -d "$server_dir" ]]; then
    health_status="not_deployed"
    details+=("server:not_deployed")
  else
    # Check container running
    if check_container_running "$server_name"; then
      details+=("container:running")
    else
      health_status="stopped"
      issues+=("container_not_running")
      details+=("container:stopped")
    fi

    # Game traffic is routed by mc-router; container health + logs cover the
    # server itself and check_router_entry covers the shared entry point
    if check_container_running "$server_name"; then
      details+=("port:routed_via_mc-router")
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

    # Check disk space (only for deployed servers and only warn if container is running)
    if check_container_running "$server_name"; then
      if check_disk_space "$server_name"; then
        details+=("disk:healthy")
      else
        health_status="warning"
        issues+=("low_disk_space")
        details+=("disk:low_space")
      fi
    else
      details+=("disk:not_checked")
    fi
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
    warning) return 0 ;;      # Warnings don't fail the check
    stopped) return 0 ;;      # Stopped servers are not errors
    not_deployed) return 0 ;; # Not deployed servers are not errors
    unhealthy) return 1 ;;
  esac
}

# Main execution
main() {
  # Shared entry point first: if mc-router is down every route is dark,
  # regardless of individual server health
  if [[ "$JSON_OUTPUT" == false ]]; then
    check_router_entry
  fi

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
      overall_status=4 # Health check failed
    fi
  done

  if [[ "$JSON_OUTPUT" == true ]]; then
    echo "]" >&2
  fi

  return $overall_status
}

# Run main function
main "$@"
