#!/usr/bin/env bats
# Test Suite: End-to-end server startup (one test per server)
#
# US1-TC007 starts every selected modpack and waits until the server logs
# "Done!". It is slow (minutes per server) and needs a running Docker
# daemon plus a prepared .env, which is why it only runs in the manual
# e2e-tests.yml workflow (the fast suite lives in config-validation.bats).
#
# Unlike the fast suite, this file does not declare its cases statically:
# it registers one dynamically generated test per modpack (bats_test_function,
# BATS >= 1.6) at load time, all sharing the same test_server_startup
# template. Every server is therefore reported (and can fail) on its own,
# bats --filter <name> runs a single server's test, and bats --jobs N runs
# N servers at once (needs GNU parallel, preinstalled on CI runners).
# The set of modpacks under test is narrowed with TEST_MODPACKS.
#
# Isolation: real servers keep their containers, worlds and backups. Every
# test run is namespaced away from the production stack:
#   - CONTAINER_NAME_PREFIX=mc-test-   test containers vs. real mc-*
#   - SERVERS_BASE_DIR=.tmp/e2e-data   worlds/mods/backups written under the
#                                      repo's git-ignored .tmp, never into
#                                      the real servers/ and backups/ trees
#   - ROUTER_PROJECT_NAME/ROUTER_CONTAINER_NAME=minecraft-router-test
#   - MC_ROUTER_PORT/MC_ROUTER_API_PORT moved off the real router ports
#   - RCON_PORT_OFFSET=1000            published RCON becomes 27565-27664,
#                                      so tests can run beside live servers
# Containers and compose projects are named per server (mc-test-<server>),
# every server publishes its own loopback RCON port and writes data under
# its own directory, so parallel tests never fight over these resources.
# Each server's test data is deleted as soon as its check finishes; the
# shared test router is torn down by whichever test finishes last (tracked
# through a runner registry file, updated under flock so concurrent
# teardowns cannot lose or duplicate the sweep), and teardown removes
# whatever a crash may have left behind. A suite killed hard (SIGKILL)
# cannot run any cleanup: scripts/ci/run-e2e.sh wraps this suite and sweeps
# the leftovers before the next run (and on INT/TERM).

# Isolation knobs (keep in sync with the defaults in scripts/common.sh)
TEST_CONTAINER_PREFIX="mc-test-"
TEST_DATA_BASE_DIR="$(pwd)/.tmp/e2e-data"
TEST_ROUTER_PORT=25600
TEST_ROUTER_API_PORT=25601
RUNNERS_REGISTRY="${TEST_DATA_BASE_DIR}/.active-runners"

# The suite may be invoked from anywhere; everything below (config lookups,
# ./scripts/*.sh, compose files) expects the project root as cwd. This file
# lives two directories below it (tests/bats/).
cd "$(cd "${BATS_TEST_DIRNAME:-$(dirname "${BATS_TEST_FILENAME:-.}")}/../.." && pwd)" || exit 1

# Make TERM clean up: without an explicit handler, a killed bats process
# dies without running its EXIT trap, so teardown() (container removal,
# runner registry, router sweep) is silently lost. Turning TERM into an
# exit routes it through bats' teardown path. INT is left alone: bats
# installs its own handler and overriding it would break suite interruption.
trap 'exit 143' TERM

# ---------------------------------------------------------------------------
# Test selection (top-level: runs when bats loads this file, before any test)
# TEST_MODPACKS (set by scripts/ci/filter-modpacks.sh) holds a space-
# separated list; without it every config under config/modpacks is tested.
# ---------------------------------------------------------------------------
TEST_SERVERS=()
if [ -n "${TEST_MODPACKS:-}" ]; then
    for modpack_name in $TEST_MODPACKS; do
        if [ -f "config/modpacks/${modpack_name}.env" ]; then
            # Guard against duplicates (bats aborts on repeated test names)
            [[ " ${TEST_SERVERS[*]-} " == *" ${modpack_name} "* ]] || TEST_SERVERS+=("$modpack_name")
        fi
    done
else
    while IFS= read -r -d '' file; do
        TEST_SERVERS+=("$(basename "$file" .env)")
    done < <(find config/modpacks -name "*.env" -type f -print0 | sort -z)
fi

if [ "${#TEST_SERVERS[@]}" -gt 0 ]; then
    for server in "${TEST_SERVERS[@]}"; do
        bats_test_function --description "US1-TC007: server '${server}' fully starts and becomes ready" \
            -- "test_server_startup" "$server"
    done
else
    bats_test_function --description "US1-TC007: no modpack configs selected" -- "test_no_servers_selected"
fi

setup() {
    # Scripts and configs are referenced relative to the project root
    cd "$(dirname "$BATS_TEST_DIRNAME")/.."

    export CONTAINER_NAME_PREFIX="$TEST_CONTAINER_PREFIX"
    export SERVERS_BASE_DIR="$TEST_DATA_BASE_DIR"
    export ROUTER_PROJECT_NAME="minecraft-router-test"
    export ROUTER_CONTAINER_NAME="minecraft-router-test"
    export MC_ROUTER_PORT="$TEST_ROUTER_PORT"
    export MC_ROUTER_API_PORT="$TEST_ROUTER_API_PORT"
    export RCON_PORT_OFFSET="${RCON_PORT_OFFSET:-1000}"

    # Startup monitoring budgets, overridable for slow machines/first downloads
    export MAX_WAIT_TIME="${MAX_WAIT_TIME:-300}"
    export CONTAINER_CREATE_TIMEOUT="${CONTAINER_CREATE_TIMEOUT:-30}"

    mkdir -p "$SERVERS_BASE_DIR"
    # Register this test's process so the last one out can tear the shared
    # test router down without killing tests still running in parallel
    echo "$$" >> "$RUNNERS_REGISTRY"
}

teardown() {
    # Bats invokes teardown as `teardown >>"$BATS_OUT"`: if the suite-wide
    # cleanup already removed BATS_RUN_TMPDIR (coordinator died on a signal
    # first), that redirection fails silently and teardown never runs.
    # Recreate the directory so a dying run still cleans its resources.
    [ -n "${BATS_OUT:-}" ] && mkdir -p "${BATS_OUT%/*}" 2> /dev/null || true
    # Safety net for a container the test body could not remove (crash, or a
    # bats abort before its own cleanup ran): only ever touches test containers
    if [ -n "${TEST_SERVER_UNDER_TEST:-}" ]; then
        timeout 60 docker rm -f "${TEST_CONTAINER_PREFIX}${TEST_SERVER_UNDER_TEST}" > /dev/null 2>&1 || true
    fi

    # If the test body was interrupted (bats does not trap TERM), kill the
    # detached server tree the body started; its container is gone already
    if [ -n "${TEST_SERVER_PID:-}" ]; then
        kill -TERM -- -"$TEST_SERVER_PID" > /dev/null 2>&1 || true
    fi

    # Drop this process from the runner registry; only the last running test
    # removes the dedicated test router (the real minecraft-router is a
    # different project/container and stays untouched) and sweeps leftover
    # data of servers whose check was interrupted. The whole drop-count-
    # sweep sequence is serialized with flock: concurrent teardowns would
    # otherwise all see remaining>0 and nobody would sweep (or two would).
    # Entries whose pid is gone — from a run killed with SIGKILL — are
    # pruned, so a later teardown still reaches the sweep and the next run
    # starts clean. Bounded with timeout: a wedged container runtime must
    # not stall the suite forever.
    if command -v flock > /dev/null 2>&1 && [ -d "${SERVERS_BASE_DIR:-/nonexistent}" ]; then
        (
            flock -w 300 9 2> /dev/null || exit 0
            registry_update_and_sweep
        ) 9>>"${RUNNERS_REGISTRY}.lock"
    else
        registry_update_and_sweep
    fi
}

# Registry update + last-runner sweep; callers serialize it (teardown holds
# RUNNERS_REGISTRY.lock). See teardown for the why.
registry_update_and_sweep() {
    local tmp_next="${RUNNERS_REGISTRY}.next" pid remaining=0
    : > "$tmp_next" 2> /dev/null || return 0
    if [ -f "$RUNNERS_REGISTRY" ]; then
        while IFS= read -r pid; do
            [ -n "$pid" ] || continue
            [ "$pid" = "$$" ] && continue
            if kill -0 "$pid" 2> /dev/null || [ -d "/proc/$pid" ]; then
                echo "$pid" >> "$tmp_next"
                remaining=$((remaining + 1))
            fi
        done < "$RUNNERS_REGISTRY"
    fi
    mv "$tmp_next" "$RUNNERS_REGISTRY" 2> /dev/null || true

    if [ "$remaining" -gt 0 ]; then
        return 0
    fi
    timeout 120 docker compose -p "${ROUTER_PROJECT_NAME:-minecraft-router-test}" \
        -f docker-compose.router.yml down -v > /dev/null 2>&1 || true

    # Only ever touches the dedicated test tree, never the real
    # servers/ and backups/ trees
    if [ -d "${SERVERS_BASE_DIR:-/nonexistent}" ]; then
        remove_tree "${SERVERS_BASE_DIR}/servers"
        remove_tree "${SERVERS_BASE_DIR}/backups"
    fi
}

# Delete a directory tree that may be owned by the container user. Under
# rootless podman, container root maps to an unprivileged host subuid, so a
# plain host rm -rf fails with permission errors; fall back to removing the
# CONTENTS from inside a container in the same user namespace — the mount
# point itself (/target) is always "Resource busy" and cannot be removed.
remove_tree() {
    local path="$1"
    [ -e "$path" ] || return 0
    rm -rf "$path" 2> /dev/null || \
        timeout 300 docker run --rm -v "${path}:/target" "${CLEANUP_IMAGE:-alpine:latest}" \
            find /target -mindepth 1 -delete > /dev/null 2>&1 || true
}

# Save the full container log before the container is removed, so failures
# stay diagnosable (CI uploads them as artifacts)
capture_server_logs() {
    local modpack_name="$1" container_name="$2"
    local log_dir="${TEST_LOG_DIR:-${SERVERS_BASE_DIR}/server-logs}"
    mkdir -p "$log_dir"
    timeout 60 docker logs "$container_name" > "${log_dir}/${modpack_name}.log" 2>&1 || true
}

# Delete the test world/mods/backup data of one server. Called as soon as its
# check finishes so nothing accumulates on disk between runs.
cleanup_test_server_data() {
    local modpack_name="$1"
    remove_tree "${SERVERS_BASE_DIR}/servers/${modpack_name}"
    remove_tree "${SERVERS_BASE_DIR}/backups/${modpack_name}"
}

# Bring the server container down and clean its data. Shared by every exit
# path of the template below.
remove_test_server() {
    local modpack_name="$1" server_pid="$2" container_name="$3"

    kill -- -$server_pid > /dev/null 2>&1 || true
    capture_server_logs "$modpack_name" "$container_name"
    ./scripts/stop-server.sh "$modpack_name" > /dev/null 2>&1 || true
    timeout 60 docker rm -f "$container_name" > /dev/null 2>&1 || true
    cleanup_test_server_data "$modpack_name"
}

# Fallback when the selection above found nothing (keeps bats reporting a
# defined result instead of an empty suite)
test_no_servers_selected() {
    skip "No modpack configs found for this test run (TEST_MODPACKS='${TEST_MODPACKS:-}')"
}

# ---------------------------------------------------------------------------
# US1-TC007 template: start one modpack and wait until its server logs the
# Minecraft readiness banner. Registered once per server, so $1 is the
# modpack name. Any failure reports against that single server only.
# ---------------------------------------------------------------------------
test_server_startup() {
    local modpack_name="$1"
    local container_name="${TEST_CONTAINER_PREFIX}${modpack_name}"
    TEST_SERVER_UNDER_TEST="$modpack_name"

    # The end-to-end test needs a Docker daemon; skip cleanly when unavailable
    if ! docker info > /dev/null 2>&1; then
        skip "Docker daemon is not running"
    fi

    local max_wait_time="$MAX_WAIT_TIME"
    local check_interval=5 # Check logs every 5 seconds

    echo "🚀 Testing full startup for '$modpack_name'"
    echo "📋 Config: config/modpacks/${modpack_name}.env"
    echo "📦 Container: $container_name"
    echo "⏱️  Max wait time: ${max_wait_time}s, check interval: ${check_interval}s"
    echo "🧪 Isolation: containers '${CONTAINER_NAME_PREFIX}*', data under ${SERVERS_BASE_DIR}"
    echo "---"

    # Start the server in background (own process group so a failure
    # timeout can kill its whole tree, compose children included).
    # TEST_SERVER_PID lets teardown kill the tree too if this body is
    # interrupted before reaching its own cleanup paths
    echo "🚀 Starting server '$modpack_name'..."
    setsid ./scripts/start-server.sh "$modpack_name" &
    local server_pid=$!
    TEST_SERVER_PID="$server_pid"

    # Wait for container to be created
    echo "⏳ Waiting for container creation..."
    local wait_container=0
    while [ $wait_container -lt "$CONTAINER_CREATE_TIMEOUT" ]; do
        if docker ps -a --filter "name=${container_name}" --format "{{.Names}}" | grep -q "^${container_name}$"; then
            echo "  ✅ Container created successfully"
            break
        fi
        sleep 1
        wait_container=$((wait_container + 1))
    done

    if [ $wait_container -ge "$CONTAINER_CREATE_TIMEOUT" ]; then
        echo "  ❌ Container not created after ${CONTAINER_CREATE_TIMEOUT}s"
        kill -- -$server_pid > /dev/null 2>&1 || true
        cleanup_test_server_data "$modpack_name"
        fail "container not created after ${CONTAINER_CREATE_TIMEOUT}s"
    fi

    # Monitor logs until server is ready or fails
    local elapsed=0
    local server_ready=false
    local last_log_line=""
    local last_progress_time=0

    echo "→ Monitoring startup progress..."
    echo "   📊 Progress updates every 5 seconds"
    echo "   🔍 Checking for 'Done!' message"

    while [ $elapsed -lt "$max_wait_time" ]; do
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

            remove_test_server "$modpack_name" "$server_pid" "$container_name"

            if [ "$exit_code" = "unknown" ]; then
                fail "container disappeared during startup (last status: $container_status)"
            fi
            fail "container stopped during startup (exit code: $exit_code)"
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

        # Check for fatal errors. Autopause/knockd noise is filtered
        # first: when the daemon cannot grab the interface (rootless
        # podman) it logs "Failed to start knockd daemon" yet the
        # server itself starts fine. Exceptions are only fatal when
        # they hit the main/server thread — background workers can
        # throw survivable exceptions while the server keeps loading.
        if echo "$current_logs" | grep -v -i "autopause\|knockd" | grep -q -i "java.lang.OutOfMemoryError\|Server crashed\|Failed to start\|Could not reserve enough space\|Exception in thread \"main\"\|Exception in thread \"Server thread\""; then
            echo "  ❌ Fatal error detected in '$modpack_name' logs"
            echo "  📄 Last 20 log lines:"
            echo "$current_logs" | tail -20 | sed 's/^/     /'

            remove_test_server "$modpack_name" "$server_pid" "$container_name"
            fail "fatal error detected in logs after ${elapsed}s"
        fi

        sleep "$check_interval"
        elapsed=$((elapsed + check_interval))
    done

    # Verify result
    if [ "$server_ready" != true ]; then
        # The wait budget ran out without a readiness banner; report what
        # the container was doing when the time came
        local final_status
        final_status=$(docker inspect "${container_name}" --format='{{.State.Status}}' 2> /dev/null || echo "not_found")

        echo "  ⏰ Timeout after ${max_wait_time}s"
        echo "  Last 20 log lines:"
        docker logs "$container_name" 2>&1 | tail -20 | sed 's/^/    /'

        if [ "$final_status" = "running" ]; then
            remove_test_server "$modpack_name" "$server_pid" "$container_name"
            fail "timeout after ${max_wait_time}s (container still running, never became ready)"
        fi
        local final_exit_code
        final_exit_code=$(docker inspect "${container_name}" --format='{{.State.ExitCode}}' 2> /dev/null || echo "unknown")
        remove_test_server "$modpack_name" "$server_pid" "$container_name"
        fail "timeout after ${max_wait_time}s (container stopped, status: $final_status, exit: $final_exit_code)"
    fi

    echo "  ✅ Completed in ${elapsed}s"

    # Clean up container, then the test data it generated
    capture_server_logs "$modpack_name" "$container_name"
    ./scripts/stop-server.sh "$modpack_name" > /dev/null 2>&1 || true
    timeout 60 docker rm -f "$container_name" > /dev/null 2>&1 || true
    cleanup_test_server_data "$modpack_name"
}
