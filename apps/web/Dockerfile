# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage: workspace install + panel compile.
# Build context is the REPO ROOT (see apps/web/docker-compose.yml) so pnpm can
# resolve the workspace lockfile.
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS build
RUN npm install --global pnpm@12.3.4
WORKDIR /mono

# Workspace manifests first: the dependency layer only rebuilds when they do.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# Panel sources + compile (Tailwind/Astro/React bundle).
COPY apps/web/ apps/web/
RUN pnpm --filter @minecraft-servers/web build

# ---------------------------------------------------------------------------
# Runtime: node + docker CLI/compose plugin. The panel shells out to the repo
# management scripts (scripts/*.sh), which drive `docker compose` against the
# socket mounted by docker-compose.yml.
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL "https://download.docker.com/linux/debian/gpg" \
      -o /etc/apt/keyrings/docker.asc \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" \
      > /etc/apt/sources.list.d/docker.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      docker-ce-cli docker-compose-plugin tzdata \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3777 \
    MCPANEL_ROOT=/repo \
    MCPANEL_DATA_DIR=/data

# Mirror the monorepo layout (workspace root + apps/web) so pnpm's relative
# node_modules symlinks keep resolving inside the image.
WORKDIR /repo
COPY --from=build /mono/node_modules /mono/node_modules
COPY --from=build /mono/apps/web/node_modules /mono/apps/web/node_modules
COPY --from=build /mono/apps/web/package.json /mono/apps/web/package.json
COPY --from=build /mono/apps/web/dist /mono/apps/web/dist

EXPOSE 3777
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3777)+'/api/auth/me').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "/mono/apps/web/dist/server/entry.mjs"]
