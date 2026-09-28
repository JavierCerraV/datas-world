---
modulo: engine
ruta: packages/engine
estado: en-desarrollo
specs: [001, 002, 003, 004, 005, 006, 007, 008, 009, 014, 023, 029, 030, 035, 039, 041, 043, 044]
actualizado: 2026-09-24
---

# Módulo: engine

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Núcleo puro de la simulación: tipos del dominio, RNG, reloj, scheduler, eventos, validación de acciones y bucle de tick. Cada sistema (necesidades, rutinas, relaciones, memoria…) vive en `src/<sistema>/` con su propio MODULE.md.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 001 | CA-001, CA-002, CA-003, CA-004, CA-006, CA-007, CA-008; CA-005 se prueba con la generación (`generators/src/population`, `apps/cli`) | — |
| 002 | CA-001, CA-002, CA-003, CA-004, CA-005 (en el motor y desde la CLI, `apps/cli`) | — |
| 014 | CA-001, CA-002, CA-003 | — |
| 023 | CA-003, CA-004, CA-005, CA-006; CA-001 en parte: mismo hash en un proceso y entre dos procesos (`apps/cli`), pero con un mundo vacío | CA-001 con 100 personas y CA-002 (necesitan población, M1–M2) |
| 003 | Soporte del mapa: R-002 (distancias por calle), INV-002 (con `generators/src/geography`). Los CA se prueban en el generador | — |
| 004 | `Place` y `addPlace` validado (R-001 en parte). Los CA se prueban en el generador de lugares (bloque C) | — |
| 006 | `Organization`, `Position` y `addOrganization` validado; `hire` y `setOccupation`; eventos `JOB_HIRED`, `INFORMAL_WORK_STARTED`, `JOB_LOST` y `RETIRED`. Los CA se prueban en el generador de organizaciones | — |
| 007, 008 | Tipos `Citizen`, `Household`, `Kinship` y `Occupation`; `addPerson`, `addHousehold`, `completeHousehold`; `ageInYears`; eventos `HOUSEHOLD_FORMED`, `STUDIES_COMPLETED`, `CHILDHOOD_EVENT`. Los CA se prueban en el generador de población | — |
| 005 | `WorldObject`, `addObject`, `objectsOf`; eventos `OBJECT_ACQUIRED` y `OBJECT_INHERITED`. Los CA se prueban en el generador de objetos | — |
| 029 | Consulta del perfil (R-002, R-003 con `profileValue`); INV-001 e INV-002 (`checkProfile`). Los CA se prueban en `generators/src/country` | — |
| 030 | Antepasados, padres y fechas de fundación validados (`history.ts`); 9 eventos de la historia. Los CA se prueban en `generators/src/history` | — |
| 043 | Eventos de la charla en el mundo: `CONVERSATION_STARTED`, `CONVERSATION_DECLINED`, `CONVERSATION_HELD` y `LEARNED_FROM_CONVERSATION`. Los CA se prueban en `src/conversation` | — |


## 3. API pública
Desde `@datas-world/engine` (`src/index.ts`). Todo lo público se reexporta desde ahí:

| Símbolo | Archivo | Descripción |
|---|---|---|
| `createRng(seed): Rng` | `src/rng.ts` | Flujo raíz de un mundo. `seed` se interpreta como uint32 |
| `restoreRng(state): Rng` | `src/rng.ts` | Reconstruye un flujo desde `state()`, en el mismo punto de la secuencia |
| `interface Rng` | `src/rng.ts` | `next`, `int`, `chance`, `pick`, `weighted`, `normal`, `fork`, `state` (spec 023 §3) |
| `interface RngState` | `src/rng.ts` | `{ key: [u32, u32], s: [u32 ×4] }`, serializable como JSON |
| `formatId`, `allocateId`, `idKind`, `idNumber`, `emptyCounters`, `ID_WIDTH`, `ENTITY_KINDS`, tipos `EntityId`/`EntityKind`/`Counters`/`WorldId` | `src/ids.ts` | Identificadores con relleno por tipo; los contadores nunca retroceden (001 R-001) |
| `ageInYears(nacimiento, minuto, epoch)`, `toCalendar`, `parseEpoch`, `parseDate`, `daysFromCivil`, `civilFromDays`, `formatDate`, `MINUTES_PER_DAY`, tipos `WorldMinute`/`CalendarView`/`CivilDate`/`CivilDateTime` | `src/calendar.ts` | Calendario gregoriano con aritmética entera, sin `Date` (002) |
| `createScheduler`, `schedule`, `popDue`, `sortedItems`, tipos `Scheduler`/`ScheduledItem` | `src/scheduler.ts` | Montículo por `(at, id)` (002 R-004) |
| `makeEvent`, `eventText`, `EVENT_TYPES`, tipos `WorldEvent`/`CauseRef`/`NewEvent`/`EventType`/`EventOrigin` | `src/events.ts` | Catálogo central; creación validada e inmutable (014) |
| `CAPABILITIES`, `CAPABILITY_DEPS`, `canEnable`, `isCapability`, `withCapability`, `validateCapabilities`, tipo `Capability` | `src/capabilities.ts` | Capacidades y dependencias (001 R-007) |
| `defineColumn`, `ensureCapacity`, `columns`, `capacityFor`, tipos `CitizenComponents`/`ColumnType` | `src/components.ts` | Columnas tipadas por índice denso (001 §3.1) |
| `createWorld`, `addCitizen`, `addPerson`, `addHousehold`, `completeHousehold`, `addPlace`, `addOrganization`, `deactivateEntity`, `validateConfig`, tipos `World`/`WorldConfig`/`WorldStatus`/`BaseEntity`/`Citizen`/`Place`/`NewPlace`/`OpeningHours`/`Organization`/`NewOrganization`/`Position`/`NewPosition`/`Shift`/`Household`/`Kinship`/`KinshipKind`/`NewPerson`/`Occupation` | `src/world.ts` | Mundo raíz (001). `addPlace` da de alta un lugar o una unidad territorial validando padre, barrio, rectángulo y puerta dentro del mapa, estrato 1–6, `safety` en [0,1], capacidad entera ≥ 1 y horario (`{ days, open, close }` en minutos, `'24h'` o `null` si es privado) (003, 004). `addHousehold` crea un hogar vacío en una vivienda existente y libre (una vivienda, un hogar); `addPerson` crea la fila del ciudadano con nombre, sexo, lugar de nacimiento y hogar, y lo añade a sus miembros; `completeHousehold` fija cabeza, parentesco (dirigido, entre miembros) y cuidadores (007, 008). `addOrganization` valida lugares, sector y ocupación (claves de catálogo), sueldo entero ≥ 0 con `wagePeriod` mensual o diario, turno dentro del día con almuerzo menor que el turno, nivel, supervisor (índice de otro puesto) y cultura en [0,1], y asigna los ids de puesto `ORG-0001/P01…` (006) |
| `serializeWorld`, `deserializeWorld`, `stateHash`, `canonicalize`, `hashString`, tipo `WorldSnapshot` | `src/serialize.ts`, `src/hash.ts` | Instantánea JSON y hash canónico de 64 bits (001 R-004, R-010). `serializeWorld` copia en profundidad; `stateHash` recorre la misma forma sin copiar (mismo resultado, ≈ 60 % menos coste) |
| `tick`, `applyExternalInput`, tipos `ExternalInput`/`InputResult`/`ScheduledHandler` | `src/tick.ts` | Tick y entradas externas: `enable_capability`, `set_speed`, `pause`, `resume`, `close` (002, 023 R-004). Desde M2, `tick(world, rng, handlers?, systems?, loop?)` recorre además el registro de sistemas por fases (021, módulo `src/simulation/`) |
| `Runner`, tipo `Speed` | `src/runner.ts` | Velocidad, pausa, paso, avanzar N días, tiempo real → ticks, replay (002, 023). `continueInputsAfter(última)` continúa la numeración `seq` al retomar un mundo guardado. Desde M2: `new Runner(world, rng, handlers?, { systems?, loop? })` |
| Bucle de sistemas (spec 021) | `src/simulation/` | `createRegistry`, `runSystems`, `applyPatches`, `viewOf`, `levelOf` y los tipos `System`, `Patch`, `WorldView`… Ver su MODULE.md |
| `hire`, `setOccupation` | `src/employment.ts` | Única vía para cambiar la ocupación. `hire` ocupa un puesto libre y lo refleja en la persona y en el puesto (006 INV-002); `setOccupation` asigna una ocupación informal, independiente o ninguna, con su motivo |
| `addObject`, `recordObjectEvent`, `objectsOf`, tipos `WorldObject`/`NewObject` | `src/objects.ts`, `src/world.ts` | Objetos con dueño CIT o HOU validado, valores en rango e historia de eventos; `objectsOf` devuelve los objetos propios y los del hogar (005) |
| `ENGINE_VERSION` | `src/version.ts` | Versión del motor para `WorldConfig.engineVersion` y `meta.engine_version` (027 R-009). `0.2.0` desde M1 |
| `profileValue`, `profileNumber`, `profileEntry`, `checkProfile`, tipos `CountryProfile`/`ProfileEntry`/`ProfileScope`/`ProfileStatus`/`ProfileValue` | `src/profile.ts` | Perfil de país (029): valor vigente por clave, fecha ("AAAA-MM-DD") y alcance territorial, con respaldo en el nacional. Lanza si falta la cifra. `checkProfile` comprueba INV-001 e INV-002 |
| `TILE`, `createGeoMap`, `tileAt`, `setTile`, `roadDistances`, `doorDistanceMatrix`, `geoToData`, `geoFromData`, tipos `GeoMap`/`GeoMapData`/`TileKind`/`TilePoint` | `src/geo.ts` | Mapa de tiles (u8) y distancias por calle (BFS, 4 vecinos en orden fijo). La matriz entre puertas es derivada: no se guarda (003 R-002) |
| tipo `CatalogRef` | `src/world.ts` | `{ version, hash }` de un catálogo (ADR-006 §4) |
| `LATE_CLOSE_LIMIT`, `Place.travel` | `src/world.ts` | Un horario puede cerrar hasta las 06:00 del día siguiente (`close` ≤ 1800). Un lugar regional, fuera del mapa, lleva `travel: { minutes, cost }` y no tiene `rect` (033) |
| `addAncestor`, `setParents`, `setFoundedAt`, tipo `NewAncestor` | `src/history.ts` | Historia generada (030). `addAncestor` crea un antepasado fuera del mundo (`active = 0`, `status: 'inactive'`, `ancestor: true`, sin hogar); `setParents` fija madre (F) y padre (M) existentes y distintos del hijo; `setFoundedAt` fija la fundación de un `PLC` u `ORG`, siempre antes del presente. `Citizen` gana `motherId`, `fatherId` y `ancestor`; `Place` y `Organization`, `foundedAt` |

## 4. Diseño interno y decisiones
Funciones puras `(state, input, rng) => { patches, events }`. Sistemas en carpetas propias con su MODULE.md y sus specs.

- **Sin paso de compilación.** Node 24 ejecuta TypeScript directamente (eliminación de tipos), así que `exports` apunta a `src/index.ts`. El tsconfig impone `erasableSyntaxOnly`: nada de `enum`, `namespace` ni propiedades de parámetro. Los imports relativos llevan extensión `.ts` (`allowImportingTsExtensions`).
- **Estado por componentes** (ADR-005, spec 001 §3.1). Los valores numéricos por persona van en columnas tipadas, con la fila = número del `CIT` y la fila 0 sin usar. Crecen ×2 conservando las filas y cada columna guarda su valor inicial. La columna `active` existe desde el principio. El hash solo cubre las filas usadas, así que la capacidad reservada no lo afecta (R-010).
- **Sistemas enchufables (spec 021)**: todavía no. La spec 021 está en borrador; el `tick` de M0 solo avanza el reloj, emite `DAY_STARTED` y atiende el scheduler con manejadores por tipo.
- **El azar no tiene estado persistente.** El flujo raíz nunca se consume directamente: todo se deriva con `fork` (p. ej. `fork('sched').fork(item.id)`). Por eso el estado del RNG no se guarda y cargar un mundo da el mismo resultado que no haberlo cerrado.
- **Mutación controlada.** `tick`, `applyExternalInput`, `addCitizen` y `deactivateEntity` modifican el `World` recibido y devuelven los eventos. Es el paso de "aplicar" del motor (CLAUDE.md regla 4). Los parches por sistema llegan con la 021.
- **Mapa y lugares** (M1).
  - `World.geo` es opcional. Cuando existe, entra en la instantánea como `geo` (tiles como arreglo) y, por tanto, en el hash. Sin mapa, la instantánea no lleva la clave y el hash de los mundos de M0 no cambia.
  - Las entidades se copian con `structuredClone` al serializar y cargar, porque las de M1 tienen objetos anidados.
  - Las distancias entre puertas se calculan por BFS sobre las calles; en la plantilla del prototipo, 23 puertas cuestan unos 23 × 2 560 pasos.
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
| 2026-09-24 | m1/b-geografia | 003, 004 | `geo.ts` (mapa de tiles, distancias por calle, matriz entre puertas); `World.geo` opcional en la instantánea y el hash; tipo `Place` y `addPlace` validado; copia profunda de entidades al serializar. 6 pruebas |
| 2026-09-24 | m1/c-lugares | 004 | `Place` gana `capacity` y `openingHours` (tipo `OpeningHours`), validados en `addPlace`. 1 prueba |
| 2026-09-24 | m1/d-organizaciones | 006 | Tipos `Organization`, `Position`, `Shift`, `NewOrganization`, `NewPosition` y `addOrganization` validado (ids de puesto `ORG-0001/P01`, supervisor por índice). 2 pruebas |
| 2026-09-24 | m1/f-poblacion | 007, 008, 014 | `Citizen` (nombre, sexo, lugar de nacimiento, hogar, ocupación, trayectoria; campos opcionales por compatibilidad con `addCitizen`), `Household`, `Kinship`, `Occupation`; `addPerson`, `addHousehold`, `completeHousehold`; `ageInYears` por calendario (también antes del epoch y con bisiestos); eventos `HOUSEHOLD_FORMED`, `STUDIES_COMPLETED` y `CHILDHOOD_EVENT`. 4 pruebas |
| 2026-09-24 | m1/g-empleo-objetos | 005, 006, 014 | `employment.ts` (`hire`, `setOccupation`) y `objects.ts` (`addObject`, `recordObjectEvent`, `objectsOf`) en archivos propios, porque `world.ts` pasaba de 300 líneas; tipo `WorldObject`; 6 eventos nuevos en el catálogo. 5 pruebas |
| 2026-09-24 | m1/h-historia | 014, 030 | `history.ts` (`addAncestor`, `setParents`, `setFoundedAt`); `Citizen.motherId`/`fatherId`/`ancestor`; `foundedAt` en lugares y organizaciones; 9 eventos de la historia generada (`HISTORICAL_CONTEXT` es espontáneo). 3 pruebas |
| 2026-09-25 | m1/j-ocio | 032, 014 | `Citizen.leisure` (tipo `LeisureInterest`: clave, afinidad, veces al mes, desde cuándo) y evento `LEISURE_TAKEN_UP` |
| 2026-09-25 | m1/j-salud | 031, 014 | `Citizen.conditions` (tipo `HealthCondition`: clave, fecha de diagnóstico, controlada) y eventos `HEALTH_INSURANCE_SET` y `CONDITION_DIAGNOSED` de la ficha de salud |
| 2026-09-24 | m1/j-dotacion | 004, 033 | `Place.travel` (lugar regional fuera del mapa: minutos y coste del viaje; incompatible con `rect`) y horarios que cierran después de medianoche, hasta `LATE_CLOSE_LIMIT` = 06:00 del día siguiente (bares, 033 R-004). 1 prueba ampliada |
| 2026-09-24 | m1/i-cli | 001, 027 | `stateHash` ya no copia el mundo (`snapshotOf` con copia o sin ella): el mismo hash con ≈ 60 % menos coste, medido con un mundo de M1 poblado. Sin cambios de comportamiento |
| 2026-09-25 | m2/a-bucle | 021 | Módulo nuevo `src/simulation/` (bucle de sistemas por fases, registro, parches, vista de solo lectura). `tick` y `Runner` aceptan el registro y las opciones del bucle; sin sistemas, el hash de los mundos de M0 y M1 no cambia. 8 pruebas en el módulo |
| 2026-09-25 | m2/b-necesidades | 010, 014 | Módulo nuevo `src/needs/` (necesidades, emociones, estrés, ánimo, sueño y enfermedad aguda) y `src/activity.ts` (actividad actual, `act.kind`). Eventos `FELL_ILL`, `RECOVERED` y `STRESS_PEAK`. `index.ts` exporta la API de ambos. 6 pruebas en el módulo |
| 2026-09-25 | m2/c-rutinas | 011, 010, 014 | Módulo nuevo `src/routines/` (horarios, tipo de día, plan del día, despertar y `OVERSLEPT`). Evento `OVERSLEPT`. `index.ts` exporta su API. `testing.ts` comparte el perfil de prueba `TEST_PROFILE` (necesidades y rutina). 7 pruebas en el módulo |
| 2026-09-25 | m2/d-movilidad | 016, 004, 014, 021 | Módulo nuevo `src/mobility/` (posición, viajes, modos, bus a La Capital, entrada a los lugares, llegadas tarde). Eventos `ARRIVED_LATE` y `TRIP_TAKEN`. `SystemEvent` con `recordAs` en el bucle. `testing.ts`: parámetros `mobility.*` en `TEST_PROFILE`. 8 pruebas en el módulo |
| 2026-09-25 | m2/e-decisiones | 017, 032, 014 | Módulo nuevo `src/decision/` (opciones, utilidad, softmax, validación de acciones y explicación como causa). Evento `LEISURE_DONE`. `LeisureInterest.lastDone`. 7 pruebas en el módulo |
| 2026-09-25 | mf/1-temperamento (MF1.4, MF1.5) | 009 v1.0, 035 | Módulos nuevos `src/temperament/` (registro de mecanismos, términos prohibidos, adaptador @deprecated) y `src/architecture/` (guardarraíl anticircularidad). `index.ts` exporta `MECHANISMS`, `isMechanism`, `FORBIDDEN_TERMS`, `legacyTraits`/`legacyTrait` (@deprecated), `checkArchitecture`, `POLICY` y `doneTasks` |
| 2026-09-25 | m2/f-economia | 015, 001, 014 | Módulo nuevo `src/economy/`. `World.accounts` (resto del país), `Household.tenure/rent/savings`, `Organization.cash`, `Citizen.debts` y tipo `Debt`; la instantánea incluye `accounts` solo si existe (el hash de los mundos anteriores no cambia). Eventos `SALARY_PAID`, `RENT_PAID`, `RENT_LATE`, `DEBT_TAKEN`, `DEBT_REPAID` y `PAYMENT_MISSED`. `testing.ts`: parámetros de economía en `TEST_PROFILE` |
| 2026-09-25 | m2/g-trabajo-objetos | 006, 005, 014 | Módulo nuevo `src/work/` (retrasos, advertencias, despidos, vacantes, crisis). `objects.ts`: `transferObject` (regalo con valor emocional según quién lo da, venta) y `loseObject` (el objeto queda con `status: inactive` y su `fate`, nunca se borra), con `GIFT_SENTIMENTAL`. Tipos: `Citizen.jobRecord`, `Organization.crisisDays`. Eventos `JOB_WARNING`, `OBJECT_GIFTED`, `OBJECT_SOLD` y `OBJECT_LOST`. 3 pruebas nuevas de objetos (`objects-life.test.ts`: 005 CA-004, CA-005) |
| 2026-09-25 | mf/2-funciones | 036, 042, 001, 021 | Módulos nuevos `src/functions/` (capa 2 del motor funcional) y `src/lab/` (batería 042). `Citizen.functions` (almacén por persona). `capabilities.ts`: `learning` depende de `routines`. `index.ts` exporta la API de `functions` |
| 2026-09-26 | mf/3-seleccion | 040, 036 | `decision` pasa a la 040 (fuentes de control, `select.ts`); `functions` añade los estados aprendidos y el aprendizaje de la selección; `lab` añade V-4 y V-5; `routines` quita el adaptador. `index.ts` exporta la API nueva y deja de exportar `Factor` |
| 2026-09-26 | mf/4-red | 037 | Módulo nuevo `src/relations/` (capa 3: red relacional). `Citizen.network`. `index.ts` exporta su API y `directValue` |
| 2026-09-26 | mf/5-reglas-valores | 038 | Módulo nuevo `src/rules/` (capa 4: reglas y valores). `Citizen.rules`. `index.ts` exporta su API |
| 2026-09-27 | charla/l1-motor (L1) | 043 | Módulo nuevo `src/conversation/` (charla con ciudadanos: tono, postura, disponibilidad y consolidación). Eventos nuevos `CONVERSATION_STARTED`, `CONVERSATION_DECLINED`, `CONVERSATION_HELD` y `LEARNED_FROM_CONVERSATION`. `index.ts` exporta su API |
| 2026-09-27 | charla/l3-mundo (L3) | 043, 002, 021 | Velocidad de tiempo real `REAL_TIME` (1/60x, 002 R-003). Registro de manejadores de entradas externas (`InputHandler`; opción `inputs` del `Runner`) en dos fases: validar sin cambiar nada y luego aplicar. Actividad `conversation` (código 16) |
| 2026-09-27 | charla/l5 (L5.2) | 044 | Eventos nuevos `CHAT_CLAIM_HEARD` y `CHAT_CLAIM_BELIEVED`. `Citizen.beliefs` (creencia mínima: sobre quién, qué, fuente, credibilidad, minuto y evento causa) y `Citizen.bonds` (tensión y confianza de los vínculos tocados, 044 P3: en la persona hasta la 012). `index.ts` exporta la API de las afirmaciones del módulo `conversation` y los tipos `Belief` y `Bond` |
| 2026-09-27 | charla/l5 (L5.3) | 044 | Eventos nuevos `INTENTION_FORMED`, `INTENTION_EXPIRED`, `PHONE_CALL_MADE` (con la urgencia), `CONFRONTATION` (con la vía, las dos respuestas y el impacto) y `BOND_STRAINED` (tensión y las dos confianzas). `Citizen.intentions` (tipo `Intention`). `Belief.about` admite al visitante (`EXT-…`), para lo que aprende el tercero (044 P4). `index.ts` exporta los sistemas de las consecuencias y la API de las intenciones |
| 2026-09-28 | mf/6-privados (MF6) | 039 | Módulo nuevo `src/private/` (capa 5: eventos privados, PNR, evitación y «Yo»). `Citizen.mind`. Eventos nuevos `PNR_EPISODE` y `THOUGHT_DERIVED`. `index.ts` exporta su API y `MOOD_BASELINE` en lugar de `stability` (MF6.4) |
| 2026-09-28 | mf/7-desarrollo (MF7) | 041 | Evento nuevo `DEVELOPMENT_YEAR` (un año de vida con todos sus episodios; tipo `DevelopmentEpisode`). Se elimina el adaptador de rasgos (`temperament/legacy.ts`) y su exportación (MF7.4). Las horas de sueño sin ficha de salud ya no leen rasgos (MF7.3) |
| 2026-09-28 | mf/8-rendimiento (MF8.5) | 001, 021 | `ids.ts`: `formatId` guarda los ids ya formateados y `idNumber`/`idKind` los ya leídos, solo de entidades del mundo (no de eventos, para acotar la memoria); `parse` sin expresión regular, con las mismas validaciones. Sin cambios de comportamiento (mismo hash). Junto con los cambios de movilidad, rutinas y parches, un año con 254 personas pasa de 411 s a 270 s (`docs/validaciones/MF8-bench-vida.md`) |
| 2026-09-28 | m3/relaciones (R1–R5) | 012 | Módulo nuevo `relationships/` (ver su MODULE.md). `Bond` se amplía (familiaridad, etiquetas `BondLabel`, encuentros, última discusión, deterioro, eventos del par). Eventos nuevos `MET`, `ENCOUNTER` (roce), `FRIENDSHIP_FORMED`, `ARGUMENT`, `RELATIONSHIP_STARTED`, `BREAKUP` y `BOND_FORGOTTEN`, con sus textos. El índice exporta el módulo |
