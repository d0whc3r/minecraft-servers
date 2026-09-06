#!/bin/sh
#
# backup-restore.sh - Wipe /data and restore a backup into it.
#
# DESTRUCTIVE: everything currently in /data is deleted. The panel scales the
# server to zero before running this. Runs as a short-lived K8s Job (alpine)
# with the server's claims mounted at /data and /backups. Must stay POSIX sh.
# The panel passes the file name from its own validated list
# (safeBackupName); it is never interpolated into the script text.
#
# Usage: backup-restore.sh <name>.tar.gz
#
# Exit Codes:
#   0 - restore complete
#   1/2 - missing or invalid <name> (paths and dotfiles are rejected)
#   2 - checksum mismatch (data left untouched)
#   other - tar failure

set -e

f="${1:?usage: backup-restore.sh <name>.tar.gz}"
case "$f" in
  "" | ..* | */*)
    echo "ERROR: invalid backup name: $f" >&2
    exit 1
    ;;
esac

cd /backups
# Refuse to wipe /data when the archive does not match its checksum.
if [ -f "$f.sha256" ]; then
  sha256sum -c "$f.sha256" || exit 2
fi
find /data -mindepth 1 -delete
tar xzf "/backups/$f" -C /data
echo "restore complete: $f"
