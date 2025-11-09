#!/usr/bin/env bash
# Docker Helper Functions for BATS Test Suite
# Provides utilities for Docker container management and validation

# Source common helpers
source "$(dirname "${BASH_SOURCE[0]}")/common.bash"

# Docker Container Management Functions

# Check if a Docker container is running
# Args: container_name
# Returns: 0 if running, 1 if not running or doesn't exist
docker_container_running() {
    local container_name="$1"
    docker ps --filter "name=${container_name}" --filter "status=running" --format "{{.Names}}" | grep -q "^${container_name}$"
}

# Get container status (running, exited, etc.)
# Args: container_name
# Returns: container status string or empty if not found
docker_container_status() {
    local container_name="$1"
    docker ps -a --filter "name=${container_name}" --format "{{.Status}}" | head -n1
}

# Get container logs with size limit
# Args: container_name [max_lines=100]
# Returns: container logs as string
docker_container_logs() {
    local container_name="$1"
    local max_lines="${2:-100}"
    docker logs "${container_name}" 2>&1 | tail -n "${max_lines}"
}

# Stop and remove a Docker container
# Args: container_name
# Returns: 0 on success, 1 on failure
docker_cleanup_container() {
    local container_name="$1"

    # Stop container if running
    if docker_container_running "${container_name}"; then
        docker stop "${container_name}" >/dev/null 2>&1 || return 1
    fi

    # Remove container
    docker rm "${container_name}" >/dev/null 2>&1 || return 1

    return 0
}

# Clean up all test containers matching a pattern
# Args: pattern (default: "test-")
# Returns: 0 on success
docker_cleanup_test_containers() {
    local pattern="${1:-test-}"

    # Stop all matching running containers
    docker ps --filter "name=${pattern}" --format "{{.Names}}" | xargs -r docker stop >/dev/null 2>&1

    # Remove all matching containers
    docker ps -a --filter "name=${pattern}" --format "{{.Names}}" | xargs -r docker rm >/dev/null 2>&1

    return 0
}

# Wait for container to be ready (running state)
# Args: container_name [timeout_seconds=30]
# Returns: 0 if ready, 1 if timeout
docker_wait_container_ready() {
    local container_name="$1"
    local timeout="${2:-30}"
    local count=0

    while [ $count -lt $timeout ]; do
        if docker_container_running "${container_name}"; then
            return 0
        fi
        sleep 1
        ((count++))
    done

    return 1
}

# Check if Docker image exists locally
# Args: image_name
# Returns: 0 if exists, 1 if not
docker_image_exists() {
    local image_name="$1"
    docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^${image_name}$"
}

# Pull Docker image if not exists
# Args: image_name
# Returns: 0 on success, 1 on failure
docker_ensure_image() {
    local image_name="$1"

    if ! docker_image_exists "${image_name}"; then
        docker pull "${image_name}" >/dev/null 2>&1 || return 1
    fi

    return 0
}

# Execute command in running container
# Args: container_name command [args...]
# Returns: command exit code
docker_exec() {
    local container_name="$1"
    shift
    docker exec "${container_name}" "$@"
}

# Get container IP address
# Args: container_name
# Returns: IP address or empty string
docker_container_ip() {
    local container_name="$1"
    docker inspect "${container_name}" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || echo ""
}

# Check if container port is accessible
# Args: container_name port [timeout_seconds=5]
# Returns: 0 if accessible, 1 if not
docker_container_port_open() {
    local container_name="$1"
    local port="$2"
    local timeout="${3:-5}"
    local ip

    ip=$(docker_container_ip "${container_name}")
    [ -z "$ip" ] && return 1

    timeout "${timeout}s" bash -c "</dev/tcp/${ip}/${port}" 2>/dev/null
}

# Get container resource usage
# Args: container_name
# Returns: JSON with CPU and memory usage
docker_container_stats() {
    local container_name="$1"
    docker stats --no-stream --format "json" "${container_name}" 2>/dev/null || echo "{}"
}

# Validate Docker environment
# Returns: 0 if Docker is available and functional
docker_validate_environment() {
    # Check if Docker is installed
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker command not found"
        return 1
    fi

    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running"
        return 1
    fi

    # Check if Docker Compose is available
    if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
        log_error "Docker Compose not found"
        return 1
    fi

    log_info "Docker environment validated successfully"
    return 0
}

# Create test container with specific configuration
# Args: container_name image_name [port_mapping] [env_vars...]
# Returns: 0 on success, 1 on failure
docker_create_test_container() {
    local container_name="$1"
    local image_name="$2"
    local port_mapping="$3"
    shift 3

    # Clean up any existing container
    docker_cleanup_container "${container_name}" >/dev/null 2>&1

    # Build docker run command
    local cmd=(docker run -d --name "${container_name}")

    # Add port mapping if provided
    [ -n "$port_mapping" ] && cmd+=( -p "${port_mapping}" )

    # Add environment variables
    for env_var in "$@"; do
        cmd+=( -e "${env_var}" )
    done

    # Add image name
    cmd+=( "${image_name}" )

    # Execute command
    "${cmd[@]}" >/dev/null 2>&1
}

# Get container health status
# Args: container_name
# Returns: health status (healthy, unhealthy, none) or empty if not found
docker_container_health() {
    local container_name="$1"
    docker inspect "${container_name}" --format '{{.State.Health.Status}}' 2>/dev/null || echo ""
}

# Wait for container health check to pass
# Args: container_name [timeout_seconds=60]
# Returns: 0 if healthy, 1 if timeout or unhealthy
docker_wait_container_healthy() {
    local container_name="$1"
    local timeout="${2:-60}"
    local count=0

    while [ $count -lt $timeout ]; do
        local health
        health=$(docker_container_health "${container_name}")

        case "$health" in
            "healthy")
                return 0
                ;;
            "unhealthy")
                return 1
                ;;
            "none"|"")
                # No health check defined, consider running as healthy
                if docker_container_running "${container_name}"; then
                    return 0
                fi
                ;;
        esac

        sleep 1
        ((count++))
    done

    return 1
}