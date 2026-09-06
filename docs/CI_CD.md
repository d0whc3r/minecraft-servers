# CI/CD Pipeline Configuration

This document explains how the CI/CD pipelines for the Minecraft Multi-Server
System work and how to configure them.

## Pipeline Configuration

### Configuration File (`.github/workflows/config`)

All pipeline settings are centralized in `.github/workflows/config` - the
single source of truth for CI/CD configuration. Every workflow loads it through
`scripts/ci/load-config.sh` and falls back to inline defaults when the file is
missing.

**Key Settings:**

```bash
# E2E test execution settings (e2e-tests.yml)
TEST_TIMEOUT_MINUTES=45 # bats timeout per matrix chunk, in minutes
PARALLEL_JOBS=1         # parallel bats jobs inside a chunk

# Docker settings (e2e-tests.yml)
DOCKER_VERSION=28.5.2

# Dependency versions (all workflows)
NODE_VERSION=22
```

**How to Modify:**

1. Edit `.github/workflows/config`
2. Commit and push changes
3. All workflows will automatically use new values

### CI Helper Scripts (`scripts/ci/`)

The workflow YAML files stay thin: the actual logic lives in versioned shell
scripts under `scripts/ci/` (validated by the BATS suite like any other
script).

| Script                     | Purpose                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `load-config.sh`           | Parse `.github/workflows/config` into `$GITHUB_OUTPUT`         |
| `generate-test-matrix.sh`  | Build the E2E job matrix (chunks of modpacks + Java versions)  |
| `pull-minecraft-images.sh` | Pre-pull the `itzg/minecraft-server` tags a chunk needs        |
| `generate-summary.sh`      | Write the run summary to `$GITHUB_STEP_SUMMARY`                |
| `create-test-env.sh`       | Create the `.env` docker compose consumes during tests         |
| `filter-modpacks.sh`       | Select the modpacks one E2E runner will test (`TEST_MODPACKS`) |

## GitHub Actions Workflows

### 1. Code Quality (`code-quality.yml`)

**Purpose:** Fast code quality validation without Docker.

**Triggers:** push to `master`, pull requests to `master`, manual dispatch.

**What it does:**

- Runs `pnpm run lint` (Prettier code formatting check)
- Fast execution (~1 minute)

### 2. BATS Tests (`bats-tests.yml`)

**Purpose:** Fast validation of scripts, modpack configs and compose files.
Runs on every push/PR so regressions are caught before merge.

**Triggers:** push to `master`, pull requests to `master`, manual dispatch.

**What it does:**

- Runs `tests/bats/config-validation.bats` (`US1-TC001`–`TC006`, `TC008`–`TC010`):
  script syntax, config invariants (TYPE/MEMORY/VERSION/RCON_PORT/SERVER_NAME),
  argument validation, server detection, compose rendering and `common.sh`
  API checks
- No Minecraft containers are started and no images are downloaded (the only
  Docker usage renders the compose files with the CLI)
- Single job, ~2 minutes

### 3. E2E BATS Tests (`e2e-tests.yml`)

**Purpose:** Full end-to-end validation: every modpack is started for real and
must reach `Done!` in its logs.

**Triggers:** manual dispatch only (`workflow_dispatch`) — each runner downloads
modpacks and boots containers, which consumes hours of CI time across the
matrix.

**What it does:**

- `prepare-matrix`: chunks the modpacks (2 per runner) and computes the Java
  versions each chunk needs (`scripts/ci/generate-test-matrix.sh`)
- `test`: per chunk — setup deps/docker, create `.env`, filter modpacks,
  pre-pull the required images, run `tests/bats/server-startup.bats`
  (`US1-TC007`), upload logs as artifacts
- `summarize`: collects artifacts and publishes a run summary
  (`scripts/ci/generate-summary.sh`)

## Environment Variables in CI

The E2E workflow defines its test environment in the job's `env` block
(`.github/workflows/e2e-tests.yml`); `scripts/ci/create-test-env.sh` turns it
into the `.env` docker compose reads:

```bash
EULA=TRUE
MC_ROUTER_DOMAIN=mc.local
CF_API_KEY=${{ secrets.CF_API_KEY }} # from GitHub secrets
ENABLE_RCON=true
RCON_PASSWORD=minecraft
RCON_PORT=25575
BROADCAST_RCON_TO_OPS=false
TZ=UTC
ENABLE_ROLLING_LOGS=true
USE_AIKAR_FLAGS=true
ONLINE_MODE=false
ALLOW_FLIGHT=true
```

If you add a variable to `.env.example` that tests depend on, mirror it in the
workflow's `env` block **and** in `scripts/ci/create-test-env.sh`.

## Required GitHub Secrets

### CF_API_KEY

**Required for:** E2E test suite (CurseForge modpack downloads)

**How to set it:**

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. **Name:** `CF_API_KEY`
5. **Value:** Your CurseForge API key
6. Click **Add secret**

**How to get a CurseForge API key:**

1. Visit [console.curseforge.com](https://console.curseforge.com/)
2. Sign in with your CurseForge account
3. Navigate to **API Keys**
4. Generate a new API key
5. Copy the key value

## Test Execution Details

### Test Categories

1. **US1-TC001:** Script syntax validation (fast, no Docker)
2. **US1-TC002:** Configuration file validation (fast, no Docker)
3. **US1-TC003:** Error handling for invalid inputs (fast, no Docker)
4. **US1-TC004:** Script accessibility checks (fast, no Docker)
5. **US1-TC005:** Dynamic modpack detection (fast, no Docker)
6. **US1-TC006:** Modpack name extraction (fast, no Docker)
7. **US1-TC007:** Full server startup and readiness (slow, Docker, manual E2E)
8. **US1-TC008:** Compose files render router-only wiring (fast)
9. **US1-TC009:** `router.sh` argument validation (fast, no Docker)
10. **US1-TC010:** `common.sh` cross-script API completeness (fast, no Docker)

### Test Output Visibility

- **Real-time progress:** server logs shown every 5 seconds during E2E startup
- **Detailed error reporting:** full container logs on failures
- **Test artifacts:** E2E logs uploaded per chunk and linked in the run summary

## Local Development vs CI

| Aspect          | Local Development     | CI Pipeline                      |
| --------------- | --------------------- | -------------------------------- |
| **Linting**     | `pnpm run lint`       | `code-quality.yml`               |
| **Quick Tests** | `pnpm run test:quick` | `bats-tests.yml` + pre-push hook |
| **Full Tests**  | `pnpm run test`       | `e2e-tests.yml` (manual)         |
| **Environment** | Local `.env` file     | Workflow `env` block             |
| **CF_API_KEY**  | Manual `.env` setup   | GitHub secret                    |

## Troubleshooting

### Common Issues

#### "CF_API_KEY secret not found"

- Ensure the secret is named exactly `CF_API_KEY`
- Check that it's in the correct repository
- Verify the secret value is correct

#### "Container creation timeout" (E2E)

- Check Docker resource limits in GitHub Actions
- Verify modpack configurations are valid
- Look at test artifacts for detailed logs

#### "Modpack download failures" (E2E)

- Verify CF_API_KEY is valid and has proper permissions
- Check if CurseForge API is accessible
- Ensure modpack URLs in config files are correct

### Test Artifacts

Failed E2E runs upload artifacts containing:

- Container logs for each tested server
- Test execution logs
- Configuration files used

Download these from the GitHub Actions run page under "Artifacts".

## Cost Notes

The heavy part of testing is starting real servers (modpack downloads + boot
time). To keep CI minutes low:

- The fast suite (`bats-tests.yml`) gates every push/PR in ~2 minutes
- The E2E suite is manual-only and chunks modpacks 2 per runner with
  `max-parallel: 2`
- No cross-run caching of Docker images or server data: pulls are explicit
  (`scripts/ci/pull-minecraft-images.sh`) and every E2E run starts from a
  clean data directory, which avoids stale-world false positives
