# auto-restart.ps1 - Automatically restart unhealthy Minecraft servers (PowerShell port)
#
# Usage: pwsh ./scripts/auto-restart.ps1 [OPTIONS]
#
# OPTIONS:
#   -d, --daemon            Run in daemon mode (continuous monitoring)
#   -i, --interval=SECONDS  Interval between health checks (default: 300)
#   -t, --timeout=SECONDS   Timeout for restart operations (default: 300)
#   -f, --force             Force restart even if health check passes
#   -n, --dry-run           Show what would be done without making changes
#   -v, --verbose           Show detailed output
#   -h, --help              Show this help message
#
# EXIT CODES:
#   0  Success - no restarts needed or all restarts successful
#   2  Invalid arguments
#   3  Restart failed for one or more servers

. "$PSScriptRoot\common.ps1"

function Show-Usage {
  Write-Info "Usage: auto-restart.ps1 [OPTIONS]"
  Write-Info ''
  Write-Info 'Automatically restart unhealthy Minecraft servers.'
  Write-Info ''
  Write-Info 'OPTIONS:'
  Write-Info '    -d, --daemon            Run in daemon mode (continuous monitoring)'
  Write-Info '    -i, --interval=SECONDS  Interval between health checks (default: 300)'
  Write-Info '    -t, --timeout=SECONDS   Timeout for restart operations (default: 300)'
  Write-Info '    -f, --force             Force restart even if health check passes'
  Write-Info '    -n, --dry-run           Show what would be done without making changes'
  Write-Info '    -v, --verbose           Show detailed output'
  Write-Info '    -h, --help              Show this help message'
}

# Defaults
$DaemonMode = $false
$Interval = 300
$Timeout = 300
$ForceRestart = $false
$DryRun = $false
$VerboseOut = $false

# Parse command line arguments
for ($i = 0; $i -lt $args.Count; $i++) {
  $a = $args[$i]
  switch -Wildcard ($a) {
    '-d' { $DaemonMode = $true }
    '--daemon' { $DaemonMode = $true }
    '--interval=*' {
      $Interval = $a -replace '^--interval=', ''
      if (($Interval -notmatch '^[0-9]+$') -or ([int]$Interval -lt 30)) {
        Write-Err 'Interval must be a number >= 30 seconds'; exit 2
      }
      $Interval = [int]$Interval
    }
    '-i' {
      $i++; $Interval = $args[$i]
      if (($Interval -notmatch '^[0-9]+$') -or ([int]$Interval -lt 30)) {
        Write-Err 'Interval must be a number >= 30 seconds'; exit 2
      }
      $Interval = [int]$Interval
    }
    '--timeout=*' {
      $Timeout = $a -replace '^--timeout=', ''
      if (($Timeout -notmatch '^[0-9]+$') -or ([int]$Timeout -lt 30)) {
        Write-Err 'Timeout must be a number >= 30 seconds'; exit 2
      }
      $Timeout = [int]$Timeout
    }
    '-t' {
      $i++; $Timeout = $args[$i]
      if (($Timeout -notmatch '^[0-9]+$') -or ([int]$Timeout -lt 30)) {
        Write-Err 'Timeout must be a number >= 30 seconds'; exit 2
      }
      $Timeout = [int]$Timeout
    }
    '-f' { $ForceRestart = $true }
    '--force' { $ForceRestart = $true }
    '-n' { $DryRun = $true }
    '--dry-run' { $DryRun = $true }
    '-v' { $VerboseOut = $true }
    '--verbose' { $VerboseOut = $true }
    '-h' { Show-Usage; exit 0 }
    '--help' { Show-Usage; exit 0 }
    default { Write-Err "Unknown option: $a"; Show-Usage; exit 2 }
  }
}

# Check server health status. Returns: not_deployed | stopped | <docker health> | unknown
function Get-AutoServerHealth {
  param([string]$Server)
  $containerName = Get-ContainerName $Server

  if (-not (Test-ContainerExists $containerName)) { return 'not_deployed' }

  $status = docker inspect --format '{{.State.Status}}' $containerName 2> $null
  if ($LASTEXITCODE -ne 0 -or -not $status) { $status = 'unknown' }
  if ($status -ne 'running') { return 'stopped' }

  $health = docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' $containerName 2> $null
  if ($LASTEXITCODE -ne 0 -or -not $health) { $health = 'unknown' }
  return $health
}

# Restart a server. Returns $true on success.
function Invoke-RestartServer {
  param([string]$Server, [string]$Reason)

  if ($DryRun) {
    Write-Info "[DRY RUN] Would restart $Server (reason: $Reason)"
    return $true
  }

  Write-Warn "Restarting $Server (reason: $Reason)"

  $scriptPath = Join-Path $PSScriptRoot 'restart-server.ps1'
  if (Test-Path -LiteralPath $scriptPath -PathType Leaf) {
    $exe = (Get-Process -Id $PID).Path
    $procArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $scriptPath, $Server)
    $p = Start-Process -FilePath $exe -ArgumentList $procArgs -PassThru -NoNewWindow
    if ($p.WaitForExit($Timeout * 1000)) {
      if ($p.ExitCode -eq 0) { Write-Success "Successfully restarted $Server"; return $true }
      Write-Err "Failed to restart $Server"; return $false
    } else {
      try { $p.Kill() } catch { }
      Write-Err "Failed to restart $Server (timeout)"; return $false
    }
  } else {
    $containerName = Get-ContainerName $Server
    docker restart $containerName *> $null
    if ($LASTEXITCODE -eq 0) { Write-Success "Successfully restarted $Server"; return $true }
    Write-Err "Failed to restart $Server"; return $false
  }
}

# Check and restart unhealthy servers. Returns exit code (0 ok, 3 failures).
function Invoke-CheckAndRestart {
  $servers = @(Get-AvailableServers | Sort-Object)
  $restartCount = 0
  $failedCount = 0

  foreach ($server in $servers) {
    $health = Get-AutoServerHealth $server

    if ($VerboseOut) { Write-Info "Server $server health: $health" }

    $needsRestart = $false
    $reason = ''

    switch ($health) {
      'unhealthy' { $needsRestart = $true; $reason = 'unhealthy' }
      'stopped' { $needsRestart = $true; $reason = 'stopped' }
      'unknown' {
        if (Test-ContainerExists (Get-ContainerName $server)) {
          $needsRestart = $true; $reason = 'health_check_unknown'
        }
      }
    }

    if ($ForceRestart -and $health -ne 'not_deployed') {
      $needsRestart = $true; $reason = 'force_restart'
    }

    if ($needsRestart) {
      if (Invoke-RestartServer $server $reason) { $restartCount++ } else { $failedCount++ }
    }
  }

  if ($restartCount -gt 0) { Write-Success "Restarted $restartCount server(s)" }
  if ($failedCount -gt 0) {
    Write-Err "Failed to restart $failedCount server(s)"
    return 3
  }
  if ($restartCount -eq 0 -and $failedCount -eq 0 -and $VerboseOut) {
    Write-Info 'No servers needed restarting'
  }
  return 0
}

# Daemon mode - run continuously
function Start-Daemon {
  Write-Info "Starting auto-restart daemon (interval: ${Interval}s)"
  while ($true) {
    $startTime = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    if ((Invoke-CheckAndRestart) -ne 0) { Write-Err 'Health check cycle failed' }
    $endTime = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $elapsed = $endTime - $startTime
    $sleepTime = $Interval - $elapsed
    if ($sleepTime -gt 0) {
      if ($VerboseOut) { Write-Info "Sleeping for ${sleepTime}s until next check" }
      Start-Sleep -Seconds $sleepTime
    } else {
      Write-Warn "Health check took longer than interval (${elapsed}s > ${Interval}s)"
    }
  }
}

# Main execution
if ($DaemonMode) {
  Start-Daemon
} else {
  exit (Invoke-CheckAndRestart)
}
