# Server Health Monitoring

This document describes the health monitoring and auto-restart capabilities of the minecraft-servers system.

## Overview

The system provides comprehensive health monitoring for Minecraft servers with automatic restart capabilities. Health checks monitor:

- Container status (running/stopped)
- mc-router entry point (the one port players use)
- Server logs (error detection)
- Disk space (low space warnings)
- Docker health checks (built into containers)

## Health Check Script

The `scripts/health-check.sh` script provides detailed health status for servers.

### Usage

```bash
# Check specific server
./scripts/health-check.sh rlcraft

# Check all servers
./scripts/health-check.sh --all

# Verbose output with details
./scripts/health-check.sh --all --verbose

# JSON output for automation
./scripts/health-check.sh --all --json
```

### Health Status Values

- **healthy**: Server is running and all checks pass
- **warning**: Server is running but has issues (log errors, low disk space)
- **unhealthy**: Server has critical issues (not running)

### Health Check Components

1. **Router Entry Point**: Tests that the shared mc-router port answers (warns — if it is down no route works, but servers themselves may be fine)
2. **Container Status**: Checks if Docker container is running
3. **Log Analysis**: Scans recent logs for errors/crashes
4. **Disk Space**: Monitors available space (>90% usage = warning)

Game traffic has no per-server port: reachability per server is the mc-router
route (`<server>.<MC_ROUTER_DOMAIN>`), so the old per-server port probe is gone.

## Auto-Restart System

The `scripts/auto-restart.sh` script automatically restarts unhealthy servers.

### Usage

```bash
# One-time check and restart
./scripts/auto-restart.sh

# Run in daemon mode (continuous monitoring)
./scripts/auto-restart.sh --daemon

# Custom check interval (default: 5 minutes)
./scripts/auto-restart.sh --daemon --interval=600

# Dry run to see what would be restarted
./scripts/auto-restart.sh --dry-run --verbose

# Force restart all servers
./scripts/auto-restart.sh --force
```

### Auto-Restart Triggers

Servers are automatically restarted when:

- Container is stopped
- Health status is "unhealthy"
- Health check returns "unknown" (possible health check failure)
- Manual force restart requested

### Daemon Mode

In daemon mode, the script runs continuously and checks server health at regular intervals. This is useful for production deployments where you want 24/7 monitoring.

```bash
# Start monitoring daemon
./scripts/auto-restart.sh --daemon --interval=300 --verbose

# The script will continue running until manually stopped (Ctrl+C)
```

## Docker Health Checks

The `docker-compose.yml` includes built-in Docker health checks:

```yaml
healthcheck:
  test: mc-health
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 5m
```

This uses the `itzg/minecraft-server` image's built-in `mc-health` command, which checks if the Minecraft server process is responding.

## List Servers with Health

The `scripts/list-servers.sh` command includes health status in its output:

```bash
./scripts/list-servers.sh
```

Output includes:

- Server name
- Status (running/stopped)
- Connect address (the mc-router route hostname)
- Memory allocation
- Uptime
- Health status (healthy/unhealthy/starting/N/A)

## Integration with Docker Compose

Health checks are automatically configured for all servers started via `docker-compose.yml`. The health status is available through:

```bash
# Check health of specific container
docker inspect mc-rlcraft | jq '.[].State.Health.Status'

# View health check logs
docker logs mc-rlcraft 2>&1 | grep -i health
```

## Monitoring Best Practices

### Production Setup

1. **Enable Auto-Restart**: Run auto-restart in daemon mode for production servers
2. **Monitor Logs**: Regularly check server logs for issues
3. **Disk Space**: Monitor disk usage and clean up old backups
4. **Network**: Ensure stable network connectivity for server access

### Example Production Commands

```bash
# Start health monitoring (run in background)
nohup ./scripts/auto-restart.sh --daemon --interval=300 --verbose > monitoring.log 2>&1 &

# Check health status periodically
./scripts/health-check.sh --all --json | jq '.[] | select(.status != "healthy")'

# Monitor specific server
watch -n 60 './scripts/health-check.sh problematic-server --verbose'
```

### Alerting Integration

The JSON output format enables integration with monitoring systems:

```bash
#!/bin/bash
# Check for unhealthy servers and send alerts
UNHEALTHY=$(./scripts/health-check.sh --all --json | jq '.[] | select(.status == "unhealthy") | .server')

if [ -n "$UNHEALTHY" ]; then
  echo "Alert: Unhealthy servers: $UNHEALTHY"
  # Send email, Slack notification, etc.
fi
```

## Troubleshooting

### Common Issues

**Health check shows "unknown"**

- Docker health check may not be configured properly
- Server may be starting up (check start_period in docker-compose.yml)

**Auto-restart not working**

- Ensure auto-restart.sh has execute permissions
- Check if restart-server.sh exists and is executable
- Verify Docker daemon is running

**Route not answering**

- Server may be starting up (takes 5+ minutes for large modpacks)
- Check server logs for startup errors
- Check the router is up and the route is registered: `./scripts/router.sh status`
- Verify the client resolves `<server>.<MC_ROUTER_DOMAIN>` to this host

**Log errors detected**

- Check server logs: `docker logs mc-servername`
- Look for Java errors, mod conflicts, or configuration issues
- Check available memory and disk space

### Debug Commands

```bash
# Check Docker health status directly
docker ps --format "table {{.Names}}\t{{.Status}}"

# View container health details
docker inspect mc-rlcraft | jq '.[].State.Health'

# Check server logs for errors
docker logs --tail 100 mc-rlcraft | grep -i error

# Test the router entry point manually (the only public game port)
MC_ROUTER_PORT=$(grep '^MC_ROUTER_PORT=' .env | cut -d= -f2)
nc -zv localhost "${MC_ROUTER_PORT:-25565}"
```

## Configuration

### Health Check Intervals

Modify `docker-compose.yml` to adjust health check frequency:

```yaml
healthcheck:
  test: mc-health
  interval: 60s # Check every minute
  timeout: 10s # Wait up to 10 seconds for response
  retries: 3 # Fail after 3 unsuccessful checks
  start_period: 10m # Wait 10 minutes for initial startup
```

### Auto-Restart Customization

The auto-restart script can be customized by modifying the script or creating wrapper scripts for specific monitoring needs.

## Exit Codes

**health-check.sh**:

- 0: All servers healthy
- 1: Script execution error
- 2: Invalid arguments
- 3: Server not found
- 4: One or more servers unhealthy

**auto-restart.sh**:

- 0: Success (no restarts needed or all successful)
- 1: Script execution error
- 2: Invalid arguments
- 3: One or more restarts failed
