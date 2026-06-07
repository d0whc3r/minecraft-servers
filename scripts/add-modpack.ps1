# add-modpack.ps1 - Add new Minecraft server configuration (PowerShell port of add-modpack.sh)
#
# Usage: pwsh ./scripts/add-modpack.ps1 <server-name> [--modpack=<template>] [--port=<port>] [--memory=<amount>]
# Creates new server configuration with automatic port assignment and validation.

. "$PSScriptRoot\common.ps1"

# Available templates
$Templates = @{
  'atm8'        = @{ DisplayName = 'All The Mods 8'; Type = 'AUTO_CURSEFORGE'; Version = '1.20.1'; Memory = '8G'; CfUrl = 'https://www.curseforge.com/minecraft/modpacks/all-the-mods-8'; ServerName = 'ATM8 Server' }
  'skyfactory4' = @{ DisplayName = 'SkyFactory 4'; Type = 'AUTO_CURSEFORGE'; Version = '1.12.2'; Memory = '4G'; CfUrl = 'https://www.curseforge.com/minecraft/modpacks/skyfactory-4'; ServerName = 'SkyFactory 4' }
  'prominence2' = @{ DisplayName = 'Prominence II RPG'; Type = 'AUTO_CURSEFORGE'; Version = '1.20.1'; Memory = '6G'; CfUrl = 'https://www.curseforge.com/minecraft/modpacks/prominence-2-rpg'; ServerName = 'Prominence II RPG' }
  'rlcraft'     = @{ DisplayName = 'RLCraft'; Type = 'AUTO_CURSEFORGE'; Version = '1.12.2'; Memory = '6G'; CfUrl = 'https://www.curseforge.com/minecraft/modpacks/rlcraft'; ServerName = 'RLCraft' }
  'vanilla'     = @{ DisplayName = 'Vanilla Optimized'; Type = 'PAPER'; Version = '1.20.4'; Memory = '2G'; CfUrl = ''; ServerName = 'Vanilla Server' }
}

function Test-MemoryFormat {
  param([string]$Memory)
  if ($Memory -notmatch '^[0-9]+[GMgm]$') {
    Write-Err "Invalid memory format: $Memory"
    Write-Err 'Memory must be in format: <number>G or <number>M (e.g., 4G, 8G, 2048M)'
    return $false
  }
  return $true
}

function New-ServerConfig {
  param([string]$Name, [string]$Template, [string]$Port, [string]$Memory)

  $configFile = "config/modpacks/$Name.env"
  $lines = @()

  if ($Template -and $Templates.ContainsKey($Template)) {
    $t = $Templates[$Template]
    $finalMemory = if ($Memory) { $Memory } else { $t.Memory }

    $lines += "# $($t.DisplayName) Configuration"
    $lines += "TYPE=$($t.Type)"
    $lines += "VERSION=$($t.Version)"
    $lines += "MEMORY=$finalMemory"
    if ($t.CfUrl) { $lines += "CF_PAGE_URL=$($t.CfUrl)" }
    $lines += "SERVER_NAME=$($t.DisplayName)"
    $lines += "SERVER_PORT=$Port"
    $lines += 'MAX_PLAYERS=20'
    $lines += 'DIFFICULTY=normal'
    $lines += 'VIEW_DISTANCE=10'

    Write-Info "Using template: $($t.DisplayName)"
  } else {
    if (-not $Memory) { $Memory = '4G' }
    $lines += '# Custom Server Configuration'
    $lines += 'TYPE=PAPER'
    $lines += 'VERSION=1.20.4'
    $lines += "MEMORY=$Memory"
    $lines += "SERVER_NAME=$Name"
    $lines += "SERVER_PORT=$Port"
    $lines += 'MAX_PLAYERS=20'
    $lines += 'DIFFICULTY=normal'
    $lines += 'VIEW_DISTANCE=10'

    Write-Info 'Created basic configuration (no template specified)'
  }

  Set-Content -LiteralPath $configFile -Value $lines -Encoding ascii
  Write-Success "Created config: $configFile"
}

function New-ServerDirectories {
  param([string]$Name)
  New-DirectoryIfMissing "servers/$Name/data"
  New-DirectoryIfMissing "servers/$Name/mods"
  New-DirectoryIfMissing "backups/$Name"
  Write-Success 'Created directories:'
  Write-Success "  - servers/$Name/data"
  Write-Success "  - servers/$Name/mods"
  Write-Success "  - backups/$Name"
}

# Parse arguments
$ServerName = ''
$Template = ''
$Port = ''
$Memory = ''

foreach ($arg in $args) {
  switch -Wildcard ($arg) {
    '--modpack=*' { $Template = $arg -replace '^--modpack=', ''; break }
    '--port=*' { $Port = $arg -replace '^--port=', ''; break }
    '--memory=*' { $Memory = $arg -replace '^--memory=', ''; break }
    '-*' {
      Write-Err "Unknown option: $arg"
      Write-Info "Usage: add-modpack.ps1 <server-name> [--modpack=<template>] [--port=<port>] [--memory=<amount>]"
      Write-Info "Available templates: $($Templates.Keys -join ' ')"
      exit 2
    }
    default {
      if (-not $ServerName) {
        $ServerName = $arg
      } else {
        Write-Err 'Multiple server names specified'
        exit 2
      }
    }
  }
}

# Validate required arguments
if (-not $ServerName) {
  Write-Err 'Server name is required'
  Write-Info "Usage: add-modpack.ps1 <server-name> [--modpack=<template>] [--port=<port>] [--memory=<amount>]"
  exit 2
}

if (-not (Test-ServerName $ServerName)) { exit 2 }

# Check if server already exists
if (Test-Path -LiteralPath (Get-ConfigFile $ServerName) -PathType Leaf) {
  Write-Err "Server '$ServerName' already exists"
  exit 2
}

# Validate template if specified
if ($Template -and (-not $Templates.ContainsKey($Template))) {
  Write-Err "Unknown template: $Template"
  Write-Info "Available templates: $($Templates.Keys -join ' ')"
  exit 3
}

# Validate memory if specified
if ($Memory -and (-not (Test-MemoryFormat $Memory))) { exit 4 }

# Determine port
if (-not $Port) {
  Write-Info 'Auto-assigning port...'
  $Port = Find-AvailablePort
  if (-not $Port) { exit 4 }
  Write-Info "Assigned port: $Port"
} else {
  if (($Port -notmatch '^[0-9]+$') -or ([int]$Port -lt 25565) -or ([int]$Port -gt 25664)) {
    Write-Err "Invalid port: $Port"
    Write-Err 'Port must be between 25565 and 25664'
    exit 4
  }
  if (-not (Test-PortConflicts)) {
    Write-Err "Port $Port is already in use"
    exit 4
  }
}

Write-Info "Adding new server: $ServerName"

# Create configuration and directories
New-ServerConfig $ServerName $Template "$Port" $Memory
New-ServerDirectories $ServerName

# Success output
Write-Success 'New server configuration created successfully!'
Write-Info ''
Write-Info 'Configuration Summary:'
Write-Info "  Name: $ServerName"
if ($Template) {
  $t = $Templates[$Template]
  Write-Info "  Type: $($t.Type) ($($t.DisplayName))"
  Write-Info "  Version: $($t.Version)"
} else {
  Write-Info '  Type: PAPER (Vanilla)'
  Write-Info '  Version: 1.20.4'
}
Write-Info "  Port: $Port"
if ($Memory) {
  Write-Info "  Memory: $Memory"
} elseif ($Template) {
  Write-Info "  Memory: $($Templates[$Template].Memory)"
} else {
  Write-Info '  Memory: 4G'
}
Write-Info ''
Write-Info 'To start the server:'
Write-Info "  ./scripts/start-server.ps1 $ServerName"

exit 0
