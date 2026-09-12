# Profile and documentation

Use this reference when writing the server profile and repository documentation.

## Server profile

Create `config/modpacks/<slug>.env` with concrete values and comments that explain non-obvious
choices.

- Set `SERVER_NAME=<slug>` to the filename stem using lowercase letters, digits, and hyphens.
- Include `TYPE`, `VERSION`, `JAVA_VERSION`, `MEMORY`, the pinned release selector, and settings
  specific to the pack. The local validator requires an explicit `VERSION=` even when Auto
  CurseForge can detect Minecraft. For a modded server, `JAVA_VERSION` must be an image tag whose
  Java major was verified for the exact pack, Minecraft version, and loader combination.
- Select an unused `RCON_PORT` from 26565 through 26664 after checking every profile. Use existing
  helpers when appropriate. Set `ENABLE_RCON=true`; the password comes from shared configuration.
- Do not add `SERVER_PORT` or publish a game port for an individual server. Compose fixes the
  container port at 25565, exposes RCON only on loopback, and mc-router routes by hostname.
- Preserve current access and gameplay choices. Do not change `ONLINE_MODE`, whitelist behavior, or
  flight restrictions on an existing profile without a concrete reason.
- Keep memory easy to adjust. If `INIT_MEMORY` or `MAX_MEMORY` is present, make sure it does not
  contradict or obscure `MEMORY`.
- Set `TAGS=<comma-separated lowercase tags>` so the panel can categorize servers without a guide
  (panel-created servers have no doc file to read tags from).
- Add world-generation, command, JVM, or performance settings only when supported by the pack or by
  an explicit configuration decision.

Profile discovery is dynamic: adding a `.env` normally does not require Compose, TUI, or web-panel
registration. Do not treat another pack's `add-modpack.sh` template as evidence for this project.

## Guide and indexes

For a new guide, copy [the modpack guide template](../assets/modpack-guide-template.md) to
`docs/modpacks/<slug>.md`, replace every placeholder, and remove instructional comments and sections
that do not apply. Adapt an existing guide in place instead of overwriting it with the template.

The completed guide must include:

- a `**Tags**:` line with lowercase comma-separated gameplay/theme tags (the web panel reads it for
  search and tag filters); end metadata hard breaks with two trailing spaces, never a trailing
  backslash — the panel parses these lines raw and a `\` would surface as a tag;
- the selected pack, Minecraft, loader, and Java versions;
- concrete source links and the date they were checked;
- chosen resources and any special installation steps;
- client installation requirements;
- the connection hostname; and
- the repository's real validation, start, log, stop, and backup commands;
- whether a real first boot was performed; and
- any remaining manual step or unresolved fact.

Clearly distinguish author requirements, local choices, and unverified details. Do not add an
unverified mod list, progression guide, or hardware recommendation.

Update `docs/MODPACKS.md` and the index in `docs/README.md`. Derive catalog counts and related totals
from current repository files instead of copying old numbers.

Prepare `servers/<slug>/data`, `servers/<slug>/mods`, and `backups/<slug>` only when useful for the
requested work; `start-server.sh` also creates them. Do not add worlds, JARs, or backups to version
control.
