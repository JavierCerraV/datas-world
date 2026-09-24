---
modulo: engine
ruta: packages/engine
estado: planificado
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

## 5. Invariantes y guardarraíles
Sin E/S ni APIs no deterministas (comprobado por `scripts/guardrails/check.mjs` y ESLint). Iteración por id ascendente.

## 6. Cómo se prueba
Por definir al implementar.

## 7. Paridad con el prototipo
Porta `RNG`/`sm32` (023), `ev` (014) y `tick` (021, en su submódulo). Ver docs/prototipo-referencia.md.

## 8. Pendientes y deuda
- [ ] Primera implementación.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-23 | kit de arranque | — | Documento creado (sin código) |
