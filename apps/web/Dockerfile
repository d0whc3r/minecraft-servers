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
# TUI build stage: the same terminal dashboard, shipped inside the panel so an
# ssh session into the container can drive the cluster too (kubernetes
# runtime: MCPANEL_RUNTIME=kubernetes flips the TUI onto helm/kubectl).
# ---------------------------------------------------------------------------
# fully-qualified: podman setups without unqualified-search registries can't
# resolve short names, and this stage is new enough to have no local alias.
FROM docker.io/library/golang:1.27-bookworm AS tui
WORKDIR /src
COPY apps/tui/go.mod apps/tui/go.sum ./
RUN go mod download
COPY apps/tui/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o /mc-tui .

# ---------------------------------------------------------------------------
# Runtime: node + every CLI the two panel runtimes shell out to.
#   docker runtime:     docker CLI + compose plugin (socket mounted)
#   kubernetes runtime: kubectl + helm, driving the charts/ baked below with
#                       the pod's ServiceAccount (see charts/web-panel)
# Plus an sshd (started by the entrypoint when MCPANEL_SSH=1) so operators can
# ssh in and manage the cluster with the bundled mc-tui.
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim
ARG KUBECTL_VERSION=v1.32.5
ARG HELM_VERSION=v3.17.3
ARG TARGETARCH
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg openssh-server \
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
  && rm -f /tmp/helm \
  && mkdir -p /run/sshd /home/node/.ssh \
  && chown node:node /home/node \
  && usermod -s /bin/bash node \
  && rm -rf /var/lib/apt/lists/*

# The TUI binary + a wrapper pinning -root /repo: findRoot() walks up from the
# working directory, which never lands on /repo from a login shell.
COPY --from=tui /mc-tui /opt/mc-tui/mc-tui
COPY apps/web/mc-tui-ssh.sh /usr/local/bin/mc-tui
COPY apps/web/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 0755 /opt/mc-tui/mc-tui /usr/local/bin/mc-tui /usr/local/bin/docker-entrypoint.sh \
  # sshd with UsePAM=no rejects locked accounts ("!" in shadow): give the node
  # user an empty-but-valid password field so pubkey login works.
  && usermod -p '*' node

ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=3777 \
  MCPANEL_ROOT=/repo \
  MCPANEL_DATA_DIR=/data

# Mirror the monorepo layout (workspace root + apps/web) so pnpm's relative
# node_modules symlinks keep resolving inside the image. The repo-shaped
# content the panel reads (charts, modpack catalog, docs metadata, k8s job
# scripts) is baked in: on the docker runtime the host checkout is mounted
# over /repo anyway, on the kubernetes runtime these are the panel's working
# files.
WORKDIR /repo
COPY --from=build /mono/node_modules /mono/node_modules
COPY --from=build /mono/apps/web/node_modules /mono/apps/web/node_modules
COPY --from=build /mono/apps/web/package.json /mono/apps/web/package.json
COPY --from=build /mono/apps/web/dist /mono/apps/web/dist
COPY charts/ /repo/charts/
COPY config/modpacks/ /repo/config/modpacks/
COPY docs/modpacks/ /repo/docs/modpacks/
COPY scripts/k8s-jobs/ /repo/scripts/k8s-jobs/

EXPOSE 3777
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3777)+'/api/auth/me').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "/mono/apps/web/dist/server/entry.mjs"]
