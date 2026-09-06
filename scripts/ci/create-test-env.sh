#!/usr/bin/env bash
# Create the .env that docker compose consumes during CI tests, from the
# job environment defined in the workflow's env: block. CF_API_KEY is
# appended separately because its value may contain characters the heredoc
# would expand.

set -euo pipefail

cat << EOF > .env
# CI Environment - Auto-generated
EULA=${EULA:-TRUE}
MC_ROUTER_DOMAIN=${MC_ROUTER_DOMAIN:-mc.local}
ENABLE_RCON=${ENABLE_RCON:-true}
RCON_PASSWORD=${RCON_PASSWORD:-minecraft}
RCON_PORT=${RCON_PORT:-25575}
BROADCAST_RCON_TO_OPS=${BROADCAST_RCON_TO_OPS:-false}
TZ=${TZ:-UTC}
ENABLE_ROLLING_LOGS=${ENABLE_ROLLING_LOGS:-true}
USE_AIKAR_FLAGS=${USE_AIKAR_FLAGS:-true}
ONLINE_MODE=${ONLINE_MODE:-false}
ALLOW_FLIGHT=${ALLOW_FLIGHT:-true}
EOF

echo "CF_API_KEY=${CF_API_KEY:-dummy_key}" >> .env
echo "✅ .env file created"
