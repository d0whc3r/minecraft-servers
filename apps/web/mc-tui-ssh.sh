#!/usr/bin/env bash
# mc-tui inside the panel container. Two reasons this is a wrapper and not a
# bare binary:
#   - the login shell never starts in /repo, and findRoot() only walks up from
#     the working directory or the binary location, so pin the repo layout;
#   - sshd does not pass the container environment to sessions, so default the
#     kubernetes runtime (the reason the TUI ships in this image). An explicit
#     MCPANEL_RUNTIME=docker — the docker-runtime panel with a socket mount —
#     still wins.
: "${MCPANEL_RUNTIME:=kubernetes}"
: "${MCPANEL_DATA_DIR:=/data}"
export MCPANEL_RUNTIME MCPANEL_DATA_DIR
exec /opt/mc-tui/mc-tui -root /repo "$@"
