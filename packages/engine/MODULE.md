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
| 023 | CA-003 (fork estable), CA-005 (lint de `Math.random`) | CA-001, CA-002, CA-004 (necesitan mundo y tick, bloque C), CA-006 (capacidades) |


## 3. API pública
Desde `@mundo-social/engine` (`src/index.ts`):

| Símbolo | Archivo | Descripción |
|---|---|---|
| `createRng(seed): Rng` | `src/rng.ts` | Flujo raíz de un mundo. `seed` se interpreta como uint32 |
| `restoreRng(state): Rng` | `src/rng.ts` | Reconstruye un flujo desde `state()`, en el mismo punto de la secuencia |
| `interface Rng` | `src/rng.ts` | `next`, `int`, `chance`, `pick`, `weighted`, `normal`, `fork`, `state` (spec 023 §3) |
| `interface RngState` | `src/rng.ts` | `{ key: [u32, u32], s: [u32 ×4] }`, serializable como JSON |

## 4. Diseño interno y decisiones
Funciones puras `(state, input, rng) => { patches, events }`. Sistemas en carpetas propias con su MODULE.md y sus specs.

- **Sin paso de compilación.** Node 24 ejecuta TypeScript directamente (eliminación de tipos), así que `exports` apunta a `src/index.ts`. El tsconfig impone `erasableSyntaxOnly`: nada de `enum`, `namespace` ni propiedades de parámetro. Los imports relativos llevan extensión `.ts` (`allowImportingTsExtensions`).
- **Estado por componentes y sistemas enchufables** según ADR-005 (specs 001 §3.1 y 021). Se implementa a partir del bloque C.
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

## 7. Paridad con el prototipo
Porta `RNG`/`sm32` (023), `ev` (014) y `tick` (021, en su submódulo). Ver docs/prototipo-referencia.md.

- `RNG` → `Rng`. Métodos equivalentes: `next`, `int`, `pick`, `chance` y `normal` (misma fórmula de Box–Muller). `range(a, b)` no se porta: equivale a `a + (b - a) * rng.next()`.
- **Diferencias deliberadas.** El generador es xoshiro128\*\* y no `sm32` directamente, así que las secuencias no coinciden número a número; la paridad es estadística, como pide `docs/prototipo-referencia.md`. `int` no tiene sesgo de módulo. Hay flujos con nombre (`fork`) que el prototipo no tiene.

## 8. Pendientes y deuda
- [ ] Mundo, reloj, scheduler, eventos y `stateHash` (bloque C).
- [ ] CA-001, CA-002 y CA-004 de la spec 023 cuando exista `tick`.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-23 | kit de arranque | — | Documento creado (sin código) |
| 2026-09-23 | m0/a-tooling (A5) | — | Esqueleto del paquete: `package.json` (workspace, ESM, `exports` → `src/index.ts`) y `src/index.ts` vacío. Sin API todavía |
| 2026-09-23 | m0/b-rng (B0–B3) | 023 | `Rng` xoshiro128\*\* con `fork` por clave de 64 bits, `state`/`restoreRng`, `int` sin sesgo, `weighted`, `normal`. Pruebas de CA-003 y CA-005 más distribución y vector de referencia. Excepción de determinismo aprobada para el ejemplo de `lint.test.ts` |
