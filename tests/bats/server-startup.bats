#!/usr/bin/env bats
# Test Suite: End-to-end server startup
#
# US1-TC007 starts every selected modpack and waits until the server logs
# "Done!". It is slow (minutes per server) and needs a running Docker
# daemon plus a prepared .env, which is why it only runs in the manual
# e2e-tests.yml workflow (the fast suite lives in config-validation.bats).
# The set of modpacks under test is narrowed with TEST_MODPACKS.

setup() {
    # Scripts and configs are referenced relative to the project root
    cd "$(dirname "$BATS_TEST_DIRNAME")/.."
}

# Test Case: US1-TC007 - servers fully start and become ready (end-to-end)
@test "US1-TC007: All servers fully start and become ready" {
    # The end-to-end test needs a Docker daemon; skip cleanly when unavailable
    if ! docker info > /dev/null 2>&1; then
        skip "Docker daemon is not running"
    fi

    local max_wait_time=300 # 5 minutes max per server
    local check_interval=5  # Check logs every 5 seconds
    local failed_servers=()
    local successful_servers=()
    local total_servers=0

    # Get modpack configurations - respect TEST_MODPACKS environment variable if set
    local modpack_configs=()
    if [ -n "${TEST_MODPACKS:-}" ]; then
        echo "🔍 Using filtered modpacks from TEST_MODPACKS: $TEST_MODPACKS"
        # Convert space-separated string to array
        local test_modpacks_array=($TEST_MODPACKS)
        for modpack_name in "${test_modpacks_array[@]}"; do
            local config_file="config/modpacks/${modpack_name}.env"
            if [ -f "$config_file" ]; then
                modpack_configs+=("$config_file")
            else
                echo "⚠️  Warning: Config file not found: $config_file"
            fi
        done
    else
        echo "🔍 No TEST_MODPACKS filter set, testing all modpacks"
        # Fallback to all modpacks if no filter is set
        while IFS= read -r -d '' file; do
            modpack_configs+=("$file")
        done < <(find config/modpacks -name "*.env" -type f -print0 | sort -z)
    fi

    [ ${#modpack_configs[@]} -gt 0 ] || skip "No modpack configs found for this test chunk"

    echo "🚀 Testing full startup for ${#modpack_configs[@]} modpack(s) in this chunk..."
    echo "📋 Modpacks to test: $(for config in "${modpack_configs[@]}"; do basename "$config" .env; done | tr '\n' ' ')"
    echo "⏱️  Max wait time per server: ${max_wait_time}s"
    echo "🔍 Check interval: ${check_interval}s"
    echo "---"

    for config_file in "${modpack_configs[@]}"; do
        total_servers=$((total_servers + 1))
        local modpack_name
        modpack_name=$(basename "$config_file" .env)
        local container_name="mc-${modpack_name}"

        echo ""
        echo "[$total_servers/${#modpack_configs[@]}] Testing: $modpack_name"
        echo "Monitoring: Check every ${check_interval}s, max ${max_wait_time}s"
        echo "Container: $container_name"

        # Start the server in background
        echo "🚀 Starting server '$modpack_name'..."
        ./scripts/start-server.sh "$modpack_name" &
        local server_pid=$!

        # Wait for container to be created
        echo "⏳ Waiting for container creation..."
        local wait_container=0
        while [ $wait_container -lt 30 ]; do
            if docker ps -a --filter "name=${container_name}" --format "{{.Names}}" | grep -q "^${container_name}$"; then
                echo "  ✅ Container created successfully"
                break
            fi
            sleep 1
            wait_container=$((wait_container + 1))
        done

        if [ $wait_container -ge 30 ]; then
            echo "  ❌ Container not created after 30s"
            failed_servers+=("$modpack_name:container_not_created")
            kill $server_pid > /dev/null 2>&1 || true
            continue
        fi

        # Monitor logs until server is ready or fails
        local elapsed=0
        local server_ready=false
        local last_log_line=""
        local last_progress_time=0

        echo "→ Monitoring startup progress..."
        echo "   📊 Progress updates every 5 seconds"
        echo "   🔍 Checking for 'Done!' message"

        while [ $elapsed -lt $max_wait_time ]; do
            # CRITICAL: Check container status FIRST before any operation
            local container_status
            container_status=$(docker inspect "${container_name}" --format='{{.State.Status}}' 2> /dev/null || echo "not_found")

            if [ "$container_status" != "running" ]; then
                # Container is not running - could be exited, dead, or removed
                local exit_code
                exit_code=$(docker inspect "${container_name}" --format='{{.State.ExitCode}}' 2> /dev/null || echo "unknown")

                echo "  ❌ Container stopped (status: $container_status, exit code: $exit_code)"
                echo "  📄 Last 20 log lines:"
                docker logs "$container_name" 2>&1 | tail -20 | sed 's/^/     /'

                if [ "$exit_code" = "unknown" ]; then
                    failed_servers+=("$modpack_name:container_disappeared")
                else
                    failed_servers+=("$modpack_name:stopped_exit_$exit_code")
                fi

                kill $server_pid > /dev/null 2>&1 || true
                docker rm "$container_name" > /dev/null 2>&1 || true
                break
            fi

            # Container is running - safe to get logs
            # Show progress more frequently (every 5 seconds instead of 15)
            if [ $((elapsed - last_progress_time)) -ge 5 ] || [ $elapsed -eq 0 ]; then
                local current_log_tail
                current_log_tail=$(docker logs "$container_name" 2>&1 | tail -3 | tr '\n' ' | ' | sed 's/  */ /g' | sed 's/| $//')

                if [ "$current_log_tail" != "$last_log_line" ] && [ -n "$current_log_tail" ]; then
                    echo "  📝 [${elapsed}s] $modpack_name: ${current_log_tail:0:120}..."
                    last_log_line="$current_log_tail"
                    last_progress_time=$elapsed
                fi
            fi

            # Check for server ready message (most reliable indicator)
            local current_logs
            current_logs=$(docker logs "$container_name" 2>&1)

            if echo "$current_logs" | grep -q 'Done ([0-9.]*s)! For help, type "help"'; then
                server_ready=true
                echo "  ✅ Server '$modpack_name' fully ready after ${elapsed}s!"
                break
            fi

            # Alternative check for older Minecraft versions
            if echo "$current_logs" | grep -q 'Done! For help, type "help"'; then
                server_ready=true
                echo "  ✅ Server '$modpack_name' fully ready after ${elapsed}s!"
                break
            fi

            # Check for fatal errors
            if echo "$current_logs" | grep -q -i "java.lang.OutOfMemoryError\|Server crashed\|Failed to start\|Could not reserve enough space\|Exception in thread"; then
                echo "  ❌ Fatal error detected in '$modpack_name' logs"
                echo "  📄 Last 20 log lines:"
                echo "$current_logs" | tail -20 | sed 's/^/     /'
                failed_servers+=("$modpack_name:fatal_error")
                kill $server_pid > /dev/null 2>&1 || true
                docker rm "$container_name" > /dev/null 2>&1 || true
                break
            fi

            sleep "$check_interval"
            elapsed=$((elapsed + check_interval))
        done

        # Verify result
        if [ "$server_ready" = true ]; then
            echo "  ✅ Completed in ${elapsed}s"
            successful_servers+=("$modpack_name")

            # Clean up
            ./scripts/stop-server.sh "$modpack_name" > /dev/null 2>&1 || true
            docker rm "$container_name" > /dev/null 2>&1 || true
        else
            # Only add timeout if server wasn't already marked as failed
            if ! echo "${failed_servers[*]}" | grep -q "$modpack_name"; then
                # Check one last time if container is still running
                local final_status
                final_status=$(docker inspect "${container_name}" --format='{{.State.Status}}' 2> /dev/null || echo "not_found")

                if [ "$final_status" = "running" ]; then
                    echo "  ⏰ Timeout after ${max_wait_time}s (container still running)"
                    echo "  Last 20 log lines:"
                    docker logs "$container_name" 2>&1 | tail -20 | sed 's/^/    /'
                    failed_servers+=("$modpack_name:timeout")
                else
                    local final_exit_code
                    final_exit_code=$(docker inspect "${container_name}" --format='{{.State.ExitCode}}' 2> /dev/null || echo "unknown")
                    echo "  ⏰ Timeout - container stopped (status: $final_status, exit: $final_exit_code)"
                    echo "  Last 20 log lines:"
                    docker logs "$container_name" 2>&1 | tail -20 | sed 's/^/    /'
                    failed_servers+=("$modpack_name:timeout_stopped_$final_exit_code")
                fi

                # Clean up
                kill $server_pid > /dev/null 2>&1 || true
                ./scripts/stop-server.sh "$modpack_name" > /dev/null 2>&1 || true
                docker rm "$container_name" > /dev/null 2>&1 || true
            fi
        fi
    done

    # Final summary
    echo ""
    echo "🎯 === FINAL TEST SUMMARY ==="
    echo "📊 Total servers tested: $total_servers"
    echo "✅ Successful: ${#successful_servers[@]}"
    echo "❌ Failed: ${#failed_servers[@]}"

    if [ ${#successful_servers[@]} -gt 0 ]; then
        echo ""
        echo "✅ SUCCESSFUL SERVERS:"
        for server in "${successful_servers[@]}"; do
            echo "  🟢 $server"
        done
    fi

    if [ ${#failed_servers[@]} -gt 0 ]; then
        echo ""
        echo "❌ FAILED SERVERS:"
        for server in "${failed_servers[@]}"; do
            echo "  🔴 $server"
        done
        echo ""
        echo "💡 Check the test artifacts for detailed logs"
    fi

    # Assert all servers succeeded
    [ ${#failed_servers[@]} -eq 0 ]
}
