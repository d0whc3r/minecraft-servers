# Test Fixtures

This directory contains test fixtures and sample configurations used by the BATS test suite.

## Files

### Configuration Files (.env)

- `valid-server.env`: Complete, valid Minecraft server configuration for successful test scenarios
- `invalid-server.env`: Configuration with invalid/missing values for error handling tests

### Docker Compose

- `test-docker-compose.yml`: Sample Docker Compose configuration for testing containerized deployments

### Test Data

- `test-data.json`: JSON file containing test case definitions, expected outputs, and test data structures

## Usage

These fixtures are used by the test suite to:

1. **Validate configuration parsing**: Test how `start-server.sh` handles valid and invalid configurations
2. **Test Docker operations**: Verify container creation, startup, and cleanup
3. **Error handling**: Ensure proper error messages and exit codes for failure scenarios
4. **Integration testing**: Test complete server startup workflows

## Adding New Fixtures

When adding new test fixtures:

1. Use descriptive filenames that indicate their purpose
2. Include comments explaining the fixture's role in testing
3. Ensure fixtures are realistic representations of production configurations
4. Update this README with the new fixture's purpose and usage

## Maintenance

- Keep fixtures in sync with actual configuration formats
- Update fixtures when server configuration options change
- Remove obsolete fixtures that are no longer used by tests
