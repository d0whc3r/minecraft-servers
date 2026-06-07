# validate-config.ps1 - Validate server configurations and system setup (PowerShell port)
#
# Usage: pwsh ./scripts/validate-config.ps1 [OPTIONS] [SERVER_NAME]
#
# OPTIONS:
#   -a, --all       Validate all configured servers
#   -s, --system    Validate system requirements only
#   -f, --fix       Attempt to fix common issues automatically
#   -v, --verbose   Show detailed validation output
#   -j, --json      Output in JSON format
#   -h, --help      Show this help message
#
# EXIT CODES:
#   0  All validations passed
#   2  Invalid arguments
#   3  Validation failed (errors found)
#   4  Validation warnings (no errors)

. "$PSScriptRoot\common.ps1"

# Global validation state
$script:Errors = 0
$script:Warnings = 0

function Show-Usage {
  Write-Info "Usage: validate-config.ps1 [OPTIONS] [SERVER_NAME]"
  Write-Info ''
  Write-Info 'Validate server configurations and system setup.'
  Write-Info ''
  Write-Info 'OPTIONS:'
  Write-Info '    -a, --all              Validate all configured servers'
  Write-Info '    -s, --system           Validate system requirements only'
  Write-Info '    -f, --fix              Attempt to fix common issues automatically'
  Write-Info '    -v, --verbose          Show detailed validation output'
  Write-Info '    -j, --json             Output in JSON format'
  Write-Info '    -h, --help             Show this help message'
}

# Parse command line arguments
$AllServers = $false
$SystemOnly = $false
$AutoFix = $false
$VerboseOut = $false
$JsonOutput = $false
$ServerName = ''

foreach ($arg in $args) {
  switch -Exact ($arg) {
    { $_ -in '-a', '--all' } { $AllServers = $true }
    { $_ -in '-s', '--system' } { $SystemOnly = $true }
    { $_ -in '-f', '--fix' } { $AutoFix = $true }
    { $_ -in '-v', '--verbose' } { $VerboseOut = $true }
    { $_ -in '-j', '--json' } { $JsonOutput = $true }
    { $_ -in '-h', '--help' } { Show-Usage; exit 0 }
    default {
      if ($arg -like '-*') {
        Write-Err "Unknown option: $arg"
        Show-Usage
        exit 2
      }
      if ($ServerName) {
        Write-Err 'Multiple server names specified'
        Show-Usage
        exit 2
      }
      $ServerName = $arg
    }
  }
}

# Validate arguments
if ((-not $AllServers) -and (-not $SystemOnly) -and (-not $ServerName)) {
  Write-Err 'Must specify either --all, --system, or a server name'
  Show-Usage
  exit 2
}
if ($AllServers -and $ServerName) {
  Write-Err 'Cannot specify both --all and a server name'
  Show-Usage
  exit 2
}

# Validation result helpers
function Add-ValidationError {
  param([string]$Message)
  $script:Errors++
  if (-not $JsonOutput) { Write-Err $Message }
}
function Add-ValidationWarning {
  param([string]$Message)
  $script:Warnings++
  if (-not $JsonOutput) { Write-Warn $Message }
}
function Add-ValidationSuccess {
  param([string]$Message)
  if ($VerboseOut -and (-not $JsonOutput)) { Write-Success $Message }
}

function Test-ConfigHasKey {
  param([string]$ConfigFile, [string]$Key)
  return [bool](Select-String -LiteralPath $ConfigFile -Pattern "^$([regex]::Escape($Key))=" -Quiet)
}

# System requirement checks
function Test-SystemRequirements {
  if (-not $JsonOutput) { Write-Info 'Validating system requirements...' }

  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $docker) {
    Add-ValidationError 'Docker is not installed or not in PATH'
  } else {
    Add-ValidationSuccess 'Docker is available'

    docker info *> $null
    if ($LASTEXITCODE -ne 0) {
      Add-ValidationError 'Docker daemon is not running'
    } else {
      Add-ValidationSuccess 'Docker daemon is running'
    }

    docker compose version *> $null
    if ($LASTEXITCODE -ne 0) {
      Add-ValidationWarning 'Docker Compose is not available (optional for dynamic server management)'
    } else {
      Add-ValidationSuccess 'Docker Compose is available'
    }
  }

  # Required directories
  foreach ($dir in @('config/modpacks', 'servers', 'backups')) {
    if (-not (Test-Path -LiteralPath $dir -PathType Container)) {
      if ($AutoFix) {
        New-DirectoryIfMissing $dir
        Add-ValidationSuccess "Created directory: $dir"
      } else {
        Add-ValidationError "Required directory missing: $dir"
      }
    } else {
      Add-ValidationSuccess "Directory exists: $dir"
    }
  }

  # Script presence (executable bit is not applicable on Windows; check the .ps1 ports)
  $scripts = @('start-server', 'stop-server', 'restart-server', 'list-servers',
               'backup', 'restore', 'add-modpack', 'health-check', 'auto-restart')
  foreach ($script in $scripts) {
    $scriptPath = "scripts/$script.ps1"
    if (Test-Path -LiteralPath $scriptPath -PathType Leaf) {
      Add-ValidationSuccess "Script present: $script.ps1"
    } else {
      Add-ValidationWarning "Script not found: $script.ps1"
    }
  }

  # Contract file
  if (-not (Test-Path -LiteralPath 'specs/001-docker-multi-server/contracts/management-api.md' -PathType Leaf)) {
    Add-ValidationWarning 'Management API contract not found'
  } else {
    Add-ValidationSuccess 'Management API contract exists'
  }
}

function Get-ServerList {
  if ($AllServers) {
    Get-AvailableServers | Sort-Object
  } else {
    $ServerName
  }
}

function Test-ServerNameFormat {
  param([string]$Server)
  if ($Server -notmatch '^[a-z0-9-]+$') {
    Add-ValidationError "Invalid server name format: $Server (must be lowercase alphanumeric with hyphens)"
  } else {
    Add-ValidationSuccess "Server name format valid: $Server"
  }
}

function Test-ConfigFile {
  param([string]$Server)
  $configFile = Get-ConfigFile $Server

  if (-not (Test-Path -LiteralPath $configFile -PathType Leaf)) {
    Add-ValidationError "Configuration file missing: $configFile"
    return
  }
  Add-ValidationSuccess "Configuration file exists: $configFile"

  foreach ($var in @('TYPE', 'VERSION', 'MEMORY')) {
    if (-not (Test-ConfigHasKey $configFile $var)) {
      Add-ValidationError "Required variable missing in config: $var"
    } else {
      Add-ValidationSuccess "Required variable present: $var"
    }
  }

  $type = Get-ConfigValue $configFile 'TYPE'
  if ($type -in @('VANILLA', 'PAPER', 'FORGE', 'FABRIC', 'AUTO_CURSEFORGE', 'MODRINTH')) {
    Add-ValidationSuccess "Server type valid: $type"
  } else {
    Add-ValidationError "Invalid server type: $type (must be VANILLA, PAPER, FORGE, FABRIC, AUTO_CURSEFORGE, or MODRINTH)"
  }

  $memory = Get-ConfigValue $configFile 'MEMORY'
  if ($memory -match '^[0-9]+[GgMm]$') {
    Add-ValidationSuccess "Memory format valid: $memory"
  } else {
    Add-ValidationError "Invalid memory format: $memory (must be like '4G' or '4096M')"
  }

  $port = Get-ConfigValue $configFile 'SERVER_PORT'
  if ($port) {
    if (($port -match '^[0-9]+$') -and ([int]$port -ge 1024) -and ([int]$port -le 65535)) {
      Add-ValidationSuccess "Server port valid: $port"
    } else {
      Add-ValidationError "Invalid server port: $port (must be 1024-65535)"
    }
  }

  if ($type -eq 'AUTO_CURSEFORGE') {
    $cfUrl = Get-ConfigValue $configFile 'CF_PAGE_URL'
    if (-not $cfUrl) {
      Add-ValidationError 'CF_PAGE_URL required for AUTO_CURSEFORGE type'
    } elseif ($cfUrl -notmatch '^https://www\.curseforge\.com/minecraft/modpacks/') {
      Add-ValidationError "Invalid CurseForge URL format: $cfUrl"
    } else {
      Add-ValidationSuccess 'CurseForge URL format valid'
    }
  }
}

function Test-ServerDirectories {
  param([string]$Server)
  $serverDir = "servers/$Server"

  if (-not (Test-Path -LiteralPath $serverDir -PathType Container)) {
    if ($AutoFix) {
      New-DirectoryIfMissing $serverDir
      Add-ValidationSuccess "Created server directory: $serverDir"
    } else {
      Add-ValidationWarning "Server directory missing: $serverDir"
    }
  } else {
    Add-ValidationSuccess "Server directory exists: $serverDir"
  }

  foreach ($subdir in @('data', 'mods')) {
    $fullPath = "$serverDir/$subdir"
    if (-not (Test-Path -LiteralPath $fullPath -PathType Container)) {
      if ($AutoFix) {
        New-DirectoryIfMissing $fullPath
        Add-ValidationSuccess "Created subdirectory: $fullPath"
      } else {
        Add-ValidationWarning "Server subdirectory missing: $fullPath"
      }
    } else {
      Add-ValidationSuccess "Server subdirectory exists: $fullPath"
    }
  }

  $backupDir = Get-BackupDir $Server
  if (-not (Test-Path -LiteralPath $backupDir -PathType Container)) {
    if ($AutoFix) {
      New-DirectoryIfMissing $backupDir
      Add-ValidationSuccess "Created backup directory: $backupDir"
    } else {
      Add-ValidationWarning "Backup directory missing: $backupDir"
    }
  } else {
    Add-ValidationSuccess "Backup directory exists: $backupDir"
  }
}

function Test-PortConflictsValidation {
  if (-not (Test-PortConflicts)) {
    Add-ValidationError 'Port conflicts detected across server configurations'
    return
  }
  Add-ValidationSuccess 'No port conflicts detected'
}

function Test-Server {
  param([string]$Server)
  if (-not $JsonOutput) { Write-Info "Validating server: $Server" }
  Test-ServerNameFormat $Server
  Test-ConfigFile $Server
  Test-ServerDirectories $Server
  Test-PortConflictsValidation
}

function Invoke-ValidateAll {
  if (-not $SystemOnly) {
    $servers = @(Get-ServerList)
    if ($servers.Count -eq 0) {
      if ($AllServers) {
        Add-ValidationWarning 'No servers configured yet'
      } else {
        Add-ValidationError "Server not found: $ServerName"
      }
    } else {
      foreach ($server in $servers) { Test-Server $server }
    }
  }
  Test-SystemRequirements
}

# Main execution
Invoke-ValidateAll

if ($JsonOutput) {
  $exitCode = 0
  if ($script:Errors -gt 0) { $exitCode = 3 } elseif ($script:Warnings -gt 0) { $exitCode = 4 }
  Write-Output "{ `"errors`": $($script:Errors), `"warnings`": $($script:Warnings), `"exit_code`": $exitCode }"
} else {
  if ($VerboseOut -or $script:Errors -gt 0 -or $script:Warnings -gt 0) {
    Write-Info ''
    Write-Info 'Validation Summary:'
    Write-Info "- Errors: $($script:Errors)"
    Write-Info "- Warnings: $($script:Warnings)"
  }
}

if ($script:Errors -gt 0) {
  exit 3
} elseif ($script:Warnings -gt 0) {
  exit 4
} else {
  if (-not $JsonOutput) { Write-Success 'All validations passed' }
  exit 0
}
