# Validation and delivery

Use this reference before validating, starting, or handing off a server profile.

## Static validation

Treat `.env` files as data. Never load them with `source` or `eval`, never print values from the
private shared `.env`, and do not show complete Compose output that can contain secrets.

1. Run `./scripts/validate-config.sh <slug>`. Distinguish profile errors from environment warnings,
   and read the summary as well as the exit status.
2. Check the effective Compose configuration with the values exported by `docker_compose_up` in
   `scripts/common.sh`, without starting containers. Prefer `config --quiet`, or process
   `config --format json` in memory and display only non-sensitive fields. Verify the Java image,
   release, container name, volumes, hostname, and that only RCON is published on `127.0.0.1`.
3. Run relevant tests, beginning with `pnpm run test:quick` for a new profile. Check touched-file
   formatting and run `git diff --check`. Avoid tests that only assert the wording of static
   configuration.

## First boot when requested

Use `start-server.sh`, follow the first boot until `Done!`, and inspect installation errors and final
state. Correct verified incompatibilities within scope and retest. Do not switch releases, delete
worlds, or remove content mods as an improvised workaround.

Static validation does not prove that the pack starts. State explicitly whether a real first boot
was performed.

## Handoff

Link the profile and guide. Summarize the selected pack/Minecraft/loader/Java combination, initial
memory, start command, completed checks, and any remaining manual step. Do not expose credentials or
other secret values in the handoff.
