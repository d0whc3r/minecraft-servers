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
        list_available_servers >&2
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
                echo "  - $(basename "$config" .env)"
            done
        else
            echo "  (none configured)"
        fi
    else
        echo "  (config directory not found)"
    fi
}

# List running servers
list_running_servers() {
    docker ps --filter "name=mc-" --format "{{.Names}}" 2>/dev/null | sed 's/mc-//' || true
}

# Get container name from server name
# Args: $1 - server name
# Returns: container name (stdout)
get_container_name() {
    local server_name="$1"
    echo "mc-${server_name}"
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
    echo "servers/${server_name}"
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

# Start server using docker-compose
# Args: $1 - server name
# Returns: 0 on success, 1 on failure
docker_compose_up() {
    local server_name="$1"
    local config_file
    config_file=$(get_config_file "$server_name")
    
    # Set dynamic environment variables
    export CONTAINER_NAME="mc-${server_name}"
    export SERVER_DATA_DIR="$(pwd)/servers/${server_name}/data"
    export SERVER_MODS_DIR="$(pwd)/servers/${server_name}/mods"
    export SERVER_BACKUP_DIR="$(pwd)/backups/${server_name}"
    
    debug "Starting server with docker-compose -p mc-${server_name}"
    docker-compose -p "mc-${server_name}" --env-file "$config_file" up -d 2>&1
}

# Stop server using docker-compose
# Args: $1 - server name
# Returns: 0 on success, 1 on failure
docker_compose_down() {
    local server_name="$1"
    
    debug "Stopping server with docker-compose -p mc-${server_name} down"
    docker-compose -p "mc-${server_name}" down -v 2>&1
}

# Restart server using docker-compose
# Args: $1 - server name
# Returns: 0 on success, 1 on failure
docker_compose_restart() {
    local server_name="$1"
    local config_file
    config_file=$(get_config_file "$server_name")
    
    # Set dynamic environment variables
    export CONTAINER_NAME="mc-${server_name}"
    export SERVER_DATA_DIR="$(pwd)/servers/${server_name}/data"
    export SERVER_MODS_DIR="$(pwd)/servers/${server_name}/mods"
    export SERVER_BACKUP_DIR="$(pwd)/backups/${server_name}"
    
    debug "Restarting server with docker-compose -p mc-${server_name} restart"
    docker-compose -p "mc-${server_name}" --env-file "$config_file" restart 2>&1
}

# ============================================================================
# FILE OPERATIONS
# ============================================================================

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
    
    if ! docker network inspect "$network_name" &>/dev/null; then
        debug "Creating Docker network: $network_name"
        docker network create "$network_name" &>/dev/null
    fi
}

# Get server port from config
# Args: $1 - server name
# Returns: port number (stdout)
get_server_port() {
    local server_name="$1"
    local config_file
    config_file=$(get_config_file "$server_name")
    
    if [ -f "$config_file" ]; then
        grep "^SERVER_PORT=" "$config_file" | cut -d= -f2 | tr -d ' "' || echo "unknown"
    else
        echo "unknown"
    fi
}

# Get container uptime in human-readable format
# Args: $1 - container name
# Returns: uptime string (stdout)
get_container_uptime() {
    local container_name="$1"
    
    # Get status output which includes uptime
    local status_line
    status_line=$(docker ps --filter "name=${container_name}" --format "{{.Status}}" 2>/dev/null)
    
    if [ -z "$status_line" ]; then
        echo "N/A"
        return
    fi
    
    # Extract uptime from "Up X minutes/hours/days"
    if [[ "$status_line" =~ Up[[:space:]](.+)$ ]]; then
        echo "${BASH_REMATCH[1]}" | sed 's/ (.*)//' | head -c 12
    else
        echo "N/A"
    fi
}

# ============================================================================
# INITIALIZATION
# ============================================================================

# This section runs when the script is sourced
debug "common.sh loaded"
