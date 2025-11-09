#!/usr/bin/env bash
# Test Result Logging and Reporting Infrastructure
# Provides comprehensive logging and reporting for BATS test suite

# Source common helpers
source "$(dirname "${BASH_SOURCE[0]}")/common.bash"

# Configuration
TEST_LOG_DIR="${TEST_LOG_DIR:-test-results}"
TEST_LOG_MAX_SIZE="${TEST_LOG_MAX_SIZE:-10485760}"  # 10MB default
TEST_LOG_RETENTION_DAYS="${TEST_LOG_RETENTION_DAYS:-30}"

# Initialize logging infrastructure
init_test_logging() {
    # Create log directory if it doesn't exist
    mkdir -p "${TEST_LOG_DIR}"

    # Clean up old logs
    cleanup_old_logs

    log_info "Test logging infrastructure initialized in ${TEST_LOG_DIR}"
}

# Clean up logs older than retention period
cleanup_old_logs() {
    local cutoff_date
    cutoff_date=$(date -d "${TEST_LOG_RETENTION_DAYS} days ago" +%Y%m%d 2>/dev/null || date -v-${TEST_LOG_RETENTION_DAYS}d +%Y%m%d 2>/dev/null)

    if [ -d "${TEST_LOG_DIR}" ]; then
        find "${TEST_LOG_DIR}" -name "*.log" -type f -mtime +${TEST_LOG_RETENTION_DAYS} -delete 2>/dev/null || true
        find "${TEST_LOG_DIR}" -name "*.json" -type f -mtime +${TEST_LOG_RETENTION_DAYS} -delete 2>/dev/null || true
    fi
}

# Rotate log file if it exceeds maximum size
rotate_log_file() {
    local log_file="$1"
    local max_size="${2:-${TEST_LOG_MAX_SIZE}}"

    if [ -f "$log_file" ] && [ "$(stat -f%z "$log_file" 2>/dev/null || stat -c%s "$log_file" 2>/dev/null)" -gt "$max_size" ]; then
        local timestamp
        timestamp=$(date +%Y%m%d_%H%M%S)
        local backup_file="${log_file}.${timestamp}.bak"

        mv "$log_file" "$backup_file" 2>/dev/null || true
        log_info "Rotated log file: ${log_file} -> ${backup_file}"

        # Keep only last 5 backup files
        ls -t "${log_file}".*.bak 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
    fi
}

# Write test result to log file
log_test_result() {
    local test_id="$1"
    local test_name="$2"
    local status="$3"  # passed, failed, skipped
    local duration="$4"
    local output="$5"
    local error="$6"

    local log_file="${TEST_LOG_DIR}/test-results-$(date +%Y%m%d).log"
    local json_file="${TEST_LOG_DIR}/test-results-$(date +%Y%m%d).json"

    # Rotate files if needed
    rotate_log_file "$log_file"
    rotate_log_file "$json_file"

    # Create log entry
    local timestamp
    timestamp=$(date +%Y-%m-%dT%H:%M:%S%z)

    # Text log entry
    {
        echo "[$timestamp] TEST: $test_id - $test_name"
        echo "[$timestamp] STATUS: $status"
        echo "[$timestamp] DURATION: ${duration}s"
        if [ -n "$error" ]; then
            echo "[$timestamp] ERROR: $error"
        fi
        if [ -n "$output" ]; then
            echo "[$timestamp] OUTPUT: $output"
        fi
        echo "[$timestamp] ---"
    } >> "$log_file"

    # JSON log entry
    local json_entry
    json_entry=$(cat <<EOF
{
  "timestamp": "$timestamp",
  "test_id": "$test_id",
  "test_name": "$test_name",
  "status": "$status",
  "duration": $duration,
  "output": $(printf '%q' "$output" | sed 's/^/$/'),
  "error": $(printf '%q' "$error" | sed 's/^/$/')
}
EOF
    )

    # Append to JSON array file
    if [ -f "$json_file" ]; then
        # Remove closing bracket, add comma, then new entry
        sed -i '$ s/]$/,/' "$json_file"
        echo "$json_entry" >> "$json_file"
        echo "]" >> "$json_file"
    else
        # Create new JSON array file
        echo "[" > "$json_file"
        echo "$json_entry" >> "$json_file"
        echo "]" >> "$json_file"
    fi
}

# Generate test summary report
generate_test_report() {
    local report_file="${TEST_LOG_DIR}/test-summary-$(date +%Y%m%d_%H%M%S).txt"
    local json_file="${TEST_LOG_DIR}/test-results-$(date +%Y%m%d).json"

    if [ ! -f "$json_file" ]; then
        log_error "No test results found for today"
        return 1
    fi

    # Parse JSON and generate summary
    local total_tests passed_tests failed_tests skipped_tests total_duration

    total_tests=$(jq '. | length' "$json_file" 2>/dev/null || echo "0")
    passed_tests=$(jq '[.[] | select(.status == "passed")] | length' "$json_file" 2>/dev/null || echo "0")
    failed_tests=$(jq '[.[] | select(.status == "failed")] | length' "$json_file" 2>/dev/null || echo "0")
    skipped_tests=$(jq '[.[] | select(.status == "skipped")] | length' "$json_file" 2>/dev/null || echo "0")
    total_duration=$(jq '[.[] | .duration] | add' "$json_file" 2>/dev/null || echo "0")

    # Generate text report
    {
        echo "=== Test Execution Summary ==="
        echo "Date: $(date)"
        echo "Total Tests: $total_tests"
        echo "Passed: $passed_tests"
        echo "Failed: $failed_tests"
        echo "Skipped: $skipped_tests"
        echo "Total Duration: ${total_duration}s"
        echo ""

        if [ "$failed_tests" -gt 0 ]; then
            echo "=== Failed Tests ==="
            jq -r '.[] | select(.status == "failed") | "• \(.test_id): \(.test_name)\n  Error: \(.error)"' "$json_file" 2>/dev/null || echo "Unable to parse failed tests"
            echo ""
        fi

        echo "=== Performance Summary ==="
        if [ "$total_tests" -gt 0 ]; then
            local avg_duration
            avg_duration=$(echo "scale=2; $total_duration / $total_tests" | bc 2>/dev/null || echo "0")
            echo "Average Test Duration: ${avg_duration}s"

            local slowest_test
            slowest_test=$(jq -r 'max_by(.duration) | "\(.test_id): \(.test_name) (\(.duration)s)"' "$json_file" 2>/dev/null || echo "N/A")
            echo "Slowest Test: $slowest_test"
        fi

        echo ""
        echo "=== Detailed Results ==="
        jq -r '.[] | "\(.timestamp) [\(.status | ascii_upcase)] \(.test_id): \(.test_name) (\(.duration)s)"' "$json_file" 2>/dev/null || echo "Unable to parse detailed results"

    } > "$report_file"

    log_info "Test report generated: $report_file"
    echo "$report_file"
}

# Export test results in different formats
export_test_results() {
    local format="${1:-json}"  # json, csv, xml
    local output_file="${TEST_LOG_DIR}/export-$(date +%Y%m%d_%H%M%S).${format}"
    local json_file="${TEST_LOG_DIR}/test-results-$(date +%Y%m%d).json"

    if [ ! -f "$json_file" ]; then
        log_error "No test results found for today"
        return 1
    fi

    case "$format" in
        "json")
            cp "$json_file" "$output_file"
            ;;
        "csv")
            {
                echo "timestamp,test_id,test_name,status,duration,output,error"
                jq -r '.[] | [.timestamp, .test_id, .test_name, .status, .duration, (.output | @csv), (.error | @csv)] | @csv' "$json_file" 2>/dev/null
            } > "$output_file"
            ;;
        "xml")
            {
                echo '<?xml version="1.0" encoding="UTF-8"?>'
                echo '<test-results>'
                jq -r '.[] | "<test-case id=\"\(.test_id)\" name=\"\(.test_name)\" status=\"\(.status)\" duration=\"\(.duration)\"><output><![CDATA[\(.output)]]></output><error><![CDATA[\(.error)]]></error></test-case>"' "$json_file" 2>/dev/null
                echo '</test-results>'
            } > "$output_file"
            ;;
        *)
            log_error "Unsupported export format: $format"
            return 1
            ;;
    esac

    log_info "Test results exported to: $output_file"
    echo "$output_file"
}

# Get test statistics
get_test_stats() {
    local json_file="${TEST_LOG_DIR}/test-results-$(date +%Y%m%d).json"
    local days="${1:-1}"  # Number of days to analyze

    if [ ! -f "$json_file" ]; then
        echo '{"total_tests": 0, "passed": 0, "failed": 0, "skipped": 0, "success_rate": 0, "avg_duration": 0}'
        return
    fi

    local stats
    stats=$(jq -r "{
        total_tests: (. | length),
        passed: ([.[] | select(.status == \"passed\")] | length),
        failed: ([.[] | select(.status == \"failed\")] | length),
        skipped: ([.[] | select(.status == \"skipped\")] | length),
        success_rate: (if (. | length) > 0 then (([.[] | select(.status == \"passed\")] | length) / (. | length) * 100 | floor) else 0 end),
        avg_duration: (if (. | length) > 0 then (([.[] | .duration] | add) / (. | length) | . * 100 | floor | . / 100) else 0 end)
    }" "$json_file" 2>/dev/null || echo '{"error": "Failed to parse test results"}')

    echo "$stats"
}

# Archive old test results
archive_test_results() {
    local archive_dir="${TEST_LOG_DIR}/archive"
    local archive_file="${archive_dir}/test-results-$(date +%Y%m).tar.gz"

    mkdir -p "$archive_dir"

    # Find all log files for current month
    local files_to_archive
    files_to_archive=$(find "${TEST_LOG_DIR}" -name "test-results-$(date +%Y%m)*" -type f)

    if [ -n "$files_to_archive" ]; then
        tar -czf "$archive_file" $files_to_archive 2>/dev/null
        rm -f $files_to_archive 2>/dev/null
        log_info "Archived test results to: $archive_file"
    fi
}

# Setup test result directories and cleanup
setup_test_environment() {
    init_test_logging

    # Create temporary directories for test isolation
    export TEST_TMP_DIR="${TEST_TMP_DIR:-${TEST_LOG_DIR}/tmp}"
    mkdir -p "$TEST_TMP_DIR"

    # Set up cleanup trap
    trap 'cleanup_test_environment' EXIT
}

# Clean up test environment
cleanup_test_environment() {
    # Clean up temporary files
    if [ -d "$TEST_TMP_DIR" ]; then
        rm -rf "$TEST_TMP_DIR" 2>/dev/null || true
    fi

    # Clean up test containers
    source "$(dirname "${BASH_SOURCE[0]}")/docker-helpers.bash"
    docker_cleanup_test_containers
}