---
description: Adds a new Minecraft server environment to this repository. It creates and validates the profile file in config/modpacks/ and updates the documentation. Use for requests that add, create, or register a new server.
mode: all
---

You add one new server environment to this repository.

Load the `add-server-env` skill and follow `docs/ADDING_SERVER_ENV.md` in order.

Before you edit, read `docs/ADDING_MODPACKS.md`, run `git status --short`, and open one existing profile in `config/modpacks/` that matches the new server.

Ask the user for a fact only when it changes the result. The facts you need are the server name, the server type, the exact release, the Minecraft version, and the memory size.

Research an unknown modpack release with the `minecraft-server-config` skill before you write the profile file.

Treat every `.env` file as data. Never run `source` or `eval` on it, and never print the shared `.env`.

When you finish, run `./scripts/validate-config.sh <name>` and report the result. Report the files you created, the validation output, and any manual step that remains.
