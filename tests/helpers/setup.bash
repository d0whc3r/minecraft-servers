#!/bin/bash
# Test environment prerequisites validation script

set -e

echo "🔍 Validating test environment prerequisites..."

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker."
    exit 1
fi

echo "✅ Docker is installed"

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running. Please start Docker."
    exit 1
fi

echo "✅ Docker daemon is running"

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

echo "✅ Docker Compose is available"

# Check if BATS is available
if ! ./node_modules/.bin/bats --version &> /dev/null; then
    echo "❌ BATS is not available. Please run 'pnpm install' to install dependencies."
    exit 1
fi

echo "✅ BATS is available"

# Check if start-server.sh script exists
if [ ! -f "scripts/start-server.sh" ]; then
    echo "❌ scripts/start-server.sh not found. Please ensure the script exists."
    exit 1
fi

echo "✅ start-server.sh script exists"

# Check if script is executable
if [ ! -x "scripts/start-server.sh" ]; then
    echo "⚠️  scripts/start-server.sh is not executable. Making it executable..."
    chmod +x scripts/start-server.sh
    echo "✅ Made start-server.sh executable"
fi

echo ""
echo "🎉 All test environment prerequisites validated successfully!"
echo ""
echo "You can now run tests with:"
echo "  pnpm test              # Run all tests"
echo "  pnpm run test:verbose  # Run tests with verbose output"
echo "  pnpm run test:start-server  # Run only start-server tests"