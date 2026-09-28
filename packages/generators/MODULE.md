---
modulo: generators
ruta: packages/generators
estado: en-desarrollo
specs: [001, 023, 041, 044]
actualizado: 2026-09-23
---

# Módulo: generators

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Genera el mundo inicial a partir de semilla y parámetros. Cada generador (geografía, lugares, organizaciones, población, hogares, personalidad, objetos) vive en `src/<generador>/` con su MODULE.md.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 001 | CA-005 (con `world:new`, en `apps/cli`) | — |
| 023 | CA-001 con población (en `apps/cli`) | CA-002 (M2) |


## 3. API pública
`src/index.ts` reexporta la API de cada submódulo, cada uno con su `MODULE.md`:
- `src/catalogs/`: catálogos de datos (ADR-006);
- `src/country/`: perfil de país y festivos (spec 029);
- `src/geography/`, `src/places/`, `src/organizations/`, `src/personality/`, `src/population/`, `src/employment/`, `src/objects/`, `src/history/`: los generadores del mundo.

Y en la raíz, `src/generate.ts`:

| Símbolo | Descripción |
|---|---|
| `generateWorld({ seed, profileId?, population?, name?, epoch?, tickMinutes?, catalogs? })` → `GeneratedWorld` | La generación completa de M1, en el orden de abajo. Devuelve el mundo, todos los eventos de la creación ordenados por id (`WORLD_CREATED` y el pasado) y los resultados de cada paso |
| `DEFAULT_EPOCH`, `HOLIDAY_YEARS` | `2026-01-01T00:00` (030 §3) y 10 años de festivos en la configuración |

## 4. Diseño interno y decisiones
- **Orden de generación** (spec 007 R-001 y spec 030 R-001): geografía → lugares → organizaciones → personalidad → hogares y población → empleo → objetos → historia. Cada paso usa su flujo `gen:<paso>` o `hist:<paso>`.
- **Datos fuera del código:** `catalogs/*.json` y `profiles/*.json`, validados con Zod al cargarlos (dependencia `zod` 4, ya prevista en el ADR-001; unos cientos de KB en disco y nada en el motor).

## 5. Invariantes y guardarraíles
Mismo seed → mismo mundo. Generación explicada: cada situación inicial tiene eventos de backstory.

## 6. Cómo se prueba
Cada submódulo tiene sus pruebas junto al código. `src/testing.ts` (no exportado) monta mundos completos con `generateWorld` y carga los catálogos una sola vez.

## 7. Paridad con el prototipo
Porta `genWorld`, `buildPlaces`, `genPopulation`, `newAgent`, `genJobs`, `genRelations`, `genObjects`, `genFacts`.

## 8. Pendientes y deuda
- [ ] Primera implementación.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-23 | kit de arranque | — | Documento creado (sin código) |
| 2026-09-23 | m0/a-tooling (A5) | — | Esqueleto del paquete: `package.json` (workspace, ESM, `exports` → `src/index.ts`) y `src/index.ts` vacío. Sin API todavía |
| 2026-09-24 | m1/a-catalogos | ADR-006, 029 | Submódulos `catalogs` y `country` con su MODULE.md; dependencia `zod`; datos en `catalogs/` y `profiles/` |
| 2026-09-24 | m1/b-geografia | 003 | Submódulo `geography` (plantilla del prototipo, mapa y jerarquía territorial) |
| 2026-09-24 | m1/c-lugares | 004 | Submódulo `places` (lugares de las parcelas y viviendas) |
| 2026-09-24 | m1/d-organizaciones | 006 | Submódulo `organizations` (organizaciones y puestos) |
| 2026-09-24 | m1/e-personalidad | 009 | Submódulo `personality` y catálogos de rasgos y valores |
| 2026-09-24 | m1/f-poblacion | 007, 008 | Submódulo `population` (hogares, personas, apariencia y trayectoria) y 5 catálogos de población |
| 2026-09-24 | m1/g-empleo-objetos | 005, 006 | Submódulos `employment` y `objects`; `src/testing.ts` monta un mundo de M1 completo para las pruebas |
| 2026-09-24 | m1/h-historia | 030 | Submódulo `history` (historia desde 1900); `src/testing.ts` añade la historia al final y devuelve `hist`; `src/index.ts` exporta `generateHistory` y `lineageOf` |
| 2026-09-24 | m1/i-cli | 001, 007, 029, 030 | `src/generate.ts`: `generateWorld({ seed, profileId?, population?, name?, epoch?, tickMinutes?, catalogs? })` hace la generación completa de M1 (configuración con perfil, referencias de catálogos y festivos de `HOLIDAY_YEARS` años desde el epoch `DEFAULT_EPOCH`) y devuelve los eventos ordenados por id, listos para guardar. `src/testing.ts` la usa. La usan `world:new` y `bench` |
| 2026-09-24 | m1/j-dotacion | 033 | Submódulo `amenities` (dotación urbana). `generateWorld` elige la plantilla del perfil (`gen.map.template`) y, si tiene parcelas comerciales, aplica el plan de dotación, resuelve las parcelas y crea la ciudad de referencia; lo devuelve en `amenities`. `src/index.ts` exporta la API de `amenities` |
| 2026-09-25 | m1/j-salud | 031 | Submódulo `health` (ficha de salud). `generateWorld` genera hábitos, peso y discapacidad antes del empleo, y condiciones, afiliación y salud física después de la historia, si el perfil tiene ficha de salud |
| 2026-09-25 | m1/j-ocio | 032 | Submódulo `leisure` (ficha de esparcimiento). `generateWorld` la genera al final, cuando la salud, el empleo y la oferta de lugares ya existen |
| 2026-09-25 | m2/b-necesidades | 010 | `generateWorld` llama a `initNeeds` (motor) después de la población: necesidades, estrés y ánimo iniciales según la personalidad |
| 2026-09-25 | m2/c-rutinas | 011 | `generateWorld` llama a `initRoutines` (motor) al final, con el turno y las horas de sueño ya asignados. Perfiles: `routine.school`, `routine.meals` y `needs.rates.eatRate` |
| 2026-09-25 | m2/d-movilidad | 016, 005 | `generateWorld` llama a `initMobility` (motor): todos empiezan en su vivienda. Perfiles: `mobility.speeds`, `mobility.fuelPerKm`, `mobility.bus`, `mobility.intercity`, `mobility.habits` y `gen.objects.motoP` |
| 2026-09-25 | m2/e-decisiones | 017, 032 | `generateWorld` define las columnas de decisión (`defineDecisionColumns`). Exporta `leisureParams` y `leisureTable` |
| 2026-09-25 | mf/1-temperamento (MF1.2–MF1.5) | 009 v1.0, 035 | Temperamento en la población (`generateTemperament`, flujo `gen:temperament`); catálogos nuevos; exporta `checkTemperamentCatalog`, `generateTemperament`, tipo `TemperamentAttrs` (y deja de exportar `copingFor`, `COPING`, `COPING_COLUMN`, `topValues`). Módulo nuevo `src/architecture/` (escaneo del repositorio). Cambia el hash de los mundos nuevos (009 INV-002) |
| 2026-09-25 | m2/f-economia | 015 | Módulo nuevo `src/economy/` (`generateEconomy`, exportado); `generateWorld` la llama al final. Perfil `CO-2026.09`: `economy.*`, `gen.savings.household.*` y `needs.stress.debt` |
| 2026-09-25 | m2/g-trabajo-objetos | 006 | `generateWorld` define las columnas del trabajo (`defineWorkColumns`) |
| 2026-09-25 | m2/h-cierre | 021, 015, 016, 017, 006, 023 | `life.ts`: `LIFE_CAPABILITIES`, `lifeSystems(world, catalogs)` (registro con todos los sistemas de M2 y el validador de acciones) y `lifeRunner` (con la semilla del mundo). `generateWorld` crea los mundos con las capacidades de la vida diaria (`static: true` para uno de solo reloj, como los de M1); cambia el hash de los mundos nuevos. `life.test.ts`: 021 CA-001 (nivel 1 frente a 2) y 023 CA-002 |
| 2026-09-25 | mf/2-funciones (MF2.1, MF2.5) | 036 | Módulo nuevo `src/stimuli/` (`buildOntology`, exportado). `life.ts`: `LIFE_CAPABILITIES` incluye `learning` y `lifeSystems` monta el sistema de aprendizaje con la ontología del catálogo; cambia el hash de los mundos nuevos |
| 2026-09-26 | mf/3-seleccion | 040 | `generateWorld` llama a `initLearnedStates` (040 R-011) después de la ficha de esparcimiento; `lifeSystems` pasa la ontología al sistema de decisiones. Cambia el hash de los mundos nuevos |
| 2026-09-26 | mf/4-red | 037 | `lifeSystems` monta el sistema `relations` (enseñanza de la comunidad verbal); catálogo `stimulus_classes` 2026.09.2 |
| 2026-09-26 | mf/5-reglas-valores | 038 | `generateWorld` llama a `initRules` (reglas de la rutina); `lifeSystems` monta el sistema `rules`. Catálogo `stimulus_classes` 2026.09.3 |
| 2026-09-27 | charla/l3-mundo (L3) | 043 | `lifeRunner` registra los manejadores de la charla (`chatInputHandlers`) con los catálogos `chat_*`, la ontología y los parámetros de aprendizaje; `chatEngineCatalog`. Prueba `chat-world.test.ts`: apertura, consolidación, rechazo sin cambios y replay (043 CA-014) |
| 2026-09-27 | charla/l5 (L5.1, L5.2) | 044, 005 | `chatEngineCatalog` incluye `chat_claims` y `chat_relations` (sin ellos el worker descartaría todas las afirmaciones). El celular desde los 14 años cambia los objetos y el hash de los mundos nuevos (044 P2). Prueba nueva en `chat-world.test.ts`: una afirmación sobre su hijo deja la creencia y el replay da el mismo estado sin LLM (044 CA-006) |
| 2026-09-27 | charla/l5 (L5.3) | 044 | `lifeSystems` monta los sistemas de las consecuencias de la charla (`consequenceSystems`: llamadas, encuentros y vínculos); sin intenciones no hacen nada, así que no cambian el hash de los mundos. `chatEngineCatalog` incluye el celular (`phone`: el tipo con `callAccess`). Prueba en `chat-world.test.ts`: la revelación forma una intención, todo encuentro se remonta a lo que oyó (044 INV-002) y el replay de 2 días coincide |
| 2026-09-27 | charla/l5 (L5.4) | 044 | `chat-world.test.ts` con tiempo máximo de 60 s por prueba: cada una genera y hace vivir el mundo de la semilla, y con toda la suite en paralelo superaba los 5 s por defecto |
| 2026-09-28 | mf/6-privados (MF6) | 039 | `lifeSystems` monta el sistema `private` (eventos privados, PNR, evitación y «Yo»). Sin nada activo no hace nada |
| 2026-09-28 | mf/7-desarrollo (MF7) | 041, 031 | `generateWorld` añade la fase de desarrollo (`generateDevelopment`, módulo `development`) después de la historia de la 030, salvo en los mundos estáticos, y después `learnedHabits` (tabaco, alcohol, actividad física y peso desde lo aprendido). Cambia el hash de los mundos nuevos. `vitest.config.ts`: tiempo máximo de 180 s por prueba y 120 s por preparación, porque generar un mundo incluye su historia |
| 2026-09-28 | m3/relaciones (R1, R5) | 012 | `lifeSystems` monta los sistemas de relaciones (encuentros, registro de causas y trabajo diario) y `LIFE_CAPABILITIES` incluye `relationships`. Cambia el hash de los mundos que viven. Prueba nueva `relationships-world.test.ts`: punto de partida (R-007) y 100 personas × 1 año (CA-001, CA-002, degeneración) |
