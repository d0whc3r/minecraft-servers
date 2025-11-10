# Failed Servers Analysis & Fixes

## Summary of Failed Servers (from test run)

```
❌ Failed servers:
  - amazing-fps-booster:stopped_exit_0
  - atm8:fatal_error
  - my-hero-adventure:stopped_exit_1
  - prominence2:stopped_exit_1
  - rlcraft:stopped_exit_1
  - skyfactory4:stopped_exit_1
  - solocraft-modpack:stopped_exit_0
  - unofficial-dragon-block-c:stopped_exit_1
```

## Root Cause Analysis

### 1. amazing-fps-booster (stopped_exit_0)

**Problem**: Client-only modpack  
**Details**:

- This is an FPS optimization modpack designed ONLY for clients
- Contains client-only mods (mantlegg, elementa, melody) with client-side mixins
- Error: `@Mixin target net.minecraft.class_746 was not found` (client rendering classes)
- The modpack tries to load client UI/rendering code on a server

**Solution**:

- **REMOVE THIS SERVER** - Not designed for server use
- Alternative: Use server-side performance mods instead (Lithium, Starlight, etc.)

**Action Required**:

1. Delete `config/modpacks/amazing-fps-booster.env`
2. Delete `servers/amazing-fps-booster/` directory
3. Update documentation to note this is client-only

### 2. atm8 (fatal_error)

**Problem**: Needs investigation  
**Status**: Pending log analysis

**Action Required**: Check logs with `docker logs mc-atm8`

### 3. solocraft-modpack (stopped_exit_0)

**Problem**: Likely client-only mods in modpack  
**Status**: Modrinth modpack, needs client mod exclusion

**Solution**: Add server-side filtering:

```env
# Exclude client-side mods
MODRINTH_EXCLUDE_FILES: \
  | clientmod1
clientmod2
```

**Action Required**: Investigate which mods are client-only

### 4. Exit 1 Servers (my-hero-adventure, prominence2, rlcraft, skyfactory4, unofficial-dragon-block-c)

**Common Causes**:

1. Insufficient memory allocation
2. Missing dependencies
3. Mod incompatibilities
4. Java version mismatch

**Investigation Steps** (per server):

1. Check logs: `docker logs mc-{server-name}`
2. Verify memory allocation (MEMORY in .env)
3. Check Java version requirements
4. Verify mod loader version

## Recommended Actions

### Immediate Actions

1. **Remove client-only modpacks**:
   - `amazing-fps-booster` - FPS optimization is client-side only

2. **Investigate each Exit 1 server individually**:

   ```bash
   for server in my-hero-adventure prominence2 rlcraft skyfactory4 unofficial-dragon-block-c; do
     echo "=== $server ==="
     docker logs mc-$server 2>&1 | tail -50
   done
   ```

3. **Check memory requirements**:
   - RLCraft: Needs 4-6GB minimum
   - Sky Factory 4: Needs 4-6GB minimum
   - Prominence 2: Needs 6-8GB minimum
   - ATM8: Needs 6-8GB minimum (currently only 4GB)

### Configuration Fixes Needed

#### ATM8

```env
# Increase memory - ATM8 is memory-hungry
MEMORY=6G
INIT_MEMORY=6G
MAX_MEMORY=6G
```

#### Server Name Consistency

Some configs have `SERVER_NAME` with spaces or uppercase - Docker container names should be lowercase, no spaces.

**solocraft-modpack.env**:

```env
# BEFORE:
SERVER_NAME=SoloCraft Survival

# AFTER:
SERVER_NAME=solocraft-modpack
```

## Next Steps

1. Run individual server diagnostics
2. Update memory allocations based on modpack requirements
3. Remove client-only modpacks
4. Add client mod exclusions for hybrid modpacks
5. Document minimum requirements per modpack

## Test Strategy

After fixes, re-run tests individually:

```bash
# Test one server at a time
./scripts/start-server.sh atm8
docker logs -f mc-atm8

# Verify startup completes
docker logs mc-atm8 2>&1 | grep -i "done"
```
