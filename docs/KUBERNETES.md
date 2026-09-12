# Kubernetes

The same system — 34 modpacks behind one mc-router entry point, managed from
the web panel — runs on Kubernetes with **only the Helm charts in `charts/`**.
The panel gets `MCPANEL_RUNTIME=kubernetes` and does everything itself: when
you press **Start** on a modpack it renders `config/modpacks/<server>.env`
plus the shared `.env` into chart values and runs
`helm upgrade --install mc-<server>` inside the cluster. No Docker socket, no
bind mounts, no repo scripts.

```
                                   ┌────────────────────────────────┐
                                   │      namespace: minecraft      │
 players ──► <server>.<domain>     │                                │
            ┌──────────────────┐   │  ┌──────────────────────────┐  │
            │    mc-router     │───┼─►│  mc-vanilla (Deployment) │  │
            │  Service :25565  │   │  │  PVC data + backups      │  │
            └────────▲─────────┘   │  └──────────────────────────┘  │
                     │ watches     │  ┌──────────────────────────┐  │
                     │ Services    │  │  mc-dawncraft (release)  │  │
   browser ──────────┼─────────────┼─►│  ...one per started pack │  │
   (panel UI)        │             │  └──────────────────────────┘  │
            ┌────────┴──────────┐  │                                │
            │  minecraft-panel  │──┼─► helm upgrade --install       │
            │  SA + RBAC        │  │    kubectl logs / exec / Jobs  │
            └───────────────────┘  └────────────────────────────────┘
```

## Charts

| Chart                     | Release            | Purpose                                                                                                                                   |
| ------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `charts/minecraft-server` | `mc-<server>`      | One server per release: Deployment, Service (mc-router annotations), ConfigMap/Secret with the modpack env, PVCs for world + backups.     |
| `charts/mc-router`        | `minecraft-router` | The single public port. Discovers backends in-cluster from Service annotations — installing a server release is the whole routing config. |
| `charts/web-panel`        | `minecraft-panel`  | The web dashboard in kubernetes mode: RBAC to manage the `mc-*` releases, the shared `.env` as a Secret, optional Ingress.                |

## Requirements

- Kubernetes 1.25+ with `helm` and `kubectl` locally
- A default **StorageClass** that can provision `ReadWriteOnce` volumes
  (local-path, nfs-subdir, Longhorn, cloud CSI…)
- **LoadBalancer** support for the router (or set
  `service.type=NodePort` on the mc-router chart). On kind there is no LB
  controller: the EXTERNAL-IP stays `<pending>` by design and players connect
  through the fixed nodePort mapped by `kind-config.yaml` instead
- Optional: **metrics-server** for CPU/memory bars in the panel
  (everything works without it; the bars just stay empty)
- Optional: an **Ingress controller** if you want the panel off `port-forward`

## Quick start

```bash
# 1. Configure the same .env the docker setup uses
cp .env.example .env
nano .env # EULA, CF_API_KEY, RCON_PASSWORD, MC_ROUTER_DOMAIN...

# 2. Install router + panel (reads .env, creates values for you)
./scripts/k8s-install.sh minecraft

# 3. Open the panel
kubectl -n minecraft port-forward svc/minecraft-panel 3777:3777
# -> http://localhost:3777  (generated password: kubectl -n minecraft logs deploy/minecraft-panel | grep -i password)

# 4. Start any modpack from the dashboard. That's it — the release appears:
helm -n minecraft list
```

Equivalent manual install without the script:

```bash
helm upgrade --install minecraft-router charts/mc-router -n minecraft --create-namespace
helm upgrade --install minecraft-panel charts/web-panel -n minecraft \
  --set sharedEnv.EULA=TRUE \
  --set sharedEnv.CF_API_KEY='$2a$10$...' \
  --set sharedEnv.RCON_PASSWORD=change-me \
  --set sharedEnv.MC_ROUTER_DOMAIN=mc.example.com
```

> The image `ghcr.io/d0whc3r/minecraft-servers/panel` is published by the
> **Docker Publish** workflow (`.github/workflows/docker-publish.yml`) on
> every push to `master` that touches the panel, charts or modpack catalog;
> it can also be run manually from the Actions tab. GHCR creates the first
> package as **private**: flip it to public (Packages → panel → Package
> settings) or set `imagePullSecrets` in the web-panel chart, or pulls fail
> with 403. It carries kubectl, helm, the charts, the modpack catalog and the
> mc-tui binary (plus an optional key-only sshd, see below) — that plus the
> cluster credentials is everything the panel needs to start servers. To use
> your own registry instead, set `image.repository` / `image.tag` in the
> web-panel chart.

## Quick start (no repo clone)

The charts are also published to GHCR as OCI artifacts by the **Charts
Publish** workflow (`.github/workflows/charts-publish.yml`):

```
oci://ghcr.io/d0whc3r/minecraft-servers/charts/mc-router
oci://ghcr.io/d0whc3r/minecraft-servers/charts/web-panel
oci://ghcr.io/d0whc3r/minecraft-servers/charts/minecraft-server
```

`scripts/k8s-bootstrap.sh` is a standalone script that installs the stack
from those refs — no checkout needed. Download it (and read it) first, since
it asks for your secrets interactively:

```bash
curl -fsSL https://raw.githubusercontent.com/d0whc3r/minecraft-servers/master/scripts/k8s-bootstrap.sh -o k8s-bootstrap.sh
bash k8s-bootstrap.sh minecraft
```

It creates the `minecraft-shared-env` Secret (EULA, `CF_API_KEY`,
`RCON_PASSWORD` — prompts on a TTY, or pass them as environment variables
when piped) and installs router + panel from the OCI charts. The modpack
catalog ships baked into the panel image, so the panel is fully functional
afterwards: start servers from the dashboard and each becomes an `mc-<server>`
release. Re-run with `FORCE_SHARED_ENV=1` to update the Secret, and pass
`--env-file .env` to import extra keys. Helm installs the newest published
chart by default (each publish also re-tags it as `latest` on GHCR for raw
OCI tooling); pin a release with `MC_ROUTER_CHART_VERSION` /
`PANEL_CHART_VERSION`.
The chart packages on GHCR are also born **private** — flip them to public
the same way as the panel image.

## Syncing local configs and secrets

The local files stay the source of truth: one command uploads them to the
cluster and wires the panel to them.

```bash
./scripts/k8s-sync-configs.sh minecraft # or: make k8s-sync NS=minecraft
```

| Local                   | Cluster object                 | Mounted in the panel at |
| ----------------------- | ------------------------------ | ----------------------- |
| `.env`                  | Secret `minecraft-shared-env`  | `/repo/.env`            |
| `config/modpacks/*.env` | ConfigMap `minecraft-modpacks` | `/repo/config/modpacks` |

Re-running it after editing any local file updates both objects, re-points the
panel release and restarts the panel pod (the `.env` mount only refreshes on
restart). The catalog is live-mounted, so new or edited modpacks appear in the
dashboard without waiting for the restart. `k8s-install.sh` auto-detects both
objects, so install order doesn't matter.

Two caveats:

- **Servers started earlier keep the env they were started with** — each
  `mc-<server>` release renders its env on start. Restart a server from the
  panel to pick up `.env` / modpack changes.
- **Keep secrets out of `config/modpacks/*.env`**: the catalog rides in a
  ConfigMap, which is not redacted. Anything sensitive (API keys, passwords)
  belongs in `.env`, which lands in a Secret.

### Servers created from the panel

The catalog ConfigMap mounts read-only, so **+ New server** in the panel
writes to `<panel PVC>/servers/<name>.env` instead. Those servers persist
across panel restarts (they live on the panel's data claim), appear in the
dashboard immediately and are deletable from the panel (**custom** badge).
They are _not_ part of the ConfigMap: if you also want them in the git
catalog, copy the file into `config/modpacks/` and re-run the sync script.

## How a server start works

1. You click **Start** on a modpack in the panel.
2. The panel merges `.env` (shared) with `config/modpacks/<server>.env` and
   builds chart values:
   - plain settings → ConfigMap (`env`), secrets (`PASSWORD`, `API_KEY`,
     `TOKEN`, `SECRET` patterns) → Secret (`secretEnv`)
   - `JAVA_VERSION` → image tag (`itzg/minecraft-server:java21`), like
     docker-compose did
   - `MEMORY` → resource request/limit (`6G` → `6Gi`)
   - route `<server>.<MC_ROUTER_DOMAIN>` → `mc-router.itzg.me/externalServerName`
     Service annotation
3. `helm upgrade --install mc-<server> charts/minecraft-server` runs with a
   values file; the release is the unit of management from then on.

| Panel action | Kubernetes operation                                              |
| ------------ | ----------------------------------------------------------------- |
| Start        | `helm upgrade --install mc-<name> … --set replicaCount=1`         |
| Stop         | same release with `--set replicaCount=0` (data + route preserved) |
| Restart      | `kubectl rollout restart deployment/mc-<name>`                    |
| Logs         | `kubectl logs deployment/mc-<name> -c minecraft` (+ `-f` SSE)     |
| RCON         | direct TCP to `mc-<name>.<ns>.svc.cluster.local:25575`            |
| Backup       | one-off Job: `tar czf /backups/…` + `sha256sum` (data claim)      |
| Restore      | Job: checksum-verify → wipe data claim → extract (stops server)   |
| Status/stats | deployments + `kubectl top` (if metrics-server is present)        |

## Storage

Each server release gets two PVCs by default (`persistence.data.size=10Gi`,
`persistence.backups.size=10Gi`). The panel's backup button tars the **data
claim** into the **backups claim**, so backup/restore works with plain RWO
volumes and no node affinity games. Set `existingClaim` to reuse volumes, or
disable a claim (falls back to `emptyDir`) — not recommended for data.

## Backups on a schedule

The minecraft-server chart can run the official `itzg/mc-backup` sidecar:

```yaml
# values for the mc-<server> release (or edit via a custom values file)
backup:
  enabled: true
  interval: 6h
  pruneDays: 7
```

Manual panel backups work regardless of this setting.

## Namespace layout

Everything lives in one namespace by default (`minecraft` in the examples):
router, panel and servers. The web-panel chart supports
`minecraft.namespace` to keep servers elsewhere — it renders the management
Role in that namespace automatically (and `rbac.watchAllNamespaces: true`
turns it into a ClusterRole for every namespace).

## Values cheatsheet

```yaml
# web-panel
admin: { user: admin, password: '' } # "" -> generated, in logs
sharedEnv: { EULA: 'TRUE', CF_API_KEY: ... } # the servers' shared .env
ingress: { enabled: true, className: nginx, host: panel.example.com, tlsSecret: panel-tls }
router: { host: minecraft-router, port: 25565 }
modpacksConfigMap: '' # ConfigMap with <server>.env keys to override the catalog
resources: { requests: { cpu: 50m, memory: 128Mi }, limits: { memory: 512Mi } }

# mc-router
service: { type: LoadBalancer, port: 25565 } # NodePort also fine
rbac: { watchAllNamespaces: false }

# minecraft-server (set by the panel; tweak in a custom values file)
replicaCount: 1 # 0 = stopped
image: { tag: java21 }
resources: { requests: { memory: 6Gi }, limits: { memory: 6Gi } }
router: { host: dawncraft.mc.example.com, default: false }
persistence: { data: { size: 10Gi }, backups: { size: 10Gi } }
```

## RBAC

The panel's ServiceAccount is granted exactly what the actions need, scoped
to the server namespace: CRUD on Deployments/Services/ConfigMaps/Secrets/PVCs
(helm releases), pods get/log/exec (status, logs, downloads), and batch Jobs
(backup/restore). mc-router's SA can only watch Services. Nothing is
cluster-scoped unless you opt in with `rbac.watchAllNamespaces`.

> The panel can start any modpack and run commands as the servers — treat its
> credentials like the Docker-socket setup: keep the admin password safe, put
> it behind TLS/Ingress auth, don't expose it to the internet.

## Uninstall

```bash
./scripts/k8s-uninstall.sh minecraft # or: make k8s-uninstall NS=minecraft
```

Uninstalls every `mc-<server>` release, then the panel and the router. The
PVCs (worlds, backups, panel state) carry the `helm.sh/resource-policy: keep`
annotation, so data survives; the synced config Secret/ConfigMap also stay and
are re-used by the next install. Equivalent manual uninstall:

```bash
helm -n minecraft list -q | grep '^mc-' | xargs -r -n1 helm -n minecraft uninstall
helm -n minecraft uninstall minecraft-panel minecraft-router
# wipe the data for a clean slate:
kubectl -n minecraft delete pvc --all
```

`--purge` deletes the whole namespace instead (worlds and backups included;
`--yes` skips the confirmation): `./scripts/k8s-uninstall.sh minecraft --purge`.

## One-shot commands (kind)

Everything from zero to a running panel, in order. Idempotent: safe to
re-paste over an existing cluster.

```bash
cd /path/to/minecraft-servers

# 1. cluster (skipped when it exists) + node DNS + CoreDNS refresh
#    kind-config.yaml is the source of truth for the host-facing ports:
#    25565 -> node 30065 (mc-router), 9090 -> 80 / 9443 -> 443 (ingress).
#    On podman setups (docker=podman alias, rootless) kind needs the
#    explicit provider, and it cannot add port mappings to a running node:
#    changing kind-config.yaml means delete + create.
export KIND_EXPERIMENTAL_PROVIDER=podman # docker setups: drop this line
kind get clusters 2> /dev/null | grep -q '^kind-cluster$' || kind create cluster --config kind-config.yaml
docker exec kind-cluster-control-plane sh -c 'printf "nameserver 8.8.8.8\nnameserver 1.1.1.1\n" > /etc/resolv.conf'
kubectl -n kube-system rollout restart deployment/coredns
kubectl -n kube-system rollout status deployment/coredns --timeout=120s

# 2. panel image: build + load into the node
#    podman normalizes the loaded name to localhost/minecraft-panel:local —
#    PANEL_IMAGE_REPO below must match or the pull tries docker.io.
docker build -f apps/web/Dockerfile --build-arg TARGETARCH=amd64 --network=host -t minecraft-panel:local .
kind load docker-image minecraft-panel:local --name kind-cluster

# 3. router + panel (reads .env; keep the PANEL_IMAGE_* vars on re-installs;
#    K8S_PANEL_HOST enables the panel Ingress through Contour -> port 9090)
PANEL_IMAGE_REPO=localhost/minecraft-panel PANEL_IMAGE_TAG=local \
  K8S_PANEL_HOST=panel.${MC_ROUTER_DOMAIN:-$(grep -m1 '^MC_ROUTER_DOMAIN=' .env | cut -d= -f2)} \
  ./scripts/k8s-install.sh minecraft

# 4. open the panel in the background + credentials
kubectl -n minecraft rollout status deployment/minecraft-panel --timeout=300s
pkill -f "port-forward svc/minecraft-panel" 2> /dev/null
sleep 1
nohup kubectl -n minecraft port-forward svc/minecraft-panel 3777:3777 > /tmp/mcpanel-forward.log 2>&1 &
sleep 3 && curl -s http://localhost:3777/api/auth/me
kubectl -n minecraft logs deploy/minecraft-panel | grep -i password
# -> http://localhost:3777 (user admin), or via ingress:
#    http://panel.<MC_ROUTER_DOMAIN>:9090 (any host that resolves <domain>)
```

Players connect to `<host-LAN-IP>:25565` with the hostname
`<server>.<MC_ROUTER_DOMAIN>` — with a `nip.io` domain (e.g.
`192.168.1.10.nip.io`) both the host resolution and the LAN IP come free,
no DNS setup needed. Verified end to end: `kind-config.yaml` forwards host
25565 to the router's fixed nodePort 30065, and a real status ping for
`smoke.<MC_ROUTER_DOMAIN>` returns the backend server's JSON.

Full uninstall (deletes servers, worlds, backups, panel, router):

```bash
pkill -f "port-forward svc/minecraft-panel" 2> /dev/null
./scripts/k8s-uninstall.sh minecraft --purge --yes
# optional: remove the whole cluster
# kind delete cluster --name kind-cluster
```

## Local clusters (kind)

kind runs the whole cluster inside a single docker/podman container. Three
things a fresh node can't do out of the box:

**1. Port mappings are fixed at cluster creation.** `kind-config.yaml` (repo
root) publishes the ports the outside world uses — players and browsers hit
the HOST, kind forwards into the node:

| Host port | Node port | Who listens there                       |
| --------- | --------- | --------------------------------------- |
| 25565     | 30065     | mc-router nodePort (fixed in the chart) |
| 9090      | 80        | Contour envoy hostPort (ingress HTTP)   |
| 9443      | 443       | Contour envoy hostPort (ingress HTTPS)  |

kind cannot add mappings to a running node — recreate the cluster after
editing the file. The router chart pins `service.nodePort: 30065` by default
so the mapping always lands on it.

**2. The node can't pull images (DNS).** The kind node resolves registry
hostnames through the container network's embedded DNS, and when that
resolver is broken every pull fails with
`lookup registry-1.docker.io ... connection refused` while pods sit in
`Pending`/`ImagePullBackOff`. Point the node at public DNS and refresh
CoreDNS (it snapshots the node resolver when its pods are created):

```bash
docker exec kind-cluster-control-plane sh -c \
  'printf "nameserver 8.8.8.8\nnameserver 1.1.1.1\n" > /etc/resolv.conf'
kubectl -n kube-system rollout restart deployment/coredns
```

The node fix doesn't survive a node restart — reapply it if you recreate the
cluster.

**3. Provider and image-name quirks on podman.** On hosts where
`docker` is an alias for podman (rootless), kind must be told explicitly:
`export KIND_EXPERIMENTAL_PROVIDER=podman` for `kind create` and
`kind load` (the docker-provider path fails inspecting the API-server port).
Loading a local image also normalizes the name
(`minecraft-panel:local` → `localhost/minecraft-panel:local` in the node), so
point `PANEL_IMAGE_REPO` at `localhost/minecraft-panel` or the pod tries to
pull from docker.io.

**4. The panel image isn't in any registry by default.** Build it and load it
into the cluster, then point the release at it:

```bash
docker build -f apps/web/Dockerfile --build-arg TARGETARCH=amd64 --network=host \
  -t minecraft-panel:local .
kind load docker-image minecraft-panel:local --name <cluster-name>

PANEL_IMAGE_REPO=minecraft-panel PANEL_IMAGE_TAG=local \
  ./scripts/k8s-install.sh minecraft
```

(`TARGETARCH` is auto-detected by modern docker; passing it explicitly keeps
the build portable across environments. The `web-panel` chart defaults to
`ghcr.io/d0whc3r/minecraft-servers/panel:latest`; use your own registry and
`--set image.repository/tag` if you publish the image instead.)

Also expect the **first server start** to be slow: the node pulls
`itzg/minecraft-server` (~1 GB) plus the modpack download on first boot.

## Shell + mc-tui over ssh

The panel image bundles the repo's TUI (`mc-tui`) and — when enabled — a
key-only sshd, so an ssh session into the panel container can manage the same
cluster from the terminal:

```yaml
# values for the minecraft-panel release
ssh:
  enabled: true
  port: 2222
  authorizedKeys:
    - ssh-ed25519 AAAA... operator@laptop
```

```bash
kubectl -n minecraft port-forward svc/minecraft-panel 2222:2222
ssh -p 2222 node@localhost # then run: mc-tui
```

Nothing is duplicated: the sshd has no passwords and no root login, and the
TUI inside the container runs with `MCPANEL_RUNTIME=kubernetes` — the same
switch the panel uses — so both UIs act on the same things:

- the same Helm releases (`mc-<server>`): start/stop/restart map to
  `helm upgrade --reuse-values --set replicaCount=…` and
  `kubectl rollout restart`, exactly the panel's action table; start-all /
  stop-all scale every existing release, and never-deployed packs must be
  started once from the panel (or with a single start) so a slip of the
  keyboard can't create twenty 8Gi releases at once;
- the same configuration sources: `/repo/.env` (the shared-env Secret) and
  `/repo/config/modpacks` (the synced ConfigMap) — the TUI reads them to list
  servers and builds chart values the same way the panel does for first
  starts, panel-created servers included;
- the same ServiceAccount RBAC: logs (`kubectl logs --follow`), RCON
  (`kubectl exec … rcon-cli`), and backups (the same one-off alpine Jobs the
  panel runs, from the same `/repo/scripts/k8s-jobs` scripts).

Host keys persist on the panel's data claim (`/data/mc-ssh`), so clients
don't get host-key warnings on pod restarts. Manage the keys by editing the
`ssh.authorizedKeys` values (or point `ssh.existingAuthorizedKeysSecret` at
your own Secret) and re-running the install.

## Migration notes (docker → kubernetes)

- The compose `minecraft-network` / labels become Service annotations; the
  router discovers them in-cluster (`IN_KUBE_CLUSTER`) instead of watching
  the Docker socket.
- Per-server loopback RCON ports (26565-26664) are unnecessary: each server
  has its own Service DNS name and the chart pins RCON to 25575 internally.
- The panel's bash actions are replaced by helm/kubectl; the repo scripts
  still work for any docker-based install of the same project.
