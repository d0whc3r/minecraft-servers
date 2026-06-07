# health-check.ps1 - Server health monitoring and status checking (PowerShell port)
#
# Usage: pwsh ./scripts/health-check.ps1 [OPTIONS] [SERVER_NAME]
#
# OPTIONS:
#   -a, --all       Check all configured servers
#   -v, --verbose   Show detailed health information
#   -j, --json      Output in JSON format
#   -h, --help      Show this help message
#
# EXIT CODES:
#   0  Success - all servers healthy
#   1  Error - script execution failed
#   2  Invalid arguments
#   3  Server not found
#   4  Health check failed (one or more servers unhealthy)

. "$PSScriptRoot\common.ps1"

function Show-Usage {
  Write-Info "Usage: health-check.ps1 [OPTIONS] [SERVER_NAME]"
  Write-Info ''
  Write-Info 'Check health status of Minecraft servers.'
  Write-Info ''
  Write-Info 'OPTIONS:'
  Write-Info '    -a, --all              Check all configured servers'
  Write-Info '    -v, --verbose          Show detailed health information'
  Write-Info '    -j, --json             Output in JSON format'
  Write-Info '    -h, --help             Show this help message'
  Write-Info ''
  Write-Info 'EXIT CODES:'
  Write-Info '    0  Success - all servers healthy'
  Write-Info '    2  Invalid arguments'
  Write-Info '    3  Server not found'
  Write-Info '    4  Health check failed (one or more servers unhealthy)'
}

# JSON helpers (manual, to guarantee valid output on all PowerShell versions)
function ConvertTo-JsonString {
  param([string]$Value)
  return ($Value -replace '\\', '\\' -replace '"', '\"')
}
function ConvertTo-JsonStringArray {
  param([string[]]$Items)
  if (-not $Items -or $Items.Count -eq 0) { return '[]' }
  $escaped = $Items | ForEach-Object { '"' + (ConvertTo-JsonString $_) + '"' }
  return '[' + ($escaped -join ', ') + ']'
}

# Parse arguments
$AllServers = $false
$Verbose = $false
$JsonOutput = $false
$ServerName = ''

foreach ($arg in $args) {
  switch -Exact ($arg) {
    { $_ -in '-a', '--all' } { $AllServers = $true }
    { $_ -in '-v', '--verbose' } { $Verbose = $true }
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
if ((-not $AllServers) -and (-not $ServerName)) {
  Write-Err 'Must specify either --all or a server name'
  Show-Usage
  exit 2
}
if ($AllServers -and $ServerName) {
  Write-Err 'Cannot specify both --all and a server name'
  Show-Usage
  exit 2
}

# Get list of servers to check
function Get-ServerList {
  if ($AllServers) {
    Get-AvailableServers | Sort-Object
  } else {
    $ServerName
  }
}

# Check if server is responding on configured port
function Test-ServerPort {
  param([string]$Server)
  $port = Get-ConfigValue (Get-ConfigFile $Server) 'SERVER_PORT'
  if (-not $port) { return $false }
  return (Test-PortOpen ([int]$port))
}

# Check server process health via Docker logs (no error patterns)
function Test-ServerLogs {
  param([string]$Server)
  $containerName = "mc-$Server"
  $logs = docker logs --tail 50 $containerName 2> $null | Out-String

  if ($logs -match '(?i)error|exception|failed|crash') { return $false }
  if ($logs -match 'Done.*For help') { return $true }
  return $true
}

# Check disk space for server data (fail if drive > 90% used)
function Test-DiskSpace {
  param([string]$Server)
  $serverDir = "servers/$Server"
  if (-not (Test-Path -LiteralPath $serverDir -PathType Container)) { return $false }

  try {
    $full = (Resolve-Path -LiteralPath $serverDir).Path
    $root = [System.IO.Path]::GetPathRoot($full)
    $drive = Get-PSDrive -PSProvider FileSystem | Where-Object {
      $root.TrimEnd('\', '/').ToLower() -like ($_.Root.TrimEnd('\', '/').ToLower() + '*')
    } | Select-Object -First 1
    if (-not $drive) { return $true }
    $total = $drive.Used + $drive.Free
    if ($total -le 0) { return $true }
    $usage = [int](($drive.Used / $total) * 100)
    return ($usage -le 90)
  } catch {
    return $true
  }
}

# Perform comprehensive health check for a server. Returns a result hashtable.
function Get-ServerHealth {
  param([string]$Server)

  $issues = @()
  $details = @()
  $healthStatus = 'healthy'

  # Configured?
  if (-not (Test-Path -LiteralPath (Get-ConfigFile $Server) -PathType Leaf)) {
    return @{ server = $Server; status = 'error:server_not_found'; issues = @(); details = @(); rc = 1 }
  }

  $serverDir = "servers/$Server"
  if (-not (Test-Path -LiteralPath $serverDir -PathType Container)) {
    $healthStatus = 'not_deployed'
    $details += 'server:not_deployed'
  } else {
    $running = Test-ContainerRunning (Get-ContainerName $Server)
    if ($running) {
      $details += 'container:running'
    } else {
      $healthStatus = 'stopped'
      $issues += 'container_not_running'
      $details += 'container:stopped'
    }

    if ($running) {
      if (Test-ServerPort $Server) {
        $details += 'port:responsive'
      } else {
        $healthStatus = 'unhealthy'
        $issues += 'port_not_responding'
        $details += 'port:unresponsive'
      }

      if (Test-ServerLogs $Server) {
        $details += 'logs:healthy'
      } else {
        $healthStatus = 'warning'
        $issues += 'logs_show_errors'
        $details += 'logs:errors_detected'
      }

      if (Test-DiskSpace $Server) {
        $details += 'disk:healthy'
      } else {
        $healthStatus = 'warning'
        $issues += 'low_disk_space'
        $details += 'disk:low_space'
      }
    } else {
      $details += 'port:unknown'
      $details += 'logs:unknown'
      $details += 'disk:not_checked'
    }
  }

  $rc = if ($healthStatus -eq 'unhealthy') { 1 } else { 0 }
  return @{ server = $Server; status = $healthStatus; issues = $issues; details = $details; rc = $rc }
}

# Main execution
$servers = @(Get-ServerList)
$overallStatus = 0
$jsonBlocks = @()

foreach ($server in $servers) {
  $result = Get-ServerHealth $server
  if ($result.rc -ne 0) { $overallStatus = 4 }

  if ($JsonOutput) {
    $jsonBlocks += @"
  {
    "server": "$(ConvertTo-JsonString $result.server)",
    "status": "$(ConvertTo-JsonString $result.status)",
    "issues": $(ConvertTo-JsonStringArray $result.issues),
    "details": $(ConvertTo-JsonStringArray $result.details)
  }
"@
  } else {
    Write-Info "$($result.server):$($result.status)"
    if ($Verbose) {
      if ($result.issues.Count -gt 0) { Write-Info "  Issues: $($result.issues -join ' ')" }
      Write-Info "  Details: $($result.details -join ' ')"
    }
  }
}

if ($JsonOutput) {
  Write-Output '['
  Write-Output ($jsonBlocks -join ",`n")
  Write-Output ']'
}

exit $overallStatus
