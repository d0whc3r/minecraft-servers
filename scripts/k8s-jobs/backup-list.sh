#!/bin/sh
#
# backup-list.sh - List a server's world backups as machine-readable lines.
#
# Runs inside the server pod (kubectl exec) or a short-lived K8s Job that
# mounts the server's claims, so it must stay POSIX sh: identical output on
# alpine (Jobs) and debian (exec). The panel (apps/web k8s backend) parses
# the output, not the operator — keep the format in sync with k8s.ts.
#
# Output: one line per backup
#   "<file> <size-bytes> <mtime-ISO8601|unknown> <checksums: yes|no>"
#
# Exit Codes:
#   0 - listing finished (entries that cannot be stat'd are skipped)

for f in /backups/*.tar.gz; do
  [ -f "$f" ] || continue
  sz=$(wc -c < "$f")
  ts=$(date -u -r "$f" "+%Y-%m-%dT%H:%M:%SZ" 2> /dev/null || echo unknown)
  cs=no
  [ -f "$f.sha256" ] && cs=yes
  echo "$(basename "$f") $sz $ts $cs"
done
