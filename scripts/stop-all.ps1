# stop-all.ps1 - Stop all running Minecraft servers gracefully (PowerShell port of stop-all.sh)
#
# Usage: pwsh ./scripts/stop-all.ps1 [options]
#
# Options:
#   --prune     Remove containers and data for ALL servers (preserves configs and backups)
#   -h, --help  Show this help message
#
# Exit Codes:
#   0 - All servers stopped successfully
#   1 - One or more servers had issues stopping
#   2 - Invalid arguments

. "$PSScriptRoot\common.ps1"

# Parse options
$Prune = $false

foreach ($arg in $args) {
  switch -Exact ($arg) {
    { $_ -in '--help', '-h' } {
      Write-Info "Usage: stop-all.ps1 [options]"
      Write-Info ''
      Write-Info 'Options:'
      Write-Info '  --prune             Stop running servers and remove containers and data for ALL configured servers (preserves configs and backups)'
      Write-Info '  -h, --help          Show this help message'
      Write-Info ''
      Write-Info 'Examples:'
      Write-Info '  stop-all.ps1                   # Stop all running servers normally'
      Write-Info '  stop-all.ps1 --prune           # Stop all running servers and remove runtime data for ALL configured servers'
      exit 0
    }
    '--prune' { $Prune = $true }
    default {
      Write-Err "Unknown option: $arg"
      Write-Info 'Use --help for usage information'
      exit 2
    }
  }
}

Write-Info ''
if ($Prune) {
  Write-Info "${RED}PRUNE MODE: Runtime data will be permanently deleted for ALL configured servers!${NC}"
  Write-Info 'This will:'
  Write-Info '  - Stop any running servers'
  Write-Info '  - Remove all containers and volumes'
  Write-Info '  - Remove all server data directories'
  Write-Success 'Configurations and backups will be PRESERVED'
  Write-Info ''
  if (-not (Confirm-Action 'Are you sure you want to prune runtime data for ALL configured servers?')) {
    Write-Info 'Prune cancelled.'
    exit 0
  }
  Write-Info ''
}

Write-Info "${BLUE}Stopping all Minecraft servers gracefully...${NC}"
Write-Info ''

# Determine which servers to process
if ($Prune) {
  $AllServers = @(Get-AvailableServers)
  if ($AllServers.Count -eq 0) {
    Write-Info 'No configured Minecraft servers found.'
    Write-Info ''
    exit 0
  }
  Write-Info 'Processing all configured servers (with prune)...'
} else {
  $AllServers = @(Get-RunningServers)
  if ($AllServers.Count -eq 0) {
    Write-Info 'No running Minecraft servers found.'
    Write-Info ''
    exit 0
  }
}

$Stopped = 0
$Failed = 0
$Pruned = 0
$PruneFailed = 0
$StoppedServers = @()
$FailedServers = @()
$PrunedServers = @()
$PruneFailedServers = @()

foreach ($ServerName in $AllServers) {
  $ContainerName = Get-ContainerName $ServerName
  $IsRunning = Test-ContainerRunning $ContainerName

  if ($IsRunning) {
    Write-Info "Stopping: ${YELLOW}${ServerName}${NC}"
    if (Invoke-DockerComposeDown $ServerName) {
      $StoppedServers += $ServerName
      $Stopped++
      Write-Success "Stopped: $ServerName"
    } else {
      $FailedServers += $ServerName
      $Failed++
      Write-Err "Failed to stop: $ServerName"
    }
  } elseif ($Prune) {
    Write-Info "Processing stopped server: ${YELLOW}${ServerName}${NC}"
  } else {
    continue
  }

  if ($Prune) {
    if (Remove-ServerData $ServerName) {
      Write-Success '  Runtime data pruned'
      $PrunedServers += $ServerName
      $Pruned++
    } else {
      Write-Warn '  Failed to prune some data'
      $PruneFailedServers += $ServerName
      $PruneFailed++
    }
  }
}

Write-Info ''
Write-Info ('-' * 52)
Write-Info ''

if ($Stopped -gt 0) {
  Write-Success "Stopped servers ($Stopped):"
  foreach ($server in $StoppedServers) { Write-Info "  - $server" }
  Write-Info ''
}

if ($Failed -gt 0) {
  Write-Err "Failed to stop ($Failed):"
  foreach ($server in $FailedServers) { Write-Info "  - $server" }
  Write-Info ''
}

if ($Prune) {
  if ($Pruned -gt 0) {
    Write-Success "Pruned servers ($Pruned):"
    foreach ($server in $PrunedServers) { Write-Info "  - $server" }
    Write-Info ''
  }
  if ($PruneFailed -gt 0) {
    Write-Err "Failed to prune ($PruneFailed):"
    foreach ($server in $PruneFailedServers) { Write-Info "  - $server" }
    Write-Info ''
  }
}

if ($Prune) {
  Write-Success 'All configured servers processed and runtime data pruned.'
  Write-Info 'Removed: containers and data directories'
  Write-Success 'Configurations and backups preserved for all servers'
  Write-Info ''
  Write-Info 'To recreate servers with same configs:'
  Write-Info "  ${YELLOW}./scripts/start-all.ps1${NC}"
} else {
  Write-Info 'All running servers stopped. Worlds have been saved.'
  Write-Info ''
  Write-Info "Start servers again with: ${YELLOW}./scripts/start-all.ps1${NC}"
}

Write-Info ''

if ($Failed -eq 0 -and $PruneFailed -eq 0) { exit 0 } else { exit 1 }
