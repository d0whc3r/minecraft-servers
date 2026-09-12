# DeceasedCraft Server

DeceasedCraft is a Forge modpack for Minecraft Java Edition focused on urban
exploration, zombie hordes, firearms, vehicles, quests, and technical progression.

## Pinned Release

| Item                 | Value                                         |
| -------------------- | --------------------------------------------- |
| Modpack release      | `DeceasedCraft_Beta-5.10.17`                  |
| CurseForge project   | `deceasedcraft` (project 490660)              |
| Main file            | 8448820, release channel, uploaded 2026-07-17 |
| Matching server pack | 8448977                                       |
| Minecraft            | 1.20.1                                        |
| Loader               | Forge 47.4.0                                  |
| Java image           | `itzg/minecraft-server:java17`                |
| Memory               | 10G                                           |

The profile deliberately pins the regular main file, not the optional alpha DH
Edition. The main archive's manifest was inspected on 2026-09-12 and declares
Minecraft 1.20.1, Forge 47.4.0, and the standard CurseForge `overrides` layout.
Although its internal version field still says `5.10.16`, CurseForge publishes the
archive itself as release `5.10.17`.

Version 5.10.x is an open beta. The author warns that its endgame is incomplete and
that beta worlds are not guaranteed to remain compatible with the eventual 6.0
release. The older 5.5.5 branch is the complete 1.18.2 experience; this repository
uses the newest stable file because no older client or world was requested.

## Requirements and Local Choices

- The author specifies 8GB as the minimum server allocation and 10GB or more as
  recommended. This profile starts at 10G; adjust `MEMORY`, `INIT_MEMORY`, and
  `MAX_MEMORY` together if the host requires another limit.
- Java 17 is required. The image tag is pinned because newer Java runtimes are not
  a safe substitute for this Forge 1.20.1 pack.
- Command blocks are enabled because the author says multiblocks and vehicle spawns
  depend on them.
- Nether access is disabled to follow the pack's intended dimension setup. The pack
  also states that it does not include the End.
- `ONLINE_MODE=false`, hard difficulty, PvP, and a 20-player limit follow the local
  repository's existing gameplay/access convention; they are not author requirements.
- Players must install the same `DeceasedCraft_Beta-5.10.17` client pack with a
  proper CurseForge-compatible launcher. The server pack is not a client pack.

## Installation

The server uses `TYPE=AUTO_CURSEFORGE`. It selects the main modpack archive rather
than the 552.7MB server ZIP because the automated installer needs `manifest.json` to
resolve the exact loader and mods. A matching official server pack does exist, but
no manual extraction is required for this profile.

Oculus and Colorwheel are explicitly excluded from the dedicated server. Both are
client-side rendering/shader mods and Colorwheel requires Oculus; leaving Colorwheel
without Oculus can fail during dedicated-server mod loading.

```dotenv
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/deceasedcraft/files/8448820
CF_SLUG=deceasedcraft
CF_FILE_ID=8448820
CF_EXCLUDE_MODS="oculus,colorwheel"
VERSION=1.20.1
JAVA_VERSION=java17
MEMORY=10G
ENABLE_COMMAND_BLOCK=true
ALLOW_NETHER=false
```

The Java 17 image currently includes a CurseForge API key. A private key can still
be provided as `CF_API_KEY` in the repository's shared `.env` if the bundled key is
rate-limited or unavailable. Do not put a key in the modpack profile.

## Start and Connect

```bash
./scripts/validate-config.sh deceasedcraft
./scripts/start-server.sh deceasedcraft
docker logs -f mc-deceasedcraft
```

Wait until the log contains `Done!`. The first installation downloads the full pack
and can take substantially longer than a normal restart.

Players connect through mc-router at:

```text
deceasedcraft.<MC_ROUTER_DOMAIN>
```

For example, with the repository's nip.io setup the hostname can look like
`deceasedcraft.192.168.1.10.nip.io`. RCON is available only on the host loopback at
port 26583.

## Operations

```bash
./scripts/stop-server.sh deceasedcraft
./scripts/restart-server.sh deceasedcraft
./scripts/backup.sh deceasedcraft
./scripts/router.sh status
docker logs mc-deceasedcraft
```

If a newly generated world does not start in a medium or large Suburb Residential
District, the author recommends generating another world because progression may be
affected. Back up an existing world before replacing or regenerating it.

## Sources

Checked on 2026-09-12:

- [DeceasedCraft project and author requirements](https://www.curseforge.com/minecraft/modpacks/deceasedcraft)
- [Pinned DeceasedCraft 5.10.17 main file](https://www.curseforge.com/minecraft/modpacks/deceasedcraft/files/8448820)
- [Matching 5.10.17 server pack](https://www.curseforge.com/minecraft/modpacks/deceasedcraft/files/8448977)
- [DeceasedCraft server guide](https://deceasedcraft.wiki.gg/wiki/Getting_Started_With_a_Server)
- [itzg Auto CurseForge documentation](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/auto-curseforge/)
- [Oculus project (client environment)](https://www.curseforge.com/minecraft/mc-mods/oculus)
- [Colorwheel project (client environment)](https://www.curseforge.com/minecraft/mc-mods/colorwheel)
