#!/bin/bash
# Common test utilities and data structures for BATS tests

# Test Case data structure
# Usage: create_test_case "name" "description" "category" timeout
create_test_case() {
    local name="$1"
    local description="$2"
    local category="$3"
    local timeout="${4:-30}"

    cat << EOF
{
    "name": "$name",
    "description": "$description",
    "category": "$category",
    "timeout": $timeout,
    "status": "pending"
}
EOF
}

# Test Suite data structure
# Usage: create_test_suite "name" "description"
create_test_suite() {
    local name="$1"
    local description="$2"

    cat << EOF
{
    "name": "$name",
    "description": "$description",
    "test_cases": [],
    "start_time": null,
    "end_time": null,
    "status": "pending"
}
EOF
}

# Test Result data structure
# Usage: create_test_result "test_name" "status" exit_code stdout stderr
create_test_result() {
    local test_name="$1"
    local status="$2"
    local exit_code="${3:-0}"
    local stdout="${4:-}"
    local stderr="${5:-}"

    cat << EOF
{
    "test_name": "$test_name",
    "status": "$status",
    "exit_code": $exit_code,
    "execution_time_ms": 0,
    "start_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "end_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "stdout": "$stdout",
    "stderr": "$stderr"
}
EOF
}

# Log Entry data structure
# Usage: create_log_entry "level" "component" "message" [context]
create_log_entry() {
    local level="$1"
    local component="$2"
    local message="$3"
    local context="${4:-}"

    cat << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "level": "$level",
    "component": "$component",
    "message": "$message",
    "context": "$context"
}
EOF
}

# Utility functions for test execution

# Generate unique test ID
generate_test_id() {
    echo "test_$(date +%s)_$RANDOM"
}

# Calculate execution time between two timestamps
calculate_duration() {
    local start_time="$1"
    local end_time="$2"

    if command -v gdate &> /dev/null; then
        # macOS with coreutils
        echo $(( $(gdate -d "$end_time" +%s) - $(gdate -d "$start_time" +%s) ))
    else
        # Linux
        echo $(( $(date -d "$end_time" +%s) - $(date -d "$start_time" +%s) ))
    fi
}

# Validate JSON structure (basic check)
validate_json() {
    local json="$1"
    echo "$json" | python3 -m json.tool > /dev/null 2>&1
}

# Safe file operations with error handling
safe_read_file() {
    local file_path="$1"
    local max_size="${2:-1048576}"  # 1MB default

    if [[ ! -f "$file_path" ]]; then
        echo "ERROR: File not found: $file_path" >&2
        return 1
    fi

    if [[ ! -r "$file_path" ]]; then
        echo "ERROR: File not readable: $file_path" >&2
        return 1
    fi

    local file_size
    file_size=$(stat -f%z "$file_path" 2>/dev/null || stat -c%s "$file_path" 2>/dev/null)
    if [[ $file_size -gt $max_size ]]; then
        echo "ERROR: File too large: $file_path (${file_size} bytes > ${max_size} bytes)" >&2
        return 1
    fi

    cat "$file_path"
}

# Logging functions for test execution
log_info() {
    create_log_entry "info" "${BATS_TEST_NAME:-unknown}" "$1" "$2" >&3
}

log_error() {
    create_log_entry "error" "${BATS_TEST_NAME:-unknown}" "$1" "$2" >&3
}

log_debug() {
    if [[ "${BATS_DEBUG:-false}" == "true" ]]; then
        create_log_entry "debug" "${BATS_TEST_NAME:-unknown}" "$1" "$2" >&3
    fi
}

# Test assertion helpers
assert_command_success() {
    local command="$1"
    local description="${2:-Command execution}"

    if ! eval "$command"; then
        log_error "$description failed" "command: $command"
        return 1
    fi

    log_info "$description succeeded" "command: $command"
}

assert_file_exists() {
    local file_path="$1"
    local description="${2:-File existence check}"

    if [[ ! -f "$file_path" ]]; then
        log_error "$description failed" "file: $file_path"
        return 1
    fi

    log_info "$description succeeded" "file: $file_path"
}

assert_file_contains() {
    local file_path="$1"
    local expected_content="$2"
    local description="${3:-File content check}"

    if ! grep -q "$expected_content" "$file_path" 2>/dev/null; then
        log_error "$description failed" "file: $file_path, expected: $expected_content"
        return 1
    fi

    log_info "$description succeeded" "file: $file_path, found: $expected_content"
}