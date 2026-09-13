#!/bin/bash

# backup.sh - Create backup for Minecraft server
# Usage: ./scripts/backup.sh <server-name>
# Creates atomic backup with checksum verification and rolling retention

set -euo pipefail

# Load common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

BACKUP_RETENTION=3

# Validate arguments
if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <server-name>" >&2
  echo "Example: $0 atm8" >&2
  exit 2
fi

SERVER_NAME="$1"

# Validate server name
if ! validate_server_name "$SERVER_NAME"; then
  exit 2
fi

# One backup/restore/start/stop per server at a time: a concurrent backup
# would interleave stop/tar/start and archive a mid-write world
if ! acquire_server_lock "$SERVER_NAME" "backup"; then
  exit 1
fi

# Check if server config exists
CONFIG_FILE=$(get_config_file "$SERVER_NAME")
if [[ ! -f "$CONFIG_FILE" ]]; then
  error "Server configuration not found: $CONFIG_FILE"
  exit 3
fi

# Check if server is running
CONTAINER_NAME=$(get_container_name "$SERVER_NAME")
if ! container_running "$CONTAINER_NAME"; then
  error "Server '$SERVER_NAME' is not running (container: $CONTAINER_NAME)"
  error "Start the server first with: ./scripts/start-server.sh $SERVER_NAME"
  exit 3
fi

# Setup backup paths
BACKUP_DIR=$(get_backup_dir "$SERVER_NAME")
SERVER_DATA_DIR=$(get_data_dir "$SERVER_NAME")

# Create backup directory if it doesn't exist
ensure_directory "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILENAME="${SERVER_NAME}-${TIMESTAMP}.tar.gz"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILENAME"
CHECKSUM_PATH="$BACKUP_PATH.sha256"

info "Starting backup for server: $SERVER_NAME"
info "Backup file: $BACKUP_FILENAME"

# Record start time
START_TIME=$(date +%s)

# Stop server temporarily for atomic backup. -t gives the JVM time to save
# the world (the default 10s can cut off slow worlds mid-write)
info "Stopping server temporarily for backup..."
if ! docker stop -t 60 "$CONTAINER_NAME" > /dev/null 2>&1; then
  error "Failed to stop server container"
  exit 1
fi

# Wait for server to stop gracefully
sleep 5

# Create backup archive
info "Creating backup archive..."
if ! tar czf "$BACKUP_PATH" -C "$(dirname "$SERVER_DATA_DIR")" data/ 2> /dev/null; then
  # Restart server on failure
  warning "Backup failed, restarting server..."
  docker start "$CONTAINER_NAME" > /dev/null 2>&1
  error "Failed to create backup archive"
  exit 1
fi

# Calculate checksum
info "Calculating checksum..."
CHECKSUM=$(sha256sum "$BACKUP_PATH" | cut -d' ' -f1)
echo "$CHECKSUM  $BACKUP_FILENAME" > "$CHECKSUM_PATH"

# Restart server
info "Restarting server..."
if ! docker start "$CONTAINER_NAME" > /dev/null 2>&1; then
  error "Failed to restart server after backup"
  error "Server may need manual restart: docker start $CONTAINER_NAME"
  exit 1
fi
# Calculate backup size and compression ratio
BACKUP_SIZE=$(stat -f%z "$BACKUP_PATH" 2> /dev/null || stat -c%s "$BACKUP_PATH" 2> /dev/null || echo "0")
BACKUP_SIZE_MB=$((BACKUP_SIZE / 1024 / 1024))

# Estimate original size (rough approximation)
ORIGINAL_ESTIMATE_MB=$(du -sm "$SERVER_DATA_DIR" 2> /dev/null | cut -f1 || echo "0")
if [[ $ORIGINAL_ESTIMATE_MB -gt 0 ]]; then
  COMPRESSION_RATIO=$((BACKUP_SIZE_MB * 100 / ORIGINAL_ESTIMATE_MB))
else
  COMPRESSION_RATIO=0
fi

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Clean up old backups (keep only $BACKUP_RETENTION most recent)
info "Checking backup retention (keeping $BACKUP_RETENTION most recent)..."
find "$BACKUP_DIR" -maxdepth 1 -name '*.tar.gz' -type f -printf '%T@ %p\0' 2> /dev/null \
  | sort -rz \
  | tail -z -n +$((BACKUP_RETENTION + 1)) \
  | while IFS= read -r -d '' old_backup; do
    old_backup="${old_backup#* }"
    if [[ -f "$old_backup" ]]; then
      info "Deleting old backup: $(basename "$old_backup")"
      rm -f "$old_backup" "${old_backup}.sha256"
    fi
  done

# Success output
success "Backup completed successfully!"
echo "Server: $SERVER_NAME"
echo "Backup: $BACKUP_PATH"
echo "Size: ${BACKUP_SIZE_MB}MB"
if [[ $COMPRESSION_RATIO -gt 0 ]]; then
  echo "Compression: ${COMPRESSION_RATIO}%"
fi
echo "Checksum: $CHECKSUM"
echo "Duration: ${DURATION}s"

# List current backups
echo ""
echo "Current backups for $SERVER_NAME:"
for backup_file in "$BACKUP_DIR"/*.tar.gz; do
  [ -f "$backup_file" ] || continue
  file_size=$(stat -c%s "$backup_file" 2> /dev/null || stat -f%z "$backup_file" 2> /dev/null || echo "0")
  echo "  $(basename "$backup_file") ($((file_size / 1024 / 1024))MB)"
done

exit 0
