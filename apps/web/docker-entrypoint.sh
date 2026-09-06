#!/bin/sh
# Panel container entrypoint. When MCPANEL_SSH=1 (chart values ssh.enabled),
# start a key-only sshd before the panel server, so operators can ssh in and
# drive the cluster with the bundled mc-tui. sshd runs unprivileged as the
# node user on a high port — no root, no passwords, authorized keys only.
set -e

if [ "${MCPANEL_SSH:-0}" = "1" ]; then
  ssh_dir="${MCPANEL_SSH_DIR:-/data/mc-ssh}"
  port="${MCPANEL_SSH_PORT:-2222}"
  mkdir -p "$ssh_dir"

  # Stable host identity: keys live on the data claim, so clients don't see
  # a host-key warning on every pod restart.
  if [ ! -f "$ssh_dir/ssh_host_ed25519_key" ]; then
    ssh-keygen -t ed25519 -f "$ssh_dir/ssh_host_ed25519_key" -N '' -C mcpanel
  fi

  cat > "$ssh_dir/sshd_config" <<EOF
Port $port
ListenAddress 0.0.0.0
HostKey $ssh_dir/ssh_host_ed25519_key
PidFile $ssh_dir/sshd.pid
AuthorizedKeysFile /home/node/.ssh/authorized_keys
PasswordAuthentication no
PubkeyAuthentication yes
KbdInteractiveAuthentication no
PermitRootLogin no
AllowUsers node
StrictModes yes
UsePAM no
Subsystem sftp internal-sftp
EOF

  /usr/sbin/sshd -f "$ssh_dir/sshd_config" -E "$ssh_dir/sshd.log"
fi

exec "$@"
