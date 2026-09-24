---
modulo: persistence
ruta: packages/persistence
estado: en-desarrollo
specs: [027]
actualizado: 2026-09-24
---

# Módulo: persistence

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Guarda y carga el mundo en SQLite: estado, registro de eventos append-only, instantáneas, entradas externas, órdenes de control, compactación.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 027 | CA-001, CA-003 (muerte abrupta aquí; cierre limpio con SIGTERM, R-007, en `apps/worker`), CA-004, CA-006 | CA-002 y CA-005 (compactación, M4), CA-007 (no hay peldaño anterior hasta M1), CA-008 (memoria, spec 013) |


## 3. API pública
Desde `@datas-world/persistence` (`src/index.ts`):

| Símbolo | Archivo | Descripción |
|---|---|---|
| `openWorldDb(path, { migrationsDir? })` | `src/db.ts` | Conexión del worker (único escritor): pragmas R-003 y migraciones pendientes (R-006) |
| `openReadonly(path)` | `src/db.ts` | Conexión de solo lectura para la API (R-001). No migra; falla si el esquema no está al día |
| `closeDb(db)` | `src/db.ts` | Cierre limpio: `wal_checkpoint(TRUNCATE)` si es escritor |
| `migrate`, `listMigrations`, `schemaVersion`, `MIGRATIONS_DIR`, tipo `Db` | `src/db.ts` | Migraciones numeradas `NNN-nombre.sql` en `migrations/` |
| `WorldRepository` | `src/repository.ts` | `flush({ world, events?, inputs? })`, `loadWorld()`, `hasWorld()`, `saveSnapshot(world)`, `loadSnapshot(at?)`, `readEvents(afterSeq?, limit?)`, `readInputs()`, `lastInput()`, `countEvents(type?)`, `countSnapshots()`, `lastSeq` |
| `WorldSession` | `src/session.ts` | Une un `Runner` con el repositorio: `ticked(n)` (flush cada `FLUSH_TICKS`), `flush()` (entradas nuevas una sola vez, instantánea al cambiar de periodo), `advanceTicks(n, onProgress?)`. La usan el worker y `world:advance` |
| `enqueueCommand`, `pendingCommands`, `finishCommand`, `CONTROL_COMMANDS`, tipos `ControlCommand`/`ControlCommandName` | `src/control.ts` | Órdenes de control (`done`: 0 pendiente, 1 aplicada, -1 rechazada). En M0 solo las encola la CLI |
| `acquireWriterLock`, `releaseWriterLock`, `writerLock` | `src/control.ts` | Cerrojo de escritor en `meta.writer_pid` (R-001); se recupera si su dueño ya no existe |
| `encodeSnapshot`, `decodeSnapshot`, `columnToLE`, `columnFromLE` | `src/codec.ts` | Formato binario de instantáneas y columnas |
| `FLUSH_TICKS`, `SNAPSHOT_EVERY_DAYS` | `src/params.ts` | Parámetros de la §8 que usa el M0 |

## 4. Diseño interno y decisiones
- **better-sqlite3 13** (ADR-001), síncrono. Trae binarios precompilados (`gypfile: false`), así que en `pnpm-workspace.yaml` su script de instalación queda deshabilitado (`allowBuilds: better-sqlite3: false`): no hace falta compilador de C++. El RSS del módulo nativo son unos pocos MB.
- **zstd sin dependencias**: `node:zlib` (`zstdCompressSync`) de Node 24.
- **Esquema** (migración 001) = spec 027 §3 v0.3: `events` con `origin` y `place_id`, `components` con `initial` (decidido por el usuario en el bloque D). Dos triggers impiden `UPDATE` y `DELETE` sobre `events` (INV-001); la compactación de M4 los retirará en su propia migración.
- **Migraciones** (R-006): versión en `meta.schema_version`, una transacción por archivo. Si la base ya tenía esquema, antes de migrar se copia entera con `VACUUM INTO` a `<ruta>.v<versión>.backup` (copia consistente y síncrona). Si esa copia ya existe, no se sobrescribe: se para.
- **Un flush = una transacción** (R-002): eventos + participantes + entradas externas + estado. `meta` guarda `world_id`, `config`, `engine_version` (una vez), y en cada flush `now`, `status`, `counters`, `capabilities`, `scheduler` y `state_hash`.
- **`seq` = número del id `EVT`**. Crece estrictamente por construcción; un lote con un `seq` que no supera el último guardado se rechaza y se deshace la transacción entera.
- **Solo se reescribe lo que cambió** (R-008). El motor no marca cambios, así que el repositorio recuerda lo último escrito (JSON de cada entidad, bytes de cada columna) y compara. Esos cachés solo avanzan si la transacción se confirma. Coste: una copia de cada columna usada en RAM (10 000 personas × 50 columnas × 4 B ≈ 2 MB).
- **Columnas en binario little-endian** (R-008), también dentro de la instantánea. En máquinas LE la escritura es una vista sin copia.
- **Instantánea** (R-004): `MSS1` + u32 LE + cabecera JSON (el `WorldSnapshot` sin las filas) + columnas en binario, todo comprimido con zstd; la tabla guarda el hash. `INSERT OR REPLACE` por minuto. La retención llega en M4.
- **Carga verificada.** `loadWorld` rechaza capacidades desconocidas (R-009) y comprueba que el hash del mundo reconstruido coincide con `meta.state_hash`: detecta estados alterados o incoherentes.
- **Sentencias preparadas una vez**, en el constructor del repositorio, y la transacción de flush también. Prepararlas en cada flush dejaba miles de sentencias nativas esperando al recolector: 365 días (8 760 flush) llegaban a 483 MB de RSS y 2,3 s. Preparadas una vez, se quedan en 66 MB y 0,75 s.
- **Un solo escritor** (R-001): el worker y `world:advance` toman `meta.writer_pid` en una transacción `IMMEDIATE`. Si el dueño ya no existe (murió en seco), se recupera. Encolar una orden de control es una escritura mínima que no toma el cerrojo: SQLite la serializa con `busy_timeout`.
- **Datos como JSON** en M0 (pregunta abierta de la spec: JSON o MessagePack; se medirá en M4).
- Los participantes de un evento se leen ordenados por id (la clave primaria de `event_participants` no conserva el orden de inserción).

## 5. Invariantes y guardarraíles
Un solo escritor (R-001). Nunca UPDATE/DELETE sobre eventos salvo compactación documentada (triggers de la migración 001). Nunca dos mundos en la misma base.

## 6. Cómo se prueba
Vitest, desde la raíz: `pnpm test`. Cada prueba usa una carpeta temporal propia (`src/testing.ts`).

- `src/db.test.ts` (9 pruebas): tablas de la §3, pragmas R-003, migración con copia `.backup` (con un directorio de migraciones de prueba), esquema más nuevo que el código, numeración sin huecos, triggers de INV-001, solo lectura.
- `src/repository.test.ts` (11 pruebas):
  - CA-001: 10 días, guardar, cerrar, cargar, 5 días más = ejecución sin cerrar (hash, eventos, entradas);
  - CA-006: columnas `f32`/`i32`/`u8` idénticas byte a byte, también tras crecer y vía instantánea;
  - R-008: una columna sin cambios conserva su `updated_at`;
  - INV-001: un lote con `seq` repetido se rechaza y no deja nada a medias;
  - R-009, estado alterado detectado por hash, dos mundos en una base;
  - CA-004: un lector con una transacción abierta ve su instantánea mientras el escritor hace 20 flush, sin `SQLITE_BUSY`.
- `src/crash.test.ts` (1 prueba, CA-003): un proceso hijo (`src/crash-child.fixture.ts`) avanza 30 días con flush cada `FLUSH_TICKS` ticks. El padre lo mata en seco (`SIGKILL`) después de un flush del día 10. Al reabrir: estado de un flush, ningún evento confirmado perdido, eventos iguales al prefijo de una ejecución de referencia. Seguir hasta el día 30 da el mismo hash y los mismos eventos.

- `src/control.test.ts` (3 pruebas): órdenes en orden de id; cerrojo rechazado con un dueño vivo, liberado y recuperado de un proceso muerto.
- `src/session.test.ts` (2 pruebas): flush cada `FLUSH_TICKS`, una instantánea por día, progreso cada 5 %; entradas guardadas una sola vez y numeración continua entre sesiones.

Las pruebas de CA-001 y CA-003 llevan "determinismo" en el nombre y corren también con `pnpm test:determinism`.

## 7. Paridad con el prototipo
No aplica (el prototipo no persiste).

## 8. Pendientes y deuda
- [ ] ¿Quién encola órdenes cuando exista la API (M5)? Hoy solo la CLI (decisión del usuario, bloque E).
- [ ] Retención de instantáneas (R-004) y compactación (R-005, CA-002, CA-005), M4.
- [ ] `stateHash` en cada flush: medir su coste con población (M1) y, si pesa, calcularlo solo en instantáneas y al cerrar.
- [ ] `meta.scheduler` se reescribe entero en cada flush; revisar cuando el scheduler tenga miles de elementos.
- [ ] `readEvents` lee participantes con una consulta por evento; para la API conviene un JOIN (E2 o M5).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-23 | kit de arranque | — | Documento creado (sin código) |
| 2026-09-23 | m0/a-tooling (A5) | — | Esqueleto del paquete: `package.json` (workspace, ESM, `exports` → `src/index.ts`) y `src/index.ts` vacío. Sin API todavía |
| 2026-09-24 | m0/d-persistencia (D1–D3) | 027 | Migración 001 (esquema §3 v0.3 con triggers de INV-001), pragmas WAL, migraciones con copia `.backup`, `WorldRepository` (flush transaccional, reescritura solo de lo cambiado, carga verificada por hash, instantáneas zstd con columnas binarias LE). Dependencias: `better-sqlite3`, `@types/better-sqlite3`. 21 pruebas: CA-001, CA-003, CA-004, CA-006 |
| 2026-09-24 | m0/e-cli-worker (E1–E3) | 027 | `WorldSession` (flush e instantáneas compartidos por el worker y la CLI), órdenes de control, cerrojo de escritor, `lastInput`/`countEvents`/`countSnapshots`. Sentencias preparadas una vez: 365 días pasan de 483 MB a 66 MB y de 2,3 s a 0,75 s. 5 pruebas nuevas |
| 2026-09-24 | chore/renombrar-datas-world-2 | — | Renombrado de los paquetes `@mundo-social/*` → `@datas-world/*` (imports y `package.json`). Sin cambios de comportamiento |
| 2026-09-24 | chore/nombre-datas-world | — | El nombre del mundo en las configuraciones de prueba y por defecto pasa de "Villa Cordillera" a "Data's World" (decisión del usuario). Sin cambios de comportamiento |
