# SkyFactory 4

Servidor de SkyFactory 4 fijado a una versión reproducible y configurado para
crear el mundo vacío clásico del pack.

## Versión fijada

| Componente                      | Versión                                     |
| ------------------------------- | ------------------------------------------- |
| SkyFactory 4                    | 4.2.4 (release)                             |
| Archivo principal de CurseForge | `SkyFactory 4-4.2.4.zip` (`3565683`)        |
| Server pack de referencia       | `SkyFactory-4_Server_4_2_4.zip` (`3565687`) |
| Minecraft                       | 1.12.2                                      |
| Forge                           | 14.23.5.2860                                |
| Java                            | 8                                           |
| Memoria configurada             | 6 GB                                        |

`AUTO_CURSEFORGE` usa el archivo principal con manifest, no el ZIP de servidor.
El server pack oficial se ha usado como referencia para Forge, memoria y
propiedades del mundo.

## Mundo SkyFactory

La configuración incluye los valores indicados por la guía multijugador
oficial:

```env
LEVEL_TYPE=DEFAULT
GENERATOR_SETTINGS={"Topography-Preset":"Sky Factory 4"}
SPAWN_PROTECTION=0
```

Deben estar presentes antes del primer arranque. Si `servers/skyfactory4/data`
ya contiene un mundo normal, cambiar estas variables no lo convierte en
skyblock: haz una copia de seguridad y genera un mundo nuevo de forma
deliberada.

También se permiten vuelo, Nether y command blocks porque el server pack
oficial los habilita para las mecánicas del modpack.

## Arranque y acceso

```bash
./scripts/start-server.sh skyfactory4
docker logs -f mc-skyfactory4
```

- Ruta de juego: `skyfactory4.<MC_ROUTER_DOMAIN>`
- Cliente requerido: SkyFactory 4 4.2.4
- RCON local: `127.0.0.1:26565`
- Datos: `servers/skyfactory4/data`
- Backups: `backups/skyfactory4/`

El perfil conserva las decisiones locales del repositorio: máximo de 10
jugadores, dificultad normal, PvP habilitado y `ONLINE_MODE=false`. Activa el
modo online si el servidor va a ser público.

## Islas multijugador

La guía oficial documenta estos comandos de Topography:

```text
/topography spawn [player]
/topography island
/topography island home [player]
/topography island new [player]
/topography island set [player] x z
/topography island info [player]
/topography island invite
/topography island accept
```

Prestige es opcional y no se activa desde este perfil. Si se quiere usar, debe
configurarse expresamente en `prestige.cfg` después de que el pack lo genere.

## Actualizaciones

Antes de cambiar desde una versión anterior a 4.2.4, abre las tumbas existentes
y realiza un backup: las notas oficiales avisan de un cambio de mod de tumbas
que puede hacer inaccesibles las antiguas.

## Fuentes verificadas

Comprobadas el 12 de septiembre de 2026:

- [Proyecto oficial en CurseForge](https://www.curseforge.com/minecraft/modpacks/skyfactory-4)
- [Archivo principal 4.2.4](https://www.curseforge.com/minecraft/modpacks/skyfactory-4/files/3565683)
- [Server pack 4.2.4](https://www.curseforge.com/minecraft/modpacks/skyfactory-4/files/3565687)
- [Guía multijugador oficial](https://github.com/DarkPacks/SkyFactory-4/wiki/Multiplayer-Instructions)
- [Variables de generación de itzg/minecraft-server](https://docker-minecraft-server.readthedocs.io/en/latest/configuration/server-properties/#level-type-and-generator-settings)
