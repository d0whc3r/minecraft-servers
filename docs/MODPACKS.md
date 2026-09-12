# Pre-Configured Modpacks

Every server below is ready to start — no compose edits, no downloads to
chase. Start any of them with:

```bash
./scripts/start-server.sh <server-name>
```

Each server gets its own world, config, and backups under `servers/<name>/`
and `backups/<name>/`. CurseForge modpacks need `CF_API_KEY` in `.env` (free
at [console.curseforge.com](https://console.curseforge.com/)); Modrinth and
Paper servers work without it.

## Catalog

| Server Name                   | Modpack                                                                 | MC Version | Memory | Platform   |
| ----------------------------- | ----------------------------------------------------------------------- | ---------- | ------ | ---------- |
| `all-the-mods-10`             | All The Mods 10                                                         | 1.21.1     | 8G     | CurseForge |
| `all-the-mods-10-sky`         | All The Mods 10: To the Sky                                             | 1.21.1     | 8G     | CurseForge |
| `all-the-mods-11`             | All The Mods 11                                                         | 26.1.2     | 8G     | CurseForge |
| `amazing-fps-booster`         | Amazing FPS Booster                                                     | 1.20.6     | 2G     | CurseForge |
| `better-mc-bmc4`              | Better MC [FORGE] BMC4                                                  | 1.20.1     | 6G     | CurseForge |
| `better-mc-bmc5`              | Better MC [NEOFORGE] BMC5                                               | 1.21.1     | 8G     | CurseForge |
| `cobblemon`                   | Cobblemon Official [Fabric]                                             | 1.21.1     | 6G     | Modrinth   |
| `cobbleverse`                 | Cobbleverse                                                             | 1.21.1     | 6G     | Modrinth   |
| `cursed-walking`              | Cursed Walking                                                          | 1.20.1     | 8G     | CurseForge |
| `dawncraft`                   | DawnCraft: Echoes of Legends                                            | 1.18.2     | 8G     | CurseForge |
| `deceasedcraft`               | [DeceasedCraft](modpacks/deceasedcraft.md)                              | 1.20.1     | 10G    | CurseForge |
| `homestead`                   | Homestead                                                               | 1.20.1     | 6G     | CurseForge |
| `menagerie`                   | Menagerie                                                               | 1.20.1     | 6G     | CurseForge |
| `menagerie-paradoxical-wilds` | [Menagerie: Paradoxical Wilds](modpacks/menagerie-paradoxical-wilds.md) | 1.20.1     | 6G     | CurseForge |
| `my-hero-adventure`           | My Hero Adventure                                                       | 1.16.5     | 4G     | CurseForge |
| `pixelmon`                    | The Pixelmon Modpack                                                    | 1.21.1     | 6G     | Modrinth   |
| `plants-vs-zombies`           | Plants vs. Zombies+                                                     | 26.1.2     | 4G     | CurseForge |
| `prominence-2`                | Prominence II: Hasturian Era                                            | 1.20.1     | 6G     | Modrinth   |
| `rlcraft`                     | RLCraft                                                                 | 1.12.2     | 6G     | CurseForge |
| `skyfactory4`                 | [SkyFactory 4](modpacks/skyfactory4.md)                                 | 1.12.2     | 6G     | CurseForge |
| `slimes-adventure`            | Slimes Adventure                                                        | 1.21.1     | 4G     | Modrinth   |
| `solocraft-modpack`           | SoloCraft                                                               | 1.20.1     | 3G     | Modrinth   |
| `solo-leveling-level-up`      | Solo Leveling: Level Up                                                 | 1.20.1     | 4G     | CurseForge |
| `solo-leveling-reawakening`   | Solo Leveling: Reawakening                                              | 1.21.1     | 4G     | CurseForge |
| `solo-leveling-shadows`       | Solo Leveling: Shadows                                                  | 1.20.1     | 6G     | CurseForge |
| `stoneblock4`                 | FTB StoneBlock 4                                                        | 1.21.1     | 8G     | CurseForge |
| `unofficial-dragon-block-c`   | Unofficial Dragon Block C                                               | 1.7.10     | 4G     | CurseForge |
| `vanilla`                     | Vanilla (Paper)                                                         | 26.2       | 2G     | Paper      |
| `zombie-invade-100-days`      | Zombie Invade 100 Days                                                  | 1.20.1     | 6G     | Modrinth   |

> [!TIP]
> Running **all** servers at once needs ~169GB of RAM. Start with the ones you
> actually play, and use `./scripts/list-servers.sh` to see what's running.

## First Start Notes

- **First start downloads the whole modpack** — give CurseForge/Modrinth
  servers 5–10 minutes and watch `docker logs -f mc-<name>` until you see
  `Done! For help, type "help"`.
- `vanilla` (Paper) is light and needs no API key — the best first test.
- Memory is per server and configurable: `MEMORY=` in
  `config/modpacks/<name>.env` (see
  [Environment Variables](ENVIRONMENT_VARIABLES.md)).

## Per-Modpack Guides

One page per modpack with requirements, gameplay notes, and tuning tips:
[docs/modpacks/](modpacks/).

Don't see your modpack? Add it —
[Adding Modpacks](ADDING_MODPACKS.md) covers the script and the manual way.
