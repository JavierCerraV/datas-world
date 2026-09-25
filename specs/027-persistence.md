---
id: 027
nombre: persistence
estado: aprobada
hito: M0 (base) · M4 (retención)
depende_de: [001, 002, 014]
version: 0.3
---

# 027 — Persistencia

## 1. Propósito
Guardar el mundo en SQLite de forma segura, rápida y dentro de 5 GB de disco: estado actual, registro de eventos append-only, instantáneas, entradas externas y órdenes de control.

## 2. Alcance
**Incluye:** esquema, migraciones, escritura por lotes, instantáneas, retención/compactación, lectura para la API.
**Fuera de alcance:** consultas analíticas pesadas (se exporta con la CLI).

## 3. Modelo de datos (SQLite, modo WAL)
```sql
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);         -- schema_version, world config, engine version, capabilities
CREATE TABLE entities (id TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL,
                       data BLOB NOT NULL, updated_at INTEGER NOT NULL); -- estado actual (JSON o msgpack)
CREATE TABLE events (seq INTEGER PRIMARY KEY, id TEXT UNIQUE NOT NULL, type TEXT NOT NULL,
                     at INTEGER NOT NULL, importance REAL NOT NULL, payload BLOB NOT NULL,
                     causes TEXT NOT NULL, origin TEXT NOT NULL,         -- 'engine' | 'external' | 'llm'
                     place_id TEXT);                                     -- append-only
CREATE TABLE event_participants (event_seq INTEGER NOT NULL, entity_id TEXT NOT NULL, role TEXT,
                     PRIMARY KEY (entity_id, event_seq)) WITHOUT ROWID;
CREATE INDEX events_at ON events(at);
CREATE INDEX events_type_at ON events(type, at);
CREATE TABLE snapshots (at INTEGER PRIMARY KEY, hash TEXT NOT NULL, data BLOB NOT NULL); -- zstd
CREATE TABLE external_inputs (at INTEGER, seq INTEGER, kind TEXT, payload BLOB, PRIMARY KEY(at, seq));
CREATE TABLE control_commands (id INTEGER PRIMARY KEY, cmd TEXT, arg TEXT, created_at TEXT, done INTEGER DEFAULT 0);

-- Componentes densos (spec 001 §3.1): una fila por columna, datos binarios little-endian.
CREATE TABLE components (name TEXT PRIMARY KEY, type TEXT NOT NULL,   -- 'f32' | 'i32' | 'u8'
                         length INTEGER NOT NULL, initial REAL NOT NULL, -- valor con que nacen las filas nuevas
                         data BLOB NOT NULL, updated_at INTEGER NOT NULL);

-- Memoria fuera de RAM (spec 013): episodios consolidados u olvidados, esquemas y capítulos archivados.
CREATE TABLE memory_archive (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, kind TEXT NOT NULL, -- 'MEM'|'SCH'|'CHP'
                             status TEXT NOT NULL, at INTEGER NOT NULL, data BLOB NOT NULL);
CREATE INDEX memory_archive_owner_at ON memory_archive(owner_id, at);
```

## 4. Reglas
- **R-001** — Un solo escritor (el worker). La API abre la base en solo lectura.
- **R-002** — El worker escribe por lotes: cada `FLUSH_TICKS` ticks o al pausar, en una transacción con estado modificado + eventos + participantes.
- **R-003** — Pragmas: `journal_mode=WAL`, `synchronous=NORMAL`, `cache_size=-16000` (16 MB), `busy_timeout=2000`, checkpoint periódico.
- **R-004** — Instantánea completa comprimida cada `SNAPSHOT_EVERY_DAYS` días de mundo; se conservan diarias 30 días, semanales 1 año, mensuales siempre.
- **R-005** — Compactación: eventos con `importance < 0.2` y más antiguos que `COMPACT_AFTER_DAYS` se resumen en eventos agregados (`DAILY_ROUTINE_SUMMARY`) que conservan conteos y causas relevantes. Los eventos referenciados como causa de otro nunca se compactan.
- **R-006** — Migraciones numeradas en `packages/persistence/migrations`, ejecutadas al arrancar con copia previa (`.backup`).
- **R-007** — El worker hace flush y cierra limpio al recibir SIGTERM/SIGINT.
- **R-008** — **Componentes.** Las columnas de `components` se guardan como BLOB binario (no JSON) en la tabla `components` y dentro de la instantánea. Solo se reescriben las columnas marcadas como modificadas desde el último flush.
- **R-009** — **Capacidades.** `meta.capabilities` guarda la lista activa en orden canónico; `meta.engine_version` la versión del motor. Al cargar, el worker rechaza un mundo cuyas capacidades no conoce su versión del motor.
- **R-010** — **Archivo de memoria.** Cuando un episodio, esquema o capítulo sale de la RAM (spec 013 R-003, R-008, R-010), se escribe en `memory_archive` en el mismo flush. Nunca se borra. La API y el informe de vida (020) lo leen desde ahí.
- **R-011** — **Compatibilidad entre peldaños.** Un mundo guardado en el peldaño N se debe poder cargar con el motor del peldaño N+1. Si cambia el esquema de datos, la migración (R-006) se prueba con un mundo de ejemplo del peldaño anterior versionado en `docs/validaciones/mundos/`.
- **R-012** — **Puntos de control.** El `stateHash` no se calcula en cada flush, sino solo en los puntos de control:
  - cada instantánea (R-004);
  - el final de un avance de la CLI;
  - una pausa o un cambio de control;
  - el cierre (R-007).

  `meta` guarda `state_hash`, `state_hash_at` y `state_dirty`. Un flush normal solo marca `state_dirty = 1`. Al cargar:
  - si el estado es el de un punto de control, se verifica con su hash; si no coincide, la carga falla;
  - si hubo flush después (un cierre en seco), no hay hash de ese estado: se carga y se marca como recuperado (`recovered`).

  Una base anterior a esta regla (sin `state_hash_at`) se verifica siempre. Decisión del usuario del 2026-09-24: con la población de M1, el hash de cada flush costaba ≈ 15 ms, y avanzar 30 días tardaba 12 s; con los puntos de control, 2,4 s.

## 6. Invariantes
- **INV-001** — `events.seq` estrictamente creciente; nunca `UPDATE` ni `DELETE` sobre eventos salvo el proceso de compactación documentado.

## 7. Criterios de aceptación
- **CA-001** — *Dado* un mundo avanzado 10 días, *cuando* se guarda, se cierra y se carga, *entonces* el hash coincide y se puede seguir avanzando con el mismo resultado que sin cerrar.
- **CA-002** — *Dado* 100 personas × 365 días, *entonces* la base ocupa < 500 MB tras compactación.
- **CA-003** — *Dado* un SIGTERM durante la simulación, *cuando* se reinicia, *entonces* no se pierde ningún evento ya confirmado y el mundo continúa desde el último flush.
- **CA-004** — *Dado* la API leyendo mientras el worker escribe, *entonces* no hay errores `SQLITE_BUSY` visibles.
- **CA-005** — La compactación nunca elimina un evento que aparece en `causes` de otro.
- **CA-006** — *Dado* un mundo con componentes, *cuando* se guarda y se carga, *entonces* cada columna es idéntica byte a byte y el hash coincide.
- **CA-007** — *Dado* un mundo guardado del peldaño anterior, *cuando* se carga con el motor actual, *entonces* se migra sin errores y avanza 30 días de forma determinista.
- **CA-008** — *Dado* un episodio que pasa a `consolidated`, *entonces* aparece en `memory_archive` tras el siguiente flush y sale de la RAM.

## 8. Parámetros
| Parámetro | Defecto |
|---|---|
| `FLUSH_TICKS` | 12 (1 h de mundo) |
| `SNAPSHOT_EVERY_DAYS` | 1 |
| `COMPACT_AFTER_DAYS` | 90 |

## 10. Preguntas abiertas
- [ ] ¿JSON o MessagePack para `data`? Propuesta: JSON en M0 (depurable), medir y decidir en M4. Los componentes densos van siempre en binario (R-008).
- [ ] ¿Cuántos mundos de ejemplo por peldaño se versionan para probar migraciones? (Propuesta: uno pequeño, 60 personas × 30 días, < 5 MB.)

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial |
| 2026-09-23 | 0.2 | Tablas `components` y `memory_archive`, capacidades en `meta`, compatibilidad entre peldaños (R-008 a R-011, CA-006 a CA-008). ADR-005 |
| 2026-09-24 | 0.2 | Estado → aprobada |
| 2026-09-24 | 0.3 | Implementación M0 (bloque D): `events` gana `origin` y `place_id` (campos de `WorldEvent`, spec 014) y `components` gana `initial` (valor inicial de la columna, necesario para crecer igual tras cargar). Decidido por el usuario |
| 2026-09-24 | 0.3 | Bloque I de M1: consultas del registro (`queryEvents`, `eventsById`) para la historia (030 R-008); primer mundo de ejemplo versionado en `docs/validaciones/mundos/m1-482917.db` (R-011). Medido: con la población de M1 (≈ 1 300 personas entre vivas y antepasados), el `stateHash` de cada flush cuesta ≈ 15 ms y avanzar 30 días tarda ≈ 12 s. Pendiente de decidir antes de M2 (ver el MODULE.md de persistence). Sin cambios en reglas ni CA |
| 2026-09-24 | 0.4 | R-012 (puntos de control), aprobada por el usuario: el `stateHash` se guarda solo en instantáneas, al final de un avance, al pausar y al cerrar; la carga verifica los puntos de control y marca como recuperado un estado posterior (cierre en seco). Avanzar 30 días con la población de M1 pasa de 12 s a 2,4 s con el mismo hash final. Sin cambios en CA |
| 2026-09-25 | 0.3 | Bloque F de M2 (015): las cuentas del sistema se guardan en `meta.accounts` en cada guardado y se cargan si existen. Sin cambios en CA |
