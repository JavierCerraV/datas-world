---
modulo: generators
ruta: packages/generators
estado: en-desarrollo
specs: [001, 023]
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
