# Test Runner Contract

**Version**: 1.0.0
**Date**: 2025-11-09
**Purpose**: Define the interface for executing the automated test suite

## Overview

The test runner provides a standardized interface for executing the complete test suite or individual test categories against the Minecraft server deployment system.

## Interface Definition

### run_test_suite([options])

Execute the complete test suite with optional filtering and configuration.

**Parameters**:

- `modpack` (optional): String - Specific modpack to test (default: all available)
- `category` (optional): String - Test category to run ("startup", "docker", "config", "error")
- `verbose` (optional): Boolean - Enable detailed output (default: false)
- `timeout` (optional): Integer - Suite timeout in seconds (default: 300)

**Returns**:

- `exit_code`: Integer - 0 for success, non-zero for failure
- `results`: TestResults object containing execution summary

**Behavior**:

- Validates environment prerequisites (Docker, BATS)
- Executes tests in dependency order
- Provides real-time progress reporting
- Generates comprehensive test report
- Cleans up test artifacts

### run_single_test(test_name, [options])

Execute a specific test case with full isolation.

**Parameters**:

- `test_name`: String - Name of test to execute (required)
- `options`: Object - Same as run_test_suite options

**Returns**:

- `exit_code`: Integer - Test result status
- `result`: TestResult object with detailed execution information

**Behavior**:

- Sets up isolated test environment
- Executes single test with full validation
- Provides detailed execution logs
- Ensures complete cleanup regardless of outcome

## Error Handling

- **Environment Errors**: Clear messages for missing prerequisites
- **Test Failures**: Detailed failure analysis with suggestions
- **Timeout Errors**: Graceful termination with partial results
- **Resource Errors**: Safe cleanup and resource release

## Output Format

Test results provided in structured format:

```json
{
  "suite": "start_server_integration",
  "timestamp": "2025-11-09T10:00:00Z",
  "duration": 45,
  "tests_run": 12,
  "tests_passed": 10,
  "tests_failed": 2,
  "results": [
    {
      "test": "start_server_valid_modpack",
      "status": "pass",
      "duration": 5,
      "message": "Server started successfully"
    }
  ]
}
```

## Compatibility

- BATS 1.0+ required
- Docker 20.10+ required
- Linux/macOS environments supported
- CI/CD integration via standard exit codes
