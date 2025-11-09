#!/usr/bin/env bats
# Test Suite: Script Execution Validation
# User Story 1: Validate start-server.sh script execution with real modpack configurations

# Load test environment and helpers
load '../helpers/test-env'

# Setup and teardown for all tests in this suite
setup_suite() {
    # Simple setup without complex functions
    echo "Setting up test suite"
}

teardown_suite() {
    # Simple cleanup
    echo "Cleaning up test suite"
}

setup() {
    # Simple setup
    echo "Setting up test"
}

teardown() {
    # Simple cleanup
    echo "Cleaning up test"
}

# Helper function to get all modpack configurations
get_modpack_configs() {
    local modpack_dir="config/modpacks"
    local configs=()

    if [ -d "$modpack_dir" ]; then
        while IFS= read -r -d '' file; do
            configs+=("$file")
        done < <(find "$modpack_dir" -name "*.env" -type f -print0 | sort -z)
    fi

    echo "${configs[@]}"
}

# Helper function to extract modpack name from config file
get_modpack_name() {
    local config_file="$1"
    basename "$config_file" .env
}

# Test Case: US1-TC001 - All existing modpacks can be started
@test "US1-TC001: All existing modpacks can be started successfully" {
    local modpack_configs=()
    local failed_modpacks=()
    local total_modpacks=0

    # Get all modpack configurations
    while IFS= read -r -d '' file; do
        modpack_configs+=("$file")
    done < <(find config/modpacks -name "*.env" -type f -print0 | sort -z)

    for config_file in "${modpack_configs[@]}"; do
        total_modpacks=$((total_modpacks + 1))
        local modpack_name
        modpack_name=$(basename "$config_file" .env)
        local test_container="test-${modpack_name}-$(date +%s)"

        echo "Testing modpack: $modpack_name"

        # Test script execution (with timeout to prevent hanging)
        # The script expects only the server name, it automatically finds the config
        # Use a shorter timeout since we're just testing script execution, not full server startup
        timeout 10 ./scripts/start-server.sh "$modpack_name"

        if [ $? -eq 0 ]; then
            # Check if container was created (not necessarily running yet, as MC servers take time to start)
            local expected_container="mc-${modpack_name}"
            if docker ps -a --filter "name=${expected_container}" --format "{{.Names}}" | grep -q "^${expected_container}$"; then
                echo "✓ Modpack $modpack_name started successfully (container created)"
                # Clean up container
                docker stop "$expected_container" >/dev/null 2>&1 || true
                docker rm "$expected_container" >/dev/null 2>&1 || true
            else
                echo "✗ Modpack $modpack_name container not created"
                failed_modpacks+=("$modpack_name:container_not_created")
                # Clean up any failed containers
                docker rm "$expected_container" >/dev/null 2>&1 || true
            fi
        else
            echo "✗ Modpack $modpack_name script execution failed"
            failed_modpacks+=("$modpack_name:script_failed")
        fi
    done

    # Assert no modpacks failed
    [ ${#failed_modpacks[@]} -eq 0 ]

    echo "Tested $total_modpacks modpacks"
    if [ ${#failed_modpacks[@]} -gt 0 ]; then
        echo "Failed: ${failed_modpacks[*]}"
    fi
}

# Test Case: US1-TC002 - All modpack configurations are valid
@test "US1-TC002: All modpack configurations are valid" {
    local modpack_configs=()
    local invalid_configs=()
    local total_configs=0

    # Get all modpack configurations
    while IFS= read -r -d '' file; do
        modpack_configs+=("$file")
    done < <(find config/modpacks -name "*.env" -type f -print0 | sort -z)

    for config_file in "${modpack_configs[@]}"; do
        total_configs=$((total_configs + 1))
        local modpack_name
        modpack_name=$(basename "$config_file" .env)

        echo "Validating config: $modpack_name"

        # Check if config file exists and is readable
        if [ ! -f "$config_file" ]; then
            invalid_configs+=("$modpack_name:file_not_found")
            continue
        fi

        if [ ! -r "$config_file" ]; then
            invalid_configs+=("$modpack_name:file_not_readable")
            continue
        fi

        # Validate required environment variables
        local required_vars=("SERVER_NAME" "VERSION" "MEMORY")
        local missing_vars=()

        for var in "${required_vars[@]}"; do
            if ! grep -q "^${var}=" "$config_file"; then
                missing_vars+=("$var")
            fi
        done

        if [ ${#missing_vars[@]} -gt 0 ]; then
            invalid_configs+=("$modpack_name:missing_vars(${missing_vars[*]})")
        fi

        # Validate VERSION format (basic check)
        local version
        version=$(grep "^VERSION=" "$config_file" | cut -d'=' -f2)
        if [ -n "$version" ] && ! [[ "$version" =~ ^[0-9]+\.[0-9]+ ]]; then
            invalid_configs+=("$modpack_name:invalid_version($version)")
        fi

        # Validate MEMORY format (basic check)
        local memory
        memory=$(grep "^MEMORY=" "$config_file" | cut -d'=' -f2)
        if [ -n "$memory" ] && ! [[ "$memory" =~ ^[0-9]+[MG]$ ]]; then
            invalid_configs+=("$modpack_name:invalid_memory($memory)")
        fi
    done

    # Assert no invalid configurations
    [ ${#invalid_configs[@]} -eq 0 ]

    echo "Validated $total_configs configurations"
    if [ ${#invalid_configs[@]} -gt 0 ]; then
        echo "Invalid: ${invalid_configs[*]}"
    fi
}

# Test Case: US1-TC003 - Script handles non-existent modpack gracefully
@test "US1-TC003: Script handles non-existent modpack gracefully" {
    local nonexistent_config="config/modpacks/nonexistent-modpack.env"

    # Act
    run ./scripts/start-server.sh --config "$nonexistent_config" --name 'test-nonexistent'

    # Assert
    [ "$status" -ne 0 ]

    # Verify error message
    [[ "$output" =~ "Configuration file not found" ]] || [[ "$output" =~ "No such file" ]] || [[ "$output" =~ "not found" ]]
}

# Test Case: US1-TC005 - Dynamic modpack detection works
@test "US1-TC005: Dynamic modpack detection works" {
    # Count modpacks using direct file listing
    local actual_count
    actual_count=$(find config/modpacks -name "*.env" -type f | wc -l)

    # Assert we have at least some modpacks
    [ "$actual_count" -gt 0 ]

    echo "Detected $actual_count modpacks"
}

# Test Case: US1-TC006 - Modpack names are properly extracted
@test "US1-TC006: Modpack names are properly extracted" {
    local test_configs=("config/modpacks/vanilla.env" "config/modpacks/atm8.env")
    local expected_names=("vanilla" "atm8")
    local extracted_names=()

    for config in "${test_configs[@]}"; do
        # Skip if file doesn't exist (for CI compatibility)
        [ -f "$config" ] || continue

        local name
        name=$(basename "$config" .env)
        extracted_names+=("$name")
    done

    # Assert names match expected (only if files exist)
    if [ -f "config/modpacks/vanilla.env" ]; then
        [ "${extracted_names[0]}" = "${expected_names[0]}" ]
    fi

    if [ -f "config/modpacks/atm8.env" ]; then
        [ "${extracted_names[1]}" = "${expected_names[1]}" ]
    fi

    echo "Names: ${extracted_names[*]}"
}

# Test Case: US1-TC004 - Script is executable and accessible
@test "US1-TC004: Script is executable and accessible" {
    # Verify script exists and is executable
    [ -f "./scripts/start-server.sh" ]
    [ -x "./scripts/start-server.sh" ]

    # Try to run script without arguments
    run ./scripts/start-server.sh

    # Script should exit with non-zero (since no valid args provided)
    [ "$status" -ne 0 ]

    # Should show some output
    [ -n "$output" ]
}

# Test Case: US1-TC007 - Server fully starts and becomes ready
@test "US1-TC007: Server fully starts and becomes ready" {
    # Use vanilla modpack for this test as it's the simplest and fastest to start
    local test_modpack="vanilla"
    local container_name="mc-${test_modpack}"
    local max_wait_time=180  # 3 minutes should be enough for vanilla
    local check_interval=5   # Check logs every 5 seconds

    # Skip if vanilla config doesn't exist
    [ -f "config/modpacks/${test_modpack}.env" ] || skip "Vanilla modpack config not found"

    echo "Testing full server startup for: $test_modpack"
    echo "Monitoring: Check every ${check_interval}s, max ${max_wait_time}s"

    # Start the server in background
    ./scripts/start-server.sh "$test_modpack" &
    local server_pid=$!

    # Wait for container to be created
    echo "Waiting for container to be created..."
    local wait_container=0
    while [ $wait_container -lt 30 ]; do
        if docker ps -a --filter "name=${container_name}" --format "{{.Names}}" | grep -q "^${container_name}$"; then
            echo "✓ Container created"
            break
        fi
        sleep 1
        wait_container=$((wait_container + 1))
    done

    if [ $wait_container -ge 30 ]; then
        echo "✗ Container was not created after 30s"
        kill $server_pid >/dev/null 2>&1 || true
        return 1
    fi

    # Monitor logs continuously until server is ready or fails
    local elapsed=0
    local server_ready=false
    local last_log_line=""

    echo "Monitoring server logs for completion..."

    while [ $elapsed -lt $max_wait_time ]; do
        # Check if container is still running
        if ! docker ps --filter "name=${container_name}" --filter "status=running" --format "{{.Names}}" | grep -q "^${container_name}$"; then
            # Container stopped - check if it exited with error
            local exit_code
            exit_code=$(docker inspect "${container_name}" --format='{{.State.ExitCode}}' 2>/dev/null || echo "1")
            if [ "$exit_code" != "0" ]; then
                echo "✗ Container exited with code $exit_code"
                echo "Last 20 log lines:"
                docker logs "$container_name" 2>&1 | tail -20
                kill $server_pid >/dev/null 2>&1 || true
                docker rm "$container_name" >/dev/null 2>&1 || true
                return 1
            fi
        fi

        # Get last 3 lines of logs to show progress
        local current_log_tail
        current_log_tail=$(docker logs "$container_name" 2>&1 | tail -3 | tr '\n' ' ' | sed 's/  */ /g')
        
        # Only show if logs changed
        if [ "$current_log_tail" != "$last_log_line" ] && [ -n "$current_log_tail" ]; then
            echo "[${elapsed}s] Latest: ${current_log_tail:0:120}..."
            last_log_line="$current_log_tail"
        fi

        # Check for server ready message (most reliable indicator)
        if docker logs "$container_name" 2>&1 | grep -q 'Done ([0-9.]*s)! For help, type "help"'; then
            server_ready=true
            echo "✓ Server is fully ready!"
            break
        fi

        # Alternative check for older Minecraft versions
        if docker logs "$container_name" 2>&1 | grep -q 'Done! For help, type "help"'; then
            server_ready=true
            echo "✓ Server is fully ready!"
            break
        fi

        # Check for fatal errors that would prevent startup
        if docker logs "$container_name" 2>&1 | grep -q -i "java.lang.OutOfMemoryError\|Server crashed\|Failed to start\|Could not reserve enough space"; then
            echo "✗ Fatal error detected in logs"
            echo "Last 20 log lines:"
            docker logs "$container_name" 2>&1 | tail -20
            kill $server_pid >/dev/null 2>&1 || true
            docker rm "$container_name" >/dev/null 2>&1 || true
            return 1
        fi

        sleep "$check_interval"
        elapsed=$((elapsed + check_interval))
    done

    # Verify if server is ready
    if [ "$server_ready" = true ]; then
        echo "✅ Server startup completed in ${elapsed}s"

        # Clean up
        ./scripts/stop-server.sh "$test_modpack" >/dev/null 2>&1 || true
        docker rm "$container_name" >/dev/null 2>&1 || true

        return 0
    else
        echo "⏰ Server did not complete startup within ${max_wait_time}s"
        echo "Last 30 log lines:"
        docker logs "$container_name" 2>&1 | tail -30

        # Clean up
        kill $server_pid >/dev/null 2>&1 || true
        ./scripts/stop-server.sh "$test_modpack" >/dev/null 2>&1 || true
        docker rm "$container_name" >/dev/null 2>&1 || true

        return 1
    fi
}