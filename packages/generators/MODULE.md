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
| 001 | — | todos |
| 023 | — | todos |


## 3. API pública
`src/index.ts` reexporta la API de cada submódulo, cada uno con su `MODULE.md`:
- `src/catalogs/`: catálogos de datos (ADR-006);
- `src/country/`: perfil de país y festivos (spec 029).

Los generadores del mundo llegan en los bloques B a H de M1.

## 4. Diseño interno y decisiones
- **Orden de generación** (spec 007 R-001 y spec 030 R-001): geografía → lugares → organizaciones → personalidad → hogares y población → empleo → objetos → historia. Cada paso usa su flujo `gen:<paso>` o `hist:<paso>`.
- **Datos fuera del código:** `catalogs/*.json` y `profiles/*.json`, validados con Zod al cargarlos (dependencia `zod` 4, ya prevista en el ADR-001; unos cientos de KB en disco y nada en el motor).

## 5. Invariantes y guardarraíles
Mismo seed → mismo mundo. Generación explicada: cada situación inicial tiene eventos de backstory.

## 6. Cómo se prueba
Por definir al implementar.

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
