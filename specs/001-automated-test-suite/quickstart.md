# Quick Start: Automated Test Suite

**Date**: 2025-11-09
**Feature**: 001-automated-test-suite
**Audience**: Developers, QA engineers, DevOps teams

## Overview

The automated test suite validates the Minecraft server deployment system using BATS framework. It tests start-server.sh execution, Docker container lifecycle, configuration generation, and error handling.

## Prerequisites

### System Requirements

- **OS**: Linux or macOS
- **Shell**: Bash 4.0+
- **Docker**: 20.10+ with Docker Compose
- **BATS**: 1.0+ (Bash Automated Testing System)

### Installation

```bash
# Install BATS (Ubuntu/Debian)
sudo apt-get install bats

# Install BATS (macOS with Homebrew)
brew install bats-core

# Install BATS (from source)
git clone https://github.com/bats-core/bats-core.git
cd bats-core
sudo ./install.sh /usr/local
```

### Environment Setup

```bash
# Clone repository
git clone <repository-url>
cd minecraft-servers

# Ensure Docker is running
docker --version
docker compose --version

# Verify BATS installation
bats --version
```

## Running Tests

### Complete Test Suite

```bash
# Run all tests
bats tests/bats/

# Run with verbose output
bats --verbose tests/bats/

# Run specific test file
bats tests/bats/start-server.bats
```

### Test Categories

```bash
# Test script execution
bats tests/bats/start-server.bats

# Test Docker integration
bats tests/bats/docker-integration.bats

# Test configuration validation
bats tests/bats/config-validation.bats

# Test error handling
bats tests/bats/error-handling.bats
```

### CI/CD Integration

```bash
# Run tests in CI environment
bats --formatter junit tests/bats/

# With timeout protection
timeout 300 bats tests/bats/
```

## Test Results

### Success Output

```
 ✓ start-server.sh executes successfully with valid modpack
 ✓ Docker container is created and running
 ✓ Configuration files are generated correctly
 ✓ Error handling works for invalid inputs

4 tests, 0 failures
```

### Failure Output

```
 ✗ start-server.sh fails with invalid modpack
   (in test file tests/bats/start-server.bats, line 15)
   `[ "$exit_code" -eq 1 ]' failed

4 tests, 1 failure
```

## Debugging Failed Tests

### Enable Debug Logging

```bash
# Run with maximum verbosity
BATS_VERBOSE_RUN=1 bats tests/bats/

# Show execution traces
bats --trace tests/bats/
```

### Inspect Test Environment

```bash
# Check Docker containers
docker ps -a

# View test logs
cat /tmp/bats-test-*.log

# Check system resources
df -h
docker system df
```

### Common Issues

#### Docker Not Available

```
Error: Cannot connect to the Docker daemon
Solution: Start Docker service or use Docker Desktop
```

#### BATS Not Found

```
Error: bats command not found
Solution: Install BATS or add to PATH
```

#### Permission Denied

```
Error: Permission denied accessing Docker
Solution: Add user to docker group or use sudo
```

## Development Workflow

### Adding New Tests

1. Create test file in `tests/bats/`
2. Follow BATS syntax and naming conventions
3. Use helper functions from `tests/helpers/`
4. Add test fixtures to `tests/fixtures/`

### Test Structure Example

```bash
#!/usr/bin/env bats

load '../helpers/common.bash'

@test "start server with valid modpack" {
    run start_server "vanilla"
    [ "$status" -eq 0 ]
    assert_container_running "minecraft-vanilla"
}
```

### Helper Functions

```bash
# Load helpers
load 'helpers/common.bash'
load 'helpers/docker-helpers.bash'

# Use in tests
assert_file_exists "config/modpacks/vanilla.env"
wait_for_container_health "minecraft-server" 30
```

## Configuration

### Environment Variables

```bash
# Test configuration
export TEST_MODPACK="vanilla"
export TEST_TIMEOUT="30"
export DOCKER_NETWORK="minecraft-test"

# Debug settings
export BATS_VERBOSE_RUN="1"
export TEST_CLEANUP="1"
```

### Custom Test Data

- Place sample configurations in `tests/fixtures/sample-configs/`
- Add mock Docker responses in `tests/fixtures/mock-docker/`
- Update environment files for different test scenarios

## Troubleshooting

### Test Hangs

- Check for runaway Docker containers
- Verify timeout settings
- Kill orphaned processes: `pkill -f bats`

### Inconsistent Results

- Ensure clean test environment between runs
- Check for resource conflicts
- Verify Docker images are up to date

### Performance Issues

- Run tests in parallel where possible
- Optimize Docker image pull caching
- Monitor system resources during execution

## Support

For issues or questions:

- Check test logs in `/tmp/bats-*`
- Review BATS documentation: https://bats-core.readthedocs.io/
- Examine existing test patterns in the codebase
