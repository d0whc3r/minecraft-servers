#!/usr/bin/env bats
# Test Suite: Script and configuration validation
#
# US1-TC001..TC006 are fast checks of the management scripts and modpack
# configs that need no Docker. US1-TC007 is the slow end-to-end startup test
# and requires a running Docker daemon.

setup() {
    # Scripts and configs are referenced relative to the project root
    cd "$(dirname "$BATS_TEST_DIRNAME")/.."
}

# Read VAR from a modpack .env file (empty if unset; quotes stripped)
config_value() {
    grep -m1 "^$2=" "$1" | cut -d= -f2- | tr -d '"' || true
}

# Test Case: US1-TC001 - every management script parses without syntax errors
# (syntax check only: no script is executed)
@test "US1-TC001: Script syntax validation" {
    local failed=""
    local error_output

    for script in scripts/*.sh; do
        if error_output=$(bash -n "$script" 2>&1); then
            echo "✓ $script"
        else
            echo "✗ $script"
            echo "$error_output" | sed 's/^/    /' >&2
            failed+="$script "
        fi
    done

    [ -z "$failed" ] || fail "Syntax errors in: $failed"
}

# Test Case: US1-TC002 - configs satisfy the invariants the runtime depends on:
# supported TYPE, parseable MEMORY/VERSION, a unique RCON_PORT inside the
# managed loopback range (see find_available_port in common.sh), and a
# SERVER_NAME that agrees with the file name the container will be named after.
# There are no game ports: players connect via mc-router routes.
@test "US1-TC002: All modpack configurations are valid" {
    local invalid=""
    local ports=""
    local names=""

    for config in config/modpacks/*.env; do
        if [ ! -f "$config" ]; then
            skip "No modpack configs found"
        fi

        local name type version memory rcon_port server_name
        name=$(basename "$config" .env)
        type=$(config_value "$config" TYPE)
        version=$(config_value "$config" VERSION)
        memory=$(config_value "$config" MEMORY)
        rcon_port=$(config_value "$config" RCON_PORT)
        server_name=$(config_value "$config" SERVER_NAME)

        echo "Validating config: $name"

        # TYPE must be one the itzg/minecraft-server image setup supports
        case "$type" in
            VANILLA | PAPER | FORGE | FABRIC | AUTO_CURSEFORGE | MODRINTH) ;;
            *)
                invalid+="$name: unsupported TYPE '$type'"
            ;;
        esac

        # MEMORY drives the container memory limit; must be like 4G or 4096M
        if ! [[ "$memory" =~ ^[0-9]+[GgMm]$ ]]; then
            invalid+="$name: invalid MEMORY '$memory'"
        fi

        # VERSION is optional for AUTO_CURSEFORGE (the modpack pins its own
        # version, e.g. menagerie.env), required otherwise; if present it must
        # be a real version number
        if [ "$type" != "AUTO_CURSEFORGE" ] && [ -z "$version" ]; then
            invalid+="$name: missing VERSION"
        fi
        if [ -n "$version" ] && [ "$version" != "LATEST" ] && ! [[ "$version" =~ ^[0-9]+(\.[0-9]+)+$ ]]; then
            invalid+="$name: invalid VERSION '$version'"
        fi

        # RCON_PORT is the only per-server port (127.0.0.1 loopback binding on
        # the shared host): missing, out-of-range or duplicated values break
        # startup or steal another server's admin console
        if ! [[ "$rcon_port" =~ ^[0-9]+$ ]]; then
            invalid+="$name: invalid RCON_PORT '$rcon_port'"
        elif [ "$rcon_port" -lt 26565 ] || [ "$rcon_port" -gt 26664 ]; then
            invalid+="$name: RCON_PORT $rcon_port outside managed range 26565-26664"
        fi
        ports+="$rcon_port"$'\n'

        # Container name comes from the file name, so SERVER_NAME must agree;
        # it also builds the player route <SERVER_NAME>.<MC_ROUTER_DOMAIN>
        if [ "$server_name" != "$name" ]; then
            invalid+="$name: SERVER_NAME '$server_name' does not match file name"
        fi
        names+="$server_name"$'\n'

        # No server may still carry the removed game-port variable
        if grep -q "^SERVER_PORT=" "$config"; then
            invalid+="$name: SERVER_PORT is removed (traffic routes via mc-router)"
        fi

        # Type-specific required variables
        if [ "$type" = "AUTO_CURSEFORGE" ] && ! grep -q "^CF_PAGE_URL=" "$config"; then
            invalid+="$name: CF_PAGE_URL required for AUTO_CURSEFORGE"
        fi
        if [ "$type" = "MODRINTH" ] && ! grep -q "^MODRINTH_MODPACK=" "$config"; then
            invalid+="$name: MODRINTH_MODPACK required for MODRINTH"
        fi
    done

    local duplicate_ports duplicate_names
    duplicate_ports=$(printf '%s' "$ports" | sort | uniq -d | tr '\n' ' ')
    duplicate_names=$(printf '%s' "$names" | sort | uniq -d | tr '\n' ' ')
    [ -z "$duplicate_ports" ] || invalid+="$'\n'duplicate RCON_PORT values: $duplicate_ports"
    [ -z "$duplicate_names" ] || invalid+="$'\n'duplicate SERVER_NAME values: $duplicate_names"

    [ -z "$invalid" ] || fail "Invalid configurations:$'\n'$invalid"
}

# Test Case: US1-TC003 - invalid inputs fail fast with the exit codes documented
# in the header of scripts/start-server.sh
@test "US1-TC003: Invalid inputs are rejected with documented exit codes" {
    # Malformed server name -> exit 2 (invalid arguments)
    run ./scripts/start-server.sh 'Invalid_Name'
    [ "$status" -eq 2 ]
    [[ "$output" == *"Invalid server name format"* ]]

    # Well-formed name with no config file -> exit 3 (configuration not found)
    run ./scripts/start-server.sh 'nonexistent-modpack'
    [ "$status" -eq 3 ]
    [[ "$output" == *"Configuration not found"* ]]

    # The failure must tell the operator which servers do exist
    [[ "$output" == *"Available servers"* ]]
}

# Test Case: US1-TC004 - scripts are executable, and running the entry point
# without arguments prints usage guidance instead of failing silently
@test "US1-TC004: Scripts are executable and usage is accessible" {
    for script in scripts/*.sh; do
        [ -x "$script" ] || fail "Script is not executable: $script"
    done

    run ./scripts/start-server.sh
    [ "$status" -eq 2 ]
    [[ "$output" == *"Missing server name argument"* ]]
    [[ "$output" == *"Usage:"* ]]
    [[ "$output" == *"Available servers"* ]]
}

# Test Case: US1-TC005 - the project's own server detection (list_available_servers
# in common.sh) lists exactly the modpacks present on disk
@test "US1-TC005: Dynamic modpack detection lists every configured modpack" {
    local detected expected
    detected=$(bash -c 'source scripts/common.sh && list_available_servers' | sort)
    expected=$(find config/modpacks -name '*.env' -type f -exec basename {} .env \; | sort)

    [ -n "$detected" ] || fail "list_available_servers returned no servers"
    [ "$detected" = "$expected" ] || fail "Detection mismatch. Detected: $(echo "$detected" | tr '\n' ' ') Expected: $(echo "$expected" | tr '\n' ' ')"

    echo "Detected $(wc -l <<<"$detected") modpacks"
}

# Test Case: US1-TC006 - extracted names pass the same validation the scripts
# apply (validate_server_name) and resolve to an existing config through the
# same lookup (check_config_exists)
@test "US1-TC006: Extracted modpack names are valid and resolvable" {
    run bash -c '
        source scripts/common.sh
        failed=0
        for name in $(list_available_servers); do
            if validate_server_name "$name" >/dev/null 2>&1 && check_config_exists "$name" >/dev/null 2>&1; then
                echo "OK $name"
            else
                echo "FAILED $name"
                failed=1
            fi
        done
        exit "$failed"
    '
    [ "$status" -eq 0 ]
    [[ "$output" == *"OK "* ]] || fail "No modpack names were extracted"
}

# Test Case: US1-TC008 - the compose files render the router-only wiring: the
# router stack parses on its own, servers announce their mc-router route label
# and publish nothing but their loopback RCON port
@test "US1-TC008: compose files announce routes and keep ports internal" {
    command -v docker > /dev/null 2>&1 || skip "docker CLI not available"
    if [ ! -f .env ]; then
        skip ".env not present (CI prepare step creates it)"
    fi

    # Router stack must be a valid compose file on its own
    run docker compose -p router-test -f docker-compose.router.yml config --quiet
    [ "$status" -eq 0 ] || fail "docker-compose.router.yml is invalid: $output"

    # The legacy published-ports override must be gone
    [ ! -f docker-compose.published-ports.yml ] || fail "legacy docker-compose.published-ports.yml still present"

    # Server stack: route label built from SERVER_NAME + MC_ROUTER_DOMAIN and
    # RCON bound to 127.0.0.1 as the ONLY published port
    local out
    out=$(SERVER_NAME=vanilla MC_ROUTER_DOMAIN=test.local \
        SERVER_CONFIG_FILE=config/modpacks/vanilla.env \
        RCON_PORT=26567 \
        docker compose -p server-test -f docker-compose.yml config 2>/dev/null)
    [[ "$out" == *"mc-router.host: vanilla.test.local"* ]] || fail "route label missing"
    [[ "$out" == *"host_ip: 127.0.0.1"* ]] || fail "RCON is not loopback-bound"
    local published_count
    published_count=$(grep -c 'published:' <<< "$out" || true)
    [ "$published_count" -eq 1 ] || fail "expected only loopback RCON published, found $published_count"
    if grep -q 'target: 25565' <<< "$out"; then
        fail "a game port is still published"
    fi
}

# Test Case: US1-TC009 - router.sh rejects bad subcommands before touching
# Docker and documents its interface through usage output
@test "US1-TC009: router.sh validates arguments without Docker" {
    run ./scripts/router.sh
    [ "$status" -eq 2 ]
    [[ "$output" == *"Usage:"* ]]

    run ./scripts/router.sh bogus-command
    [ "$status" -eq 2 ]
    [[ "$output" == *"Unknown command"* ]]

    run ./scripts/router.sh --help
    [ "$status" -eq 0 ]
    [[ "$output" == *"start|stop|restart|status|routes|logs"* ]]
}

# Test Case: US1-TC010 - common.sh exposes every function the management
# scripts call. Several scripts (add-modpack.sh, health-check.sh,
# validate-config.sh, list-servers.sh) previously called log_* and
# get_container_uptime without them existing anywhere, crashing at runtime
@test "US1-TC010: common.sh provides all cross-script helper functions" {
    local missing=""
    local fn
    for fn in error info success warning debug log_error log_info log_success \
        validate_server_name check_config_exists check_docker_running \
        container_exists container_running list_available_servers \
        get_container_name get_config_file get_container_uptime \
        get_env_value load_router_settings get_route_host router_running \
        ensure_router get_rcon_port find_available_port check_port_open \
        ensure_network; do
        if ! bash -c "source scripts/common.sh && declare -F '$fn' > /dev/null"; then
            missing+="$fn "
        fi
    done
    [ -z "$missing" ] || fail "Missing functions in common.sh: $missing"
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
