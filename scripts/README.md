# Scripts Documentation

This directory contains management scripts for the Minecraft multi-server environment. All scripts share common functionality through `common.sh`.

## Common Library (`common.sh`)

The `common.sh` file provides a reusable foundation for all scripts, including:

### Output Functions

- `error(message)` - Print error message to stderr with red color
- `success(message)` - Print success message with green checkmark
- `info(message)` - Print informational message
- `warning(message)` - Print warning message with yellow color
- `debug(message)` - Print debug message (only if `DEBUG=true`)

### Validation Functions

- `validate_server_name(name)` - Check if server name follows naming rules (lowercase, alphanumeric, hyphens)
- `check_config_exists(name)` - Verify server configuration file exists
- `check_docker_running()` - Ensure Docker daemon is accessible
- `container_exists(name)` - Check if Docker container exists (any state)
- `container_running(name)` - Check if Docker container is currently running

### Confirmation Functions

- `confirm(prompt)` - Ask user for yes/no confirmation

### Server Information Functions

- `list_available_servers()` - List all configured servers (from config files)
- `list_running_servers()` - List currently running servers
- `get_container_name(server)` - Get Docker container name for server
- `get_config_file(server)` - Get path to server configuration file
- `get_data_dir(server)` - Get path to server data directory
- `get_backup_dir(server)` - Get path to server backup directory
- `get_server_port(server)` - Extract port number from server config
- `get_container_uptime(container)` - Get human-readable uptime for container

### Docker Compose Helpers

- `docker_compose_up(server)` - Start server using docker compose
- `docker_compose_down(server)` - Stop server using docker compose
- `docker_compose_restart(server)` - Restart server using docker compose

### File Operations

- `ensure_directory(path)` - Create directory if it doesn't exist
- `remove_directory(path)` - Safely remove directory
- `remove_file(path)` - Safely remove file

### Prune Operations

- `prune_server_data(server)` - Remove server data directory only (preserves config and backups)

### Network Helpers

- `ensure_network(name)` - Create Docker network if it doesn't exist

## Usage in Scripts

To use the common library in a script:

```bash
#!/usr/bin/env bash

# Load common functions
source "$(dirname "$0")/common.sh"

# Use common functions
if ! validate_server_name "$SERVER_NAME"; then
  exit 2
fi

if ! check_docker_running; then
  exit 1
fi

info "Starting operation..."
success "Operation completed"
```

## Color Codes

The following color codes are exported and available after sourcing `common.sh`:

- `$RED` - Error messages
- `$GREEN` - Success messages
- `$YELLOW` - Warnings
- `$BLUE` - Headers/titles
- `$CYAN` - Highlights
- `$NC` - No Color (reset)

## Debugging

Enable debug output by setting the `DEBUG` environment variable:

```bash
DEBUG=true ./scripts/start-server.sh vanilla
```

## Error Handling

- Scripts use `set -uo pipefail` for safer error handling
- Functions return 0 on success, 1 on failure
- Error messages are sent to stderr
- Exit codes follow standard conventions (documented in each script)

## Scripts Using the Common Library

All management scripts source `common.sh`:

- `start-server.sh` - Server startup with shared validation and output
- `stop-server.sh` - Server shutdown with granular cleanup options
- `restart-server.sh` - Server restart with shared Docker Compose logic
- `list-servers.sh` - Server status display with shared helpers
- `start-all.sh` - Bulk server startup
- `stop-all.sh` - Bulk server shutdown
- `health-check.sh` - Health report (text or JSON output)
- `auto-restart.sh` - Auto-restart daemon
- `backup.sh` - Atomic backup with checksum
- `restore.sh` - Verified restore operations
- `add-modpack.sh` - Server configuration generator
- `validate-config.sh` - Configuration validation suite

Standalone utilities (`diagnose-failed-servers.sh`, `analyze-java-versions.sh`) do not
source the library.

## Benefits

Using `common.sh` provides:

1. **Consistency** - Unified output formatting and colors across all scripts
2. **Maintainability** - Single source of truth for common logic
3. **Reliability** - Shared validation and error handling
4. **Reusability** - Functions can be composed in new scripts
5. **Testability** - Individual functions can be tested in isolation
6. **Clarity** - Scripts are shorter and focus on their specific purpose

## Examples

### Validate and start a server

```bash
source "$(dirname "$0")/common.sh"

SERVER_NAME="$1"

if ! validate_server_name "$SERVER_NAME"; then
  exit 2
fi

if ! check_config_exists "$SERVER_NAME"; then
  exit 3
fi

ensure_directory "servers/${SERVER_NAME}/data"
ensure_network

if docker_compose_up "$SERVER_NAME"; then
  success "Server started"
else
  error "Failed to start server"
  exit 1
fi
```

### Check server status

```bash
source "$(dirname "$0")/common.sh"

for server in $(list_available_servers); do
  container=$(get_container_name "$server")
  if container_running "$container"; then
    port=$(get_server_port "$server")
    uptime=$(get_container_uptime "$container")
    success "$server is running on port $port (uptime: $uptime)"
  else
    warning "$server is not running"
  fi
done
```

### Safe cleanup with confirmation

```bash
source "$(dirname "$0")/common.sh"

data_dir=$(get_data_dir "$SERVER_NAME")

if confirm "Delete server data at $data_dir?"; then
  if remove_directory "$data_dir"; then
    success "Data removed"
  fi
else
  info "Cancelled"
fi
```

## Package.json Scripts

The project includes npm/pnpm scripts for development, testing, and deployment. These scripts provide convenient shortcuts for common operations.

### Testing Scripts

- `pnpm test` - Run all BATS tests
- `pnpm run test:verbose` - Run all tests with verbose output
- `pnpm run test:quick` - Run lightweight tests 1-6 (used in pre-push hook)

### Code Quality Scripts

- `lint` - Check code formatting with Prettier
- `lint:fix` - Format code with Prettier
- `pnpm run validate:all` - Run lint check and all tests

### Docker Scripts

- `pnpm run docker:build` - Build Docker images
- `pnpm run docker:up` - Start all services in detached mode
- `pnpm run docker:down` - Stop all services
- `pnpm run docker:logs` - Follow logs from all services
- `pnpm run docker:clean` - Stop services and remove volumes/orphaned containers

### Server Management Scripts

- `pnpm run server:start` - Start a specific server (requires SERVER_NAME argument)
- `pnpm run server:stop` - Stop a specific server
- `pnpm run server:restart` - Restart a specific server
- `pnpm run server:list` - List all servers and their status
- `pnpm run server:health` - Check health of all servers

### Backup Scripts

- `pnpm run backup` - Create backup of a specific server
- `pnpm run backup:all` - Create backups of all servers
- `pnpm run restore` - Restore server from backup

### Development Scripts

- `pnpm run dev:setup` - Install dependencies and setup husky hooks
- `pnpm run dev:clean` - Clean node_modules and reinstall
- `pnpm run ci` - Run full validation (equivalent to validate:all)

### Git Hooks

The project uses Husky for git hooks:

- **pre-commit**: Runs `pnpm run lint:fix` to auto-format code
- **pre-push**: Runs `pnpm run test:quick` for lightweight testing

### Usage Examples

```bash
# Development setup
pnpm run dev:setup

# Quick validation before committing
pnpm run lint

# Start development environment
pnpm run docker:up

# Check server status
pnpm run server:list

# Create backups
pnpm run backup:all

# Full CI validation
pnpm run ci
```

### Script Categories

Scripts are organized by purpose:

1. **Testing** (`test:*`) - Quality assurance and validation
2. **Code Quality** (`lint:*`) - Code formatting and linting
3. **Docker** (`docker:*`) - Container management
4. **Server** (`server:*`) - Individual server operations
5. **Backup** (`backup*`) - Data protection
6. **Development** (`dev:*`, `ci`) - Development workflow

## CI/CD Pipeline Integration

The package.json scripts are designed to work seamlessly with CI/CD pipelines:

### GitHub Actions Usage

```yaml
# Quick validation (recommended for PRs and pushes)
- name: Run validation
  run: pnpm run lint

# Individual pipeline steps
- name: Check formatting
  run: pnpm run lint

- name: Run tests
  run: pnpm run test
```

### Environment Variables in CI

The BATS test suite defines its environment variables directly in the workflow's `env` block (`.github/workflows/bats-tests.yml`):

- `EULA=TRUE` - Minecraft EULA acceptance
- `CF_API_KEY` - From GitHub secrets for CurseForge API access
- `RCON_PASSWORD`, `ENABLE_RCON`, etc. - All server configuration variables

**Required GitHub Secret:**

- `CF_API_KEY` - Your CurseForge API key (configure in repository settings)

### Local Development vs CI

- **Local Development**: Use `pnpm run lint` for fast feedback
- **CI Pipeline**: Use `pnpm run lint` for automated checks
- **Full Validation**: Use `pnpm run validate:all` when Docker is available
- **Pre-commit**: Uses `pnpm run lint:fix` for automatic formatting
- **Pre-push**: Uses `pnpm run test:quick` for lightweight testing

### Validation Scripts

- `lint` - Code quality validation (formatting check)
  - ✅ Fast feedback for development
  - ✅ No Docker required
  - ✅ Used in CI pipelines
  - ✅ Suitable for pre-commit hooks

- `validate:all` - Full validation (lint + all tests)
  - ✅ Comprehensive testing with Docker
  - ✅ Tests complete server startup
  - ❌ Slower execution
  - ❌ Requires Docker environment
  - ✅ Available via `bats-tests.yml` pipeline

### Pipeline Benefits

Using these scripts in CI/CD provides:

- **Consistency** - Same validation locally and in CI
- **Maintainability** - Single source of truth for quality checks
- **Performance** - Optimized scripts for different contexts
- **Reliability** - Comprehensive error handling and reporting
- **Integration** - Easy integration with various CI platforms
