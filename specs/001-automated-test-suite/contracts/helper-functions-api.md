# Helper Functions Contract

**Version**: 1.0.0
**Date**: 2025-11-09
**Purpose**: Define reusable utility functions for test implementation

## Overview

Helper functions provide common operations used across multiple tests, ensuring consistency and reducing code duplication.

## Core Functions

### Docker Operations

#### docker_container_running(container_name)

Check if a Docker container is currently running.

**Parameters**:

- `container_name`: String - Name of container to check

**Returns**:

- `Boolean` - true if running, false otherwise

**Behavior**:

- Uses `docker ps` to check container status
- Handles error cases gracefully
- Provides clear error messages for debugging

#### wait_for_container_health(container_name, timeout_seconds)

Wait for a container to be healthy or reach timeout.

**Parameters**:

- `container_name`: String - Container to monitor
- `timeout_seconds`: Integer - Maximum wait time (default: 30)

**Returns**:

- `exit_code`: Integer - 0 if healthy, 1 if timeout, 2 if error

**Behavior**:

- Monitors container health status
- Implements exponential backoff
- Logs progress for debugging

#### cleanup_container(container_name)

Safely remove a test container and associated resources.

**Parameters**:

- `container_name`: String - Container to clean up

**Returns**:

- `exit_code`: Integer - 0 for success, non-zero for errors

**Behavior**:

- Stops container if running
- Removes container and volumes
- Handles cleanup failures gracefully

### File System Operations

#### assert_file_exists(file_path)

Assert that a file exists and is readable.

**Parameters**:

- `file_path`: String - Path to file to check

**Returns**:

- `exit_code`: Integer - 0 if file exists, 1 if missing

**Behavior**:

- Validates file accessibility
- Provides descriptive error messages
- Supports absolute and relative paths

#### assert_file_contains(file_path, expected_content)

Check that a file contains specific content.

**Parameters**:

- `file_path`: String - File to check
- `expected_content`: String - Content to search for

**Returns**:

- `exit_code`: Integer - 0 if found, 1 if not found

**Behavior**:

- Uses grep for efficient searching
- Supports regex patterns
- Case-sensitive matching

### Process Management

#### run_with_timeout(command, timeout_seconds)

Execute a command with timeout protection.

**Parameters**:

- `command`: String - Command to execute
- `timeout_seconds`: Integer - Timeout in seconds

**Returns**:

- `exit_code`: Integer - Command exit code or 124 (timeout)
- `stdout`: String - Command output
- `stderr`: String - Command errors

**Behavior**:

- Uses `timeout` command for protection
- Captures all output streams
- Handles signal termination gracefully

#### assert_command_success(command)

Execute command and assert it succeeds.

**Parameters**:

- `command`: String - Command to test

**Returns**:

- `exit_code`: Integer - 0 if command succeeded

**Behavior**:

- Executes command in subshell
- Validates exit code
- Provides command output in failure case

## Error Handling Standards

All helper functions follow consistent error handling:

- Return appropriate exit codes (0 = success)
- Log errors to stderr with context
- Clean up resources on failure
- Provide actionable error messages

## Testing Requirements

Helper functions are tested independently:

- Unit tests for each function
- Mock external dependencies where possible
- Integration tests with real Docker environment
- Performance validation for timeout-sensitive operations
