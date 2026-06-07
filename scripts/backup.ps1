# backup.ps1 - Create backup for Minecraft server (PowerShell port of backup.sh)
#
# Usage: pwsh ./scripts/backup.ps1 <server-name>
# Creates atomic backup with checksum verification and rolling retention.

. "$PSScriptRoot\common.ps1"

$BackupRetention = 3

# Validate arguments
if ($args.Count -ne 1) {
  Write-Info "Usage: backup.ps1 <server-name>"
  Write-Info "Example: backup.ps1 atm8"
  exit 2
}

$ServerName = $args[0]

if (-not (Test-ServerName $ServerName)) { exit 2 }

# tar is required (ships with Windows 10 1803+)
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

# Check if server is running
$ContainerName = Get-ContainerName $ServerName
if (-not (Test-ContainerRunning $ContainerName)) {
  Write-Err "Server '$ServerName' is not running (container: $ContainerName)"
  Write-Err "Start the server first with: ./scripts/start-server.ps1 $ServerName"
  exit 3
}

# Setup backup paths
$BackupDir = Get-BackupDir $ServerName
$ServerDataDir = Get-DataDir $ServerName

New-DirectoryIfMissing $BackupDir

$Timestamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
$BackupFilename = "$ServerName-$Timestamp.tar.gz"
$BackupPath = Join-Path $BackupDir $BackupFilename
$ChecksumPath = "$BackupPath.sha256"

Write-Info "Starting backup for server: $ServerName"
Write-Info "Backup file: $BackupFilename"

$StartTime = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

# Stop server temporarily for atomic backup
Write-Info 'Stopping server temporarily for backup...'
docker stop $ContainerName *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Err 'Failed to stop server container'
  exit 1
}

Start-Sleep -Seconds 5

# Create backup archive
Write-Info 'Creating backup archive...'
tar czf $BackupPath -C "servers/$ServerName" data 2> $null
if ($LASTEXITCODE -ne 0) {
  Write-Warn 'Backup failed, restarting server...'
  docker start $ContainerName *> $null
  Write-Err 'Failed to create backup archive'
  exit 1
}

# Calculate checksum (lowercase hex to match sha256sum format)
Write-Info 'Calculating checksum...'
$Checksum = (Get-FileHash -LiteralPath $BackupPath -Algorithm SHA256).Hash.ToLower()
"$Checksum  $BackupFilename" | Out-File -LiteralPath $ChecksumPath -Encoding ascii

# Restart server
Write-Info 'Restarting server...'
docker start $ContainerName *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Err 'Failed to restart server after backup'
  Write-Err "Server may need manual restart: docker start $ContainerName"
  exit 1
}

# Calculate backup size and compression ratio
$BackupSize = (Get-Item -LiteralPath $BackupPath).Length
$BackupSizeMb = [int]($BackupSize / 1MB)

$OriginalEstimateMb = 0
if (Test-Path -LiteralPath $ServerDataDir -PathType Container) {
  $sum = (Get-ChildItem -LiteralPath $ServerDataDir -Recurse -File -ErrorAction SilentlyContinue |
    Measure-Object -Property Length -Sum).Sum
  if ($sum) { $OriginalEstimateMb = [int]($sum / 1MB) }
}
$CompressionRatio = if ($OriginalEstimateMb -gt 0) { [int]($BackupSizeMb * 100 / $OriginalEstimateMb) } else { 0 }

$EndTime = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$Duration = $EndTime - $StartTime

# Clean up old backups (keep only $BackupRetention most recent)
Write-Info "Checking backup retention (keeping $BackupRetention most recent)..."
$allBackups = @(Get-ChildItem -LiteralPath $BackupDir -Filter '*.tar.gz' -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending)
if ($allBackups.Count -gt $BackupRetention) {
  $toDelete = $allBackups | Select-Object -Skip $BackupRetention
  foreach ($old in $toDelete) {
    Write-Info "Deleting old backup: $($old.Name)"
    Remove-Item -LiteralPath $old.FullName -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath "$($old.FullName).sha256" -Force -ErrorAction SilentlyContinue
  }
}

# Success output
Write-Success 'Backup completed successfully!'
Write-Info "Server: $ServerName"
Write-Info "Backup: $BackupPath"
Write-Info "Size: ${BackupSizeMb}MB"
if ($CompressionRatio -gt 0) { Write-Info "Compression: ${CompressionRatio}%" }
Write-Info "Checksum: $Checksum"
Write-Info "Duration: ${Duration}s"

# List current backups
Write-Info ''
Write-Info "Current backups for ${ServerName}:"
foreach ($b in (Get-ChildItem -LiteralPath $BackupDir -Filter '*.tar.gz' -File -ErrorAction SilentlyContinue)) {
  $sizeMb = [int]($b.Length / 1MB)
  Write-Info "  $($b.Name) (${sizeMb}MB)"
}

exit 0
