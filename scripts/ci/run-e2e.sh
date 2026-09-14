#!/usr/bin/env bash
#
# run-e2e.sh - Run the E2E bats suite with guaranteed cleanup
#
# Bats alone cannot clean up when the suite is killed: bats 1.13 ignores
# SIGINT while running tests in parallel (the whole suite keeps going), an
# untrapped SIGTERM kills the coordinator before the last teardown can sweep
# the shared router, and SIGKILL by definition runs nothing. This wrapper
# owns the lifecycle instead:
#
#   1. Pre-run: sweep leftovers of a previous crashed run, but only when no
#      other suite instance is still registered as alive.
#   2. The suite runs in its own session (setsid), so killing it never kills
#      this wrapper and Ctrl+C reaches the wrapper, not the suite directly.
#   3. On INT/TERM: TERM the whole suite tree (each running test's teardown
#      removes its own container), escalate to KILL after a grace period,
#      then sweep every test resource.
#   4. SIGKILL to this wrapper cannot run code; the next invocation's
#      pre-run sweep recovers from that.
#
# Scope mirrors the suite's own teardown: only ever touches containers,
# networks, volumes and data named with the test prefix, plus the dedicated
# test router project. Real servers (mc-*) and the real router are never
# matched.
#
# Usage: scripts/ci/run-e2e.sh [--cleanup] [bats args...]
#   --cleanup    only sweep leftovers of previous runs, then exit
#   Without arguments it runs the equivalent of:
#     pnpm exec bats --jobs 4 --no-parallelize-across-files \
#       tests/bats/server-startup.bats
#
# Environment knobs (keep in sync with tests/bats/server-startup.bats):
#   TEST_CONTAINER_PREFIX (mc-test-), TEST_DATA_BASE_DIR (.tmp/e2e-data),
#   ROUTER_PROJECT_NAME (minecraft-router-test), PARALLEL_JOBS (4)
set -u

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)" || exit 1

TEST_CONTAINER_PREFIX="${TEST_CONTAINER_PREFIX:-mc-test-}"
TEST_DATA_BASE_DIR="${TEST_DATA_BASE_DIR:-$(pwd)/.tmp/e2e-data}"
ROUTER_PROJECT_NAME="${ROUTER_PROJECT_NAME:-minecraft-router-test}"
RUNNERS_REGISTRY="${TEST_DATA_BASE_DIR}/.active-runners"

# Container-owned trees can refuse a host rm -rf under rootless runtimes;
# fall back to removing the contents from inside a container (same trick the
# suite uses in remove_tree). The container must delete the directory's
# CONTENTS, not /target itself: the mount point is always "Resource busy".
remove_tree() {
  local path="$1"
  [ -e "$path" ] || return 0
  rm -rf "$path" 2> /dev/null \
    || timeout 300 docker run --rm -v "${path}:/target" "${CLEANUP_IMAGE:-alpine:latest}" \
      find /target -mindepth 1 -delete > /dev/null 2>&1 || true
}

docker_available() {
  docker info > /dev/null 2>&1
}

# Remove every resource a test run could have left behind. Idempotent and
# safe to run while nothing else is testing: everything is prefix-scoped to
# the test namespace.
sweep() {
  if docker_available; then
    docker ps -aq --filter "name=^${TEST_CONTAINER_PREFIX}" | xargs -r -n1 timeout 60 docker rm -f > /dev/null 2>&1 || true
    timeout 120 docker compose -p "$ROUTER_PROJECT_NAME" -f docker-compose.router.yml down -v > /dev/null 2>&1 || true
    docker network ls --filter "name=^${TEST_CONTAINER_PREFIX}" --format "{{.Name}}" \
      | xargs -r -n1 timeout 60 docker network rm > /dev/null 2>&1 || true
    docker volume ls --filter "name=^${TEST_CONTAINER_PREFIX}" --format "{{.Name}}" \
      | xargs -r -n1 timeout 60 docker volume rm > /dev/null 2>&1 || true
  fi
  remove_tree "${TEST_DATA_BASE_DIR}/servers"
  remove_tree "${TEST_DATA_BASE_DIR}/backups"
}

# True when the registry holds at least one entry whose pid is still alive
# (dead entries from killed runs are ignored). PIDs are the bats processes
# that tests/bats/server-startup.bats registers in setup().
another_suite_is_running() {
  [ -f "$RUNNERS_REGISTRY" ] || return 1
  local pid
  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    if kill -0 "$pid" 2> /dev/null || [ -d "/proc/$pid" ]; then
      return 0
    fi
  done < "$RUNNERS_REGISTRY"
  return 1
}

stop_suite_tree() {
  if kill -0 "$SUITE_PID" 2> /dev/null || another_suite_is_running; then
    printf 'run-e2e: stopping suite tree (pid %s)...\n' "$SUITE_PID" >&2
    # Wave 1: TERM only the running test processes (registered in the
    # runner registry). Each runs its bats teardown — container removal
    # and registry update — while the bats coordinator is still alive;
    # killing the coordinator first would make it delete bats' tmpdir
    # and every teardown would fail silently on its output redirection.
    # The registry drains as teardowns complete.
    local pid waited=0
    for pid in $(cat "$RUNNERS_REGISTRY" 2> /dev/null); do
      kill -TERM "$pid" 2> /dev/null || true
    done
    while [ "$waited" -lt 60 ] && another_suite_is_running; do
      sleep 0.5
      waited=$((waited + 1))
    done
    # Wave 2: stop the rest of the tree (coordinator, queued wrappers,
    # pnpm/node). A test spawned in between gets TERM in its body and
    # whatever its teardown cannot do is covered by the sweep below.
    kill -TERM -- -"$SUITE_PID" 2> /dev/null || true
    sleep 1
    kill -KILL -- -"$SUITE_PID" 2> /dev/null || true
    wait "$SUITE_PID" 2> /dev/null || true
  fi
}

on_signal() {
  local sig="$1" status="$2"
  # Ignore further signals: the handler must run to completion exactly once
  trap '' INT TERM EXIT
  stop_suite_tree
  # Only sweep when no other suite instance is alive: a concurrent run's
  # resources are its own business, and its last teardown will sweep.
  another_suite_is_running || sweep
  exit "$status"
}

SUITE_PID=""

if [ "${1:-}" = "--cleanup" ]; then
  shift
  [ $# -gt 0 ] && printf 'run-e2e: --cleanup ignores extra arguments\n' >&2
  sweep
  if ! another_suite_is_running; then
    rm -f "$RUNNERS_REGISTRY" "${RUNNERS_REGISTRY}.lock"
  fi
  exit 0
fi

if [ $# -eq 0 ]; then
  set -- --jobs "${PARALLEL_JOBS:-4}" --no-parallelize-across-files tests/bats/server-startup.bats
fi

if ! another_suite_is_running; then
  sweep
fi

if command -v setsid > /dev/null 2>&1; then
  # Own session/process group: the wrapper can TERM/KILL the whole tree
  # without the signal hitting the wrapper itself
  setsid pnpm exec bats "$@" &
else
  # No setsid: run in the foreground; signals then behave like a bare
  # bats run (cleanup falls back to the suite's own teardown)
  pnpm exec bats "$@"
  status=$?
  another_suite_is_running || sweep
  exit "$status"
fi
SUITE_PID=$!

trap 'on_signal INT 130' INT
trap 'on_signal TERM 143' TERM

wait "$SUITE_PID"
status=$?
another_suite_is_running || sweep
exit "$status"
