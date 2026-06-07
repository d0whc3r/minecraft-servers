#!/usr/bin/env bash
# Pre-download the itzg/minecraft-server images for the given Java versions and
# cache them as .tar files so test jobs can `docker load` them quickly.
#
# Usage: predownload-images.sh <version>...   (e.g. java21 java17 latest)
#
# Env:
#   DOCKER_IMAGE_CACHE_DIR  Cache directory (default: /tmp/docker-images)
#
# A failed pull is logged and skipped (non-fatal) so one unavailable tag does
# not abort the whole pipeline.
set -euo pipefail

CACHE_DIR="${DOCKER_IMAGE_CACHE_DIR:-/tmp/docker-images}"
mkdir -p "$CACHE_DIR"

declare -A VERSION_MAP=(
  ["latest"]="itzg/minecraft-server:latest"
  ["java8"]="itzg/minecraft-server:java8"
  ["java11"]="itzg/minecraft-server:java11"
  ["java17"]="itzg/minecraft-server:java17"
  ["java21"]="itzg/minecraft-server:java21"
)

echo "🔍 Required Java versions: $*"
echo "📥 Pre-downloading required Minecraft server images..."

for version in "$@"; do
  image="${VERSION_MAP[$version]:-}"
  if [ -z "$image" ]; then
    echo "⚠️  Unknown version '$version', skipping..."
    continue
  fi

  echo "📦 Downloading $image..."
  if docker pull "$image"; then
    echo "✅ Successfully downloaded $image"
    image_name=$(echo "$image" | tr '/' '_' | tr ':' '_')
    docker save "$image" -o "$CACHE_DIR/${image_name}.tar"
    echo "💾 Saved $image to cache"
  else
    echo "⚠️  Failed to download $image, continuing..."
  fi
done

echo "🎯 Pre-download complete. Images cached for test jobs."
