# start-all.ps1 - Start all configured Minecraft servers (PowerShell port of start-all.sh)
#
# Usage: pwsh ./scripts/start-all.ps1
#
# Exit Codes:
#   0 - All servers started successfully
#   1 - One or more servers failed to start
#   4 - No configuration files found

. "$PSScriptRoot\common.ps1"

# Check if config directory exists
if (-not (Test-Path -LiteralPath 'config/modpacks' -PathType Container)) {
  Write-Err 'Configuration directory not found: config/modpacks/'
  exit 4
}

# Find all .env files
$ConfigFiles = @(Get-ChildItem -LiteralPath 'config/modpacks' -Filter '*.env' -File)

if ($ConfigFiles.Count -eq 0) {
  Write-Err 'No server configurations found in config/modpacks/'
  Write-Info 'Create a server configuration first or run: ./scripts/add-modpack.ps1 <name>'
  exit 4
}

Write-Info ''
Write-Info "${BLUE}Starting all Minecraft servers...${NC}"
Write-Info ''

$Started = 0
$Failed = 0
$StartedServers = @()
$FailedServers = @()

foreach ($config in $ConfigFiles) {
  $ServerName = $config.BaseName

  Write-Info "Starting: ${YELLOW}${ServerName}${NC}"

  $rc = Invoke-SiblingScript -ScriptName 'start-server.ps1' -Arguments @($ServerName) -Quiet
  if ($rc -eq 0) {
    $port = Get-ServerPort $ServerName
    $StartedServers += "$ServerName (port $port)"
    $Started++
  } else {
    $FailedServers += $ServerName
    $Failed++
  }

  Write-Info ''
}

# Summary
Write-Info ('-' * 52)
Write-Info ''

if ($Started -gt 0) {
  Write-Success "Started servers ($Started):"
  foreach ($server in $StartedServers) { Write-Info "  - $server" }
  Write-Info ''
}

if ($Failed -gt 0) {
  Write-Err "Failed servers ($Failed):"
  foreach ($server in $FailedServers) { Write-Info "  - $server" }
  Write-Info ''
}

Write-Info "Total: ${GREEN}${Started} started${NC}, ${RED}${Failed} failed${NC}"
Write-Info ''
Write-Info "View status with: ${YELLOW}./scripts/list-servers.ps1${NC}"
Write-Info ''

if ($Failed -eq 0) { exit 0 } else { exit 1 }
