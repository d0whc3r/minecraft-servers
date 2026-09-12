# Research and installation decisions

Use this reference when resolving a mod or modpack URL into an exact server-compatible release and
installation mechanism.

## Resolve the requirements

Verify every material fact from current primary sources. Do not infer requirements from a title,
category, search result, or another pack's profile.

| Fact | What to verify |
| --- | --- |
| Identity | Modpack, standalone mod, or plugin; provider, slug, and ID; Java Edition or Bedrock. |
| Release | Version name, file or version ID, publication date, and channel. A URL for a specific file selects that release even when a newer one exists. |
| Minecraft | The exact Minecraft version required by the selected release, separate from the pack version. |
| Loader | Forge, Fabric, NeoForge, Quilt, Paper, or another platform; declared loader version; compatibility of included mods. |
| JVM | Java supported by the specific Minecraft and loader combination; available `itzg/minecraft-server` image tag; architecture when relevant. |
| Server side | Dedicated-server support, client-only mods, mandatory dependencies, and whether players must install the mod or pack. |
| Installation | Manifest, server pack, overrides, configs, preparation scripts, manual downloads, terms, and required credentials. |
| Resources | Author guidance when available; otherwise a clearly labeled initial estimate that does not promise a player capacity. |
| World | Included world or datapacks, generation preset, and author-required preparation. |

When page content is incomplete, inspect the official release metadata or manifest. Read archive
entries before extraction and reject absolute paths or traversal outside the temporary destination.

- CurseForge `manifest.json` commonly provides `minecraft.version`, `minecraft.modLoaders`, project
  and file IDs, and the overrides directory.
- A Modrinth version object and `modrinth.index.json` expose Minecraft and loader dependencies,
  files, hashes, and client/server environment requirements.
- For a standalone mod, resolve only mandatory dependencies for the same Minecraft version and
  loader. Do not add optional dependencies by default.
- Minecraft's Java requirement is only a starting point: old loaders can require a different JVM.
  Verify the exact combination and do not use `latest` in place of that check.

If a required fact cannot be verified, identify the missing fact precisely and do not describe the
configuration as ready to start.

## Select the installation mode

Check the current [itzg installation documentation](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/)
before selecting variables. Image support and repository validation support are distinct.

### CurseForge modpacks

Use `TYPE=AUTO_CURSEFORGE`. Prefer `CF_PAGE_URL` pointing at the main file page for the selected
release. This mode requires the main pack manifest, not the server-pack ZIP, and derives the loader
from that manifest. If using `CF_SLUG` plus `CF_FILE_ID`, verify how they interact with `CF_PAGE_URL`,
which the local validator requires. Consult the current
[Auto CurseForge documentation](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/auto-curseforge/).

### Modrinth modpacks

Use `TYPE=MODRINTH`, `MODRINTH_MODPACK`, and `MODRINTH_VERSION` with the selected release identifier.
Set `VERSION` to the exact Minecraft version and verify how the current installer filters client
files and resolves the loader.

### Standalone mods

Use the required loader and a documented mechanism that installs the mod and mandatory dependencies
reproducibly. Prefer configuration-declared downloads over untracked JAR copies. Inspect local
support before introducing new variables.

### Manual server packs and other platforms

Verify the archive format, expected mounts, loader, preparation steps, and corresponding itzg mode.
Manual `TYPE=CURSEFORGE` and `AUTO_CURSEFORGE` are different paths; a ZIP URL alone is insufficient.

The local validator may reject types that the image supports, including `NEOFORGE`, `QUILT`, or
manual `CURSEFORGE`. When the required path is unsupported, either update the affected validators
and consumers narrowly with appropriate tests or report the exact limitation. Never lie about
`TYPE` to pass validation.

Base exclusions and blocked-download workarounds on author documentation, metadata, or a
reproducible error. Do not copy exclusions from another pack or silently omit required files. For a
manual download, document its source and destination and verify that the destination is mounted in
the container.
