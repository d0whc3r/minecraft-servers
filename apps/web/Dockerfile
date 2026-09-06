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
# Runtime: node + every CLI the two panel runtimes shell out to.
#   docker runtime:     docker CLI + compose plugin (socket mounted)
#   kubernetes runtime: kubectl + helm, driving the charts/ baked below with
#                       the pod's ServiceAccount (see charts/web-panel)
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim
ARG KUBECTL_VERSION=v1.32.5
ARG HELM_VERSION=v3.17.3
ARG TARGETARCH
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
 && curl -fsSL "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${TARGETARCH}/kubectl" \
      -o /usr/local/bin/kubectl && chmod 0755 /usr/local/bin/kubectl \
 && curl -fsSL "https://get.helm.sh/helm-${HELM_VERSION}-linux-${TARGETARCH}.tar.gz" \
      | tar xz -C /tmp --strip-components=1 "linux-${TARGETARCH}/helm" \
 && install -m 0755 /tmp/helm /usr/local/bin/helm \
 && rm -f /tmp/helm && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3777 \
    MCPANEL_ROOT=/repo \
    MCPANEL_DATA_DIR=/data

# Mirror the monorepo layout (workspace root + apps/web) so pnpm's relative
# node_modules symlinks keep resolving inside the image. The repo-shaped
# content the panel reads (charts, modpack catalog, docs metadata) is baked
# in: on the docker runtime the host checkout is mounted over /repo anyway,
# on the kubernetes runtime these are the panel's working files.
WORKDIR /repo
COPY --from=build /mono/node_modules /mono/node_modules
COPY --from=build /mono/apps/web/node_modules /mono/apps/web/node_modules
COPY --from=build /mono/apps/web/package.json /mono/apps/web/package.json
COPY --from=build /mono/apps/web/dist /mono/apps/web/dist
COPY charts/ /repo/charts/
COPY config/modpacks/ /repo/config/modpacks/
COPY docs/modpacks/ /repo/docs/modpacks/

EXPOSE 3777
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3777)+'/api/auth/me').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "/mono/apps/web/dist/server/entry.mjs"]
