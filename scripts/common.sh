#!/usr/bin/env bash
#
# common.sh - Common functions and utilities for Minecraft server management scripts
#
# Usage: source "$(dirname "$0")/common.sh"
#

# Ensure script exits on error (but allow arithmetic that evaluates to 0)
set -uo pipefail

# ============================================================================
# COLOR CODES
# ============================================================================

export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export CYAN='\033[0;36m'
export NC='\033[0m' # No Color

# ============================================================================
# OUTPUT FUNCTIONS
# ============================================================================

# Print error message to stderr
error() {
  echo -e "${RED}ERROR: $1${NC}" >&2
}

# Print success message
success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# Print info message
info() {
  echo -e "$1"
}

# Print warning message
warning() {
  echo -e "${YELLOW}WARNING: $1${NC}" >&2
}

# Print debug message (only if DEBUG=true)
debug() {
  if [ "${DEBUG:-false}" = true ]; then
    echo -e "${CYAN}DEBUG: $1${NC}" >&2
  fi
}

# Aliases kept for the scripts that call the log_* naming (add-modpack.sh,
# health-check.sh, validate-config.sh)
log_error() { error "$1"; }
log_info() { info "$1"; }
log_success() { success "$1"; }

# ============================================================================
# VALIDATION FUNCTIONS
# ============================================================================

# Validate server name format
# Args: $1 - server name
# Returns: 0 if valid, 1 if invalid
validate_server_name() {
  local server_name="$1"

  if [[ ! "$server_name" =~ ^[a-z0-9-]+$ ]]; then
    error "Invalid server name format: $server_name"
    info "Server names must contain only lowercase letters, numbers, and hyphens" >&2
    return 1
  fi

  return 0
}

# Check if server configuration exists
# Args: $1 - server name
# Returns: 0 if exists, 1 if not
check_config_exists() {
  local server_name="$1"
  local config_file="config/modpacks/${server_name}.env"

  if [ ! -f "$config_file" ]; then
    error "Configuration not found: $config_file"
    echo "" >&2
    echo "Available servers:" >&2
    list_available_servers | sed 's/^/  - /' >&2
    return 1
  fi

  return 0
}

# Check if Docker daemon is running
# Returns: 0 if running, 1 if not
check_docker_running() {
  if ! docker info > /dev/null 2>&1; then
    error "Docker daemon is not running"
    info "Please start Docker and try again" >&2
    return 1
  fi

  return 0
}

# Check if container exists
# Args: $1 - container name
# Returns: 0 if exists, 1 if not
container_exists() {
  local container_name="$1"
  docker ps -a --format '{{.Names}}' | grep -q "^${container_name}$"
}

# Check if container is running
# Args: $1 - container name
# Returns: 0 if running, 1 if not
container_running() {
  local container_name="$1"
  docker ps --format '{{.Names}}' | grep -q "^${container_name}$"
}

# ============================================================================
# CONFIRMATION FUNCTIONS
# ============================================================================

# Ask user for confirmation
# Args: $1 - prompt message
# Returns: 0 if confirmed, 1 if not
confirm() {
  local prompt="$1"
  local response

  read -p "$prompt (yes/no): " response
  [[ "$response" =~ ^[Yy][Ee]?[Ss]?$ ]]
}

# ============================================================================
# SERVER INFORMATION FUNCTIONS
# ============================================================================

# List available servers (from config files)
list_available_servers() {
  if [ -d "config/modpacks" ]; then
    local configs=(config/modpacks/*.env)
    if [ -e "${configs[0]}" ]; then
      for config in "${configs[@]}"; do
        basename "$config" .env
      done
    fi
  fi
}

# List running servers
list_running_servers() {
  docker ps --filter "name=mc-" --format "{{.Names}}" 2> /dev/null | sed 's/mc-//' || true
}

# Get container name from server name
# Args: $1 - server name
# Returns: container name (stdout)
get_container_name() {
  local server_name="$1"
  echo "mc-${server_name}"
}

# Get human-readable uptime for a container (e.g. "3d 4h", "2h 15m", "8m")
# Args: $1 - container name
# Returns: uptime string (stdout)
get_container_uptime() {
  local container_name="$1"
  local started
  started=$(docker inspect --format='{{.State.StartedAt}}' "$container_name" 2> /dev/null || echo "")
  if [ -z "$started" ]; then
    echo "N/A"
    return 0
  fi

  local started_epoch now_epoch secs days hours mins
  started_epoch=$(date -d "$started" +%s 2> /dev/null || echo 0)
  now_epoch=$(date +%s)
  secs=$((now_epoch - started_epoch))
  [ "$secs" -lt 0 ] && secs=0
  days=$((secs / 86400))
  hours=$(((secs % 86400) / 3600))
  mins=$(((secs % 3600) / 60))

  if [ "$days" -gt 0 ]; then
    echo "${days}d ${hours}h"
  elif [ "$hours" -gt 0 ]; then
    echo "${hours}h ${mins}m"
  else
    echo "${mins}m"
  fi
}

# Get config file path from server name
# Args: $1 - server name
# Returns: config file path (stdout)
get_config_file() {
  local server_name="$1"
  echo "config/modpacks/${server_name}.env"
}

# Get data directory from server name
# Args: $1 - server name
# Returns: data directory path (stdout)
get_data_dir() {
  local server_name="$1"
  echo "servers/${server_name}/data"
}

# Get backup directory from server name
# Args: $1 - server name
# Returns: backup directory path (stdout)
get_backup_dir() {
  local server_name="$1"
  echo "backups/${server_name}"
}

# ============================================================================
# DOCKER COMPOSE HELPERS
# ============================================================================

# Repo root as the Docker daemon resolves it. On the host this is $(pwd);
# inside the panel container the checkout is mounted at /repo - a path that
# does not exist on the host - so the bind-mount sources handed to
# `docker compose` must come from MCPANEL_HOST_ROOT (set by the panel
# deployment) or the daemon rejects them with "mounts denied".
repo_root() {
  echo "${MCPANEL_HOST_ROOT:-$(pwd)}"
}

# Read a variable from an env file (quotes stripped; empty when unset)
# Args: $1 - env file path, $2 - variable name
# Returns: value (stdout)
get_env_value() {
  local file="$1" key="$2"
  grep -m1 "^${key}=" "$file" 2> /dev/null | cut -d= -f2- | tr -d ' "' || true
}

# Load the MC_ROUTER_* settings from the root .env with code defaults
load_router_settings() {
  MC_ROUTER_DOMAIN="${MC_ROUTER_DOMAIN:-$(get_env_value .env MC_ROUTER_DOMAIN)}"
  MC_ROUTER_DOMAIN="${MC_ROUTER_DOMAIN:-mc.local}"
  MC_ROUTER_PORT="${MC_ROUTER_PORT:-$(get_env_value .env MC_ROUTER_PORT)}"
  MC_ROUTER_PORT="${MC_ROUTER_PORT:-25565}"
  MC_ROUTER_API_PORT="${MC_ROUTER_API_PORT:-$(get_env_value .env MC_ROUTER_API_PORT)}"
  MC_ROUTER_API_PORT="${MC_ROUTER_API_PORT:-8080}"
  MC_ROUTER_DOCKER_GID="${MC_ROUTER_DOCKER_GID:-$(get_env_value .env MC_ROUTER_DOCKER_GID)}"
  MC_ROUTER_DOCKER_GID="${MC_ROUTER_DOCKER_GID:-999}"
  export MC_ROUTER_DOMAIN MC_ROUTER_PORT MC_ROUTER_API_PORT MC_ROUTER_DOCKER_GID
}

# Hostname players use to reach a server through mc-router
# Args: $1 - server name (load_router_settings must have run)
# Returns: route hostname (stdout)
get_route_host() {
  echo "${1}.${MC_ROUTER_DOMAIN}"
}

# Check if the mc-router container is running
# Returns: 0 if running, 1 if not
router_running() {
  container_running "minecraft-router"
}

# Start mc-router (mandatory infrastructure: without it no server is
# reachable). Safe to call repeatedly.
# Returns: 0 on success or when already running, 1 on failure
ensure_router() {
  load_router_settings

  if router_running; then
    debug "mc-router already running"
    return 0
  fi

  ensure_network
  info "Starting mc-router (players connect via <server>.${MC_ROUTER_DOMAIN})..."
  docker compose -p minecraft-router -f docker-compose.router.yml up -d
}

# Start server using docker compose
# Args: $1 - server name
# Returns: 0 on success, 1 on failure
docker_compose_up() {
  local server_name="$1"
  local config_file
  config_file=$(get_config_file "$server_name")

  # Load per-server values needed for docker compose substitution
  export JAVA_VERSION=$(get_env_value "$config_file" JAVA_VERSION)
  export RCON_PORT=$(get_env_value "$config_file" RCON_PORT)
  export MC_ROUTER_DEFAULT=$(get_env_value "$config_file" MC_ROUTER_DEFAULT)
  export SERVER_NAME="$server_name"

  # Router settings feed the mc-router.* labels in docker-compose.yml
  load_router_settings

  # Set dynamic environment variables for docker compose substitution
  export CONTAINER_NAME="mc-${server_name}"
  export SERVER_DATA_DIR="$(repo_root)/servers/${server_name}/data"
  export SERVER_MODS_DIR="$(repo_root)/servers/${server_name}/mods"
  export SERVER_BACKUP_DIR="$(repo_root)/backups/${server_name}"
  export SERVER_CONFIG_FILE="$config_file"

  debug "Starting server with docker compose -p mc-${server_name} (RCON on 127.0.0.1:${RCON_PORT})"
  docker compose -p "mc-${server_name}" -f docker-compose.yml up -d 2>&1
}

# Stop server using docker compose
# Args: $1 - server name
# Returns: 0 on success, 1 on failure
docker_compose_down() {
  local server_name="$1"

  debug "Stopping server with docker compose -p mc-${server_name} down"
  docker compose -p "mc-${server_name}" down -v 2>&1
}

# Restart server using docker compose
# Args: $1 - server name
# Returns: 0 on success, 1 on failure
docker_compose_restart() {
  local server_name="$1"
  local config_file
  config_file=$(get_config_file "$server_name")

  # Load per-server values needed for docker compose substitution
  export JAVA_VERSION=$(get_env_value "$config_file" JAVA_VERSION)
  export RCON_PORT=$(get_env_value "$config_file" RCON_PORT)
  export MC_ROUTER_DEFAULT=$(get_env_value "$config_file" MC_ROUTER_DEFAULT)
  export SERVER_NAME="$server_name"
  load_router_settings

  # Set dynamic environment variables
  export CONTAINER_NAME="mc-${server_name}"
  export SERVER_DATA_DIR="$(repo_root)/servers/${server_name}/data"
  export SERVER_MODS_DIR="$(repo_root)/servers/${server_name}/mods"
  export SERVER_BACKUP_DIR="$(repo_root)/backups/${server_name}"
  export SERVER_CONFIG_FILE="$config_file"

  debug "Restarting server with docker compose -p mc-${server_name} restart"
  docker compose -p "mc-${server_name}" restart 2>&1
}

# ============================================================================
# PRUNE OPERATIONS
# ============================================================================

# Prune server runtime data (data only, preserves config and backups)
# Args: $1 - server name
# Returns: 0 on success, 1 on failure
prune_server_data() {
  local server_name="$1"
  local data_dir

  data_dir=$(get_data_dir "$server_name")

  debug "Pruning server data for: $server_name"

  # Remove data directory only (preserve backups)
  if remove_directory "$data_dir"; then
    debug "Removed data directory: $data_dir"
  fi

  # Always return success - not an error if directory didn't exist
  return 0
}

# Ensure directory exists
# Args: $1 - directory path
ensure_directory() {
  local dir="$1"
  if [ ! -d "$dir" ]; then
    debug "Creating directory: $dir"
    mkdir -p "$dir"
  fi
}

# Remove directory safely (with confirmation if not empty)
# Args: $1 - directory path
# Returns: 0 on success, 1 on failure
remove_directory() {
  local dir="$1"

  if [ ! -d "$dir" ]; then
    warning "Directory does not exist: $dir"
    return 1
  fi

  debug "Removing directory: $dir"
  rm -rf "$dir"
  return 0
}

# Remove file safely
# Args: $1 - file path
# Returns: 0 on success, 1 on failure
remove_file() {
  local file="$1"

  if [ ! -f "$file" ]; then
    warning "File does not exist: $file"
    return 1
  fi

  debug "Removing file: $file"
  rm -f "$file"
  return 0
}

# ============================================================================
# NETWORK HELPERS
# ============================================================================

# Ensure Docker network exists
# Args: $1 - network name (optional, defaults to minecraft-network)
ensure_network() {
  local network_name="${1:-minecraft-network}"

  if ! docker network inspect "$network_name" &> /dev/null; then
    debug "Creating Docker network: $network_name"
    docker network create "$network_name" &> /dev/null
  fi
}

# Get server RCON port from config (the only per-server port: loopback admin)
# Args: $1 - server name
# Returns: port number (stdout)
get_rcon_port() {
  local server_name="$1"
  local config_file
  config_file=$(get_config_file "$server_name")

  if [ -f "$config_file" ]; then
    grep "^RCON_PORT=" "$config_file" | cut -d= -f2 | tr -d ' "' || echo "unknown"
  else
    echo "unknown"
  fi
}

# Check for RCON port conflicts across all server configs. Each server needs a
# unique RCON_PORT because the loopback binding happens on the shared host.
# Returns: 0 if no conflicts, 1 if conflicts found
check_port_conflicts() {
  local port_list=()
  local server_list=()
  local has_conflict=false
  local idx

  for config_file in config/modpacks/*.env; do
    [ -f "$config_file" ] || continue

    local server_name
    server_name=$(basename "$config_file" .env)

    local port
    port=$(grep "^RCON_PORT=" "$config_file" 2> /dev/null | cut -d= -f2 | tr -d ' "')

    if [ -z "$port" ]; then
      warning "Server $server_name has no RCON_PORT defined"
      has_conflict=true
      continue
    fi

    # Check if this port already exists in our list
    idx=0
    for existing_port in "${port_list[@]+"${port_list[@]}"}"; do
      if [ "$port" = "$existing_port" ]; then
        error "Port conflict detected: $port used by both ${server_list[$idx]} and $server_name"
        has_conflict=true
        break
      fi
      ((idx++)) || true
    done

    # Add to our lists
    port_list+=("$port")
    server_list+=("$server_name")
  done

  if [ "$has_conflict" = true ]; then
    return 1
  fi

  return 0
}

# Find next available RCON port (managed range 26565-26664)
# Returns: available port number (stdout)
find_available_port() {
  local used_ports=()

  # Collect all used ports
  for config_file in config/modpacks/*.env; do
    [ -f "$config_file" ] || continue

    local port
    port=$(grep "^RCON_PORT=" "$config_file" 2> /dev/null | cut -d= -f2 | tr -d ' "')

    if [ -n "$port" ]; then
      used_ports+=("$port")
    fi
  done

  # Find first available port in range 26565-26664
  for port in {26565..26664}; do
    local port_used=false
    for used_port in "${used_ports[@]}"; do
      if [ "$port" = "$used_port" ]; then
        port_used=true
        break
      fi
    done

    if [ "$port_used" = false ]; then
      echo "$port"
      return 0
    fi
  done

  error "No available ports in range 26565-26664"
  return 1
}

# Check if a port is open/listening
# Args: $1 - port number
# Returns: 0 if port is open, 1 if closed
check_port_open() {
  local port="$1"

  # Use timeout to avoid hanging
  if timeout 5 bash -c "</dev/tcp/localhost/$port" 2> /dev/null; then
    return 0
  else
    return 1
  fi
}

# ============================================================================
# INITIALIZATION
# ============================================================================

# This section runs when the script is sourced
debug "common.sh loaded"
