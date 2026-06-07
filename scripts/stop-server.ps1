# stop-server.ps1 - Stop a specific Minecraft server (PowerShell port of stop-server.sh)
#
# Usage: pwsh ./scripts/stop-server.ps1 <server-name> [options]
#
# Options:
#   --purge              Remove container and data (preserves config and backups)
#   --remove-data        Remove server data directory only
#   --remove-backups     Remove backup directory only
#   --remove-config      Remove configuration file only
#   --remove-container   Remove container and volumes only (keep data/backups/config)
#
# Exit Codes:
#   0 - Success
#   1 - General error
#   2 - Invalid arguments
#   3 - Server not running

. "$PSScriptRoot\common.ps1"

function Show-Usage {
  Write-Info "Usage: stop-server.ps1 <server-name> [options]"
  Write-Info ''
  Write-Info 'Options:'
  Write-Info '  --purge              Remove container and data (preserves config and backups)'
  Write-Info '  --remove-data        Remove server data directory only'
  Write-Info '  --remove-backups     Remove backup directory only'
  Write-Info '  --remove-config      Remove configuration file only'
  Write-Info '  --remove-container   Remove container and volumes only'
  Write-Info '  -h, --help           Show this help message'
  Write-Info ''
  Write-Info 'Examples:'
  Write-Info '  stop-server.ps1 vanilla                          # Stop server normally'
  Write-Info '  stop-server.ps1 vanilla --remove-data            # Stop and remove world data'
  Write-Info '  stop-server.ps1 vanilla --remove-backups         # Stop and remove backups'
  Write-Info '  stop-server.ps1 vanilla --purge                  # Stop and remove everything (keeps config)'
  Write-Info '  stop-server.ps1 vanilla --purge --remove-config  # Stop and remove EVERYTHING including config'
}

# Parse options
$Purge = $false
$RemoveData = $false
$RemoveBackups = $false
$RemoveConfig = $false
$RemoveContainer = $false
$ServerName = ''

foreach ($arg in $args) {
  switch -Exact ($arg) {
    { $_ -in '--help', '-h' } {
      Show-Usage
      exit 0
    }
    '--purge' { $Purge = $true }
    '--remove-data' { $RemoveData = $true }
    '--remove-backups' { $RemoveBackups = $true }
    '--remove-config' { $RemoveConfig = $true }
    '--remove-container' { $RemoveContainer = $true }
    default {
      if ($arg -like '-*') {
        Write-Err "Unknown option: $arg"
        Write-Info 'Use --help for usage information'
        exit 2
      }
      if (-not $ServerName) {
        $ServerName = $arg
      } else {
        Write-Err 'Multiple server names provided'
        exit 2
      }
    }
  }
}

# Check arguments
if (-not $ServerName) {
  Write-Err 'Missing server name argument'
  Write-Info "Usage: stop-server.ps1 <server-name> [options]"
  Write-Info ''
  Write-Info 'Options:'
  Write-Info '  --purge              Remove container and data (preserves config and backups)'
  Write-Info '  --remove-data        Remove server data directory only'
  Write-Info '  --remove-backups     Remove backup directory only'
  Write-Info '  --remove-config      Remove configuration file only'
  Write-Info '  --remove-container   Remove container and volumes only'
  Write-Info ''
  Write-Info 'Running servers:'
  $running = @(Get-RunningServers)
  if ($running.Count -gt 0) { foreach ($s in $running) { Write-Info "  - $s" } }
  else { Write-Info '  (none running)' }
  exit 2
}

# Validate server name
if (-not (Test-ServerName $ServerName)) { exit 2 }

# Get paths
$ContainerName = Get-ContainerName $ServerName
$ConfigFile = Get-ConfigFile $ServerName
$DataDir = Get-DataDir $ServerName
$BackupDir = Get-BackupDir $ServerName

# If --purge is set, enable removal flags EXCEPT config and backups
if ($Purge) {
  $RemoveData = $true
  $RemoveContainer = $true
}

# Check container status
$ContainerRunning = Test-ContainerRunning $ContainerName
$ContainerExists = Test-ContainerExists $ContainerName

# If not running and no removal flags, error
if ((-not $ContainerRunning) -and (-not $RemoveData) -and (-not $RemoveBackups) -and (-not $RemoveConfig) -and (-not $RemoveContainer)) {
  Write-Err "Server '$ServerName' is not running"
  Write-Info ''
  Write-Info 'Running servers:'
  $running = @(Get-RunningServers)
  if ($running.Count -gt 0) { foreach ($s in $running) { Write-Info "  - $s" } }
  else { Write-Info '  (none running)' }
  Write-Info ''
  Write-Info "To remove server data, use: stop-server.ps1 $ServerName --purge"
  exit 3
}

# Display stop information
Write-Info ''
Write-Info "Stopping Minecraft server: ${YELLOW}${ServerName}${NC}"
Write-Success "Container name: $ContainerName"

# Show what will be removed
if ($Purge) {
  Write-Warn 'PURGE MODE: Server runtime data will be permanently deleted!'
  Write-Info '  - Container and volumes'
  Write-Info "  - Server data: $DataDir"
  Write-Success 'Config and backups PRESERVED'
  Write-Info ''
  if (-not (Confirm-Action "Are you sure you want to purge runtime data for $ServerName?")) {
    Write-Info 'Purge cancelled.'
    exit 0
  }
} elseif ($RemoveData -or $RemoveBackups -or $RemoveConfig -or $RemoveContainer) {
  Write-Warn 'The following will be removed:'
  if ($RemoveContainer) { Write-Info '  - Container and volumes' }
  if ($RemoveData) { Write-Info "  - Server data: $DataDir" }
  if ($RemoveBackups) { Write-Info "  - Backups: $BackupDir" }
  if ($RemoveConfig) { Write-Info "  - Config: $ConfigFile" }
  Write-Info ''
  if (-not (Confirm-Action "Are you sure you want to remove these items for $ServerName?")) {
    Write-Info 'Removal cancelled.'
    exit 0
  }
}

Write-Info ''

# Stop the container using docker compose (if running or existing)
if ($ContainerRunning -or $ContainerExists) {
  Write-Info 'Stopping container...'
  if (Invoke-DockerComposeDown $ServerName) {
    Write-Success 'Container stopped and removed'
  } else {
    Write-Err 'Failed to stop container'
    Write-Info 'Check docker compose logs for details'
    exit 1
  }
}

# Prune server data if purge mode
if ($Purge) {
  if (Remove-ServerData $ServerName) {
    Write-Success 'Runtime data pruned'
  } else {
    Write-Warn 'Some data may not have been removed'
  }
} else {
  if ($RemoveData) {
    if (Remove-DirectorySafe $DataDir) { Write-Success 'Server data removed' }
  }
  if ($RemoveBackups) {
    if (Remove-DirectorySafe $BackupDir) { Write-Success 'Backups removed' }
  }
}

# Remove config file
if ($RemoveConfig) {
  if (Remove-FileSafe $ConfigFile) { Write-Success 'Configuration removed' }
}

# Final message
Write-Info ''
if ($Purge) {
  Write-Success "Server '$ServerName' runtime data has been purged"
  Write-Info 'Removed: container and data'
  Write-Success 'Configuration and backups preserved'
  Write-Info ''
  Write-Info 'To recreate the server with same config:'
  Write-Info "  ${YELLOW}./scripts/start-server.ps1 $ServerName${NC}"
} elseif ($RemoveData -or $RemoveBackups -or $RemoveConfig -or $RemoveContainer) {
  Write-Success "Selected items removed for server '$ServerName'"
} else {
  Write-Success 'Server stopped successfully'
  Write-Info 'Container stopped. World data is preserved.'
  Write-Info "Start again with: ${YELLOW}./scripts/start-server.ps1 $ServerName${NC}"
}

Write-Info ''
exit 0
