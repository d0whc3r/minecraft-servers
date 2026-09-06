#!/bin/sh
#
# backup-create.sh - Tar the world data and write a sha256 checksum beside it.
#
# Runs as a short-lived K8s Job (alpine) with the server's claims mounted at
# /data (world) and /backups (archives). Must stay POSIX sh. The panel
# generates the file name (safeBackupName + timestamp) and passes it here, so
# the script never interpolates it into code.
#
# Usage: backup-create.sh <name>.tar.gz
#
# Exit Codes:
#   0 - backup created and checksummed
#   1/2 - missing or invalid <name> (paths and dotfiles are rejected)
#   other - tar/sha256sum failure

set -e

f="${1:?usage: backup-create.sh <name>.tar.gz}"
case "$f" in
  "" | ..* | */*)
    echo "ERROR: invalid backup name: $f" >&2
    exit 1
    ;;
esac

tar czf "/backups/$f" -C /data .
cd /backups
sha256sum "$f" > "$f.sha256"
echo "backup created: $f"
