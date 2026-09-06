#!/bin/bash

# add-modpack.sh - Add new Minecraft server configuration
# Usage: ./scripts/add-modpack.sh <server-name> [--modpack=<template>] [--rcon-port=<port>] [--memory=<amount>]
# Creates new server configuration with automatic RCON port assignment and validation

set -euo pipefail

# Load common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
source "$SCRIPT_DIR/common.sh"

# Available templates
declare -A TEMPLATES=(
  ["atm8"]="All The Mods 8,AUTO_CURSEFORGE,1.20.1,8G,https://www.curseforge.com/minecraft/modpacks/all-the-mods-8,ATM8 Server"
  ["atm10sky"]="All The Mods 10: To the Sky,AUTO_CURSEFORGE,1.21.1,8G,https://www.curseforge.com/minecraft/modpacks/all-the-mods-10-sky,ATM10 Sky"
  ["skyfactory4"]="SkyFactory 4,AUTO_CURSEFORGE,1.12.2,4G,https://www.curseforge.com/minecraft/modpacks/skyfactory-4,SkyFactory 4"
  ["prominence2"]="Prominence II RPG,AUTO_CURSEFORGE,1.20.1,6G,https://www.curseforge.com/minecraft/modpacks/prominence-2-rpg,Prominence II RPG"
  ["rlcraft"]="RLCraft,AUTO_CURSEFORGE,1.12.2,6G,https://www.curseforge.com/minecraft/modpacks/rlcraft,RLCraft"
  ["bmc4"]="Better MC BMC4,AUTO_CURSEFORGE,1.20.1,6G,https://www.curseforge.com/minecraft/modpacks/better-mc-forge-bmc4,Better MC BMC4"
  ["pixelmon"]="The Pixelmon Modpack,MODRINTH,1.21.1,6G,the-pixelmon-modpack,Pixelmon"
  ["deceasedcraft"]="DeceasedCraft,AUTO_CURSEFORGE,1.20.1,6G,https://www.curseforge.com/minecraft/modpacks/deceasedcraft,DeceasedCraft"
  ["cursed-walking"]="Cursed Walking,AUTO_CURSEFORGE,1.20.1,8G,https://www.curseforge.com/minecraft/modpacks/cursed-walking-a-modern-zombie-apocalypse,Cursed Walking"
  ["vanilla"]="Vanilla Optimized,PAPER,26.2,2G,,Vanilla Server"
)

# Function to find next available port
find_next_port() {
  find_available_port
}

# RCON port range: the only per-server port. Game traffic has no per-server
# port at all - mc-router routes every player via <server>.<MC_ROUTER_DOMAIN>
# and RCON stays bound to 127.0.0.1 on the host
RCON_PORT_MIN=26565
RCON_PORT_MAX=26664

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
  local rcon_port="$3"
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
      # MODRINTH templates store the project slug; CurseForge ones the modpack URL
      if [[ "$type" == "MODRINTH" ]]; then
        echo "MODRINTH_MODPACK=$cf_url" >> "$config_file"
      else
        echo "CF_PAGE_URL=$cf_url" >> "$config_file"
      fi
    fi

    cat >> "$config_file" << EOF
SERVER_NAME=$name
RCON_PORT=$rcon_port
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
VERSION=26.2
MEMORY=$memory
SERVER_NAME=$name
RCON_PORT=$rcon_port
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

  ensure_directory "servers/$name/data"
  ensure_directory "servers/$name/mods"
  ensure_directory "backups/$name"

  success "Created directories:"
  success "  - servers/$name/data"
  success "  - servers/$name/mods"
  success "  - backups/$name"
}

# Parse arguments
SERVER_NAME=""
TEMPLATE=""
RCON_PORT_ARG=""
MEMORY=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --modpack=*)
      TEMPLATE="${1#*=}"
      shift
      ;;
    --rcon-port=*)
      RCON_PORT_ARG="${1#*=}"
      shift
      ;;
    --help | -h)
      echo "Usage: $0 <server-name> [--modpack=<template>] [--rcon-port=<port>] [--memory=<amount>]"
      echo ""
      echo "Options:"
      echo "  --modpack=<template>  Use a built-in template (see below)"
      echo "  --rcon-port=<port>    Loopback admin port (26565-26664; auto-assigned if omitted)"
      echo "  --memory=<size>       RAM allocation (e.g. 4G, 8G, 2048M)"
      echo ""
      echo "Game traffic has no per-server port: players connect via"
      echo "<server-name>.<MC_ROUTER_DOMAIN> through mc-router"
      echo ""
      echo "Available templates:"
      for template in "${!TEMPLATES[@]}"; do
        IFS=',' read -r display_name type version default_memory _ <<< "${TEMPLATES[$template]}"
        echo "  $template  $display_name ($type, MC $version, $default_memory)"
      done | sort
      exit 0
      ;;
    --port=*)
      log_error "Option --port= no longer exists: game ports are routed by mc-router"
      log_error "Use --rcon-port= to pick the loopback admin port, or none to auto-assign"
      exit 2
      ;;
    --memory=*)
      MEMORY="${1#*=}"
      shift
      ;;
    -*)
      log_error "Unknown option: $1"
      echo "Usage: $0 <server-name> [--modpack=<template>] [--rcon-port=<port>] [--memory=<amount>]" >&2
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
  echo "Usage: $0 <server-name> [--modpack=<template>] [--rcon-port=<port>] [--memory=<amount>]" >&2
  exit 2
fi

# Validate server name
if ! validate_server_name "$SERVER_NAME"; then
  exit 2
fi

# Check if server already exists
if check_config_exists "$SERVER_NAME"; then
  error "Server '$SERVER_NAME' already exists"
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

# Determine RCON port (the only per-server port)
if [[ -z "$RCON_PORT_ARG" ]]; then
  log_info "Auto-assigning RCON port..."
  PORT=$(find_next_port)
  if [[ $? -ne 0 ]]; then
    exit 4
  fi
  log_info "Assigned RCON port: $PORT"
else
  # Validate specified port
  if [[ ! "$RCON_PORT_ARG" =~ ^[0-9]+$ ]] || [[ "$RCON_PORT_ARG" -lt "$RCON_PORT_MIN" ]] || [[ "$RCON_PORT_ARG" -gt "$RCON_PORT_MAX" ]]; then
    error "Invalid RCON port: $RCON_PORT_ARG"
    error "Port must be between $RCON_PORT_MIN and $RCON_PORT_MAX"
    exit 4
  fi

  # Check if port is already used
  if ! check_port_conflicts; then
    error "Port $RCON_PORT_ARG is already in use"
    exit 4
  fi
  PORT="$RCON_PORT_ARG"
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
  echo "  Version: 26.2"
fi
load_router_settings
echo "  Players connect via: $(get_route_host "$SERVER_NAME")"
echo "  RCON port: $PORT (127.0.0.1 only)"
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
