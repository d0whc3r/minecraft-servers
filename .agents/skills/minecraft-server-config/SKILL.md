---
name: minecraft-server-config
description: Create or update a Minecraft Java server profile in this repository from a mod or modpack URL. Verify the exact release, loader, Java version, dependencies, and dedicated-server requirements before generating and validating the configuration. Use for CurseForge, Modrinth, or official project links; not for mod development or client-only setup.
---

# Configure a Minecraft server from a URL

Deliver the files needed to start the requested server through this repository's existing
mechanisms. Research the specific project instead of treating a generic variable list as a
compatible configuration. Respond in the user's language, but keep repository content consistent
with the language and conventions of the files being edited.

## Scope and local context

- Read applicable repository instructions, `git status --short`, `docs/ADDING_MODPACKS.md`,
  `docker-compose.yml`, and one or two comparable profiles in `config/modpacks/`. Consult
  `scripts/common.sh`, `scripts/start-server.sh`, and `scripts/validate-config.sh` when behavior is
  unclear; old template comments may be stale.
- Search existing profiles by URL, slug, and provider ID. Similar names do not imply the same
  project. Update an existing profile only when that is the intended target; otherwise create an
  independent one.
- A request for a configuration authorizes creating, documenting, and validating it. Starting the
  server, downloading the full installation, or migrating a world requires that work to be in
  scope. Do not change unrelated profiles, shared credentials, or running servers.
- Preserve the user's version, resource, gameplay, and access choices. If no release is specified,
  select and pin the newest stable release that supports a dedicated server. Ask for a missing
  client or world version only when it materially determines compatibility, while continuing work
  that does not depend on it.

## Workflow

1. Establish the project's identity, exact release, Minecraft version, loader and loader version,
   supported JVM, server-side compatibility, required dependencies, installation mechanism,
   resource guidance, and world-generation requirements.
2. Use current primary sources: the author's project and release pages, server-pack instructions,
   loader documentation, and the documentation for `itzg/minecraft-server`. Record concrete source
   links and the verification date in the modpack guide.
3. Inspect official release metadata or manifests when the page is insufficient. Download only the
   minimum evidence to a temporary directory, inspect archives without executing their scripts,
   and validate archive paths before extraction.
4. Select the installation mode supported by both `itzg/minecraft-server` and this repository. Do
   not falsify `TYPE`, invent IDs or versions, substitute Paper for a mod loader, or present a
   result as runnable while a required fact remains unverified.
5. Create or update the profile and its guide, then update the documentation indexes and counts
   derived from the current repository files.
6. Run static validation and the relevant tests. Start the server and follow first boot only when
   requested; static validation alone does not prove that a modpack starts.

Read [research and installation](references/research-and-installation.md) while resolving release,
loader, JVM, dependencies, provider metadata, or the installation mode.

Read [profile and documentation](references/profile-and-documentation.md) before editing the
profile or documentation.

Read [validation and delivery](references/validation-and-delivery.md) before validating, starting,
or handing off the server.

## Non-negotiable repository invariants

- This repository hosts Minecraft Java Edition servers. A client-only mod does not justify a
  fabricated server profile.
- `SERVER_NAME` must match `config/modpacks/<slug>.env`; use lowercase letters, digits, and hyphens.
- Pin the selected release and exact Minecraft version. `JAVA_VERSION` selects an image tag such as
  `java17`, not a loader version or bare Java number.
- Choose an unused `RCON_PORT` from 26565 through 26664 by checking all profiles. Keep
  `ENABLE_RCON=true` and obtain the password from shared configuration.
- Do not add `SERVER_PORT` or publish a per-server game port. Compose keeps game traffic on port
  25565 inside the container, publishes RCON on loopback, and mc-router routes
  `<slug>.<MC_ROUTER_DOMAIN>`.
- Treat `.env` files as data: never load them with `source` or `eval`, never print the private shared
  `.env`, and never expose secrets through complete `docker compose config` output.
- Do not execute a downloaded installer or server-pack script merely to discover its requirements.
- Do not delete or replace worlds, change release, or remove content mods as an improvised fix.
