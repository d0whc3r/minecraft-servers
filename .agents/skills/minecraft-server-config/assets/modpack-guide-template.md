<!--
Replace every placeholder, then remove this comment and any section that does not apply.
Keep factual claims tied to the selected release, not merely to the project in general.
-->

# [PACK NAME] Server

**Tags**: [lowercase comma-separated gameplay/theme tags, e.g. `skyblock, tech, quests` — the web
panel uses them for search and filtering]

## Overview

[One short paragraph identifying the exact pack release and explaining what kind of server this is.]

## Verified Versions

| Component | Selection |
| --- | --- |
| Pack release | `[PACK RELEASE]` (`[PROVIDER FILE OR VERSION ID]`) |
| Minecraft | `[MINECRAFT VERSION]` |
| Loader | `[LOADER] [LOADER VERSION]` |
| Java | `[JAVA MAJOR]` via `JAVA_VERSION=[ITZG IMAGE TAG]` |
| Installation | `[TYPE AND PINNING VARIABLES]` |
| Memory | `[MEMORY]` |
| Profile | `config/modpacks/[SLUG].env` |

## Sources

Verified on `[YYYY-MM-DD]`:

- [Selected release](RELEASE_URL) — [facts established from this source].
- [Pack or server instructions](AUTHOR_URL) — [facts established from this source].
- [Loader compatibility](LOADER_URL) — [facts established from this source].
- [Java image tags](ITZG_JAVA_TAG_URL) — [tag and architecture established from this source].

[State which requirements are author-declared, which choices are repository-local, and which facts
were derived. Remove any source row that is not needed, but retain enough evidence for the version,
loader, Java, and installation decisions.]

## Quick Start

```bash
./scripts/validate-config.sh [SLUG]
./scripts/start-server.sh [SLUG]
docker logs -f mc-[SLUG]
```

The first boot is complete when the logs contain `Done! For help, type "help"`.

## Client Requirements

[State whether clients need the same pack or mod, the exact client release, and any manual client
steps. If clients do not need extra content, say so.]

## Connection

Players connect to `[SLUG].<MC_ROUTER_DOMAIN>`. Replace `<MC_ROUTER_DOMAIN>` with the value from the
shared repository configuration.

## Configuration Decisions

- **Release pin:** [Explain how the provider release is pinned.]
- **Java:** [Explain why this Java major is compatible with the exact Minecraft and loader versions.]
- **Memory:** [Distinguish author guidance from a local initial estimate.]
- **World generation:** [Document required presets, bundled worlds, or say that none were found.]
- **Manual steps:** [List required steps, or say `None`.]

## First-Boot Verification

**Status:** [Not performed / Passed on YYYY-MM-DD / Failed — see details below]

[If performed, record the observed Java major, Minecraft version, loader version, and successful
`Done!` state. If not performed, state clearly that only static validation was completed.]

## Server Management

```bash
# Start
./scripts/start-server.sh [SLUG]

# Follow logs
docker logs -f mc-[SLUG]

# Stop
./scripts/stop-server.sh [SLUG]

# Back up
./scripts/backup.sh [SLUG]
```

## Troubleshooting

[Include only pack-specific, evidence-based issues or manual requirements. Link the relevant source
or reproducible error. Remove this section when there is nothing specific to add.]
