# diagnose-failed-servers.ps1 - Analyze logs from failed servers (PowerShell port)
# Identifies root causes for servers that fail to start.

. "$PSScriptRoot\common.ps1"

$FailedServers = @(
  'atm8'
  'my-hero-adventure'
  'prominence2'
  'rlcraft'
  'skyfactory4'
  'unofficial-dragon-block-c'
)

$ClientOnlyServers = @(
  'amazing-fps-booster'
  'solocraft-modpack'
)

Write-Info '================================================'
Write-Info 'Failed Servers Diagnostic Tool'
Write-Info '================================================'
Write-Info ''

function Invoke-DiagnoseServer {
  param([string]$ServerName)
  $containerName = "mc-$ServerName"

  Write-Info "${YELLOW}=== Analyzing: $ServerName ===${NC}"

  if (-not (Test-ContainerExists $containerName)) {
    Write-Info "${RED}$([char]0x2717) Container not found${NC}"
    Write-Info "  Try starting: ./scripts/start-server.ps1 $ServerName"
    Write-Info ''
    return
  }

  $status = docker inspect $containerName --format '{{.State.Status}}' 2> $null
  if (-not $status) { $status = 'unknown' }
  $exitCode = docker inspect $containerName --format '{{.State.ExitCode}}' 2> $null
  if (-not $exitCode) { $exitCode = 'unknown' }

  Write-Info "Container Status: $status"
  Write-Info "Exit Code: $exitCode"
  Write-Info ''

  $configFile = "config/modpacks/$ServerName.env"
  if (Test-Path -LiteralPath $configFile -PathType Leaf) {
    $memory = Get-ConfigValue $configFile 'MEMORY'
    Write-Info "Configured Memory: $memory"
  }

  Write-Info ''
  Write-Info 'Last 40 log lines:'
  Write-Info '---'
  $logsTail = docker logs $containerName 2>&1 | Select-Object -Last 40
  foreach ($l in $logsTail) { Write-Info "  $l" }
  Write-Info '---'

  Write-Info ''
  Write-Info 'Error Analysis:'

  $logs = docker logs $containerName 2>&1 | Out-String

  if ($logs -match '(?i)OutOfMemoryError') {
    Write-Info "  ${RED}$([char]0x26A0) Out of Memory Error detected${NC}"
    Write-Info '     Solution: Increase MEMORY in config file'
  }
  if ($logs -match '(?i)ClassNotFoundException|NoClassDefFoundError') {
    Write-Info "  ${RED}$([char]0x26A0) Missing class/dependency error${NC}"
    Write-Info '     Solution: Check mod compatibility or Java version'
  }
  if ($logs -match '(?i)Mixin.*client') {
    Write-Info "  ${RED}$([char]0x26A0) Client-side mixin error${NC}"
    Write-Info '     Solution: This may be a client-only modpack'
  }
  if ($logs -match '(?i)Failed to download|Connection refused|Could not resolve') {
    Write-Info "  ${RED}$([char]0x26A0) Network/download error${NC}"
    Write-Info '     Solution: Check internet connection or mod source availability'
  }
  if ($logs -match 'Done \(.*s\)! For help') {
    Write-Info "  ${GREEN}$([char]0x2713) Server started successfully${NC}"
  }

  Write-Info ''
  Write-Info '================================================'
  Write-Info ''
}

Write-Info 'Starting diagnostics...'
Write-Info ''

foreach ($server in $FailedServers) {
  Invoke-DiagnoseServer $server
  Start-Sleep -Seconds 1
}

Write-Info ''
Write-Info '=== CLIENT-ONLY MODPACKS (Not suitable for servers) ==='
Write-Info ''
foreach ($server in $ClientOnlyServers) {
  Write-Info "${YELLOW}$server${NC}: Client-only modpack - will not work as server"
}

Write-Info ''
Write-Info '================================================'
Write-Info 'Diagnostic complete'
Write-Info '================================================'
Write-Info ''
Write-Info 'To fix issues:'
Write-Info '1. Increase MEMORY in config/modpacks/{server-name}.env'
Write-Info '2. Check for client-only mods that need exclusion'
Write-Info '3. Verify Java version requirements'
Write-Info '4. Remove client-only modpacks from server list'
Write-Info ''
