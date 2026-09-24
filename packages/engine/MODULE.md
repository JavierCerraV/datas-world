---
modulo: engine
ruta: packages/engine
estado: en-desarrollo
specs: [001, 002, 014, 023]
actualizado: 2026-09-23
---

# Módulo: engine

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Núcleo puro de la simulación: tipos del dominio, RNG, reloj, scheduler, eventos, validación de acciones y bucle de tick. Cada sistema (necesidades, rutinas, relaciones, memoria…) vive en `src/<sistema>/` con su propio MODULE.md.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 001 | — | todos |
| 002 | — | todos |
| 014 | — | todos |
| 023 | — | todos |


## 3. API pública
Por definir al implementar.

## 4. Diseño interno y decisiones
Funciones puras `(state, input, rng) => { patches, events }`. Sistemas en carpetas propias con su MODULE.md y sus specs.

- **Sin paso de compilación.** Node 24 ejecuta TypeScript directamente (eliminación de tipos), así que `exports` apunta a `src/index.ts`. El tsconfig impone `erasableSyntaxOnly`: nada de `enum`, `namespace` ni propiedades de parámetro. Los imports relativos llevan extensión `.ts` (`allowImportingTsExtensions`).
- **Estado por componentes y sistemas enchufables** según ADR-005 (specs 001 §3.1 y 021). Se implementa a partir del bloque C.

## 5. Invariantes y guardarraíles
Sin E/S ni APIs no deterministas. Iteración por id ascendente. Se comprueba dos veces, de forma independiente:
- ESLint (`eslint.config.js`, bloque `packages/engine/src/**`): prohíbe los globales `Date`, `performance`, `crypto`, `setTimeout`, `setInterval` y `fetch`; la propiedad `Math.random`; y los imports de `fs`, `net`, `http`, `https`, `child_process`, `dgram` y `worker_threads`.
- `scripts/guardrails/check.mjs` (sección D): busca los mismos tokens línea a línea.

## 6. Cómo se prueba
Vitest con las pruebas junto al código (`src/**/*.test.ts`), desde la raíz: `pnpm test`. `pnpm test:determinism` ejecuta las pruebas cuyo nombre contiene "determinismo"; hasta el bloque C no hay ninguna.

## 7. Paridad con el prototipo
Porta `RNG`/`sm32` (023), `ev` (014) y `tick` (021, en su submódulo). Ver docs/prototipo-referencia.md.

## 8. Pendientes y deuda
- [ ] Primera implementación.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-23 | kit de arranque | — | Documento creado (sin código) |
| 2026-09-23 | m0/a-tooling (A5) | — | Esqueleto del paquete: `package.json` (workspace, ESM, `exports` → `src/index.ts`) y `src/index.ts` vacío. Sin API todavía |
