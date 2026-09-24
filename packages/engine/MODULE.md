---
modulo: engine
ruta: packages/engine
estado: en-desarrollo
specs: [001, 002, 014, 023, 029]
actualizado: 2026-09-23
---

# Módulo: engine

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Núcleo puro de la simulación: tipos del dominio, RNG, reloj, scheduler, eventos, validación de acciones y bucle de tick. Cada sistema (necesidades, rutinas, relaciones, memoria…) vive en `src/<sistema>/` con su propio MODULE.md.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 001 | CA-001, CA-002, CA-003, CA-004, CA-006, CA-007, CA-008 | CA-005 (necesita generación de población, M1) |
| 002 | CA-001, CA-002, CA-003, CA-004, CA-005 (en el motor y desde la CLI, `apps/cli`) | — |
| 014 | CA-001, CA-002, CA-003 | — |
| 023 | CA-003, CA-004, CA-005, CA-006; CA-001 en parte: mismo hash en un proceso y entre dos procesos (`apps/cli`), pero con un mundo vacío | CA-001 con 100 personas y CA-002 (necesitan población, M1–M2) |
| 029 | Consulta del perfil (R-002, R-003 con `profileValue`); INV-001 e INV-002 (`checkProfile`). Los CA se prueban en `generators/src/country` | — |


## 3. API pública
Desde `@datas-world/engine` (`src/index.ts`). Todo lo público se reexporta desde ahí:

| Símbolo | Archivo | Descripción |
|---|---|---|
| `createRng(seed): Rng` | `src/rng.ts` | Flujo raíz de un mundo. `seed` se interpreta como uint32 |
| `restoreRng(state): Rng` | `src/rng.ts` | Reconstruye un flujo desde `state()`, en el mismo punto de la secuencia |
| `interface Rng` | `src/rng.ts` | `next`, `int`, `chance`, `pick`, `weighted`, `normal`, `fork`, `state` (spec 023 §3) |
| `interface RngState` | `src/rng.ts` | `{ key: [u32, u32], s: [u32 ×4] }`, serializable como JSON |
| `formatId`, `allocateId`, `idKind`, `idNumber`, `emptyCounters`, `ID_WIDTH`, `ENTITY_KINDS`, tipos `EntityId`/`EntityKind`/`Counters`/`WorldId` | `src/ids.ts` | Identificadores con relleno por tipo; los contadores nunca retroceden (001 R-001) |
| `toCalendar`, `parseEpoch`, `parseDate`, `daysFromCivil`, `civilFromDays`, `formatDate`, `MINUTES_PER_DAY`, tipos `WorldMinute`/`CalendarView`/`CivilDate`/`CivilDateTime` | `src/calendar.ts` | Calendario gregoriano con aritmética entera, sin `Date` (002) |
| `createScheduler`, `schedule`, `popDue`, `sortedItems`, tipos `Scheduler`/`ScheduledItem` | `src/scheduler.ts` | Montículo por `(at, id)` (002 R-004) |
| `makeEvent`, `eventText`, `EVENT_TYPES`, tipos `WorldEvent`/`CauseRef`/`NewEvent`/`EventType`/`EventOrigin` | `src/events.ts` | Catálogo central; creación validada e inmutable (014) |
| `CAPABILITIES`, `CAPABILITY_DEPS`, `canEnable`, `isCapability`, `withCapability`, `validateCapabilities`, tipo `Capability` | `src/capabilities.ts` | Capacidades y dependencias (001 R-007) |
| `defineColumn`, `ensureCapacity`, `columns`, `capacityFor`, tipos `CitizenComponents`/`ColumnType` | `src/components.ts` | Columnas tipadas por índice denso (001 §3.1) |
| `createWorld`, `addCitizen`, `deactivateEntity`, `validateConfig`, tipos `World`/`WorldConfig`/`WorldStatus`/`BaseEntity`/`Citizen` | `src/world.ts` | Mundo raíz (001) |
| `serializeWorld`, `deserializeWorld`, `stateHash`, `canonicalize`, `hashString`, tipo `WorldSnapshot` | `src/serialize.ts`, `src/hash.ts` | Instantánea JSON y hash canónico de 64 bits (001 R-004, R-010) |
| `tick`, `applyExternalInput`, tipos `ExternalInput`/`InputResult`/`ScheduledHandler` | `src/tick.ts` | Tick mínimo y entradas externas: `enable_capability`, `set_speed`, `pause`, `resume`, `close` (002, 023 R-004) |
| `Runner`, tipo `Speed` | `src/runner.ts` | Velocidad, pausa, paso, avanzar N días, tiempo real → ticks, replay (002, 023). `continueInputsAfter(última)` continúa la numeración `seq` al retomar un mundo guardado |
| `ENGINE_VERSION` | `src/version.ts` | Versión del motor para `WorldConfig.engineVersion` y `meta.engine_version` (027 R-009). `0.2.0` desde M1 |
| `profileValue`, `profileNumber`, `profileEntry`, `checkProfile`, tipos `CountryProfile`/`ProfileEntry`/`ProfileScope`/`ProfileStatus`/`ProfileValue` | `src/profile.ts` | Perfil de país (029): valor vigente por clave, fecha ("AAAA-MM-DD") y alcance territorial, con respaldo en el nacional. Lanza si falta la cifra. `checkProfile` comprueba INV-001 e INV-002 |
| tipo `CatalogRef` | `src/world.ts` | `{ version, hash }` de un catálogo (ADR-006 §4) |

## 4. Diseño interno y decisiones
Funciones puras `(state, input, rng) => { patches, events }`. Sistemas en carpetas propias con su MODULE.md y sus specs.

- **Sin paso de compilación.** Node 24 ejecuta TypeScript directamente (eliminación de tipos), así que `exports` apunta a `src/index.ts`. El tsconfig impone `erasableSyntaxOnly`: nada de `enum`, `namespace` ni propiedades de parámetro. Los imports relativos llevan extensión `.ts` (`allowImportingTsExtensions`).
- **Estado por componentes** (ADR-005, spec 001 §3.1). Los valores numéricos por persona van en columnas tipadas, con la fila = número del `CIT` y la fila 0 sin usar. Crecen ×2 conservando las filas y cada columna guarda su valor inicial. La columna `active` existe desde el principio. El hash solo cubre las filas usadas, así que la capacidad reservada no lo afecta (R-010).
- **Sistemas enchufables (spec 021)**: todavía no. La spec 021 está en borrador; el `tick` de M0 solo avanza el reloj, emite `DAY_STARTED` y atiende el scheduler con manejadores por tipo.
- **El azar no tiene estado persistente.** El flujo raíz nunca se consume directamente: todo se deriva con `fork` (p. ej. `fork('sched').fork(item.id)`). Por eso el estado del RNG no se guarda y cargar un mundo da el mismo resultado que no haberlo cerrado.
- **Mutación controlada.** `tick`, `applyExternalInput`, `addCitizen` y `deactivateEntity` modifican el `World` recibido y devuelven los eventos. Es el paso de "aplicar" del motor (CLAUDE.md regla 4). Los parches por sistema llegan con la 021.
- **Perfil y catálogos en la configuración** (M1).
  - `WorldConfig.profile` (029) y `WorldConfig.catalogs` (ADR-006) son opcionales, así que los mundos de M0 siguen siendo válidos.
  - Si están, se validan al crear el mundo: perfil correcto, misma moneda que el mundo y hashes de 16 hex. Quedan congelados y entran en el `stateHash`.
  - El motor solo consulta el perfil; cargarlo y validarlo con Zod es cosa de los generadores.
  - `profileEntry` compara fechas ISO como texto, porque tienen el mismo formato fijo, y valida la fecha pedida.
- **Cierre.** La entrada `close` emite `WORLD_CLOSED` con el minuto, el hash del estado justo antes y el motivo. No cambia `status`: marca el apagado del proceso (worker), y al reiniciar el mundo sigue en `running` o `paused` (precisión en la spec 001).
- **Entradas externas.** Pausa, reanudación, velocidad, cierre y activar capacidades son `ExternalInput` `(at, seq)`. Cada una emite `EXTERNAL_INPUT_APPLIED` y el evento específico con esa causa. Una entrada rechazada no cambia el mundo. La velocidad no forma parte del `World` (vive en el `Runner`), así que 1x y 1000x dan el mismo hash (002 CA-002).
- **Tiempo real.** El `Runner` recibe milisegundos transcurridos y acumula la fracción en enteros (minutos × 1000). Nunca lee el reloj (002 R-008).
- **Hash** de 64 bits con dos carriles de 32 bits y mezcla tipo murmur3, sobre JSON canónico (claves ordenadas, `Map` por clave, arreglos tipados como arreglos). No es criptográfico: sirve para comparar estados.
- **RNG: xoshiro128\*\*** (decisión B0 del usuario, registrada en la spec 023).
  - Aritmética solo de 32 bits (`Math.imul`, `>>>`), idéntica en cualquier plataforma. PCG32 se descartó porque necesita 64 bits (BigInt).
  - Cada flujo tiene una **clave de 64 bits** fija desde su creación. `fork(name)` deriva la clave hija con `hash64(clave, String(name))`, una variante de cyrb53, y siembra el estado con splitmix32 (el núcleo de `sm32` del prototipo). Así `fork` no consume del padre y no depende de cuánto se haya consumido (CA-003).
  - Se usan 64 bits y no los 32 del borrador (`hash32`) porque con ~4 millones de flujos (10 000 personas × 365 días) una clave de 32 bits tendría colisiones casi seguras.
  - `int` usa muestreo por rechazo (sin sesgo de módulo). `normal` es Box–Muller con la misma fórmula que el prototipo y consume dos valores por llamada, sin guardar el segundo para que `state()` sea solo la clave y los cuatro enteros.
  - Estado privado con campos `#` de clase: nadie fuera del flujo puede alterarlo.

## 5. Invariantes y guardarraíles
Sin E/S ni APIs no deterministas. Iteración por id ascendente. Se comprueba dos veces, de forma independiente:
- ESLint (`eslint.config.js`, bloque `packages/engine/src/**`): prohíbe los globales `Date`, `performance`, `crypto`, `setTimeout`, `setInterval` y `fetch`; la propiedad `Math.random`; y los imports de `fs`, `net`, `http`, `https`, `child_process`, `dgram` y `worker_threads`.
- `scripts/guardrails/check.mjs` (sección D): busca los mismos tokens línea a línea.

Excepción aprobada por el usuario: una línea de `src/lint.test.ts` con `// determinismo-permitido`. Es el texto de ejemplo que la prueba CA-005 pasa a ESLint, no código que se ejecute.

## 6. Cómo se prueba
Vitest con las pruebas junto al código (`src/**/*.test.ts`), desde la raíz: `pnpm test`. `pnpm test:determinism` ejecuta las pruebas cuyo nombre contiene "determinismo".

- `src/rng.test.ts` (17 pruebas):
  - determinismo por semilla, `state`/`restore`, JSON;
  - vector de referencia de xoshiro128\*\* (`[1,2,3,4]` → 11520, 0, 5927040);
  - CA-003 y ausencia de colisiones en 73 000 flujos persona × día;
  - distribuciones: media y varianza de `next`, chi-cuadrado de `int`, `chance`, `pick`, `weighted` y `normal`.
- `src/lint.test.ts` (2 pruebas): CA-005 mediante la API de ESLint sobre un archivo virtual del motor, más un control fuera del motor.
- `src/ids.test.ts`, `calendar.test.ts`, `scheduler.test.ts`, `events.test.ts`, `world.test.ts` y `runner.test.ts` (47 pruebas): los CA de las specs 001, 002 y 014, y de la 023 CA-004 y CA-006; también `close` → `WORLD_CLOSED` y `continueInputsAfter`.
  - Las pruebas cuyo nombre contiene "determinismo" (1x frente a 1000x, dos ejecuciones de 30 días, replay con entradas) corren también con `pnpm test:determinism`.
  - La 002 CA-005 (365 días en < 2 s) se impone con el `timeout` de la prueba, porque en el motor no se puede leer el reloj.
- `src/testing.ts`: `testConfig()` compartido por las pruebas; no se exporta.

## 7. Paridad con el prototipo
Porta `RNG`/`sm32` (023), `ev` (014) y `tick` (021, en su submódulo). Ver docs/prototipo-referencia.md.

- `RNG` → `Rng`. Métodos equivalentes: `next`, `int`, `pick`, `chance` y `normal` (misma fórmula de Box–Muller). `range(a, b)` no se porta: equivale a `a + (b - a) * rng.next()`.
- **Diferencias deliberadas.** El generador es xoshiro128\*\* y no `sm32` directamente, así que las secuencias no coinciden número a número; la paridad es estadística, como pide `docs/prototipo-referencia.md`. `int` no tiene sesgo de módulo. Hay flujos con nombre (`fork`) que el prototipo no tiene.

## 8. Pendientes y deuda
- [ ] Spec 023 CA-001 con 100 personas y CA-002 (necesitan población, M1).
- [ ] Spec 001 CA-005 (semillas distintas → hashes distintos tras la generación, M1).
- [ ] Registro de sistemas y bucle por fases (spec 021, cuando se apruebe).
- [ ] Si `#replay` crece mucho, pasar a un índice por minuto (hoy es un arreglo ordenado).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-23 | kit de arranque | — | Documento creado (sin código) |
| 2026-09-23 | m0/a-tooling (A5) | — | Esqueleto del paquete: `package.json` (workspace, ESM, `exports` → `src/index.ts`) y `src/index.ts` vacío. Sin API todavía |
| 2026-09-23 | m0/b-rng (B0–B3) | 023 | `Rng` xoshiro128\*\* con `fork` por clave de 64 bits, `state`/`restoreRng`, `int` sin sesgo, `weighted`, `normal`. Pruebas de CA-003 y CA-005 más distribución y vector de referencia. Excepción de determinismo aprobada para el ejemplo de `lint.test.ts` |
| 2026-09-23 | m0/c-mundo (C1–C6) | 001, 002, 014, 023 | Mundo (ids, configuración validada e inmutable, capacidades, componentes por columnas), calendario entero, scheduler por (at, id), catálogo de eventos validados e inmutables, `tick` mínimo, entradas externas con causalidad, `Runner` (velocidad, pausa, paso, N días, tiempo real → ticks, replay), `serializeWorld`/`stateHash`. 45 pruebas nuevas |
| 2026-09-24 | m0/e-cli-worker (E1–E3) | 001, 014, 023 | Evento `WORLD_CLOSED` y entrada externa `close` (sin cambiar `status`), `Runner.continueInputsAfter` para no repetir `(at, seq)` al retomar un mundo, `ENGINE_VERSION`. 2 pruebas nuevas |
| 2026-09-24 | m0/cierre (sincronizar-docs) | 002, 023 | Solo documentación: tabla de API completa (tipos y constantes que faltaban), paquete `@mundo-social/engine` (el nombre actual), 002 CA-005 cubierta también desde la CLI, 023 CA-001 marcada como parcial (probada con un mundo vacío; la spec pide 100 personas) |
| 2026-09-24 | chore/renombrar-datas-world-2 | — | Renombrado de los paquetes `@mundo-social/*` → `@datas-world/*` (imports y `package.json`). Sin cambios de comportamiento |
| 2026-09-24 | chore/nombre-datas-world | — | El nombre del mundo en las configuraciones de prueba y por defecto pasa de "Villa Cordillera" a "Data's World" (decisión del usuario). Sin cambios de comportamiento |
| 2026-09-24 | m1/a-catalogos (A3, A5) | 029, ADR-006 | `profile.ts` (`profileValue`/`profileNumber`/`profileEntry`/`checkProfile`); `WorldConfig.profile` y `WorldConfig.catalogs` opcionales, validados y dentro del hash; `ENGINE_VERSION` 0.2.0. Los tipos de las entidades se amplían en sus bloques (B a H). 6 pruebas |
