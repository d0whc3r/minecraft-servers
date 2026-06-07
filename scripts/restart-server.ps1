# restart-server.ps1 - Restart a specific Minecraft server (PowerShell port of restart-server.sh)
#
# Usage: pwsh ./scripts/restart-server.ps1 <server-name>
#
# Exit Codes:
#   0 - Restart successful
#   1 - General error
#   2 - Missing server-name argument
#   3 - Server not found

. "$PSScriptRoot\common.ps1"

# Check arguments
if ($args.Count -lt 1) {
  Write-Err 'Missing server name argument'
  Write-Info "Usage: restart-server.ps1 <server-name>"
  exit 2
}

$ServerName = $args[0]

# Validate server name
if (-not (Test-ServerName $ServerName)) { exit 2 }

# Get container name
$ContainerName = Get-ContainerName $ServerName

# Check if container exists
if (-not (Test-ContainerExists $ContainerName)) {
  Write-Err "Server not found: $ServerName"
  Write-Info 'Available servers:'
  foreach ($s in (Get-AvailableServers)) { Write-Info $s }
  exit 3
}

Write-Info ''
Write-Info "Restarting server: ${YELLOW}${ServerName}${NC}"
Write-Info ''

# Restart with docker compose
if (Invoke-DockerComposeRestart $ServerName) {
  Write-Success 'Server restarted successfully'
  Write-Info ''
  Write-Info "View logs with: ${YELLOW}docker logs -f $ContainerName${NC}"
  Write-Info "Check status with: ${YELLOW}./scripts/list-servers.ps1${NC}"
  Write-Info ''
  exit 0
} else {
  Write-Err 'Failed to restart server'
  exit 1
}
