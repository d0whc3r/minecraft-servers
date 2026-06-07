# common.ps1 - Common functions and utilities for Minecraft server management scripts
#
# PowerShell port of common.sh (Windows-native).
#
# Usage: . "$PSScriptRoot\common.ps1"
#
# Notes:
#   - Dot-source this file; it defines functions and color variables in the
#     caller's scope and anchors the working directory to the project root so
#     that the same relative paths used by the bash scripts (config/modpacks,
#     servers/, backups/) resolve correctly regardless of where the caller ran.
#   - User-facing messages use Write-Host (information stream) so that scripts
#     producing machine-readable output (JSON, value lists) can be piped cleanly
#     while still showing progress.

Set-StrictMode -Version Latest

# Anchor to project root (parent of the scripts/ directory)
$script:ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $script:ProjectRoot

# ============================================================================
# COLOR CODES (ANSI - rendered by Windows Terminal / PowerShell 7 / Win10+ console)
# ============================================================================

$ESC = [char]27
$RED = "$ESC[0;31m"
$GREEN = "$ESC[0;32m"
$YELLOW = "$ESC[1;33m"
$BLUE = "$ESC[0;34m"
$CYAN = "$ESC[0;36m"
$NC = "$ESC[0m" # No Color

# ============================================================================
# OUTPUT FUNCTIONS
# ============================================================================

# Print error message
function Write-Err {
  param([string]$Message)
  Write-Host "${RED}ERROR: $Message${NC}"
}

# Print success message
function Write-Success {
  param([string]$Message)
  Write-Host "${GREEN}$([char]0x2713) $Message${NC}"
}

# Print info message
function Write-Info {
  param([string]$Message = '')
  Write-Host $Message
}

# Print warning message
function Write-Warn {
  param([string]$Message)
  Write-Host "${YELLOW}WARNING: $Message${NC}"
}

# Print debug message (only if $env:DEBUG = 'true')
function Write-DebugMsg {
  param([string]$Message)
  if ($env:DEBUG -eq 'true') {
    Write-Host "${CYAN}DEBUG: $Message${NC}"
  }
}

# ============================================================================
# VALIDATION FUNCTIONS
# ============================================================================

# Validate server name format. Returns $true if valid.
function Test-ServerName {
  param([string]$ServerName)

  if ($ServerName -notmatch '^[a-z0-9-]+$') {
    Write-Err "Invalid server name format: $ServerName"
    Write-Info 'Server names must contain only lowercase letters, numbers, and hyphens'
    return $false
  }

  return $true
}

# Check if server configuration exists. Returns $true if it does.
function Test-ConfigExists {
  param([string]$ServerName)

  $configFile = "config/modpacks/$ServerName.env"

  if (-not (Test-Path -LiteralPath $configFile -PathType Leaf)) {
    Write-Err "Configuration not found: $configFile"
    Write-Info ''
    Write-Info 'Available servers:'
    foreach ($s in (Get-AvailableServers)) { Write-Info "  - $s" }
    return $false
  }

  return $true
}

# Check if Docker daemon is running. Returns $true if running.
function Test-DockerRunning {
  docker info *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Err 'Docker daemon is not running'
    Write-Info 'Please start Docker and try again'
    return $false
  }
  return $true
}

# Check if a container exists (any state). Returns $true if it exists.
function Test-ContainerExists {
  param([string]$ContainerName)
  $names = docker ps -a --format '{{.Names}}' 2> $null
  return ($names -contains $ContainerName)
}

# Check if a container is running. Returns $true if running.
function Test-ContainerRunning {
  param([string]$ContainerName)
  $names = docker ps --format '{{.Names}}' 2> $null
  return ($names -contains $ContainerName)
}

# ============================================================================
# CONFIRMATION FUNCTIONS
# ============================================================================

# Ask user for confirmation. Returns $true if confirmed.
function Confirm-Action {
  param([string]$Prompt)
  $response = Read-Host "$Prompt (yes/no)"
  return ($response -match '^[Yy][Ee]?[Ss]?$')
}

# ============================================================================
# SERVER INFORMATION FUNCTIONS
# ============================================================================

# List available servers (from config files). Returns an array of names.
function Get-AvailableServers {
  if (Test-Path -LiteralPath 'config/modpacks' -PathType Container) {
    Get-ChildItem -LiteralPath 'config/modpacks' -Filter '*.env' -File |
      ForEach-Object { $_.BaseName }
  }
}

# List running servers (mc-* containers, without the mc- prefix).
function Get-RunningServers {
  $names = docker ps --filter 'name=mc-' --format '{{.Names}}' 2> $null
  foreach ($n in $names) {
    if ($n) { $n -replace '^mc-', '' }
  }
}

# Get container name from server name.
function Get-ContainerName {
  param([string]$ServerName)
  return "mc-$ServerName"
}

# Get config file path from server name.
function Get-ConfigFile {
  param([string]$ServerName)
  return "config/modpacks/$ServerName.env"
}

# Get data directory from server name.
function Get-DataDir {
  param([string]$ServerName)
  return "servers/$ServerName/data"
}

# Get backup directory from server name.
function Get-BackupDir {
  param([string]$ServerName)
  return "backups/$ServerName"
}

# Read a single KEY=value entry from a .env-style config file.
# Mirrors: grep "^KEY=" file | cut -d= -f2 | tr -d ' "'
function Get-ConfigValue {
  param(
    [string]$ConfigFile,
    [string]$Key
  )
  if (-not (Test-Path -LiteralPath $ConfigFile -PathType Leaf)) { return '' }

  $line = Select-String -LiteralPath $ConfigFile -Pattern "^$([regex]::Escape($Key))=" |
    Select-Object -First 1
  if (-not $line) { return '' }

  $value = ($line.Line -split '=', 2)[1]
  if ($null -eq $value) { return '' }
  return ($value -replace '[ "]', '').Trim()
}

# Get human-readable uptime for a running container.
# (Implemented natively; the original bash referenced an undefined function.)
function Get-ContainerUptime {
  param([string]$ContainerName)

  $startedAt = docker inspect --format '{{.State.StartedAt}}' $ContainerName 2> $null
  if ($LASTEXITCODE -ne 0 -or -not $startedAt) { return 'unknown' }

  try {
    $start = [datetimeoffset]::Parse($startedAt)
  } catch {
    return 'unknown'
  }

  $span = [datetimeoffset]::UtcNow - $start.ToUniversalTime()
  if ($span.TotalDays -ge 1) {
    return ('{0}d{1}h' -f [int]$span.TotalDays, $span.Hours)
  } elseif ($span.TotalHours -ge 1) {
    return ('{0}h{1}m' -f [int]$span.TotalHours, $span.Minutes)
  } elseif ($span.TotalMinutes -ge 1) {
    return ('{0}m' -f [int]$span.TotalMinutes)
  } else {
    return ('{0}s' -f [int]$span.TotalSeconds)
  }
}

# ============================================================================
# DOCKER COMPOSE HELPERS
# ============================================================================

# Set the dynamic environment variables docker-compose.yml substitutes.
function Set-ComposeEnvironment {
  param([string]$ServerName)

  $configFile = Get-ConfigFile $ServerName

  # SERVER_PORT for the port mapping in docker-compose.yml
  $env:SERVER_PORT = Get-ConfigValue $configFile 'SERVER_PORT'

  # JAVA_VERSION for image selection (${JAVA_VERSION:-latest})
  $env:JAVA_VERSION = Get-ConfigValue $configFile 'JAVA_VERSION'

  $root = (Get-Location).Path
  $env:CONTAINER_NAME = "mc-$ServerName"
  $env:SERVER_DATA_DIR = Join-Path $root "servers/$ServerName/data"
  $env:SERVER_MODS_DIR = Join-Path $root "servers/$ServerName/mods"
  $env:SERVER_BACKUP_DIR = Join-Path $root "backups/$ServerName"
  $env:SERVER_CONFIG_FILE = $configFile
}

# Start server using docker compose. Returns $true on success.
function Invoke-DockerComposeUp {
  param([string]$ServerName)

  Set-ComposeEnvironment $ServerName

  Write-DebugMsg "Starting server with docker compose -p mc-$ServerName"
  Write-DebugMsg "Port mapping: $($env:SERVER_PORT):25565"
  docker compose -p "mc-$ServerName" up -d 2>&1 | Out-Host
  return ($LASTEXITCODE -eq 0)
}

# Stop server using docker compose. Returns $true on success.
function Invoke-DockerComposeDown {
  param([string]$ServerName)

  Write-DebugMsg "Stopping server with docker compose -p mc-$ServerName down"
  docker compose -p "mc-$ServerName" down -v 2>&1 | Out-Host
  return ($LASTEXITCODE -eq 0)
}

# Restart server using docker compose. Returns $true on success.
function Invoke-DockerComposeRestart {
  param([string]$ServerName)

  Set-ComposeEnvironment $ServerName

  Write-DebugMsg "Restarting server with docker compose -p mc-$ServerName restart"
  docker compose -p "mc-$ServerName" restart 2>&1 | Out-Host
  return ($LASTEXITCODE -eq 0)
}

# Run a sibling script (e.g. start-server.ps1) as a child process.
# Done as a separate process so the child's `exit` does not terminate the
# caller (this mirrors bash invoking ./scripts/<name>.sh as a subprocess).
# Returns the child's exit code.
function Invoke-SiblingScript {
  param(
    [Parameter(Mandatory)][string]$ScriptName,
    [string[]]$Arguments = @(),
    [switch]$Quiet
  )
  $exe = (Get-Process -Id $PID).Path
  $scriptPath = Join-Path $PSScriptRoot $ScriptName
  $allArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $scriptPath) + $Arguments
  if ($Quiet) {
    & $exe @allArgs *> $null
  } else {
    & $exe @allArgs
  }
  return $LASTEXITCODE
}

# ============================================================================
# PRUNE / FILESYSTEM OPERATIONS
# ============================================================================

# Prune server runtime data (data only, preserves config and backups).
# Always returns $true (missing directory is not an error).
function Remove-ServerData {
  param([string]$ServerName)

  $dataDir = Get-DataDir $ServerName
  Write-DebugMsg "Pruning server data for: $ServerName"

  if (Test-Path -LiteralPath $dataDir -PathType Container) {
    [void](Remove-DirectorySafe $dataDir)
    Write-DebugMsg "Removed data directory: $dataDir"
  }

  return $true
}

# Ensure a directory exists.
function New-DirectoryIfMissing {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
    Write-DebugMsg "Creating directory: $Path"
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

# Remove a directory recursively. Returns $true on success.
function Remove-DirectorySafe {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
    Write-Warn "Directory does not exist: $Path"
    return $false
  }

  Write-DebugMsg "Removing directory: $Path"
  Remove-Item -LiteralPath $Path -Recurse -Force
  return $true
}

# Remove a file. Returns $true on success.
function Remove-FileSafe {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    Write-Warn "File does not exist: $Path"
    return $false
  }

  Write-DebugMsg "Removing file: $Path"
  Remove-Item -LiteralPath $Path -Force
  return $true
}

# ============================================================================
# NETWORK HELPERS
# ============================================================================

# Ensure the Docker network exists.
function Initialize-Network {
  param([string]$NetworkName = 'minecraft-network')

  docker network inspect $NetworkName *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-DebugMsg "Creating Docker network: $NetworkName"
    docker network create $NetworkName *> $null
  }
}

# Get server port from config. Returns the port or 'unknown'.
function Get-ServerPort {
  param([string]$ServerName)
  $configFile = Get-ConfigFile $ServerName
  if (Test-Path -LiteralPath $configFile -PathType Leaf) {
    $port = Get-ConfigValue $configFile 'SERVER_PORT'
    if ($port) { return $port }
  }
  return 'unknown'
}

# Check for port conflicts across all server configs. Returns $true if NO conflicts.
function Test-PortConflicts {
  $seen = @{}
  $hasConflict = $false

  foreach ($configFile in (Get-ChildItem -LiteralPath 'config/modpacks' -Filter '*.env' -File -ErrorAction SilentlyContinue)) {
    $serverName = $configFile.BaseName
    $port = Get-ConfigValue $configFile.FullName 'SERVER_PORT'

    if (-not $port) {
      Write-Warn "Server $serverName has no SERVER_PORT defined"
      $hasConflict = $true
      continue
    }

    if ($seen.ContainsKey($port)) {
      Write-Err "Port conflict detected: $port used by both $($seen[$port]) and $serverName"
      $hasConflict = $true
    } else {
      $seen[$port] = $serverName
    }
  }

  return (-not $hasConflict)
}

# Find the next available port in range 25565-25664. Returns the port number, or $null.
function Find-AvailablePort {
  $usedPorts = @{}
  foreach ($configFile in (Get-ChildItem -LiteralPath 'config/modpacks' -Filter '*.env' -File -ErrorAction SilentlyContinue)) {
    $port = Get-ConfigValue $configFile.FullName 'SERVER_PORT'
    if ($port) { $usedPorts[$port] = $true }
  }

  for ($port = 25565; $port -le 25664; $port++) {
    if (-not $usedPorts.ContainsKey("$port")) {
      return $port
    }
  }

  Write-Err 'No available ports in range 25565-25664'
  return $null
}

# Check if a TCP port is open/listening on localhost. Returns $true if open.
function Test-PortOpen {
  param([int]$Port)

  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $async = $client.BeginConnect('localhost', $Port, $null, $null)
    $connected = $async.AsyncWaitHandle.WaitOne(5000, $false)
    if ($connected -and $client.Connected) {
      $client.EndConnect($async)
      return $true
    }
    return $false
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

# ============================================================================
# INITIALIZATION
# ============================================================================

Write-DebugMsg 'common.ps1 loaded'
