# list-servers.ps1 - Display status of all configured Minecraft servers (PowerShell port)
#
# Usage: pwsh ./scripts/list-servers.ps1 [--format=table|json]
#
# Exit Codes:
#   0 - Status retrieved successfully
#   1 - Docker daemon not running

. "$PSScriptRoot\common.ps1"

# Check Docker daemon
if (-not (Test-DockerRunning)) { exit 1 }

# Parse format argument (default: table)
$Format = 'table'
if ($args.Count -gt 0 -and $args[0] -like '--format=*') {
  $Format = $args[0] -replace '^--format=', ''
}

# Get all mc-* containers
$Containers = @(docker ps -a --filter 'name=mc-*' --format '{{.Names}}' 2> $null | Where-Object { $_ })

if ($Format -eq 'json') {
  $blocks = @()
  foreach ($container in $Containers) {
    $serverName = $container -replace '^mc-', ''
    $status = docker inspect --format '{{.State.Status}}' $container 2> $null
    if ($LASTEXITCODE -ne 0 -or -not $status) { $status = 'unknown' }

    if ($status -eq 'running') {
      $portRaw = docker port $container 25565 2> $null | Select-Object -First 1
      $port = if ($portRaw) { ($portRaw -split ':')[-1] } else { 'N/A' }
      $uptime = docker inspect --format '{{.State.StartedAt}}' $container 2> $null
      if (-not $uptime) { $uptime = 'unknown' }
      $health = docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}N/A{{end}}' $container 2> $null
      if (-not $health) { $health = 'N/A' }
    } else {
      $port = 'N/A'; $uptime = 'N/A'; $health = 'N/A'
    }

    $blocks += @"
    {
      "name": "$serverName",
      "status": "$status",
      "port": "$port",
      "uptime": "$uptime",
      "health": "$health"
    }
"@
  }

  Write-Output '{'
  Write-Output '  "servers": ['
  Write-Output ($blocks -join ",`n")
  Write-Output '  ]'
  Write-Output '}'
  exit 0
}

# Helper: colorize a word and pad to a visible width
function Format-Cell {
  param([string]$Text, [string]$Color, [int]$Width)
  $pad = [Math]::Max(0, $Width - $Text.Length)
  return "$Color$Text$NC" + (' ' * $pad)
}

# Table output (default)
Write-Info ''
Write-Info "${BLUE}Minecraft Servers Status${NC}"
Write-Info '================================================================================'
Write-Info ('{0,-15} {1,-12} {2,-8} {3,-8} {4,-12} {5,-10}' -f 'Name', 'Status', 'Port', 'Memory', 'Uptime', 'Health')
Write-Info '--------------------------------------------------------------------------------'

$Running = 0
$Stopped = 0

if ($Containers.Count -eq 0) {
  Write-Info 'No servers configured yet.'
  Write-Info ''
  Write-Info 'Add a server with: ./scripts/add-modpack.ps1 <name>'
  Write-Info 'Or start vanilla server: ./scripts/start-server.ps1 vanilla'
  Write-Info ''
  exit 0
}

foreach ($container in $Containers) {
  $serverName = $container -replace '^mc-', ''
  $status = docker inspect --format '{{.State.Status}}' $container 2> $null
  if ($LASTEXITCODE -ne 0 -or -not $status) { $status = 'unknown' }

  if ($status -eq 'running') {
    $statusCell = Format-Cell 'running' $GREEN 12
    $Running++

    $portRaw = docker port $container 25565 2> $null | Select-Object -First 1
    $port = if ($portRaw) { ($portRaw -split ':')[-1] } else { 'N/A' }

    $memory = Get-ConfigValue "config/modpacks/$serverName.env" 'MEMORY'
    if (-not $memory) { $memory = 'N/A' }

    $uptime = Get-ContainerUptime $container

    $healthRaw = docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}N/A{{end}}' $container 2> $null
    switch ($healthRaw) {
      'healthy' { $healthCell = Format-Cell 'healthy' $GREEN 10 }
      'unhealthy' { $healthCell = Format-Cell 'unhealthy' $RED 10 }
      'starting' { $healthCell = Format-Cell 'starting' $YELLOW 10 }
      default { $healthCell = 'N/A'.PadRight(10) }
    }
  } else {
    $statusCell = Format-Cell 'stopped' $RED 12
    $Stopped++
    $port = '-'; $memory = '-'; $uptime = '-'
    $healthCell = '-'.PadRight(10)
  }

  $line = ('{0,-15} ' -f $serverName) + ($statusCell + ' ') +
          ('{0,-8} ' -f $port) + ('{0,-8} ' -f $memory) +
          ('{0,-12} ' -f $uptime) + $healthCell
  Write-Info $line
}

Write-Info '================================================================================'
$total = $Running + $Stopped
Write-Info "Total: ${CYAN}${total}${NC} servers | Running: ${GREEN}${Running}${NC} | Stopped: ${RED}${Stopped}${NC}"
Write-Info ''

exit 0
