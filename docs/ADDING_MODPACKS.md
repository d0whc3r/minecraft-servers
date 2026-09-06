# Adding Modpacks

Guide for adding new Minecraft server configurations, whether from the built-in
templates or completely custom (CurseForge, Modrinth, Forge, Fabric, Paper).

Two paths:

- **Quick**: `add-modpack.sh` with a built-in template — generates a working config in one command
- **Manual**: create the `.env` yourself — full control, needed for modpacks not covered by templates

## Quick Path: Templates

```bash
# Add a server from a template (port auto-assigned)
./scripts/add-modpack.sh my-atm8 --modpack=atm8

# With a specific port and memory
./scripts/add-modpack.sh sf4-creative --modpack=skyfactory4 --rcon-port=26600

# Then customize and start
nano config/modpacks/my-atm8.env
./scripts/start-server.sh my-atm8
```

### Command Syntax

```text
./scripts/add-modpack.sh <server-name> [options]

Required:
  <server-name>    Unique identifier (lowercase letters, numbers, hyphens)

Options:
  --modpack=<name> Use a built-in template (see table below)
  --rcon-port=<n>  Specific loopback admin port (26565-26664; auto-assigned if omitted)
  --memory=<size>  RAM allocation (e.g. 4G, 8G, 2048M)
```

### Built-in Templates

| Template         | Description                 | Type            | Version | Memory |
| ---------------- | --------------------------- | --------------- | ------- | ------ |
| `atm8`           | All The Mods 8              | AUTO_CURSEFORGE | 1.20.1  | 8G     |
| `atm10sky`       | All The Mods 10: To the Sky | AUTO_CURSEFORGE | 1.21.1  | 8G     |
| `bmc4`           | Better MC BMC4              | AUTO_CURSEFORGE | 1.20.1  | 6G     |
| `cursed-walking` | Cursed Walking              | AUTO_CURSEFORGE | 1.20.1  | 8G     |
| `deceasedcraft`  | DeceasedCraft               | AUTO_CURSEFORGE | 1.20.1  | 6G     |
| `pixelmon`       | The Pixelmon Modpack        | MODRINTH        | 1.21.1  | 6G     |
| `prominence2`    | Prominence II RPG           | AUTO_CURSEFORGE | 1.20.1  | 6G     |
| `rlcraft`        | RLCraft                     | AUTO_CURSEFORGE | 1.12.2  | 6G     |
| `skyfactory4`    | SkyFactory 4                | AUTO_CURSEFORGE | 1.12.2  | 4G     |
| `vanilla`        | Vanilla Optimized           | PAPER           | 26.2    | 2G     |

> The script's templates are independent from the 28 pre-configured servers already in
> `config/modpacks/`. The pre-configured servers are started directly with
> `./scripts/start-server.sh <name>` — no need to "add" them first.

## Manual Path: Step by Step

### Step 1: Create the Configuration File

```bash
# Copy the documented base template
cp config/templates/modpack-template.env config/modpacks/your-modpack.env
nano config/modpacks/your-modpack.env
```

### Step 2: Configure the Required Variables

```bash
# Server type (see Step 3)
TYPE=AUTO_CURSEFORGE

# Minecraft version — MUST match the modpack exactly (critical for MODRINTH)
VERSION=1.20.1

# RAM allocation (2G-16G depending on the modpack)
MEMORY=4G

# Identifier name (lowercase, no spaces) — also builds the player-facing
# route <SERVER_NAME>.<MC_ROUTER_DOMAIN> via mc-router
SERVER_NAME=your-modpack

# The only per-server port: the loopback admin console (unique per server,
# managed range 26565-26664). Game traffic has no port — players connect via
# <SERVER_NAME>.<MC_ROUTER_DOMAIN> through mc-router
RCON_PORT=26600
```

### Step 3: Configure According to Modpack Type

#### CurseForge

```bash
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/modpack-name
# VERSION is auto-detected for AUTO_CURSEFORGE; set it only to pin
# Pin an exact release with CF_SLUG + CF_FILE_ID (see plants-vs-zombies.env for an example)
```

Requires `CF_API_KEY` in the shared `.env`.

#### Modrinth

```bash
TYPE=MODRINTH
MODRINTH_MODPACK=cobbleverse # project slug, ID or URL
VERSION=1.21.1               # CRITICAL: must match the modpack's Minecraft version
# MODRINTH_VERSION=1.0.0            # optional: pin a specific modpack release
```

**The `VERSION` is mandatory for Modrinth** — without the exact Minecraft version the
server installs the wrong MC and fails to load the modpack. Find it with:

```bash
curl -s "https://api.modrinth.com/v2/project/<slug>" | grep game_versions
```

#### Forge / Fabric (manual mods)

```bash
TYPE=FORGE     # or FABRIC
VERSION=1.19.2 # match your mods
```

Then place the mod jars in the server's mods dir (create it first):

```bash
mkdir -p servers/your-modpack/mods
cp path/to/mods/*.jar servers/your-modpack/mods/
```

#### Paper (vanilla + plugins)

```bash
TYPE=PAPER
VERSION=1.20.4
```

Plugins go in `servers/your-modpack/data/plugins/` (created after first start).

### Step 4: Create the Directories

```bash
mkdir -p servers/your-modpack/data servers/your-modpack/mods backups/your-modpack
```

### Step 5: Validate and Test

```bash
# Validate the configuration
./scripts/validate-config.sh your-modpack

# Start and watch the first boot (modpack download takes 5-10 min)
./scripts/start-server.sh your-modpack
docker logs -f mc-your-modpack

# Verify, then stop if you were just testing
docker ps | grep mc-your-modpack
./scripts/stop-server.sh your-modpack
```

### Final Checklist

- [ ] `.env` created in `config/modpacks/`
- [ ] `SERVER_NAME` unique and valid (lowercase, hyphens, no spaces)
- [ ] `RCON_PORT` unique (managed range 26565-26664; loopback admin only)
- [ ] Route live in `./scripts/router.sh status` (`<name>.<MC_ROUTER_DOMAIN>`)
- [ ] `TYPE` correct for the modpack
- [ ] `VERSION` matches the modpack (mandatory and exact for MODRINTH)
- [ ] `MEMORY` sufficient for the modpack
- [ ] `CF_API_KEY` set in shared `.env` (CurseForge only)
- [ ] Directories created (`servers/`, `backups/`)
- [ ] `validate-config.sh` passes and the server reaches `Done!` in the logs

## Customization Reference

### Common Gameplay Options

```bash
MAX_PLAYERS=20
DIFFICULTY=normal # peaceful | easy | normal | hard
MODE=survival     # survival | creative | adventure | spectator
PVP=true
MOTD="Welcome to My Server"
VIEW_DISTANCE=10 # 8-12 recommended for modded
SIMULATION_DISTANCE=10
```

### Memory Recommendations

| Modpack type       | Memory | Notes                                     |
| ------------------ | ------ | ----------------------------------------- |
| Vanilla / Paper    | 2-4G   | Basic gameplay                            |
| Light modded       | 4-6G   | Few mods                                  |
| Medium modded      | 6-8G   | Most modpacks                             |
| Heavy (ATM series) | 8-12G  | Complex automation                        |
| RLCraft / 1.12.2   | 6G     | Needs Java 8 image (`JAVA_VERSION=java8`) |

Enable optimized JVM flags for 4G+:

```bash
USE_AIKAR_FLAGS=true
```

Full variable reference: [Environment Variables](ENVIRONMENT_VARIABLES.md).

## Port Management

```bash
# Check which RCON ports are taken
grep RCON_PORT config/modpacks/*.env

# Auto-assign (first free in 26565-26664)
./scripts/add-modpack.sh new-server

# Or choose the loopback admin port explicitly
./scripts/add-modpack.sh new-server --rcon-port=26600
```

The managed range 26565-26664 allows up to 100 servers. Duplicate `RCON_PORT`
values make the second container fail to publish its loopback port — game
traffic never conflicts because mc-router routes it by hostname.

## Validation & Error Handling

### Server Name

- Format `^[a-z0-9-]+$`, unique, 3-32 characters recommended

```bash
./scripts/add-modpack.sh MyServer      # ❌ uppercase
./scripts/add-modpack.sh server_name   # ❌ underscore
./scripts/add-modpack.sh server@domain # ❌ special chars
```

### Memory

Format `<number>G` or `<number>M`: `4G` ✅, `4096M` ✅, `4GB` ❌.

## Troubleshooting

### "Server already exists"

```bash
ls config/modpacks/                     # check existing names
./scripts/add-modpack.sh different-name # pick another
```

### "Port already in use"

```bash
grep RCON_PORT config/modpacks/*.env # find the conflict
RCON_PORT=26600                      # pick another port in the .env
```

### Modpack won't download

```bash
# Verify the CurseForge URL is reachable
curl -I "https://www.curseforge.com/minecraft/modpacks/your-modpack"

# Verify the Modrinth slug and its supported versions
curl -s "https://api.modrinth.com/v2/project/your-modpack" | grep game_versions

# Check container logs for the concrete error
docker logs mc-your-modpack
```

Also confirm `CF_API_KEY` is set in `.env` for CurseForge packs.

### Permission errors

```bash
sudo chown -R $USER:$USER .
chmod +x scripts/*.sh
```

More: [Troubleshooting](TROUBLESHOOTING.md).

## Advanced Usage

### Bulk Creation

```bash
for i in {1..3}; do
  ./scripts/add-modpack.sh "atm8-test-$i" --modpack=atm8
done
```

### Custom Templates

Add your own entries to the `TEMPLATES` map in `scripts/add-modpack.sh`:

```bash
TEMPLATES["my-template"]="My Modpack,AUTO_CURSEFORGE,1.20.1,6G,https://www.curseforge.com/link,My Server"
```

### Removing a Server

```bash
# Stop and remove container + data (keeps config and backups)
./scripts/stop-server.sh <name> --purge

# Or fully manual (CAUTION: irreversible)
docker stop mc-<name>
rm config/modpacks/<name>.env
rm -rf servers/<name> backups/<name>
```

## Best Practices

- **Naming**: descriptive and consistent (`atm8-creative`, `vanilla-survival`), under 20 chars
- **Resources**: start with modest memory, watch `docker stats`, increase as needed
- **Backups**: configure a cron job after adding the server, and test a restore before going live
- **Security**: strong `RCON_PASSWORD` in `.env`, limit file access, keep Docker/modpacks updated

## Related Documentation

- [Quick Start](QUICKSTART.md) — getting started
- [Environment Variables](ENVIRONMENT_VARIABLES.md) — full configuration reference
- [Backup & Restore](BACKUP_RESTORE.md) — protecting your new server
- [Architecture](ARCHITECTURE.md) — how instantiation works internally
