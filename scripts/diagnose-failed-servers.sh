#!/usr/bin/env bash
# Diagnose Failed Servers Script
# Analyzes logs from failed servers to identify root causes

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED_SERVERS=(
    "atm8"
    "my-hero-adventure"
    "prominence2"
    "rlcraft"
    "skyfactory4"
    "unofficial-dragon-block-c"
)

CLIENT_ONLY_SERVERS=(
    "amazing-fps-booster"
    "solocraft-modpack"
)

echo "================================================"
echo "Failed Servers Diagnostic Tool"
echo "================================================"
echo ""

diagnose_server() {
    local server_name="$1"
    local container_name="mc-${server_name}"
    
    echo -e "${YELLOW}=== Analyzing: $server_name ===${NC}"
    
    # Check if container exists
    if ! docker ps -a --filter "name=${container_name}" --format "{{.Names}}" | grep -q "^${container_name}$"; then
        echo -e "${RED}✗ Container not found${NC}"
        echo "  Try starting: ./scripts/start-server.sh $server_name"
        echo ""
        return
    fi
    
    # Get container status
    local status
    status=$(docker inspect "${container_name}" --format='{{.State.Status}}' 2>/dev/null || echo "unknown")
    local exit_code
    exit_code=$(docker inspect "${container_name}" --format='{{.State.ExitCode}}' 2>/dev/null || echo "unknown")
    
    echo "Container Status: $status"
    echo "Exit Code: $exit_code"
    echo ""
    
    # Get memory allocation from config
    local config_file="config/modpacks/${server_name}.env"
    if [ -f "$config_file" ]; then
        local memory
        memory=$(grep "^MEMORY=" "$config_file" | cut -d'=' -f2)
        echo "Configured Memory: $memory"
    fi
    
    echo ""
    echo "Last 40 log lines:"
    echo "---"
    docker logs "$container_name" 2>&1 | tail -40 | sed 's/^/  /'
    echo "---"
    
    # Analyze common errors
    echo ""
    echo "Error Analysis:"
    
    local logs
    logs=$(docker logs "$container_name" 2>&1)
    
    if echo "$logs" | grep -q -i "OutOfMemoryError"; then
        echo -e "  ${RED}⚠️  Out of Memory Error detected${NC}"
        echo "     Solution: Increase MEMORY in config file"
    fi
    
    if echo "$logs" | grep -q -i "ClassNotFoundException\|NoClassDefFoundError"; then
        echo -e "  ${RED}⚠️  Missing class/dependency error${NC}"
        echo "     Solution: Check mod compatibility or Java version"
    fi
    
    if echo "$logs" | grep -q -i "Mixin.*client"; then
        echo -e "  ${RED}⚠️  Client-side mixin error${NC}"
        echo "     Solution: This may be a client-only modpack"
    fi
    
    if echo "$logs" | grep -q -i "Failed to download\|Connection refused\|Could not resolve"; then
        echo -e "  ${RED}⚠️  Network/download error${NC}"
        echo "     Solution: Check internet connection or mod source availability"
    fi
    
    if echo "$logs" | grep -q "Done (.*s)! For help"; then
        echo -e "  ${GREEN}✓ Server started successfully${NC}"
    fi
    
    echo ""
    echo "================================================"
    echo ""
}

echo "Starting diagnostics..."
echo ""

for server in "${FAILED_SERVERS[@]}"; do
    diagnose_server "$server"
    sleep 1
done

echo ""
echo "=== CLIENT-ONLY MODPACKS (Not suitable for servers) ==="
echo ""
for server in "${CLIENT_ONLY_SERVERS[@]}"; do
    echo -e "${YELLOW}$server${NC}: Client-only modpack - will not work as server"
done

echo ""
echo "================================================"
echo "Diagnostic complete"
echo "================================================"
echo ""
echo "To fix issues:"
echo "1. Increase MEMORY in config/modpacks/{server-name}.env"
echo "2. Check for client-only mods that need exclusion"
echo "3. Verify Java version requirements"
echo "4. Remove client-only modpacks from server list"
echo ""
