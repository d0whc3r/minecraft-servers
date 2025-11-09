#!/bin/bash

# add-modpack.sh - Add new Minecraft server configuration
# Usage: ./scripts/add-modpack.sh <server-name> [--modpack=<template>] [--port=<port>] [--memory=<amount>]
# Creates new server configuration with automatic port assignment and validation

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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

# Available templates
declare -A TEMPLATES=(
    ["atm8"]="All The Mods 8,AUTO_CURSEFORGE,1.20.1,8G,https://www.curseforge.com/minecraft/modpacks/all-the-mods-8,ATM8 Server"
    ["skyfactory4"]="SkyFactory 4,AUTO_CURSEFORGE,1.12.2,4G,https://www.curseforge.com/minecraft/modpacks/skyfactory-4,SkyFactory 4"
    ["prominence2"]="Prominence II RPG,AUTO_CURSEFORGE,1.20.1,6G,https://www.curseforge.com/minecraft/modpacks/prominence-2-rpg,Prominence II RPG"
    ["rlcraft"]="RLCraft,AUTO_CURSEFORGE,1.12.2,6G,https://www.curseforge.com/minecraft/modpacks/rlcraft,RLCraft"
    ["vanilla"]="Vanilla Optimized,PAPER,1.20.4,2G,,Vanilla Server"
)

# Function to find next available port
find_next_port() {
    local used_ports=()
    local config_files

    # Get all existing config files
    mapfile -t config_files < <(find "$PROJECT_ROOT/config/modpacks" -name "*.env" 2>/dev/null || true)

    # Extract used ports
    for config_file in "${config_files[@]}"; do
        if [[ -f "$config_file" ]]; then
            local port
            port=$(grep "^SERVER_PORT=" "$config_file" 2>/dev/null | cut -d'=' -f2 || true)
            if [[ -n "$port" && "$port" =~ ^[0-9]+$ ]]; then
                used_ports+=("$port")
            fi
        fi
    done

    # Find first available port in range 25565-25664
    for ((port=25565; port<=25664; port++)); do
        local port_used=false
        for used_port in "${used_ports[@]}"; do
            if [[ "$port" == "$used_port" ]]; then
                port_used=true
                break
            fi
        done
        if [[ "$port_used" == false ]]; then
            echo "$port"
            return 0
        fi
    done

    log_error "No available ports in range 25565-25664"
    return 1
}

# Function to validate server name
validate_server_name() {
    local name="$1"
    if [[ ! "$name" =~ ^[a-z0-9-]+$ ]]; then
        log_error "Invalid server name: $name"
        log_error "Server name must match regex: ^[a-z0-9-]+$ (lowercase letters, numbers, hyphens only)"
        return 1
    fi

    if [[ -f "$PROJECT_ROOT/config/modpacks/${name}.env" ]]; then
        log_error "Server '$name' already exists"
        return 1
    fi

    return 0
}

# Function to validate memory format
validate_memory() {
    local memory="$1"
    if [[ ! "$memory" =~ ^[0-9]+[GMgm]$ ]]; then
        log_error "Invalid memory format: $memory"
        log_error "Memory must be in format: <number>G or <number>M (e.g., 4G, 8G, 2048M)"
        return 1
    fi
    return 0
}

# Function to create server configuration
create_server_config() {
    local name="$1"
    local template="$2"
    local port="$3"
    local memory="$4"

    local config_file="$PROJECT_ROOT/config/modpacks/${name}.env"

    # Use template if specified, otherwise create basic config
    if [[ -n "$template" && "${TEMPLATES[$template]+exists}" ]]; then
        # Parse template
        IFS=',' read -r display_name type version default_memory cf_url server_name <<< "${TEMPLATES[$template]}"

        # Override memory if specified
        if [[ -n "$memory" ]]; then
            final_memory="$memory"
        else
            final_memory="$default_memory"
        fi

        # Create config file
        cat > "$config_file" << EOF
# $display_name Configuration
TYPE=$type
VERSION=$version
MEMORY=$final_memory
EOF

        if [[ -n "$cf_url" ]]; then
            echo "CF_PAGE_URL=$cf_url" >> "$config_file"
        fi

        cat >> "$config_file" << EOF
SERVER_NAME=$display_name
SERVER_PORT=$port
MAX_PLAYERS=20
DIFFICULTY=normal
VIEW_DISTANCE=10
EOF

        log_info "Using template: $display_name"
    else
        # Create basic configuration
        if [[ -z "$memory" ]]; then
            memory="4G"
        fi

        cat > "$config_file" << EOF
# Custom Server Configuration
TYPE=PAPER
VERSION=1.20.4
MEMORY=$memory
SERVER_NAME=$name
SERVER_PORT=$port
MAX_PLAYERS=20
DIFFICULTY=normal
VIEW_DISTANCE=10
EOF

        log_info "Created basic configuration (no template specified)"
    fi

    log_success "Created config: $config_file"
}

# Function to create directories
create_directories() {
    local name="$1"

    local server_dir="$PROJECT_ROOT/servers/$name"
    local backup_dir="$PROJECT_ROOT/backups/$name"

    mkdir -p "$server_dir/data" "$server_dir/mods" "$backup_dir"

    log_success "Created directories:"
    log_success "  - $server_dir/data"
    log_success "  - $server_dir/mods"
    log_success "  - $backup_dir"
}

# Parse arguments
SERVER_NAME=""
TEMPLATE=""
PORT=""
MEMORY=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --modpack=*)
            TEMPLATE="${1#*=}"
            shift
            ;;
        --port=*)
            PORT="${1#*=}"
            shift
            ;;
        --memory=*)
            MEMORY="${1#*=}"
            shift
            ;;
        -*)
            log_error "Unknown option: $1"
            echo "Usage: $0 <server-name> [--modpack=<template>] [--port=<port>] [--memory=<amount>]" >&2
            echo "Available templates: ${!TEMPLATES[*]}" >&2
            exit 2
            ;;
        *)
            if [[ -z "$SERVER_NAME" ]]; then
                SERVER_NAME="$1"
            else
                log_error "Multiple server names specified"
                exit 2
            fi
            shift
            ;;
    esac
done

# Validate required arguments
if [[ -z "$SERVER_NAME" ]]; then
    log_error "Server name is required"
    echo "Usage: $0 <server-name> [--modpack=<template>] [--port=<port>] [--memory=<amount>]" >&2
    exit 2
fi

# Validate server name
if ! validate_server_name "$SERVER_NAME"; then
    exit 2
fi

# Validate template if specified
if [[ -n "$TEMPLATE" && ! "${TEMPLATES[$TEMPLATE]+exists}" ]]; then
    log_error "Unknown template: $TEMPLATE"
    echo "Available templates: ${!TEMPLATES[*]}" >&2
    exit 3
fi

# Validate memory if specified
if [[ -n "$MEMORY" ]] && ! validate_memory "$MEMORY"; then
    exit 4
fi

# Determine port
if [[ -z "$PORT" ]]; then
    log_info "Auto-assigning port..."
    PORT=$(find_next_port)
    if [[ $? -ne 0 ]]; then
        exit 4
    fi
    log_info "Assigned port: $PORT"
else
    # Validate specified port
    if [[ ! "$PORT" =~ ^[0-9]+$ ]] || [[ "$PORT" -lt 25565 ]] || [[ "$PORT" -gt 25664 ]]; then
        log_error "Invalid port: $PORT"
        log_error "Port must be between 25565 and 25664"
        exit 4
    fi

    # Check if port is already used
    local config_files
    mapfile -t config_files < <(find "$PROJECT_ROOT/config/modpacks" -name "*.env" 2>/dev/null || true)
    for config_file in "${config_files[@]}"; do
        if [[ -f "$config_file" ]]; then
            local used_port
            used_port=$(grep "^SERVER_PORT=" "$config_file" 2>/dev/null | cut -d'=' -f2 || true)
            if [[ "$used_port" == "$PORT" ]]; then
                log_error "Port $PORT is already in use by $(basename "$config_file" .env)"
                exit 4
            fi
        fi
    done
fi

log_info "Adding new server: $SERVER_NAME"

# Create configuration
create_server_config "$SERVER_NAME" "$TEMPLATE" "$PORT" "$MEMORY"

# Create directories
create_directories "$SERVER_NAME"

# Success output
log_success "New server configuration created successfully!"
echo ""
echo "Configuration Summary:"
echo "  Name: $SERVER_NAME"
if [[ -n "$TEMPLATE" ]]; then
    IFS=',' read -r display_name type version default_memory cf_url server_name <<< "${TEMPLATES[$TEMPLATE]}"
    echo "  Type: $type ($display_name)"
    echo "  Version: $version"
else
    echo "  Type: PAPER (Vanilla)"
    echo "  Version: 1.20.4"
fi
echo "  Port: $PORT"
if [[ -n "$MEMORY" ]]; then
    echo "  Memory: $MEMORY"
elif [[ -n "$TEMPLATE" ]]; then
    echo "  Memory: $default_memory"
else
    echo "  Memory: 4G"
fi
echo ""
echo "To start the server:"
echo "  ./scripts/start-server.sh $SERVER_NAME"
echo ""
echo "To view available templates:"
echo "  ./scripts/add-modpack.sh --help"

exit 0