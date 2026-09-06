# Troubleshooting Guide

This guide helps diagnose and resolve common issues with the minecraft-servers system.

## Quick Diagnosis

Run the validation script to check your setup:

```bash
./scripts/validate-config.sh --all --verbose
```

## Common Issues and Solutions

### Docker Issues

#### "Docker daemon is not running"

**Symptoms:**

- Commands fail with "Cannot connect to the Docker daemon"
- `docker info` returns an error

**Solutions:**

1. Start Docker service:

   ```bash
   # Linux
   sudo systemctl start docker
   
   # macOS
   # Start Docker Desktop application
   ```

2. Add user to docker group (Linux):
   ```bash
   sudo usermod -aG docker $USER
   # Log out and back in for changes to take effect
   ```

#### "Permission denied" with Docker commands

**Symptoms:**

- Docker commands fail with permission errors

**Solutions:**

1. Use `sudo` with Docker commands (not recommended for production)
2. Add user to docker group (Linux):
   ```bash
   sudo usermod -aG docker $USER
   newgrp docker
   ```

### Server Startup Issues

#### Server fails to start with "Port already in use"

**Symptoms:**

- Server container exits immediately
- Logs show "Port already in use" or similar

**Solutions:**

1. Check what's using the server's RCON port (the only per-server port — game
   traffic never touches a per-server port; 25565 belongs to mc-router):

   ```bash
   # Linux/macOS
   RCON_PORT=$(grep ^RCON_PORT config/modpacks/server-name.env | cut -d= -f2)
   lsof -i :"$RCON_PORT"
   netstat -tulpn | grep :"$RCON_PORT"
   ```

2. Game traffic has no per-server port: mc-router routes players by hostname
   (`<server>.<MC_ROUTER_DOMAIN>`). Only the RCON port is per-server — change
   it in the config if it collides:

   ```bash
   # Edit config/modpacks/server-name.env
   RCON_PORT=26600 # Use unused port in 26565-26664
   ```

3. Use auto-port assignment when adding server:
   ```bash
   ./scripts/add-modpack.sh new-server --modpack=vanilla
   ```

#### Server shows "starting" health status for too long

**Symptoms:**

- Server health status stays "starting" for more than 10 minutes
- Can't connect to server

**Solutions:**

1. Check server logs:

   ```bash
   docker logs mc-servername
   ```

2. Common causes:
   - **Memory allocation too low**: Increase MEMORY in config
   - **Modpack download failing**: Check CF_PAGE_URL for AUTO_CURSEFORGE servers
   - **Disk space**: Ensure adequate free space (>10GB recommended)
   - **Java version incompatibility**: Some modpacks require specific Java versions

3. For CurseForge modpacks, verify URL:
   ```bash
   curl -I "https://www.curseforge.com/minecraft/modpacks/modpack-name"
   ```

#### Out of Memory errors

**Symptoms:**

- Server crashes with Java heap errors
- Logs show "java.lang.OutOfMemoryError"

**Solutions:**

1. Increase memory allocation:

   ```bash
   # Edit config/modpacks/server-name.env
   MEMORY=8G # Increase from current value
   ```

2. Restart server:

   ```bash
   ./scripts/restart-server.sh server-name
   ```

3. Check system memory:

   ```bash
   # Linux
   free -h
   
   # macOS
   vm_stat
   ```

### Configuration Issues

#### "Invalid server name format"

**Symptoms:**

- add-modpack.sh fails with name validation error

**Solutions:**

- Server names must be lowercase alphanumeric with hyphens only:

  ```bash
  # Valid names
  ./scripts/add-modpack.sh my-server
  ./scripts/add-modpack.sh server-01
  ./scripts/add-modpack.sh testserver
  
  # Invalid names
  ./scripts/add-modpack.sh MyServer  # uppercase not allowed
  ./scripts/add-modpack.sh server_01 # underscores not allowed
  ./scripts/add-modpack.sh server@1  # special chars not allowed
  ```

#### "Template not found"

**Symptoms:**

- add-modpack.sh fails when using `--modpack` option

**Solutions:**

- Use valid template names:
  ```bash
  # Available templates
  ./scripts/add-modpack.sh server --modpack=atm8
  ./scripts/add-modpack.sh server --modpack=skyfactory4
  ./scripts/add-modpack.sh server --modpack=prominence2
  ./scripts/add-modpack.sh server --modpack=rlcraft
  ./scripts/add-modpack.sh server --modpack=vanilla
  ```

#### Port conflicts between servers

**Symptoms:**

- Multiple servers can't start simultaneously
- "Port already in use" errors

**Solutions:**

1. Check current port assignments:

   ```bash
   ./scripts/list-servers.sh
   ```

2. Reconfigure conflicting ports:

   ```bash
   # Edit config/modpacks/server-name.env
   RCON_PORT=26600 # Choose unused port (26565-26664)
   ```

3. Use auto-assignment for new servers:
   ```bash
   ./scripts/add-modpack.sh new-server --modpack=vanilla
   ```

### Backup/Restore Issues

#### Backup fails with "server not running"

**Symptoms:**

- backup.sh exits with error code 3

**Solutions:**

1. Start the server first:

   ```bash
   ./scripts/start-server.sh server-name
   ```

2. Wait for server to fully start (check health):

   ```bash
   ./scripts/health-check.sh server-name
   ```

3. Run backup:
   ```bash
   ./scripts/backup.sh server-name
   ```

#### Restore fails with "checksum mismatch"

**Symptoms:**

- restore.sh fails with checksum validation error

**Solutions:**

1. Check backup file integrity:

   ```bash
   ls -la backups/server-name/
   ```

2. Verify checksum manually:

   ```bash
   # Check if checksum file exists
   cat backups/server-name/backup-2024-01-01.tar.gz.sha256
   
   # Verify against actual file
   sha256sum backups/server-name/backup-2024-01-01.tar.gz
   ```

3. If checksum is wrong, the backup may be corrupted
4. Try a different backup or create a new one

#### Restore fails with permission errors

**Symptoms:**

- restore.sh fails when extracting files

**Solutions:**

1. Check directory permissions:

   ```bash
   ls -la servers/server-name/
   ```

2. Fix ownership (if running as root):
   ```bash
   chown -R 1000:1000 servers/server-name/
   ```

### Health Monitoring Issues

#### Health checks show "unhealthy" for running servers

**Symptoms:**

- Server appears running but health check fails

**Solutions:**

1. Check Docker health status:

   ```bash
   docker ps --format "table {{.Names}}\t{{.Status}}"
   docker inspect mc-servername | jq '.[].State.Health'
   ```

2. Check server logs for errors:

   ```bash
   docker logs mc-servername | tail -50
   ```

3. Common causes:
   - **Server not fully started**: Wait longer (large modpacks take 5-10 minutes)
   - **Route not answering**: mc-router is down or the route is stale — `./scripts/router.sh status`
   - **Resource constraints**: Check memory, CPU, disk space

#### Auto-restart not working

**Symptoms:**

- Unhealthy servers don't restart automatically

**Solutions:**

1. Check auto-restart daemon is running:

   ```bash
   ps aux | grep auto-restart
   ```

2. Start daemon if not running:

   ```bash
   ./scripts/auto-restart.sh --daemon --verbose &
   ```

3. Check daemon logs for errors
4. Verify restart-server.sh is executable and working

### Modpack-Specific Issues

#### CurseForge modpack download fails

**Symptoms:**

- Server starts but modpack doesn't download
- Logs show download errors

**Solutions:**

1. Verify CurseForge URL is correct:

   ```bash
   # Check URL format
   grep CF_PAGE_URL config/modpacks/server-name.env
   ```

2. Test URL accessibility:

   ```bash
   curl -I "https://www.curseforge.com/minecraft/modpacks/modpack-name"
   ```

3. Some modpacks require specific Minecraft/Java versions
4. Check server logs for specific error messages

#### Mod conflicts or crashes

**Symptoms:**

- Server starts but crashes during gameplay
- Mod-related errors in logs

**Solutions:**

1. Check server logs for mod errors:

   ```bash
   docker logs mc-servername | grep -i error
   ```

2. Common solutions:
   - **Memory increase**: Large modpacks need more RAM
   - **Java arguments**: Some modpacks need specific JVM flags
   - **Mod compatibility**: Check modpack documentation for known issues

### Performance Issues

#### Server lag/stuttering

**Symptoms:**

- Gameplay is laggy or unresponsive

**Solutions:**

1. Check system resources:

   ```bash
   # CPU usage
   top
   
   # Memory usage
   free -h
   
   # Disk I/O
   iostat -x 1
   ```

2. Adjust server settings:
   - Increase MEMORY allocation
   - Reduce view-distance in server.properties
   - Enable/disable specific mods

3. Check for resource conflicts with other servers

#### High CPU usage

**Symptoms:**

- Server process uses excessive CPU

**Solutions:**

1. Check for infinite loops in mods/plugins
2. Reduce tick rate or entity counts
3. Update to latest modpack version
4. Check for malware (rare but possible)

### Network Issues

#### Can't connect from external clients

**Symptoms:**

- Server runs locally but external players can't connect

**Solutions:**

1. Check port forwarding on router/firewall
2. Verify the router entry point is accessible (the only public game port;
   players are then routed by hostname, so the client address must be
   `<server>.<MC_ROUTER_DOMAIN>` — a bare IP:port reaches mc-router, which
   needs the hostname to pick a server):

   ```bash
   # From external machine
   telnet your-server-ip 25565
   ```

3. Check firewall rules:

   ```bash
   # Linux
   sudo ufw status
   sudo iptables -L
   
   # macOS
   sudo pfctl -s rules
   ```

4. Ensure each server's only published port is its loopback RCON mapping:
   ```bash
   docker port mc-servername # 265XX/tcp -> 127.0.0.1:265XX, nothing else
   ```

### File System Issues

#### Permission errors

**Symptoms:**

- Scripts fail with "Permission denied"

**Solutions:**

1. Make scripts executable:

   ```bash
   chmod +x scripts/*.sh
   ```

2. Fix directory permissions:
   ```bash
   # For Docker volume mounts
   chown -R 1000:1000 servers/
   chown -R 1000:1000 backups/
   ```

#### Disk space issues

**Symptoms:**

- Backups fail with "No space left on device"

**Solutions:**

1. Check disk usage:

   ```bash
   df -h
   du -sh servers/ backups/
   ```

2. Clean old backups:

   ```bash
   # List backups by size
   find backups/ -name "*.tar.gz" -exec ls -lh {} \; | sort -k5 -hr
   
   # Remove old backups (keep last 3)
   ls -t backups/server-name/*.tar.gz | tail -n +4 | xargs rm
   ```

3. Move backups to external storage
4. Increase disk space

## Diagnostic Commands

### System Information

```bash
# System info
uname -a
docker --version
docker compose version

# Resource usage
free -h
df -h
top -n 1
```

### Docker Diagnostics

```bash
# Container status
docker ps -a
docker stats

# Container logs
docker logs mc-servername --tail 100

# Container inspection
docker inspect mc-servername | jq '.[] | {Name: .Name, State: .State, Config: .Config.Env}'
```

### Server-Specific Diagnostics

```bash
# Check server configuration
cat config/modpacks/server-name.env

# Test the router entry point, then confirm the route exists
telnet localhost 25565
./scripts/router.sh status

# Check server files
ls -la servers/server-name/

# Check backups
ls -la backups/server-name/
```

## Getting Help

If you can't resolve an issue:

1. Run the validation script:

   ```bash
   ./scripts/validate-config.sh --all --verbose
   ```

2. Collect diagnostic information:

   ```bash
   # Create diagnostic bundle
   ./scripts/health-check.sh --all --json > health-status.json
   ./scripts/list-servers.sh > server-list.txt
   docker ps > docker-status.txt
   ```

3. Check the logs:
   - Server logs: `docker logs mc-servername`
   - System logs: `/var/log/syslog` or `/var/log/messages`

4. Review documentation:
   - README.md for setup instructions
   - MONITORING.md for health monitoring
   - Individual modpack documentation in `docs/`

## Prevention

### Regular Maintenance

- Run weekly backups: `./scripts/backup.sh --all`
- Monitor disk space: `df -h`
- Check server health: `./scripts/health-check.sh --all`
- Update modpacks regularly

### Monitoring Setup

```bash
# Start health monitoring daemon
nohup ./scripts/auto-restart.sh --daemon --interval=300 > monitoring.log 2>&1 &

# Set up log rotation
# Add to /etc/logrotate.d/minecraft
/var/log/minecraft/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
```

### Backup Strategy

- Daily automated backups for active servers
- Weekly full backups
- Test restore procedures monthly
- Keep 3 rolling backups minimum
- Store backups on separate disk/volume
