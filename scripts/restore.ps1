# restore.ps1 - Restore Minecraft server from backup (PowerShell port of restore.sh)
#
# Usage: pwsh ./scripts/restore.ps1 <server-name> <backup-file> [--force]
# Restores server world data from backup archive with checksum verification.

. "$PSScriptRoot\common.ps1"

# Validate arguments
if ($args.Count -lt 2 -or $args.Count -gt 3) {
  Write-Info "Usage: restore.ps1 <server-name> <backup-file> [--force]"
  Write-Info "Example: restore.ps1 atm8 atm8-20251108-143022.tar.gz"
  Write-Info "Example: restore.ps1 vanilla vanilla-20251108-120000.tar.gz --force"
  exit 2
}

$ServerName = $args[0]
$BackupFile = $args[1]
$Force = $false

if ($args.Count -eq 3) {
  if ($args[2] -eq '--force') {
    $Force = $true
  } else {
    Write-Err "Invalid option: $($args[2])"
    Write-Err 'Use --force to skip confirmation prompt'
    exit 2
  }
}

if (-not (Test-ServerName $ServerName)) { exit 2 }

if (-not (Get-Command tar -ErrorAction SilentlyContinue)) {
  Write-Err "'tar' not found. Install Windows 10 1803+ (includes tar) or add tar to PATH."
  exit 1
}

# Check if server config exists
$ConfigFile = Get-ConfigFile $ServerName
if (-not (Test-Path -LiteralPath $ConfigFile -PathType Leaf)) {
  Write-Err "Server configuration not found: $ConfigFile"
  exit 3
}

# Resolve backup file path
if ([System.IO.Path]::IsPathRooted($BackupFile)) {
  $BackupPath = $BackupFile
} else {
  $BackupPath = Join-Path (Get-BackupDir $ServerName) $BackupFile
}

if (-not (Test-Path -LiteralPath $BackupPath -PathType Leaf)) {
  Write-Err "Backup file not found: $BackupPath"
  exit 3
}

$ChecksumPath = "$BackupPath.sha256"
if (-not (Test-Path -LiteralPath $ChecksumPath -PathType Leaf)) {
  Write-Err "Checksum file not found: $ChecksumPath"
  exit 3
}

# Verify backup integrity
Write-Info 'Verifying backup integrity...'
$expectedHash = (Get-Content -LiteralPath $ChecksumPath -First 1).Split(' ')[0].Trim()
$actualHash = (Get-FileHash -LiteralPath $BackupPath -Algorithm SHA256).Hash.ToLower()
if ($expectedHash.ToLower() -ne $actualHash) {
  Write-Err 'Backup integrity check failed!'
  Write-Err 'The backup file may be corrupted or modified.'
  exit 4
}

$BackupSize = (Get-Item -LiteralPath $BackupPath).Length
$BackupSizeMb = [int]($BackupSize / 1MB)

# Confirmation prompt (unless --force)
if (-not $Force) {
  Write-Info ''
  Write-Warn "WARNING: This will replace all world data for server: $ServerName"
  Write-Info "Backup: $([System.IO.Path]::GetFileName($BackupPath)) (${BackupSizeMb}MB)"
  Write-Info 'Server will be stopped during restore.'
  Write-Info ''
  $reply = Read-Host 'Proceed? [y/N]'
  if ($reply -notmatch '^[Yy]') {
    Write-Info 'Restore cancelled by user'
    exit 126
  }
}

Write-Info "Starting restore for server: $ServerName"
Write-Info "Backup file: $([System.IO.Path]::GetFileName($BackupPath)) (${BackupSizeMb}MB)"

$StartTime = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

# Stop server if running
$ContainerName = Get-ContainerName $ServerName
$ServerWasRunning = $false

if (Test-ContainerRunning $ContainerName) {
  $ServerWasRunning = $true
  Write-Info 'Stopping running server...'
  docker stop $ContainerName *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Err 'Failed to stop server container'
    exit 1
  }
}

Start-Sleep -Seconds 3

# Setup paths
$ServerDataDir = Get-DataDir $ServerName
New-DirectoryIfMissing $ServerDataDir

# Clear existing data
Write-Info 'Clearing existing world data...'
try {
  if ($ServerDataDir) {
    Get-ChildItem -LiteralPath $ServerDataDir -Force -ErrorAction SilentlyContinue |
      Remove-Item -Recurse -Force -ErrorAction Stop
  }
} catch {
  Write-Warn 'Failed to clear some files (may not exist yet)'
}

# Extract backup
Write-Info 'Extracting backup archive...'
tar xzf $BackupPath -C "servers/$ServerName" 2> $null
if ($LASTEXITCODE -ne 0) {
  Write-Err 'Failed to extract backup archive'
  if ($ServerWasRunning) {
    Write-Warn 'Attempting to restart server after failed restore...'
    docker start $ContainerName *> $null
  }
  exit 1
}

# File ownership: not applicable on Windows (Docker Desktop manages this)
Write-Info 'Setting file permissions...'
Write-Warn 'Skipping chown (not applicable on Windows; Docker Desktop manages permissions)'

# Restart server if it was running before
if ($ServerWasRunning) {
  Write-Info 'Restarting server...'
  docker start $ContainerName *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Err 'Failed to restart server after restore'
    Write-Err "Server may need manual restart: docker start $ContainerName"
    exit 1
  }
}

$EndTime = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$Duration = $EndTime - $StartTime

# Success output
Write-Success 'Restore completed successfully!'
Write-Info "Server: $ServerName"
Write-Info "Backup: $([System.IO.Path]::GetFileName($BackupPath))"
Write-Info "Data restored: ${BackupSizeMb}MB"
Write-Info "Duration: ${Duration}s"

if ($ServerWasRunning) {
  Write-Info 'Server status: Restarted'
} else {
  Write-Info 'Server status: Stopped (was not running before restore)'
  Write-Info "Start with: ./scripts/start-server.ps1 $ServerName"
}

exit 0
