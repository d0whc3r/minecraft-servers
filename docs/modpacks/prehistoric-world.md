# Prehistoric World Server

**Tags**: dinosaurs, adventure, exploration, building

## Overview

Prehistoric World is a Forge adventure modpack centered on fossils, dinosaur
revival, prehistoric plants, exploration, and building a dinosaur park. This
profile pins the latest stable Modrinth release available when checked:
Prehistoric World 49.4.0 for Minecraft 1.20.1.

## Verified Versions

| Component    | Selection                                                |
| ------------ | -------------------------------------------------------- |
| Pack release | `49.4.0` (`7TUCziQD`)                                    |
| Minecraft    | `1.20.1`                                                 |
| Loader       | Forge `47.4.20`                                          |
| Java         | Java 17 via `JAVA_VERSION=java17`                        |
| Installation | `TYPE=MODRINTH`, pinned with `MODRINTH_VERSION=7TUCziQD` |
| Memory       | 8GB; the author recommends at least 7GB for a server     |
| Profile      | `config/modpacks/prehistoric-world.env`                  |

## Sources

Verified on September 12, 2026:

- [Official Modrinth project](https://modrinth.com/modpack/prehistoric-world-modpack) — Minecraft
  1.20.1, Forge, client-and-server support, memory guidance, and the limitations of the Modrinth
  edition.
- [Prehistoric World 49.4.0](https://modrinth.com/modpack/prehistoric-world-modpack/version/7TUCziQD)
  and [release metadata](https://api.modrinth.com/v2/version/7TUCziQD) — immutable version ID,
  release channel, publication date, and `.mrpack` checksum.
- [Forge 1.20.1 downloads](https://files.minecraftforge.net/net/minecraftforge/forge/index_1.20.1.html)
  — confirms that the manifest's Forge 47.4.20 release exists.
- [Forge 1.20.1 prerequisites](https://docs.minecraftforge.net/en/1.20.1/gettingstarted/) — Forge
  officially supports a 64-bit Java 17 JVM for this generation.
- [itzg Modrinth installation](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/modrinth-modpacks/)
  and [Java image tags](https://docker-minecraft-server.readthedocs.io/en/latest/versions/java/) —
  configuration variables, version pinning, client-file filtering, and the `java17` image tag.

The selected `.mrpack` was also inspected directly. Its SHA-512 checksum matched the Modrinth API;
it declares Minecraft 1.20.1 and Forge 47.4.20, contains 265 indexed files plus 37 bundled mod JARs,
and has no unsafe archive paths.

## Quick Start

```bash
./scripts/validate-config.sh prehistoric-world
./scripts/start-server.sh prehistoric-world
docker logs -f mc-prehistoric-world
```

The first boot is complete when the logs contain `Done! For help, type "help"`.

## Client Requirements

Every player must install Prehistoric World 49.4.0 for Minecraft 1.20.1 from Modrinth. The project
and release both require the pack on the client and server; another release may contain a different
mod set and is not guaranteed to connect.

The Modrinth edition is not the complete CurseForge experience. The author says some content and
optimization mods cannot be distributed on Modrinth, FTB Quests itself is omitted even though quest
data is present, and no Modrinth server pack is available. This profile intentionally installs the
linked Modrinth edition rather than silently mixing files from the CurseForge release.

## Connection

Players connect to `prehistoric-world.<MC_ROUTER_DOMAIN>` through mc-router. Replace
`<MC_ROUTER_DOMAIN>` with the value from the shared repository configuration.

## Configuration Decisions

- **Release pin:** `MODRINTH_VERSION=7TUCziQD` selects release 49.4.0 rather than tracking future
  uploads.
- **Loader:** the `.mrpack` pins Forge 47.4.20; the Modrinth installer installs that declared loader.
- **Java:** Java 17 follows the official Forge 1.20.1 requirement and maps to the supported
  `itzg/minecraft-server:java17` image for this host's `amd64` architecture.
- **Memory:** 8GB is the first whole-GiB allocation above the author's 7GB server minimum. It is a
  starting point, not a tested player-capacity claim.
- **World generation:** the archive contains no bundled world, `server.properties`, or custom world
  preset. The included content mods alter generation while `LEVEL_TYPE=minecraft:default` remains
  appropriate.
- **Manual steps:** none are required for the base Modrinth edition. Adding FTB Quests would be a
  separate, optional compatibility change and is not part of this profile.

## First-Boot Verification

**Status:** Not performed.

Static profile, manifest, checksum, Java-tag, and Compose validation were completed. A real first
boot is still required to prove that this release reaches `Done!` on a dedicated server. The
manifest marks all indexed files as required on the server even though it contains client-facing
content; the itzg image applies its maintained default client-mod exclusions, but only a real boot
can expose further upstream packaging mistakes.

## Server Management

```bash
# Start
./scripts/start-server.sh prehistoric-world

# Follow logs
docker logs -f mc-prehistoric-world

# Stop
./scripts/stop-server.sh prehistoric-world

# Back up
./scripts/backup.sh prehistoric-world
```

## Troubleshooting

### Quests are missing

This is expected in the Modrinth edition. The author includes quest data but cannot distribute FTB
Quests there. Use the CurseForge edition for the author's complete experience; do not add a random
FTB Quests build without verifying its Minecraft, Forge, and dependency compatibility.

### The server stops while loading a client-facing mod

Inspect `docker logs mc-prehistoric-world` for the exact mod and error. The container already uses
itzg's maintained default Modrinth exclusions. Add a local exclusion only when the log or upstream
metadata identifies a specific incompatible file; do not remove gameplay mods speculatively.

### Installation fails before Forge starts

Confirm that Modrinth version `7TUCziQD` is still accessible and inspect the download error in the
container logs. The profile intentionally does not use a server-pack URL because the author does
not publish server packs on Modrinth.
