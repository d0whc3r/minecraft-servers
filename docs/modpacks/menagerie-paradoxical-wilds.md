# MENAGERIE - Paradoxical Wilds

An exploration and creature modpack built around Marvelous Menagerie: Paradoxical.
This is a separate CurseForge project from the existing `menagerie` profile, with
its own world, container, and backups.

## Version and Configuration

- **Modpack**: [2.8.0, released July 16, 2026](https://www.curseforge.com/minecraft/modpacks/menagerie-paradoxical-wilds/files/8445852)
- **Minecraft**: 1.20.1
- **Loader**: Forge, automatically selected from the pack manifest
- **Java image**: `itzg/minecraft-server:java17`
- **Config**: [menagerie-paradoxical-wilds.env](../../config/modpacks/menagerie-paradoxical-wilds.env)
- **Starting RAM allocation**: 6G, adjustable with `MEMORY` (not an author-specified minimum)
- **Players**: 20 slots; normal survival, PvP enabled
- **Distances**: view 10 chunks, simulation 8 chunks
- **RCON**: `127.0.0.1:26593`, using credentials from the shared `.env`

`CF_PAGE_URL` points to the exact main pack file, so restarts retain version 2.8.0.
The [AUTO_CURSEFORGE installer](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/auto-curseforge/)
reads that file's manifest to install the loader and mods; its input must be the
main pack rather than the separate server ZIP.

## Start and Connect

Configure the shared `.env` as described in [Quick Start](../QUICKSTART.md),
including `EULA`, `CF_API_KEY`, `RCON_PASSWORD`, and `MC_ROUTER_DOMAIN`.

```bash
./scripts/validate-config.sh menagerie-paradoxical-wilds
./scripts/start-server.sh menagerie-paradoxical-wilds
docker logs -f mc-menagerie-paradoxical-wilds
```

The first start downloads and installs the pack. Wait for `Done!` in the logs.
Players need **Menagerie: Paradoxical Wilds 2.8.0** and connect through mc-router:

```text
menagerie-paradoxical-wilds.<MC_ROUTER_DOMAIN>
```

For example, with `MC_ROUTER_DOMAIN=192.168.1.10.nip.io`, use
`menagerie-paradoxical-wilds.192.168.1.10.nip.io`.

## Data and Updates

- World and installed files: `servers/menagerie-paradoxical-wilds/data/`
- Extra mods: `servers/menagerie-paradoxical-wilds/mods/`
- Backups: `backups/menagerie-paradoxical-wilds/`

Before changing the pinned release:

```bash
./scripts/backup.sh menagerie-paradoxical-wilds
./scripts/stop-server.sh menagerie-paradoxical-wilds
```

Update `CF_PAGE_URL` to the desired main pack file, verify its Minecraft and Java
requirements, then start the server again. Clients must use the same release.
