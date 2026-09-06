#!/bin/bash
# validate-config.sh - Validate server configurations and system setup
# Part of minecraft-servers multi-configuration system
# Contract: contracts/management-api.md

# Load common functions
source "$(dirname "$0")/common.sh"

# Global validation state
ERRORS=0
WARNINGS=0

# Show usage information
usage() {
  cat << EOF
Usage: $0 [OPTIONS] [SERVER_NAME]

Validate server configurations and system setup.

OPTIONS:
    -a, --all              Validate all configured servers
    -s, --system           Validate system requirements only
    -f, --fix              Attempt to fix common issues automatically
    -v, --verbose          Show detailed validation output
    -j, --json             Output in JSON format
    -h, --help             Show this help message

ARGUMENTS:
    SERVER_NAME            Name of specific server to validate (optional with --all)

EXAMPLES:
    $0 atm8                 # Validate specific server
    $0 --all                # Validate all servers
    $0 --system             # Check system requirements only
    $0 --all --fix          # Validate all and attempt fixes
    $0 --all --json         # Validate all, JSON output

EXIT CODES:
    0  Success - all validations passed
    1  Error - script execution failed
    2  Invalid arguments
    3  Validation failed (errors found)
    4  Validation warnings (no errors)
EOF
}

# Parse command line arguments
ALL_SERVERS=false
SYSTEM_ONLY=false
AUTO_FIX=false
VERBOSE=false
JSON_OUTPUT=false
SERVER_NAME=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -a | --all)
      ALL_SERVERS=true
      shift
      ;;
    -s | --system)
      SYSTEM_ONLY=true
      shift
      ;;
    -f | --fix)
      AUTO_FIX=true
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
      error "Unknown option: $1"
      usage
      exit 2
      ;;
    *)
      if [[ -n "$SERVER_NAME" ]]; then
        error "Multiple server names specified"
        usage
        exit 2
      fi
      SERVER_NAME="$1"
      shift
      ;;
  esac
done

# Validate arguments
if [[ "$ALL_SERVERS" == false && "$SYSTEM_ONLY" == false && -z "$SERVER_NAME" ]]; then
  log_error "Must specify either --all, --system, or a server name"
  usage
  exit 2
fi

if [[ "$ALL_SERVERS" == true && -n "$SERVER_NAME" ]]; then
  log_error "Cannot specify both --all and a server name"
  usage
  exit 2
fi

# Validation result functions
validation_error() {
  local message="$1"
  ((ERRORS++))
  if [[ "$JSON_OUTPUT" == false ]]; then
    error "$message"
  fi
}

validation_warning() {
  local message="$1"
  ((WARNINGS++))
  if [[ "$JSON_OUTPUT" == false ]]; then
    warning "$message"
  fi
}

validation_success() {
  local message="$1"
  if [[ "$VERBOSE" == true && "$JSON_OUTPUT" == false ]]; then
    success "$message"
  fi
}

# System requirement checks
validate_system_requirements() {
  local section="system"

  if [[ "$JSON_OUTPUT" == false ]]; then
    info "Validating system requirements..."
  fi

  # Check Docker
  if ! command -v docker &> /dev/null; then
    validation_error "Docker is not installed or not in PATH"
  else
    validation_success "Docker is available"

    # Check Docker daemon
    if ! docker info &> /dev/null; then
      validation_error "Docker daemon is not running"
    else
      validation_success "Docker daemon is running"
    fi

    # Check Docker Compose (optional - only needed for docker-compose.yml usage)
    if ! command -v docker compose &> /dev/null && ! docker compose version &> /dev/null; then
      validation_warning "Docker Compose is not available (optional for dynamic server management)"
    else
      validation_success "Docker Compose is available"
    fi
  fi

  # Check required directories
  local dirs=("config/modpacks" "servers" "backups")
  for dir in "${dirs[@]}"; do
    if [[ ! -d "$dir" ]]; then
      if [[ "$AUTO_FIX" == true ]]; then
        ensure_directory "$dir"
        validation_success "Created directory: $dir"
      else
        validation_error "Required directory missing: $dir"
      fi
    else
      validation_success "Directory exists: $dir"
    fi
  done

  # Check script permissions
  local scripts=("start-server.sh" "stop-server.sh" "restart-server.sh" "list-servers.sh" "backup.sh" "restore.sh" "add-modpack.sh" "health-check.sh" "auto-restart.sh" "router.sh")
  for script in "${scripts[@]}"; do
    local script_path="scripts/$script"
    if [[ -f "$script_path" ]]; then
      if [[ ! -x "$script_path" ]]; then
        if [[ "$AUTO_FIX" == true ]]; then
          chmod +x "$script_path"
          validation_success "Made script executable: $script"
        else
          validation_error "Script not executable: $script"
        fi
      else
        validation_success "Script is executable: $script"
      fi
    else
      validation_warning "Script not found: $script"
    fi
  done

  # Check contracts
  if [[ ! -f "specs/001-docker-multi-server/contracts/management-api.md" ]]; then
    validation_warning "Management API contract not found"
  else
    validation_success "Management API contract exists"
  fi
}

# Get list of servers to validate
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

# Validate server name format
validate_server_name() {
  local server_name="$1"
  local section="server:$server_name"

  if [[ ! "$server_name" =~ ^[a-z0-9-]+$ ]]; then
    validation_error "Invalid server name format: $server_name (must be lowercase alphanumeric with hyphens)"
  else
    validation_success "Server name format valid: $server_name"
  fi
}

# Validate configuration file
validate_config_file() {
  local server_name="$1"
  local config_file
  config_file=$(get_config_file "$server_name")
  local section="server:$server_name"

  if [[ ! -f "$config_file" ]]; then
    validation_error "Configuration file missing: $config_file"
    return 1
  fi

  validation_success "Configuration file exists: $config_file"

  # Check required variables
  local required_vars=("TYPE" "VERSION" "MEMORY")
  for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" "$config_file"; then
      validation_error "Required variable missing in config: $var"
    else
      validation_success "Required variable present: $var"
    fi
  done

  # Validate TYPE
  local type
  type=$(grep "^TYPE=" "$config_file" | cut -d'=' -f2- | sed 's/^"//' | sed 's/"$//')
  case "$type" in
    VANILLA | PAPER | FORGE | FABRIC | AUTO_CURSEFORGE | MODRINTH)
      validation_success "Server type valid: $type"
      ;;
    *)
      validation_error "Invalid server type: $type (must be VANILLA, PAPER, FORGE, FABRIC, AUTO_CURSEFORGE, or MODRINTH)"
      ;;
  esac

  # Validate MEMORY format
  local memory
  memory=$(grep "^MEMORY=" "$config_file" | cut -d'=' -f2- | sed 's/^"//' | sed 's/"$//')
  if [[ "$memory" =~ ^[0-9]+[GgMm]$ ]]; then
    validation_success "Memory format valid: $memory"
  else
    validation_error "Invalid memory format: $memory (must be like '4G' or '4096M')"
  fi

  # Validate RCON_PORT: the only per-server port (loopback admin traffic).
  # Game ports are never published - mc-router routes players by hostname
  local port
  port=$(grep "^RCON_PORT=" "$config_file" | cut -d'=' -f2- | sed 's/^"//' | sed 's/"$//')
  if [[ -z "$port" ]]; then
    validation_error "RCON_PORT missing (required; managed range 26565-26664)"
  elif [[ "$port" =~ ^[0-9]+$ ]] && [[ "$port" -ge 26565 ]] && [[ "$port" -le 26664 ]]; then
    validation_success "RCON port valid: $port (loopback-only)"
  else
    validation_error "Invalid RCON port: $port (must be 26565-26664)"
  fi

  # Validate CF_PAGE_URL for AUTO_CURSEFORGE
  if [[ "$type" == "AUTO_CURSEFORGE" ]]; then
    local cf_url
    cf_url=$(grep "^CF_PAGE_URL=" "$config_file" | cut -d'=' -f2- | sed 's/^"//' | sed 's/"$//')
    if [[ -z "$cf_url" ]]; then
      validation_error "CF_PAGE_URL required for AUTO_CURSEFORGE type"
    elif [[ ! "$cf_url" =~ ^https://www\.curseforge\.com/minecraft/modpacks/ ]]; then
      validation_error "Invalid CurseForge URL format: $cf_url"
    else
      validation_success "CurseForge URL format valid"
    fi
  fi
}

# Validate server directories
validate_server_directories() {
  local server_name="$1"
  local server_dir="servers/$server_name"
  local section="server:$server_name"

  # Check main server directory
  if [[ ! -d "$server_dir" ]]; then
    if [[ "$AUTO_FIX" == true ]]; then
      ensure_directory "$server_dir"
      validation_success "Created server directory: $server_dir"
    else
      validation_warning "Server directory missing: $server_dir"
    fi
  else
    validation_success "Server directory exists: $server_dir"
  fi

  # Check subdirectories
  local subdirs=("data" "mods")
  for subdir in "${subdirs[@]}"; do
    local full_path="$server_dir/$subdir"
    if [[ ! -d "$full_path" ]]; then
      if [[ "$AUTO_FIX" == true ]]; then
        ensure_directory "$full_path"
        validation_success "Created subdirectory: $full_path"
      else
        validation_warning "Server subdirectory missing: $full_path"
      fi
    else
      validation_success "Server subdirectory exists: $full_path"
    fi
  done

  # Check backups directory
  local backup_dir
  backup_dir=$(get_backup_dir "$server_name")
  if [[ ! -d "$backup_dir" ]]; then
    if [[ "$AUTO_FIX" == true ]]; then
      ensure_directory "$backup_dir"
      validation_success "Created backup directory: $backup_dir"
    else
      validation_warning "Backup directory missing: $backup_dir"
    fi
  else
    validation_success "Backup directory exists: $backup_dir"
  fi
}

# Validate port conflicts
validate_port_conflicts() {
  local current_server="$1"

  # Use common.sh function for comprehensive port conflict checking
  if ! check_port_conflicts; then
    validation_error "Port conflicts detected across server configurations"
    return 1
  fi

  validation_success "No port conflicts detected"
  return 0
}

# Validate individual server
validate_server() {
  local server_name="$1"

  if [[ "$JSON_OUTPUT" == false ]]; then
    info "Validating server: $server_name"
  fi

  validate_server_name "$server_name"
  validate_config_file "$server_name"
  validate_server_directories "$server_name"
  validate_port_conflicts "$server_name"
}

# Main validation function
validate_all() {
  if [[ "$SYSTEM_ONLY" == false ]]; then
    local servers
    servers=$(get_server_list)

    if [[ -z "$servers" ]]; then
      if [[ "$ALL_SERVERS" == true ]]; then
        validation_warning "No servers configured yet"
      else
        validation_error "Server not found: $SERVER_NAME"
      fi
    else
      for server in $servers; do
        validate_server "$server"
      done
    fi
  fi

  validate_system_requirements
}

# Output JSON results
output_json() {
  local exit_code=0
  if [[ $ERRORS -gt 0 ]]; then
    exit_code=3
  elif [[ $WARNINGS -gt 0 ]]; then
    exit_code=4
  fi

  jq -n \
    --arg errors "$ERRORS" \
    --arg warnings "$WARNINGS" \
    --arg exit_code "$exit_code" \
    '{errors: ($errors | tonumber), warnings: ($warnings | tonumber), exit_code: ($exit_code | tonumber)}'
}

# Main execution
main() {
  validate_all

  if [[ "$JSON_OUTPUT" == true ]]; then
    output_json
  else
    if [[ "$VERBOSE" == true || $ERRORS -gt 0 || $WARNINGS -gt 0 ]]; then
      echo ""
      echo "Validation Summary:"
      echo "- Errors: $ERRORS"
      echo "- Warnings: $WARNINGS"
    fi
  fi

  # Determine exit code
  if [[ $ERRORS -gt 0 ]]; then
    return 3
  elif [[ $WARNINGS -gt 0 ]]; then
    return 4
  else
    if [[ "$JSON_OUTPUT" == false ]]; then
      success "All validations passed"
    fi
    return 0
  fi
}

# Run main function
main "$@"
