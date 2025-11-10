# CI/CD Pipeline Configuration

This document explains how to configure and use the CI/CD pipelines for the Minecraft Multi-Server System.

## GitHub Actions Workflows

### 1. Code Quality (`code-quality.yml`)

**Purpose:** Fast code quality validation without Docker.

**Triggers:**

- Push to `master` branch
- Pull requests to `master` branch
- Manual workflow dispatch

**What it does:**

- Runs `pnpm run lint` (Prettier code formatting check)
- No Docker required
- Fast execution (~30 seconds)

### 2. BATS Test Suite (`bats-tests.yml`)

**Purpose:** Comprehensive testing with real Minecraft server startup.

**Triggers:**

- Push to `master` branch
- Pull requests to `master` branch

**What it does:**

- Parallel test execution across multiple runners
- Real Docker containers with Minecraft servers
- Full server startup validation
- Environment variables automatically injected

## Environment Variables in CI

The BATS test suite automatically injects all variables from `.env.template`:

```bash
# Minecraft EULA (required)
EULA=TRUE

# Docker Configuration
NETWORK_NAME=minecraft-network
BASE_PORT=25565
COMPOSE_PROJECT_NAME=minecraft-servers

# CurseForge API (from GitHub secret)
CF_API_KEY=${{ secrets.CF_API_KEY }}

# RCON Configuration
ENABLE_RCON=true
RCON_PASSWORD=minecraft
RCON_PORT=25575
BROADCAST_RCON_TO_OPS=false

# Default Settings
TZ=UTC
ENABLE_ROLLING_LOGS=true
USE_AIKAR_FLAGS=true
ONLINE_MODE=false
ALLOW_FLIGHT=true
```

## Required GitHub Secrets

### CF_API_KEY

**Required for:** BATS test suite (CurseForge modpack downloads)

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

### Parallel Test Execution

The BATS test suite uses a matrix strategy to run tests in parallel:

- **Matrix Generation:** Automatically determines optimal chunk size based on modpack count
- **Chunking:** Divides modpacks into groups of 1-3 servers per runner
- **Parallel Execution:** Each chunk runs on a separate GitHub Actions runner
- **Result Aggregation:** All results are collected and summarized

### Test Output Visibility

The tests now provide enhanced output visibility:

- **Real-time Progress:** Server logs shown every 5 seconds during startup
- **Clear Status Indicators:** Emojis and formatted messages for easy reading
- **Detailed Error Reporting:** Full container logs on failures
- **Test Artifacts:** All logs saved for download and analysis

### Test Categories

1. **US1-TC001:** Script syntax validation (fast, no Docker)
2. **US1-TC002:** Configuration file validation
3. **US1-TC003:** Error handling for invalid inputs
4. **US1-TC004:** Script accessibility checks
5. **US1-TC005:** Dynamic modpack detection
6. **US1-TC006:** Modpack name extraction
7. **US1-TC007:** Full server startup and readiness (slow, requires Docker)

## Local Development vs CI

| Aspect          | Local Development     | CI Pipeline            |
| --------------- | --------------------- | ---------------------- |
| **Linting**     | `pnpm run lint`       | `code-quality.yml`     |
| **Quick Tests** | `pnpm run test:quick` | Pre-push hook          |
| **Full Tests**  | `pnpm run test`       | `bats-tests.yml`       |
| **Environment** | Local `.env` file     | Injected from template |
| **CF_API_KEY**  | Manual `.env` setup   | GitHub secret          |

## Troubleshooting

### Common Issues

#### "CF_API_KEY secret not found"

- Ensure the secret is named exactly `CF_API_KEY`
- Check that it's in the correct repository
- Verify the secret value is correct

#### "Container creation timeout"

- Check Docker resource limits in GitHub Actions
- Verify modpack configurations are valid
- Look at test artifacts for detailed logs

#### "Modpack download failures"

- Verify CF_API_KEY is valid and has proper permissions
- Check if CurseForge API is accessible
- Ensure modpack URLs in config files are correct

### Debug Mode

To enable debug output in tests:

```bash
# Local testing with debug
DEBUG=true pnpm run test

# Or set in environment
export DEBUG=true
pnpm run test
```

### Test Artifacts

Failed test runs upload artifacts containing:

- Container logs for each tested server
- Test execution logs
- Configuration files used
- Error details and stack traces

Download these from the GitHub Actions run page under "Artifacts".

## Performance Optimization

### Current Optimizations

- **Parallel Execution:** Tests run across multiple GitHub Actions runners
- **Docker Caching:** Base images cached between runs
- **Dependency Caching:** pnpm store cached
- **Smart Chunking:** Optimal distribution of modpacks per runner
- **Early Failure Detection:** Tests stop on critical errors

### Future Improvements

- **Test Result Caching:** Skip unchanged modpacks
- **Selective Testing:** Only test modified modpack configurations
- **Resource Pooling:** Reuse containers between tests
- **Network Optimization:** Local Docker registries for faster pulls
