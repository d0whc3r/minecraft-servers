# start-server.ps1 - Start a specific Minecraft server (PowerShell port of start-server.sh)
#
# Usage: pwsh ./scripts/start-server.ps1 <server-name>
#
# Exit Codes:
#   0 - Success
#   1 - General error
#   2 - Invalid arguments
#   3 - Server configuration not found
#   4 - Validation error (port conflict, etc.)

. "$PSScriptRoot\common.ps1"

# Check arguments
if ($args.Count -lt 1) {
  Write-Err 'Missing server name argument'
  Write-Info "Usage: start-server.ps1 <server-name>"
  Write-Info ''
  Write-Info 'Available servers:'
  foreach ($s in (Get-AvailableServers)) { Write-Info $s }
  exit 2
}

$ServerName = $args[0]

# Validate server name
if (-not (Test-ServerName $ServerName)) { exit 2 }

# Check configuration exists
if (-not (Test-ConfigExists $ServerName)) { exit 3 }

# Check Docker daemon
if (-not (Test-DockerRunning)) { exit 1 }

# Get paths
$ContainerName = Get-ContainerName $ServerName
$ConfigFile = Get-ConfigFile $ServerName

# Check if container already running
if (Test-ContainerRunning $ContainerName) {
  Write-Err "Container $ContainerName is already running"
  Write-Info "Use './scripts/restart-server.ps1 $ServerName' to restart"
  exit 4
}

# Load port from config (for display)
$ServerPort = Get-ConfigValue $ConfigFile 'SERVER_PORT'
if (-not $ServerPort) { $ServerPort = 'auto' }

# Ensure directories exist
New-DirectoryIfMissing "servers/$ServerName/data"
New-DirectoryIfMissing "servers/$ServerName/mods"
New-DirectoryIfMissing "backups/$ServerName"

# Ensure network exists
Initialize-Network

# Display startup information
Write-Info ''
Write-Info "Starting Minecraft server: ${YELLOW}${ServerName}${NC}"
Write-Success "Loading config from: $ConfigFile"
Write-Success "Container name: $ContainerName"
Write-Success "Port: $ServerPort"
Write-Info ''

# Start server
if (Invoke-DockerComposeUp $ServerName) {
  Write-Success "Container created: $ContainerName"
  Write-Success 'Server started successfully'
  Write-Info ''
  Write-Info "View logs with: ${YELLOW}docker logs -f $ContainerName${NC}"
  Write-Info "Stop server with: ${YELLOW}./scripts/stop-server.ps1 $ServerName${NC}"
  Write-Info ''
  Write-Info 'Health check will begin in 30 seconds...'
  Write-Info 'Server will be ready when logs show: ''Done! For help, type "help"'''
  exit 0
} else {
  Write-Err 'Failed to start server'
  Write-Info 'Check docker compose logs for details'
  exit 1
}
