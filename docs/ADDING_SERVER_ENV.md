# Adding a Server Environment

This document explains the steps to add a new server environment to this repository. An AI agent can follow these steps in order. A server environment is one profile file in `config/modpacks/<name>.env`. The management scripts read this file to start and manage the server.

## Before You Start

Collect these facts before you edit any file:

- The server name.
- The server type: CurseForge, Modrinth, Paper, Forge, or Fabric.
- The exact modpack or plugin release.
- The Minecraft version of that release.
- The memory size for the server.
- A free RCON port between 26565 and 26664.

Read `docs/ADDING_MODPACKS.md` before you write anything. Open one existing profile in `config/modpacks/` that matches the new server. Run `git status --short` so you know which files already change. Use the `minecraft-server-config` skill when you must research an unknown modpack first.

## Step One: Choose the Server Name

The server name is the identifier of the server. Use only lowercase letters, digits, and hyphens. The name must be unique across all files in `config/modpacks/`. The name sets the file name `config/modpacks/<name>.env` and the value of `SERVER_NAME`. The name also builds the player route `<name>.<MC_ROUTER_DOMAIN>`. Keep the name short, under 20 characters.

## Step Two: Choose the Server Type

The server type decides how the scripts install the server. Pick the type that matches the source of the modpack or plugin.

| Type              | Use it when                                           |
| ----------------- | ----------------------------------------------------- |
| `AUTO_CURSEFORGE` | The modpack comes from CurseForge.                    |
| `MODRINTH`        | The modpack comes from Modrinth.                      |
| `PAPER`           | The server runs vanilla gameplay with plugins.        |
| `FORGE`           | The server runs Forge mods that you install by hand.  |
| `FABRIC`          | The server runs Fabric mods that you install by hand. |
| `VANILLA`         | The server runs plain Minecraft.                      |

Verify the exact release of the modpack or plugin before you continue. For Modrinth, check that the modpack supports the Minecraft version you plan to set. Run `curl -s "https://api.modrinth.com/v2/project/<slug>" | grep game_versions` to read the supported versions. For CurseForge, the scripts detect the Minecraft version from the pack page.

## Step Three: Create the Profile File

You have two paths to create the profile file. Use the quick path when a built-in template fits your server. Use the manual path when you need full control.

### Quick Path

Run `./scripts/add-modpack.sh <name>` to get a basic Paper profile. Run `./scripts/add-modpack.sh <name> --modpack=<template>` to use a built-in template. Add `--rcon-port=<port>` to choose the RCON port. Add `--memory=<size>` to choose the memory size. Run `./scripts/add-modpack.sh --help` to see all templates.

The script assigns a free RCON port when you do not pass one. The script also creates the directories from Step Four. Edit the file after the script runs. Add `JAVA_VERSION` for a modded server and add `TAGS` for the web panel.

### Manual Path

Copy the documented template with `cp config/templates/modpack-template.env config/modpacks/<name>.env`. Replace every `{{PLACEHOLDER}}` value and delete the placeholders you do not need. Change `RCON_PORT` from the example value `26600` to a free port. List the used ports with `grep RCON_PORT config/modpacks/*.env`.

### Required Variables

Every profile file needs these variables:

| Variable      | Value                                    |
| ------------- | ---------------------------------------- |
| `TYPE`        | The server type from Step Two.           |
| `VERSION`     | The exact Minecraft version.             |
| `MEMORY`      | The memory size, for example `6G`.       |
| `SERVER_NAME` | The server name, equal to the file name. |
| `RCON_PORT`   | A free port between 26565 and 26664.     |

Set these extra variables for the type you chose:

| Type               | Extra variables                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `AUTO_CURSEFORGE`  | `CF_PAGE_URL` with the full CurseForge modpack URL.                                         |
| `MODRINTH`         | `MODRINTH_MODPACK` with the project slug, and `VERSION` set to the exact Minecraft version. |
| `FORGE`, `FABRIC`  | `VERSION` set to the version your mods need.                                                |
| `PAPER`, `VANILLA` | `VERSION` set to the Paper or Minecraft version.                                            |

Keep `ENABLE_RCON=true` in the profile file. The RCON password comes from the shared `.env` file. Add `JAVA_VERSION` to every modded profile. The value is an image tag such as `java17`, `java21`, or `java25`. Choose the tag whose Java major runs the modpack. Add `TAGS` with lowercase comma-separated tags so the web panel can filter the server.

The scripts, the web panel, and the TUI discover the new profile from the file. You do not register the server anywhere else.

## Step Four: Create the Directories

The server needs three directories. Create them with `mkdir -p servers/<name>/data servers/<name>/mods backups/<name>`. The `data` directory holds the world and the server files. The `mods` directory holds mod jars for Forge and Fabric servers. The `backups/<name>` directory holds the backups of the server. The quick path and `start-server.sh` create these directories for you.

## Step Five: Validate the Configuration

Run `./scripts/validate-config.sh <name>` from the repository root. The script checks the server name, the required variables, the memory format, the RCON port, and the port conflicts. Fix every error the script reports. The script exits with code 3 when it finds errors and with code 4 when it finds only warnings.

## Step Six: Start the Server for a First Test

A first boot proves that the profile file works. Run `./scripts/start-server.sh <name>` and follow the logs with `docker logs -f mc-<name>`. The first boot downloads the whole modpack and can take 5 to 10 minutes. Wait until the logs contain `Done! For help, type "help"`. Stop the server with `./scripts/stop-server.sh <name>` when the test is over.

## Step Seven: Check the Player Route

Players reach every server through the mc-router proxy. Run `./scripts/router.sh status` to see the route table. The route of the new server is `<name>.<MC_ROUTER_DOMAIN>`. The value of `MC_ROUTER_DOMAIN` comes from the shared `.env` file.

## Step Eight: Write the Documentation

Each server has one guide in `docs/modpacks/<name>.md`. Copy the guide template from `.agents/skills/minecraft-server-config/assets/modpack-guide-template.md` to `docs/modpacks/<name>.md`. Replace every placeholder and remove the sections that do not apply. Add the server to the catalog in `docs/MODPACKS.md`. Add the guide to the index in `docs/README.md`.

## Step Nine: Run the Lint and the Tests

Run `pnpm run lint` to check the formatting of every file. Run `pnpm run test:quick` to run the configuration tests. Fix any failure before you hand the work back.

## Rules That Always Apply

- Treat every `.env` file as data. Never run `source` or `eval` on a `.env` file. Never print the shared `.env` file or any secret value from it.
- Keep `ENABLE_RCON=true`. The RCON password comes from the shared `.env` file.
- Do not add `SERVER_PORT` or publish a game port. Compose keeps game traffic on port 25565 inside the container. mc-router routes players by hostname.
- Use a unique `RCON_PORT` for every server.
- Pin the exact release and the exact Minecraft version. Do not use `latest` to make a compatibility decision.
- Set an explicit `JAVA_VERSION` for every modded server.
- Do not change other profiles, the shared `.env`, or a running server while you add one server.
- Do not add worlds, JAR files, or backups to version control.

## Final Checklist

- [ ] The profile file exists in `config/modpacks/<name>.env`.
- [ ] `SERVER_NAME` matches the file name and is unique.
- [ ] `RCON_PORT` is unique and lies between 26565 and 26664.
- [ ] `TYPE` is correct and the extra variables for the type are set.
- [ ] `VERSION` matches the modpack exactly.
- [ ] `MEMORY` is enough for the modpack.
- [ ] `JAVA_VERSION` is explicit for modded servers.
- [ ] The directories exist under `servers/` and `backups/`.
- [ ] `validate-config.sh` passes with no errors.
- [ ] The first boot reached `Done!` when a boot was performed.
- [ ] The route appears in `router.sh status`.
- [ ] The guide, the catalog, and the docs index are updated.
- [ ] `pnpm run lint` and `pnpm run test:quick` pass.

## Related Files

- The `add-server-env` skill holds this procedure for AI agents: `.agents/skills/add-server-env/SKILL.md`.
- The `add-server-env` agent runs this task end to end: `.opencode/agents/add-server-env.md`.
- `docs/ADDING_MODPACKS.md` explains templates, port management, and troubleshooting.
- `docs/ENVIRONMENT_VARIABLES.md` lists every variable you can set.
- `docs/BACKUP_RESTORE.md` explains how to protect the new server.
