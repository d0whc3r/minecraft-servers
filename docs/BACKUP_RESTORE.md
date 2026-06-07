# Backup & Restore Guide

**Purpose**: Comprehensive guide for backing up and restoring Minecraft server worlds with automated retention and disaster recovery procedures.

## Overview

The backup system provides:

- **Atomic snapshots**: Server stopped during backup for consistency
- **Checksum verification**: SHA256 integrity validation
- **Rolling retention**: Automatic cleanup keeping 3 most recent backups
- **Cross-platform**: Works on Linux, macOS, and Windows (WSL)
- **Disaster recovery**: Complete world restoration capability

## Backup Strategy

### Design Principles

1. **Atomic Operations**: Server stopped during backup to ensure world consistency
2. **Integrity Verification**: SHA256 checksums prevent silent corruption
3. **Rolling Retention**: 3-backup window balances safety with disk usage
4. **Non-Intrusive**: Backups don't interfere with normal server operation
5. **Fast Recovery**: Restore completes within 15 minutes for <5GB worlds

### What Gets Backed Up

**Included** (critical server data):

- `world/` - Overworld terrain and structures
- `world_nether/` - Nether dimension
- `world_the_end/` - End dimension
- `server.properties` - Server configuration
- `ops.json` - Operator permissions
- `whitelist.json` - Player whitelist
- `banned-players.json` - Player bans
- `banned-ips.json` - IP bans
- `usercache.json` - Player UUID cache

**Excluded** (regenerated or non-critical):

- `logs/` - Server logs (can be large, regenerated)
- `crash-reports/` - Crash reports (diagnostic only)
- `cache/` - Temporary cache files
- `session.lock` - Session lock file

### Backup Format

```
{server-name}-{YYYYMMDD}-{HHMMSS}.tar.gz
Example: atm8-20251108-143022.tar.gz
```

**Archive Structure**:

```
atm8-20251108-143022.tar.gz
├── data/
│   ├── world/
│   ├── world_nether/
│   ├── world_the_end/
│   ├── server.properties
│   ├── ops.json
│   └── ...
└── atm8-20251108-143022.tar.gz.sha256 (checksum)
```

## Creating Backups

### Manual Backup

```bash
# Backup specific server
./scripts/backup.sh <server-name>

# Examples
./scripts/backup.sh atm8
./scripts/backup.sh vanilla
./scripts/backup.sh rlcraft
```

**What happens during backup**:

1. **Validation**: Checks server exists and is running
2. **Stop**: Temporarily stops server (5-10 seconds)
3. **Archive**: Creates compressed tar.gz of world data
4. **Checksum**: Calculates SHA256 hash for integrity
5. **Restart**: Starts server again
6. **Cleanup**: Removes old backups (keeps 3 most recent)

**Sample Output**:

```
[INFO] Starting backup for server: atm8
[INFO] Backup file: atm8-20251108-143022.tar.gz
[INFO] Stopping server temporarily for backup...
[INFO] Creating backup archive...
[INFO] Calculating checksum...
[INFO] Restarting server...
[SUCCESS] Backup completed successfully!
Server: atm8
Backup: ./backups/atm8/atm8-20251108-143022.tar.gz
Size: 780MB
Compression: 65%
Checksum: abc123def456...
Duration: 45s

Current backups for atm8:
  atm8-20251108-143022.tar.gz (780MB)
  atm8-20251107-230015.tar.gz (775MB)
  atm8-20251106-230010.tar.gz (770MB)
```

### Automated Backups

Set up cron jobs for regular backups:

```bash
# Edit crontab
crontab -e

# Add these lines for daily backups at 3 AM
0 3 * * * /path/to/minecraft-servers/scripts/backup.sh atm8
0 3 * * * /path/to/minecraft-servers/scripts/backup.sh vanilla

# For more frequent backups (every 6 hours)
0 */6 * * * /path/to/minecraft-servers/scripts/backup.sh rlcraft
```

**Backup Schedule Recommendations**:

| Server Type                | Frequency     | Rationale                               |
| -------------------------- | ------------- | --------------------------------------- |
| **Heavy modded** (ATM8)    | Daily         | Complex worlds, expensive to rebuild    |
| **Light modded** (Vanilla) | Weekly        | Simple worlds, easy to rebuild          |
| **Hardcore** (RLCraft)     | Every 6 hours | High death rate, frequent progress loss |
| **Creative**               | As needed     | Manual backups before major builds      |

## Restoring from Backups

### Manual Restore

```bash
# Restore specific backup
./scripts/restore.sh <server-name> <backup-file>

# Examples
./scripts/restore.sh atm8 atm8-20251108-143022.tar.gz
./scripts/restore.sh vanilla vanilla-20251107-120000.tar.gz
```

**What happens during restore**:

1. **Validation**: Verifies backup file and checksum
2. **Confirmation**: Prompts user (unless `--force`)
3. **Stop**: Stops server if running
4. **Clear**: Removes current world data
5. **Extract**: Restores from backup archive
6. **Permissions**: Sets correct file ownership
7. **Restart**: Starts server if it was running

**Sample Output**:

```
[WARNING] WARNING: This will replace all world data for server: atm8
Backup: atm8-20251108-143022.tar.gz (780MB)
Server will be stopped during restore.

Proceed? [y/N]: y

[INFO] Starting restore for server: atm8
[INFO] Backup file: atm8-20251108-143022.tar.gz (780MB)
[INFO] Stopping running server...
[INFO] Clearing existing world data...
[INFO] Extracting backup archive...
[INFO] Setting file permissions...
[INFO] Restarting server...
[SUCCESS] Restore completed successfully!
Server: atm8
Backup: atm8-20251108-143022.tar.gz
Data restored: 780MB
Duration: 25s
Server status: Restarted
```

### Force Restore (No Prompt)

```bash
# Skip confirmation prompt
./scripts/restore.sh atm8 atm8-20251108-143022.tar.gz --force
```

### Emergency Restore

If server won't start after corruption:

```bash
# Stop the broken server
docker stop mc-atm8

# Restore backup
./scripts/restore.sh atm8 atm8-20251108-143022.tar.gz --force

# Start manually if needed
docker start mc-atm8
```

## Backup Management

### Listing Backups

```bash
# View backup directory
ls -la backups/ < server-name > /

# Example output:
# -rw-r--r--  1 user  staff  816889856 Nov  8 14:30 atm8-20251108-143022.tar.gz
# -rw-r--r--  1 user  staff         90 Nov  8 14:30 atm8-20251108-143022.tar.gz.sha256
# -rw-r--r--  1 user  staff  812345678 Nov  7 23:00 atm8-20251107-230015.tar.gz
# -rw-r--r--  1 user  staff         90 Nov  7 23:00 atm8-20251107-230015.tar.gz.sha256
# -rw-r--r--  1 user  staff  807891234 Nov  6 23:00 atm8-20251106-230010.tar.gz
# -rw-r--r--  1 user  staff         90 Nov  6 23:00 atm8-20251106-230010.tar.gz.sha256
```

### Backup Retention Policy

- **Keep**: 3 most recent backups per server
- **Auto-delete**: Older backups removed automatically
- **Manual override**: Delete specific backups manually if needed

```bash
# Manual cleanup (dangerous - deletes backups!)
rm backups/atm8/atm8-20251105-120000.tar.gz
rm backups/atm8/atm8-20251105-120000.tar.gz.sha256
```

### Backup Size Expectations

| Server Type             | Typical Size | Growth Rate               |
| ----------------------- | ------------ | ------------------------- |
| **Vanilla**             | 100MB-2GB    | Slow (exploration-based)  |
| **Light modded**        | 200MB-5GB    | Medium (mods add data)    |
| **Heavy modded** (ATM8) | 500MB-10GB+  | Fast (complex automation) |
| **RLCraft**             | 300MB-8GB    | Medium (frequent resets)  |

### Disk Space Planning

```bash
# Check backup directory sizes
du -sh backups/*/

# Check available disk space
df -h .
```

**Formula**: Reserve 3x largest world size + 20% buffer

## Disaster Recovery Scenarios

### Scenario 1: World Corruption

**Symptoms**: Server starts but world is broken/missing chunks

**Recovery**:

```bash
# Identify last good backup
ls -la backups/atm8/

# Restore to last known good state
./scripts/restore.sh atm8 atm8-20251107-230015.tar.gz
```

### Scenario 2: Server Won't Start

**Symptoms**: Container fails to start, logs show world errors

**Recovery**:

```bash
# Check logs
docker logs mc-atm8

# If world corruption suspected
./scripts/restore.sh atm8 atm8-20251107-230015.tar.gz --force

# Verify
docker start mc-atm8
docker logs -f mc-atm8
```

### Scenario 3: Accidental Deletion

**Symptoms**: Admin accidentally deletes world files

**Recovery**:

```bash
# Stop server immediately
docker stop mc-atm8

# Restore latest backup
./scripts/restore.sh atm8 $(ls -t backups/atm8/*.tar.gz | head -1 | xargs basename)
```

### Scenario 4: Mod Update Breaks World

**Symptoms**: Server starts but gameplay is broken after mod update

**Recovery**:

```bash
# Restore pre-update backup
./scripts/restore.sh atm8 atm8-20251107-before-update.tar.gz

# Update mods more carefully
# Test on copy first
```

## Backup Validation

### Manual Verification

```bash
# Check backup contents
tar tzf backups/atm8/atm8-20251108-143022.tar.gz | head -20

# Verify checksum
sha256sum -c backups/atm8/atm8-20251108-143022.tar.gz.sha256

# Test extraction (dry run)
mkdir /tmp/backup-test
tar xzf backups/atm8/atm8-20251108-143022.tar.gz -C /tmp/backup-test
ls -la /tmp/backup-test/data/
rm -rf /tmp/backup-test
```

### Automated Validation

Create a validation script:

```bash
#!/bin/bash
# validate-backups.sh
for backup in backups/*/*.tar.gz; do
  echo "Validating: $backup"
  if ! sha256sum -c "${backup}.sha256" > /dev/null 2>&1; then
    echo "FAILED: $backup"
  else
    echo "OK: $backup"
  fi
done
```

## Performance Considerations

### Backup Speed

- **Small worlds** (<500MB): 30-60 seconds
- **Large worlds** (5GB+): 5-10 minutes
- **Network storage**: 2-3x slower

### Restore Speed

- **Small worlds**: 15-30 seconds
- **Large worlds**: 2-15 minutes
- **Bottleneck**: Disk I/O during extraction

### Server Downtime

- **Backup**: 30-60 seconds (server stopped)
- **Restore**: 30-120 seconds (server stopped)

### Optimization Tips

1. **Use SSD storage** for faster backups
2. **Schedule during low-traffic** hours
3. **Monitor disk space** regularly
4. **Test restore procedures** monthly
5. **Keep multiple backups** for rollback options

## Security Considerations

### Access Control

- Backup files contain sensitive data (player inventories, builds)
- Store backups on encrypted volumes
- Limit access to backup directories
- Use separate backup storage for offsite copies

### Encryption

For additional security, encrypt backups:

```bash
# Encrypt backup (requires gpg)
gpg -c backups/atm8/atm8-20251108-143022.tar.gz

# Decrypt before restore
gpg backups/atm8/atm8-20251108-143022.tar.gz.gpg
```

## Monitoring & Alerting

### Backup Success Monitoring

```bash
# Check last backup age
find backups/atm8/ -name "*.tar.gz" -mtime +1 | wc -l

# Alert if no recent backup
if [[ $(find backups/atm8/ -name "*.tar.gz" -mtime +1 | wc -l) -gt 0 ]]; then
  echo "WARNING: No backup in last 24 hours"
fi
```

### Automated Health Checks

```bash
# Cron job to verify backups
0 4 * * * /path/to/validate-backups.sh >> /var/log/backup-check.log 2>&1
```

## Troubleshooting

### Backup Fails

**Error**: "Server is not running"

**Solution**:

```bash
# Start server first
./scripts/start-server.sh atm8
./scripts/backup.sh atm8
```

**Error**: "Insufficient disk space"

**Solution**:

```bash
# Check space
df -h .

# Free space or change backup location
# Edit scripts/backup.sh to use different BACKUP_DIR
```

**Error**: "Permission denied"

**Solution**:

```bash
# Fix ownership
sudo chown -R $USER:$USER backups/
sudo chown -R $USER:$USER servers/
```

### Restore Fails

**Error**: "Checksum verification failed"

**Solution**:

- Backup file corrupted during transfer
- Use different backup file
- Check storage integrity

**Error**: "Cannot start server after restore"

**Solution**:

```bash
# Check logs
docker logs mc-atm8

# Manual start
docker start mc-atm8
```

### Performance Issues

**Slow backups**: Use faster storage (SSD vs HDD)

**Large backup files**: Consider excluding logs from backup

**Frequent downtime**: Schedule backups during maintenance windows

## Best Practices

### Operational

1. **Test restores regularly** - don't wait for disaster
2. **Monitor backup success** - automate alerts
3. **Keep multiple generations** - 3+ backups minimum
4. **Document procedures** - team knowledge sharing
5. **Secure backup storage** - encryption and access control

### Technical

1. **Use consistent naming** - predictable backup locations
2. **Validate integrity** - checksums prevent silent failures
3. **Automate retention** - prevent disk space issues
4. **Monitor performance** - optimize for your hardware
5. **Plan for growth** - scale storage with world size

### Recovery Planning

1. **Document disaster scenarios** - know what to do when
2. **Test recovery time** - meet RTO requirements
3. **Have rollback options** - multiple restore points
4. **Communicate with players** - transparency during outages
5. **Learn from incidents** - improve procedures

## Related Documentation

- [QUICKSTART.md](QUICKSTART.md) - Getting started guide
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design
- [contracts/management-api.md](../specs/001-docker-multi-server/contracts/management-api.md) - API specifications
