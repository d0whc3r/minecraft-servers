# analyze-java-versions.ps1 - Analyze Java versions required by modpacks (PowerShell port)
# Used by CI to optimize Docker image downloads.
#
# Progress goes to the information stream (Write-Host); the resulting
# space-separated list of unique Java versions is written to stdout.

. "$PSScriptRoot\common.ps1"

# Get Java version (Docker image tag) for a single modpack.
function Get-JavaVersion {
  param([string]$Modpack)

  $envFile = "config/modpacks/$Modpack.env"
  if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
    Write-Host "ERROR: Modpack config not found: $envFile"
    return $null
  }

  $javaVersion = Get-ConfigValue $envFile 'JAVA_VERSION'
  if (-not $javaVersion) { $javaVersion = 'latest' }

  switch ($javaVersion) {
    'java8' { return 'java8' }
    'java11' { return 'java11' }
    'java17' { return 'java17' }
    'java21' { return 'java21' }
    'latest' { return 'latest' }
    default {
      Write-Host "WARNING: Unknown JAVA_VERSION '$javaVersion' for $Modpack, using 'latest'"
      return 'latest'
    }
  }
}

# Analyze a set of modpacks and return the unique required Java versions.
function Get-UniqueJavaVersions {
  param([string[]]$Modpacks)

  $unique = @()
  Write-Host "Analyzing Java versions for modpacks: $($Modpacks -join ' ')"

  foreach ($modpack in $Modpacks) {
    $javaVersion = Get-JavaVersion $modpack
    if (-not $javaVersion) { continue }
    Write-Host "$modpack -> $javaVersion"
    if ($unique -notcontains $javaVersion) { $unique += $javaVersion }
  }

  Write-Host "Required Java versions: $($unique -join ' ')"
  return ($unique -join ' ')
}

# Main execution
if ($args.Count -eq 0) {
  Write-Host "Usage: analyze-java-versions.ps1 <modpack1> [modpack2] ..."
  exit 1
}

Write-Output (Get-UniqueJavaVersions $args)
