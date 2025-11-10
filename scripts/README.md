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

## Refactored Scripts

The following scripts have been refactored to use `common.sh`:

- `start-server.sh` - Server startup with shared validation and output
- `stop-server.sh` - Server shutdown with granular cleanup options
- `restart-server.sh` - Server restart with shared Docker Compose logic
- `list-servers.sh` - Server status display with shared helpers
- `start-all.sh` - Bulk server startup
- `stop-all.sh` - Bulk server shutdown

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
