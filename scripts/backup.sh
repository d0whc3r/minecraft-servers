#!/bin/bash

# backup.sh - Create backup for Minecraft server
# Usage: ./scripts/backup.sh <server-name>
# Creates atomic backup with checksum verification and rolling retention

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_RETENTION=3

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Validate arguments
if [[ $# -ne 1 ]]; then
    echo "Usage: $0 <server-name>" >&2
    echo "Example: $0 atm8" >&2
    exit 2
fi

SERVER_NAME="$1"

# Validate server name format
if [[ ! "$SERVER_NAME" =~ ^[a-z0-9-]+$ ]]; then
    log_error "Invalid server name format: $SERVER_NAME"
    log_error "Server name must match regex: ^[a-z0-9-]+$"
    exit 2
fi

# Check if server config exists
CONFIG_FILE="$PROJECT_ROOT/config/modpacks/${SERVER_NAME}.env"
if [[ ! -f "$CONFIG_FILE" ]]; then
    log_error "Server configuration not found: $CONFIG_FILE"
    exit 3
fi

# Check if server is running
CONTAINER_NAME="mc-${SERVER_NAME}"
if ! docker ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    log_error "Server '$SERVER_NAME' is not running (container: $CONTAINER_NAME)"
    log_error "Start the server first with: ./scripts/start-server.sh $SERVER_NAME"
    exit 3
fi

# Setup backup paths
BACKUP_DIR="$PROJECT_ROOT/backups/${SERVER_NAME}"
SERVER_DATA_DIR="$PROJECT_ROOT/servers/${SERVER_NAME}/data"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILENAME="${SERVER_NAME}-${TIMESTAMP}.tar.gz"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILENAME"
CHECKSUM_PATH="$BACKUP_PATH.sha256"

log_info "Starting backup for server: $SERVER_NAME"
log_info "Backup file: $BACKUP_FILENAME"

# Record start time
START_TIME=$(date +%s)

# Stop server temporarily for atomic backup
log_info "Stopping server temporarily for backup..."
if ! docker stop "$CONTAINER_NAME" >/dev/null 2>&1; then
    log_error "Failed to stop server container"
    exit 1
fi

# Wait for server to stop gracefully
sleep 5

# Create backup archive
log_info "Creating backup archive..."
if ! tar czf "$BACKUP_PATH" -C "$PROJECT_ROOT/servers/${SERVER_NAME}" data/ 2>/dev/null; then
    # Restart server on failure
    log_warning "Backup failed, restarting server..."
    docker start "$CONTAINER_NAME" >/dev/null 2>&1
    log_error "Failed to create backup archive"
    exit 1
fi

# Calculate checksum
log_info "Calculating checksum..."
CHECKSUM=$(sha256sum "$BACKUP_PATH" | cut -d' ' -f1)
echo "$CHECKSUM  $BACKUP_FILENAME" > "$CHECKSUM_PATH"

# Restart server
log_info "Restarting server..."
if ! docker start "$CONTAINER_NAME" >/dev/null 2>&1; then
    log_error "Failed to restart server after backup"
    log_error "Server may need manual restart: docker start $CONTAINER_NAME"
    exit 1
fi

# Calculate backup size and compression ratio
BACKUP_SIZE=$(stat -f%z "$BACKUP_PATH" 2>/dev/null || stat -c%s "$BACKUP_PATH" 2>/dev/null || echo "0")
BACKUP_SIZE_MB=$((BACKUP_SIZE / 1024 / 1024))

# Estimate original size (rough approximation)
ORIGINAL_ESTIMATE_MB=$(du -sm "$SERVER_DATA_DIR" 2>/dev/null | cut -f1 || echo "0")
if [[ $ORIGINAL_ESTIMATE_MB -gt 0 ]]; then
    COMPRESSION_RATIO=$((BACKUP_SIZE_MB * 100 / ORIGINAL_ESTIMATE_MB))
else
    COMPRESSION_RATIO=0
fi

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Clean up old backups (keep only $BACKUP_RETENTION most recent)
log_info "Checking backup retention (keeping $BACKUP_RETENTION most recent)..."
BACKUP_FILES=("$BACKUP_DIR"/*.tar.gz)
if [[ ${#BACKUP_FILES[@]} -gt $BACKUP_RETENTION ]]; then
    # Sort by modification time (newest first), skip first N, delete rest
    TO_DELETE=$(ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -n +$((BACKUP_RETENTION + 1)) || true)
    if [[ -n "$TO_DELETE" ]]; then
        echo "$TO_DELETE" | while read -r old_backup; do
            if [[ -f "$old_backup" ]]; then
                log_info "Deleting old backup: $(basename "$old_backup")"
                rm -f "$old_backup" "${old_backup}.sha256"
            fi
        done
    fi
fi

# Success output
log_success "Backup completed successfully!"
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
ls -la "$BACKUP_DIR"/*.tar.gz 2>/dev/null | while read -r line; do
    if [[ -n "$line" ]]; then
        filename=$(basename "$(echo "$line" | awk '{print $9}')")
        size=$(echo "$line" | awk '{print $5}')
        size_mb=$((size / 1024 / 1024))
        echo "  $filename (${size_mb}MB)"
    fi
done

exit 0