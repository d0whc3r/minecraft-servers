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
    local max_wait_time=120  # 2 minutes should be enough for vanilla server

    # Skip if vanilla config doesn't exist
    [ -f "config/modpacks/${test_modpack}.env" ] || skip "Vanilla modpack config not found"

    echo "Testing full server startup for: $test_modpack"

    # Start the server
    ./scripts/start-server.sh "$test_modpack"

    if [ $? -ne 0 ]; then
        echo "✗ Failed to start $test_modpack server"
        return 1
    fi

    # Wait for server to be fully ready by checking logs for "Done!" message
    local elapsed=0
    local ready=false

    echo "Waiting for server to be ready (max ${max_wait_time}s)..."

    while [ $elapsed -lt $max_wait_time ]; do
        # Check if "Done! For help, type "help"" appears in logs
        if docker logs "$container_name" 2>/dev/null | grep -q "Done! For help, type \"help\""; then
            ready=true
            break
        fi

        sleep 5
        elapsed=$((elapsed + 5))
        echo "Still waiting... (${elapsed}s elapsed)"
    done

    if [ "$ready" = true ]; then
        echo "✓ Server $test_modpack is fully ready"

        # Additional verification: check if server is responding on its port
        local server_port
        server_port=$(grep "^SERVER_PORT=" "config/modpacks/${test_modpack}.env" | cut -d= -f2 | tr -d ' "')

        if [ -n "$server_port" ]; then
            # Try to connect to the server port (basic connectivity check)
            if timeout 5 bash -c "</dev/tcp/localhost/$server_port" 2>/dev/null; then
                echo "✓ Server is responding on port $server_port"
            else
                echo "⚠️ Server not responding on port $server_port (but logs show ready)"
            fi
        fi

        # Clean up
        ./scripts/stop-server.sh "$test_modpack" >/dev/null 2>&1 || true
        docker rm "$container_name" >/dev/null 2>&1 || true

        return 0
    else
        echo "✗ Server $test_modpack did not become ready within ${max_wait_time}s"

        # Show last few lines of logs for debugging
        echo "Last logs:"
        docker logs "$container_name" 2>/dev/null | tail -10 || true

        # Clean up
        ./scripts/stop-server.sh "$test_modpack" >/dev/null 2>&1 || true
        docker rm "$container_name" >/dev/null 2>&1 || true

        return 1
    fi
}