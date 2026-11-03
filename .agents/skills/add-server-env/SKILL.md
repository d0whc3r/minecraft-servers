---
name: add-server-env
description: Add a new Minecraft server environment to this repository. Create and validate the per-server profile file in config/modpacks/, set up its directories, and update the documentation. Use when the user asks to add, create, or register a new server, server profile, or server env. Research an unknown modpack release first with the minecraft-server-config skill.
---

# Add a server environment

Add one new server to this repository through its existing scripts and checks. Keep the work limited to the new server and its documentation. Follow `docs/ADDING_SERVER_ENV.md` step by step; it holds the full procedure.

## Scope and local context

- Read `docs/ADDING_SERVER_ENV.md`, `docs/ADDING_MODPACKS.md`, and one existing profile in `config/modpacks/` that matches the new server.
- Run `git status --short` before you edit so you do not touch unrelated changes.
- Gather the server name, the server type, the exact release, the Minecraft version, and the memory size before you write the profile file. Ask the user for a fact only when it changes the result.
- Use the `minecraft-server-config` skill when you must research an unknown modpack release first.
- Do not change other profiles, the shared `.env`, or a running server.

## Workflow

1. Choose a unique server name with lowercase letters, digits, and hyphens. The name becomes the file name `config/modpacks/<name>.env` and the value of `SERVER_NAME`.
2. Choose the server type and verify the exact release. Use `AUTO_CURSEFORGE` or `MODRINTH` for modpacks, `PAPER` or `VANILLA` for vanilla servers, and `FORGE` or `FABRIC` for hand-installed mods.
3. Create the profile file with `./scripts/add-modpack.sh <name>` when a built-in template fits, or copy `config/templates/modpack-template.env` and edit it. Set `TYPE`, `VERSION`, `MEMORY`, `SERVER_NAME`, and `RCON_PORT`. Set `CF_PAGE_URL` for CurseForge, or `MODRINTH_MODPACK` plus the exact `VERSION` for Modrinth. Add an explicit `JAVA_VERSION` image tag to every modded profile.
4. Create the directories `servers/<name>/data`, `servers/<name>/mods`, and `backups/<name>` when the script did not create them.
5. Run `./scripts/validate-config.sh <name>` and fix every error it reports.
6. Run `./scripts/start-server.sh <name>` when a first boot is in scope. Follow the logs with `docker logs -f mc-<name>` until they contain `Done!`. Stop the server with `./scripts/stop-server.sh <name>` after the test.
7. Run `./scripts/router.sh status` and confirm the route `<name>.<MC_ROUTER_DOMAIN>`.
8. Create the guide `docs/modpacks/<name>.md` from the template in `.agents/skills/minecraft-server-config/assets/modpack-guide-template.md`. Update the catalog in `docs/MODPACKS.md` and the index in `docs/README.md`.
9. Run `pnpm run lint` and `pnpm run test:quick`.

## Non-negotiable repository invariants

- Treat `.env` files as data. Never load them with `source` or `eval`, never print the private shared `.env`, and never expose secrets through complete `docker compose config` output.
- Keep `ENABLE_RCON=true` and obtain the RCON password from shared configuration.
- Do not add `SERVER_PORT` or publish a per-server game port. Compose keeps game traffic on port 25565 inside the container, publishes RCON on loopback, and mc-router routes `<name>.<MC_ROUTER_DOMAIN>`.
- Choose an unused `RCON_PORT` from 26565 through 26664 by checking all profiles.
- Pin the selected release and the exact Minecraft version. Every modded profile must set an explicit, verified `JAVA_VERSION`.
- Do not delete or replace worlds, change release, or remove content mods as an improvised fix.

## Handoff

Report the files you created, the validation output, and any manual step that remains. State whether a real first boot was performed. Do not expose credentials or other secret values.
