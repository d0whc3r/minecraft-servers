#!/usr/bin/env bash
# Test Execution Environment Configuration
# Configures the test environment, timeouts, and cleanup mechanisms

# Source all helper modules
source "$(dirname "${BASH_SOURCE[0]}")/common.bash"
source "$(dirname "${BASH_SOURCE[0]}")/docker-helpers.bash"
source "$(dirname "${BASH_SOURCE[0]}")/reporting.bash"

# Environment Configuration
export TEST_ENV="${TEST_ENV:-development}"  # development, staging, production
export TEST_PARALLEL="${TEST_PARALLEL:-false}"
export TEST_VERBOSE="${TEST_VERBOSE:-false}"
export TEST_DEBUG="${TEST_DEBUG:-false}"

# Timeout Configuration (in seconds)
export TEST_TIMEOUT_DEFAULT="${TEST_TIMEOUT_DEFAULT:-300}"      # 5 minutes
export TEST_TIMEOUT_SETUP="${TEST_TIMEOUT_SETUP:-60}"          # 1 minute
export TEST_TIMEOUT_TEARDOWN="${TEST_TIMEOUT_TEARDOWN:-30}"    # 30 seconds
export TEST_TIMEOUT_DOCKER="${TEST_TIMEOUT_DOCKER:-120}"       # 2 minutes
export TEST_TIMEOUT_NETWORK="${TEST_TIMEOUT_NETWORK:-10}"      # 10 seconds

# Docker Configuration for Tests
export TEST_DOCKER_NETWORK="${TEST_DOCKER_NETWORK:-test-network}"
export TEST_DOCKER_PREFIX="${TEST_DOCKER_PREFIX:-test-minecraft-}"
export TEST_DOCKER_IMAGE="${TEST_DOCKER_IMAGE:-itzg/minecraft-server:latest}"
export TEST_DOCKER_PULL="${TEST_DOCKER_PULL:-true}"

# Test Data Configuration
export TEST_FIXTURES_DIR="${TEST_FIXTURES_DIR:-tests/fixtures}"
export TEST_TEMP_DIR="${TEST_TEMP_DIR:-/tmp/minecraft-test}"
export TEST_CONFIGS_DIR="${TEST_CONFIGS_DIR:-config/modpacks}"

# Logging Configuration
export TEST_LOG_LEVEL="${TEST_LOG_LEVEL:-info}"  # debug, info, warn, error
export TEST_LOG_FORMAT="${TEST_LOG_FORMAT:-text}"  # text, json
export TEST_LOG_COLOR="${TEST_LOG_COLOR:-true}"

# Performance Configuration
export TEST_MAX_CONCURRENT="${TEST_MAX_CONCURRENT:-3}"
export TEST_MEMORY_LIMIT="${TEST_MEMORY_LIMIT:-512m}"
export TEST_CPU_LIMIT="${TEST_CPU_LIMIT:-0.5}"

# Network Configuration for Tests
export TEST_BASE_PORT="${TEST_BASE_PORT:-30000}"
export TEST_PORT_RANGE="${TEST_PORT_RANGE:-100}"

# Initialize test environment
init_test_environment() {
    log_info "Initializing test environment..."

    # Validate prerequisites
    validate_test_prerequisites

    # Setup directories
    setup_test_directories

    # Configure Docker environment
    setup_docker_environment

    # Setup signal handlers
    setup_signal_handlers

    # Initialize logging
    setup_test_logging

    log_info "Test environment initialized successfully"
}

# Validate test prerequisites
validate_test_prerequisites() {
    local missing_deps=()

    # Check required commands
    local required_commands=("docker" "jq" "timeout" "curl")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing_deps+=("$cmd")
        fi
    done

    # Check Docker daemon
    if ! docker_validate_environment; then
        missing_deps+=("docker-daemon")
    fi

    # Check BATS
    if ! command -v bats >/dev/null 2>&1; then
        missing_deps+=("bats")
    fi

    # Check required files
    local required_files=("../../scripts/start-server.sh" "../../docker-compose.yml")
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            missing_deps+=("file:$file")
        fi
    done

    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "Missing test prerequisites: ${missing_deps[*]}"
        return 1
    fi

    log_info "All test prerequisites validated"
    return 0
}

# Setup test directories
setup_test_directories() {
    # Create temporary directories with full paths
    mkdir -p "$TEST_TEMP_DIR"
    mkdir -p "${TEST_TEMP_DIR}/configs"
    mkdir -p "${TEST_TEMP_DIR}/data"
    mkdir -p "${TEST_TEMP_DIR}/logs"

    # Also ensure relative paths work
    mkdir -p "tests/fixtures"
    mkdir -p "config/modpacks"

    # Set proper permissions
    chmod 755 "$TEST_TEMP_DIR" 2>/dev/null || true

    log_info "Test directories created in: $TEST_TEMP_DIR"
}

# Setup Docker environment for tests
setup_docker_environment() {
    # Create test network if it doesn't exist
    if ! docker network ls --format "{{.Name}}" | grep -q "^${TEST_DOCKER_NETWORK}$"; then
        docker network create "${TEST_DOCKER_NETWORK}" >/dev/null 2>&1
        log_info "Created Docker network: ${TEST_DOCKER_NETWORK}"
    fi

    # Pull test image if requested
    if [ "$TEST_DOCKER_PULL" = "true" ]; then
        log_info "Pulling Docker image: ${TEST_DOCKER_IMAGE}"
        timeout "$TEST_TIMEOUT_DOCKER" docker pull "${TEST_DOCKER_IMAGE}" >/dev/null 2>&1 || {
            log_warn "Failed to pull Docker image: ${TEST_DOCKER_IMAGE}"
        }
    fi
}

# Setup signal handlers for cleanup
setup_signal_handlers() {
    # Cleanup on exit
    trap 'emergency_cleanup' EXIT

    # Cleanup on interrupt
    trap 'emergency_cleanup; exit 130' INT

    # Cleanup on terminate
    trap 'emergency_cleanup; exit 143' TERM

    log_debug "Signal handlers configured"
}

# Setup test logging
setup_test_logging() {
    # Configure log level
    case "$TEST_LOG_LEVEL" in
        "debug") export LOG_LEVEL=0 ;;
        "info")  export LOG_LEVEL=1 ;;
        "warn")  export LOG_LEVEL=2 ;;
        "error") export LOG_LEVEL=3 ;;
        *)       export LOG_LEVEL=1 ;;
    esac

    # Initialize reporting infrastructure
    init_test_logging

    log_debug "Test logging configured with level: $TEST_LOG_LEVEL"
}

# Emergency cleanup function
emergency_cleanup() {
    log_warn "Performing emergency cleanup..."

    # Stop all test containers
    docker_cleanup_test_containers

    # Remove test network
    if docker network ls --format "{{.Name}}" | grep -q "^${TEST_DOCKER_NETWORK}$"; then
        docker network rm "${TEST_DOCKER_NETWORK}" >/dev/null 2>&1 || true
    fi

    # Clean up temporary directories
    if [ -d "$TEST_TEMP_DIR" ]; then
        rm -rf "$TEST_TEMP_DIR" 2>/dev/null || true
    fi

    log_info "Emergency cleanup completed"
}

# Get available test port
get_test_port() {
    local base_port="${TEST_BASE_PORT:-30000}"
    local port_range="${TEST_PORT_RANGE:-100}"
    local port

    for ((i=0; i<port_range; i++)); do
        port=$((base_port + i))
        if ! lsof -i :"$port" >/dev/null 2>&1 && ! docker ps --format "{{.Ports}}" | grep -q ":$port->"; then
            echo "$port"
            return 0
        fi
    done

    log_error "No available test ports found in range ${base_port}-$((base_port + port_range))"
    return 1
}

# Create test configuration file
create_test_config() {
    local config_name="$1"
    local base_config="${2:-valid-server.env}"
    local output_file="${TEST_TEMP_DIR}/configs/${config_name}.env"

    # Create directory if it doesn't exist
    mkdir -p "${TEST_TEMP_DIR}/configs"

    # Copy base configuration if it exists
    if [ -f "${TEST_FIXTURES_DIR}/${base_config}" ]; then
        cp "${TEST_FIXTURES_DIR}/${base_config}" "$output_file"
    else
        # Create a minimal config if base doesn't exist
        cat > "$output_file" << EOF
SERVER_NAME=${config_name}
VERSION=1.20.1
MEMORY=1G
EULA=TRUE
EOF
    fi

    # Override with test-specific settings
    cat >> "$output_file" << EOF

# Test-specific overrides
TEST_MODE=true
TEST_TIMESTAMP=$(date +%s)
TEST_ID=${config_name}
EOF

    echo "$output_file"
}

# Setup test container
setup_test_container() {
    local container_name="$1"
    local config_file="$2"
    local port="${3:-$(get_test_port)}"

    if [ -z "$port" ]; then
        log_error "Failed to allocate port for test container: $container_name"
        return 1
    fi

    # Create container with test configuration
    local env_vars=(
        "EULA=TRUE"
        "TEST_MODE=true"
        "SERVER_PORT=$port"
    )

    # Load environment variables from config file
    if [ -f "$config_file" ]; then
        while IFS='=' read -r key value; do
            [ -n "$key" ] && [ "${key:0:1}" != "#" ] && env_vars+=("${key}=${value}")
        done < "$config_file"
    fi

    # Create and start container
    docker_create_test_container "$container_name" "$TEST_DOCKER_IMAGE" "${port}:25565" "${env_vars[@]}"

    # Wait for container to be ready
    if docker_wait_container_ready "$container_name" "$TEST_TIMEOUT_DOCKER"; then
        log_info "Test container ready: $container_name (port: $port)"
        echo "$port"
        return 0
    else
        log_error "Test container failed to start: $container_name"
        return 1
    fi
}

# Teardown test container
teardown_test_container() {
    local container_name="$1"

    log_debug "Tearing down test container: $container_name"
    docker_cleanup_container "$container_name"
}

# Run test with timeout and cleanup
run_test_with_timeout() {
    local test_command="$1"
    local timeout_seconds="${2:-$TEST_TIMEOUT_DEFAULT}"

    log_debug "Running test with ${timeout_seconds}s timeout: $test_command"

    # Run command with timeout
    if timeout "$timeout_seconds" bash -c "$test_command"; then
        log_debug "Test completed successfully"
        return 0
    else
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            log_error "Test timed out after ${timeout_seconds}s"
        else
            log_error "Test failed with exit code: $exit_code"
        fi
        return $exit_code
    fi
}

# Validate test environment health
validate_test_environment() {
    local issues=()

    # Check disk space
    local disk_free
    disk_free=$(df "$TEST_TEMP_DIR" | tail -1 | awk '{print $4}')
    if [ "$disk_free" -lt 1048576 ]; then  # Less than 1GB
        issues+=("Low disk space: ${disk_free}KB available")
    fi

    # Check memory
    local mem_free
    mem_free=$(free -k 2>/dev/null | grep '^Mem:' | awk '{print $4}' || echo "0")
    if [ "$mem_free" -lt 524288 ]; then  # Less than 512MB
        issues+=("Low memory: ${mem_free}KB available")
    fi

    # Check Docker resources
    if ! docker system df >/dev/null 2>&1; then
        issues+=("Cannot check Docker disk usage")
    fi

    if [ ${#issues[@]} -gt 0 ]; then
        log_warn "Test environment issues detected:"
        for issue in "${issues[@]}"; do
            log_warn "  - $issue"
        done
        return 1
    fi

    log_debug "Test environment health validated"
    return 0
}

# Export environment variables for BATS
export_test_environment() {
    # Export all TEST_* variables
    export | grep '^TEST_' || true

    # Export helper functions (make them available to subshells)
    export -f init_test_environment
    export -f emergency_cleanup
    export -f get_test_port
    export -f create_test_config
    export -f setup_test_container
    export -f teardown_test_container
    export -f run_test_with_timeout
    export -f validate_test_environment
}

# Main initialization (called when script is sourced)
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    # Script is being executed directly
    init_test_environment
else
    # Script is being sourced
    export_test_environment
fi