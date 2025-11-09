#!/bin/bash

# restore.sh - Restore Minecraft server from backup
# Usage: ./scripts/restore.sh <server-name> <backup-file> [--force]
# Restores server world data from backup archive with checksum verification

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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
if [[ $# -lt 2 ]] || [[ $# -gt 3 ]]; then
    echo "Usage: $0 <server-name> <backup-file> [--force]" >&2
    echo "Example: $0 atm8 atm8-20251108-143022.tar.gz" >&2
    echo "Example: $0 vanilla vanilla-20251108-120000.tar.gz --force" >&2
    exit 2
fi

SERVER_NAME="$1"
BACKUP_FILE="$2"
FORCE=false

if [[ $# -eq 3 ]]; then
    if [[ "$3" == "--force" ]]; then
        FORCE=true
    else
        log_error "Invalid option: $3"
        log_error "Use --force to skip confirmation prompt"
        exit 2
    fi
fi

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

# Resolve backup file path
if [[ "$BACKUP_FILE" == /* ]]; then
    # Absolute path
    BACKUP_PATH="$BACKUP_FILE"
else
    # Relative to backup directory
    BACKUP_PATH="$PROJECT_ROOT/backups/${SERVER_NAME}/${BACKUP_FILE}"
fi

# Check if backup file exists
if [[ ! -f "$BACKUP_PATH" ]]; then
    log_error "Backup file not found: $BACKUP_PATH"
    exit 3
fi

# Check if checksum file exists
CHECKSUM_PATH="${BACKUP_PATH}.sha256"
if [[ ! -f "$CHECKSUM_PATH" ]]; then
    log_error "Checksum file not found: $CHECKSUM_PATH"
    exit 3
fi

# Verify backup integrity
log_info "Verifying backup integrity..."
if ! sha256sum -c "$CHECKSUM_PATH" >/dev/null 2>&1; then
    log_error "Backup integrity check failed!"
    log_error "The backup file may be corrupted or modified."
    exit 4
fi

# Get backup size
BACKUP_SIZE=$(stat -f%z "$BACKUP_PATH" 2>/dev/null || stat -c%s "$BACKUP_PATH" 2>/dev/null || echo "0")
BACKUP_SIZE_MB=$((BACKUP_SIZE / 1024 / 1024))

# Confirmation prompt (unless --force)
if [[ "$FORCE" != true ]]; then
    echo ""
    log_warning "WARNING: This will replace all world data for server: $SERVER_NAME"
    echo "Backup: $(basename "$BACKUP_PATH") (${BACKUP_SIZE_MB}MB)"
    echo "Server will be stopped during restore."
    echo ""
    read -p "Proceed? [y/N]: " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled by user"
        exit 126
    fi
fi

log_info "Starting restore for server: $SERVER_NAME"
log_info "Backup file: $(basename "$BACKUP_PATH") (${BACKUP_SIZE_MB}MB)"

# Record start time
START_TIME=$(date +%s)

# Check if server is running and stop it
CONTAINER_NAME="mc-${SERVER_NAME}"
SERVER_WAS_RUNNING=false

if docker ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    SERVER_WAS_RUNNING=true
    log_info "Stopping running server..."
    if ! docker stop "$CONTAINER_NAME" >/dev/null 2>&1; then
        log_error "Failed to stop server container"
        exit 1
    fi
fi

# Wait for server to stop
sleep 3

# Setup paths
SERVER_DATA_DIR="$PROJECT_ROOT/servers/${SERVER_NAME}/data"

# Create data directory if it doesn't exist
mkdir -p "$SERVER_DATA_DIR"

# Clear existing data (with confirmation already given)
log_info "Clearing existing world data..."
if ! rm -rf "${SERVER_DATA_DIR:?}"/* 2>/dev/null; then
    log_warning "Failed to clear some files (may not exist yet)"
fi

# Extract backup
log_info "Extracting backup archive..."
if ! tar xzf "$BACKUP_PATH" -C "$PROJECT_ROOT/servers/${SERVER_NAME}" 2>/dev/null; then
    log_error "Failed to extract backup archive"
    # Try to restart server if it was running
    if [[ "$SERVER_WAS_RUNNING" == true ]]; then
        log_warning "Attempting to restart server after failed restore..."
        docker start "$CONTAINER_NAME" >/dev/null 2>&1 || true
    fi
    exit 1
fi

# Set correct ownership (Minecraft user in itzg image is UID 1000)
log_info "Setting file permissions..."
if ! chown -R 1000:1000 "$SERVER_DATA_DIR" 2>/dev/null; then
    log_warning "Failed to set ownership (may not be running as root)"
fi

# Restart server if it was running before
if [[ "$SERVER_WAS_RUNNING" == true ]]; then
    log_info "Restarting server..."
    if ! docker start "$CONTAINER_NAME" >/dev/null 2>&1; then
        log_error "Failed to restart server after restore"
        log_error "Server may need manual restart: docker start $CONTAINER_NAME"
        exit 1
    fi
fi

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Success output
log_success "Restore completed successfully!"
echo "Server: $SERVER_NAME"
echo "Backup: $(basename "$BACKUP_PATH")"
echo "Data restored: ${BACKUP_SIZE_MB}MB"
echo "Duration: ${DURATION}s"

if [[ "$SERVER_WAS_RUNNING" == true ]]; then
    echo "Server status: Restarted"
else
    echo "Server status: Stopped (was not running before restore)"
    echo "Start with: ./scripts/start-server.sh $SERVER_NAME"
fi

exit 0