---
id: 001
nombre: world
estado: aprobada
hito: M0
depende_de: [002, 023]
version: 0.2
---

# 001 — Mundo

## 1. Propósito
Definir la entidad raíz que contiene toda la simulación: su identidad, semilla, configuración, reloj, registro de entidades y convenciones de identificadores. Implementa las secciones de la visión sobre "el mundo existe aunque nadie lo observe" y "cada mundo es reproducible".

## 2. Alcance
**Incluye:** `World` y `WorldConfig`, ciclo de vida (crear, cargar, pausar, reanudar, cerrar), registro de entidades e identificadores, hash de estado, capacidades activas del mundo y almacenamiento del estado por componentes.
**Fuera de alcance:** geografía (003), población (007), persistencia física (027), velocidad del reloj (002).

## 3. Modelo de datos
```ts
type WorldId = `WLD-${string}`;          // WLD-0001
type EntityKind = 'CIT' | 'HOU' | 'ORG' | 'PLC' | 'OBJ' | 'EVT' | 'MEM' | 'BEL'
                | 'SCH' | 'CHP'                  // esquemas y capítulos de memoria (spec 013)
                | 'TSK';                         // elementos del scheduler (spec 002)
type EntityId = `${EntityKind}-${string}`; // CIT-000123, EVT-00000000042

interface WorldConfig {
  name: string;               // "Data's World"
  seed: number;               // uint32
  epoch: string;              // fecha ISO de inicio, solo para mostrar: "2027-01-04T00:00"
  tickMinutes: number;        // por defecto 5
  currency: { code: string; minorUnit: number }; // { code: 'COP', minorUnit: 1 }
  population: { target: number };                // 100–500 en MVP
  engineVersion: string;      // semver del motor; forma parte de la reproducibilidad
  params: Record<string, number>; // parámetros de calibración con nombre
  holidays: string[];         // festivos "AAAA-MM-DD" (spec 002 R-001)
  initialCapabilities: Capability[]; // capacidades con las que nace el mundo (R-007)
}

// Capacidades: bloques de comportamiento que un mundo tiene activos (ADR-005, idea C).
// Orden canónico = orden de esta unión; se amplía añadiendo al final.
type Capability =
  | 'clock' | 'needs' | 'routines' | 'economy' | 'mobility'      // peldaño 1
  | 'relationships' | 'memory' | 'beliefs'                        // peldaño 2
  | 'learning' | 'consolidation' | 'conflict'                     // peldaño 3
  | 'lifecourse' | 'reputation'                                   // peldaño 4
  | 'culture' | 'llm';                                            // peldaño 5

interface World {
  id: WorldId;
  config: WorldConfig;
  now: WorldMinute;           // spec 002
  status: 'created' | 'running' | 'paused' | 'closed';
  counters: Record<EntityKind, number>; // para ids secuenciales
  capabilities: Capability[]; // activas ahora; solo crecen, en orden canónico (R-007)
  // Colecciones indexadas por id (orden ascendente garantizado):
  citizens: Map<EntityId, Citizen>;
  households: Map<EntityId, Household>;
  organizations: Map<EntityId, Organization>;
  places: Map<EntityId, Place>;
  objects: Map<EntityId, WorldObject>;
  // Componentes numéricos densos de los ciudadanos (§3.1):
  components: CitizenComponents;
}
```

### 3.1 Almacenamiento por componentes (ADR-005, idea A)

Los datos numéricos de alta frecuencia de los ciudadanos (necesidades, emociones, dinero, ubicación, nivel de simulación) no viven dentro de cada objeto `Citizen`, sino en columnas tipadas indexadas por el **índice denso** del ciudadano (`CIT-000123` → 123). `Citizen` conserva los datos de identidad, biografía y referencias; los componentes dispersos (relaciones, memorias, creencias) viven en mapas ordenados por id definidos en sus specs.

```ts
interface CitizenComponents {
  capacity: number;                 // filas reservadas; crece ×2 cuando se llena
  // Cada columna tiene longitud `capacity`; la fila i corresponde a CIT-i.
  f32: Record<string, Float32Array>; // p. ej. 'need.hunger', 'emo.mood', 'emo.stress'
  i32: Record<string, Int32Array>;   // p. ej. 'money', 'placeIdx', 'householdIdx'
  u8:  Record<string, Uint8Array>;   // p. ej. 'simLevel', 'active'
}
```

Cada spec que añade un valor numérico por persona declara su columna (nombre, tipo, rango y valor inicial) en su *Modelo de datos*. Las columnas se registran en orden alfabético de nombre.

## 4. Reglas
- **R-001** — Los identificadores se generan con contadores por tipo, con relleno de ceros (6 dígitos para CIT/OBJ, 4 para ORG/PLC/HOU, 9 para MEM/BEL/SCH/CHP/TSK, 11 para EVT). Nunca se reutilizan, aunque la entidad desaparezca.
- **R-002** — Toda iteración sobre colecciones del mundo se hace en orden de id ascendente.
- **R-003** — Una entidad eliminada (p. ej. persona fallecida, objeto destruido) no se borra: pasa a estado `inactive` con el evento correspondiente.
- **R-004** — `stateHash(world)` es un hash estable (p. ej. xxhash64 o SHA-256) de la serialización canónica (claves ordenadas, sin campos derivados ni cachés).
- **R-005** — `WorldConfig` es inmutable una vez creado el mundo; cambiar parámetros crea una rama (spec 028).
- **R-006** — El mundo sigue avanzando con `status = running` independientemente de que haya observadores.
- **R-007** — **Capacidades.** `world.capabilities` empieza igual a `config.initialCapabilities`. Una capacidad nueva solo se activa mediante una entrada externa (`ExternalInput` de tipo `enable_capability`, spec 023 R-004), que emite `CAPABILITY_ENABLED`. Las capacidades nunca se desactivan en un mundo vivo; desactivarlas solo es posible en una rama de experimento (spec 028). Una capacidad solo se puede activar si sus dependencias ya están activas (tabla en §8).
- **R-008** — Activar una capacidad inicializa los componentes que introduce con valores deterministas derivados del estado existente y del flujo `rng.fork('cap:<nombre>')`, nunca con valores "de fábrica" arbitrarios (CLAUDE.md §8).
- **R-009** — **Índice denso.** El sufijo numérico de un `CIT` es su fila en `components`. Las filas de ciudadanos inactivos se conservan (no se reutilizan, R-001); `u8.active` indica si la fila está viva.
- **R-010** — `stateHash` incluye `capabilities` y las columnas de `components` hasta el mayor índice usado (no hasta `capacity`), recorridas en orden alfabético de nombre de columna.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas |
|---|---|---|---|
| `WORLD_CREATED` | Al crear | config | — (origen) |
| `CAPABILITY_ENABLED` | Se activa una capacidad | capacidad, componentes inicializados | entrada externa |
| `WORLD_PAUSED` / `WORLD_RESUMED` | Control | motivo | evento externo |
| `WORLD_CLOSED` | Apagado | minuto final, hash | evento externo |

## 6. Invariantes
- **INV-001** — Todos los ids referenciados existen en alguna colección (activos o inactivos).
- **INV-002** — `counters[kind]` ≥ al mayor sufijo numérico existente de ese tipo.
- **INV-003** — `capabilities` está en orden canónico, sin duplicados, y cada capacidad tiene activas sus dependencias.
- **INV-004** — Todas las columnas de `components` tienen longitud `capacity` ≥ `counters.CIT + 1`.

## 7. Criterios de aceptación
- **CA-001** — *Dado* un `WorldConfig` con semilla 482917, *cuando* se crea el mundo dos veces, *entonces* `stateHash` es idéntico.
- **CA-002** — *Dado* un mundo con 3 entidades CIT, *cuando* se inactiva CIT-000002 y se crea otra, *entonces* la nueva es CIT-000004.
- **CA-003** — *Dado* un mundo, *cuando* se serializa y deserializa, *entonces* el hash no cambia.
- **CA-004** — *Dado* un mundo, *cuando* se intenta modificar `config`, *entonces* se lanza error.
- **CA-005** — *Dado* dos mundos con semillas distintas y misma configuración, *entonces* sus hashes difieren tras la generación (M1).
- **CA-006** — *Dado* un mundo con `['clock']`, *cuando* se intenta activar `memory` sin `relationships`, *entonces* la entrada se rechaza y no cambia el hash.
- **CA-007** — *Dado* un mundo guardado con capacidades del peldaño 1, *cuando* se activa `relationships` en el minuto M dos veces desde la misma instantánea, *entonces* los hashes coinciden y existe un `CAPABILITY_ENABLED` con causa en la entrada externa.
- **CA-008** — *Dado* un mundo con 1 000 ciudadanos, *cuando* se crea un ciudadano nuevo que supera `capacity`, *entonces* las columnas se amplían sin alterar las filas existentes ni el hash de los datos previos.

## 8. Parámetros
| Parámetro | Defecto | Rango |
|---|---|---|
| `tickMinutes` | 5 | 1–60, divisor de 1440 (spec 002 R-007) |
| `population.target` | 200 | 10–500 (MVP); hasta 10 000 en el peldaño 5 |
| `components.capacity` inicial | `population.target` redondeado a potencia de 2 | — |
| `initialCapabilities` | `['clock']` en M0 | ver tabla |

**Dependencias entre capacidades** (una capacidad solo se activa si las de su fila están activas):

| Capacidad | Requiere | Spec principal |
|---|---|---|
| `clock` | — | 002 |
| `needs` | `clock` | 010 |
| `routines` | `needs` | 011 |
| `economy` | `clock` | 015 |
| `mobility` | `routines` | 016 |
| `relationships` | `needs` | 012 |
| `memory` | `relationships` | 013 |
| `beliefs` | `memory` | 025 |
| `learning` | `memory` | 018 |
| `consolidation` | `memory` | 013 §4.2 |
| `conflict` | `relationships`, `memory` | 012 |
| `lifecourse` | `relationships`, `economy` | por redactar |
| `reputation` | `beliefs` | por redactar |
| `culture` | `reputation`, `learning` | por redactar |
| `llm` | `memory`, `beliefs` | 026 |

## 9. Métricas
Número de entidades por tipo y estado; hash de estado en cada instantánea.

## 10. Preguntas abiertas
- [ ] ¿Un servidor ejecuta un único mundo o varios? (Propuesta: uno en MVP.)
- [ ] Nombre y ambientación del mundo por defecto (propuesta: ciudad colombiana ficticia, COP).
- [ ] ¿Almacenamiento por columnas desde M0 o desde M2? (Propuesta: la estructura `components` existe desde M0 con la columna `active`; las demás llegan con sus specs.)
- [ ] ¿Se permite desactivar capacidades en un mundo vivo? (Propuesta: no; solo en ramas de experimento.)
- [ ] Specs pendientes de redactar para `lifecourse`, `reputation` y `culture` (peldaños 4 y 5).

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial |
| 2026-09-23 | 0.2 | Capacidades del mundo (R-007, R-008, tabla de dependencias) y almacenamiento por componentes con índice denso (§3.1, R-009, R-010). ADR-005 |
| 2026-09-24 | 0.2 | Estado → aprobada |
| 2026-09-23 | 0.2 | Precisiones de la implementación (bloque C): `WorldConfig.holidays` (lo exigía la spec 002 R-001), tipo de id `TSK` para el scheduler, rellenos de MEM/BEL/SCH/CHP/TSK = 9 dígitos, `tickMinutes` divisor de 1440. Sin cambios en reglas ni CA |
| 2026-09-24 | 0.2 | Precisión de la implementación (bloque E): `WORLD_CLOSED` se emite con la entrada externa `close` (payload: `minute`, `hash` del estado justo antes y `reason`). No cambia `status`: marca el apagado del proceso y, al reiniciar, el mundo sigue como estaba (`running` o `paused`). El estado `closed` queda reservado para un mundo terminado. Sin cambios en CA |
| 2026-09-24 | 0.2 | Nombre (usuario): el mundo y su municipio se llaman **Data's World**, en lugar de Villa Cordillera. Inspirado en el androide Data: ciudadanos autónomos, curiosos y capaces de aprender. Solo cambia el nombre; la información sigue siendo de Colombia |
