#!/bin/bash
# Script to analyze Java versions required by modpacks
# Used by GitHub Actions to optimize Docker image downloads

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Function to get Java version for a modpack
get_java_version() {
  local modpack="$1"
  local env_file="$PROJECT_ROOT/config/modpacks/${modpack}.env"

  if [[ ! -f "$env_file" ]]; then
    echo "ERROR: Modpack config not found: $env_file" >&2
    return 1
  fi

  # Extract JAVA_VERSION, default to 'latest' if not specified
  local java_version
  java_version=$(grep -E '^JAVA_VERSION=' "$env_file" | cut -d'=' -f2 | tr -d '"' || echo "latest")

  # Map to Docker image tag
  case "$java_version" in
    java8) echo "java8" ;;
    java11) echo "java11" ;;
    java17) echo "java17" ;;
    java21) echo "java21" ;;
    java25) echo "java25" ;;
    latest | "") echo "latest" ;;
    *)
      echo "WARNING: Unknown JAVA_VERSION '$java_version' for $modpack, using 'latest'" >&2
      echo "latest"
      ;;
  esac
}

# Function to analyze Java versions for a list of modpacks
analyze_modpacks_java_versions() {
  local modpacks="$1"
  local unique_versions=""

  echo "🔍 Analyzing Java versions for modpacks: $modpacks" >&2

  for modpack in $modpacks; do
    local java_version
    java_version=$(get_java_version "$modpack")
    echo "📦 $modpack -> $java_version" >&2

    # Add to unique versions if not already present
    if [[ "$unique_versions" != *"$java_version"* ]]; then
      unique_versions="${unique_versions:+$unique_versions }$java_version"
    fi
  done

  echo "✅ Required Java versions: $unique_versions" >&2
  echo "$unique_versions"
}

# Main execution
if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <modpack1> [modpack2] ..." >&2
  exit 1
fi

analyze_modpacks_java_versions "$*"
