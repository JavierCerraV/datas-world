---
modulo: experiment
ruta: packages/engine/src/experiment
estado: en-desarrollo
specs: [028]
actualizado: 2026-10-07
---

# Módulo: experiment

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Las piezas puras de los experimentos (spec 028): la definición de un experimento y su validación, los manejadores de las intervenciones (`force_job_loss`, `grant_money`), las métricas por persona, el colector de eventos que cuenta y descarta, y la comparación pareada con intervalo por *bootstrap*. No corre mundos ni toca disco: eso lo hacen `generators/experiment` (la corrida de un brazo) y la CLI (la base, el informe y los archivos).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 028 | R-003, R-004, R-006 (de estado), R-007, R-008; parte pura de CA-004 | `psychometrics` como métrica; `--keep-events` (R-007); CA-007 (memoria) |

## 3. API pública
| Símbolo | Descripción |
|---|---|
| `parseExperiment(raw)` → `Experiment` | Valida la definición de un archivo y completa los valores por defecto (028 §8); lanza con el motivo. `base.branchAt` 0 = el estado actual de la base |
| `experimentInputs()`, `EXPERIMENT_FEED_KINDS` | Manejadores `force_job_loss` y `grant_money` para el `Runner` (`opts.inputs`) y los tipos cuyos eventos deben llegar al aprendizaje (`opts.feedKinds`) |
| `measure(world, id, metric, rolling, counter)`, `Rolling`, `EventCounter`, `eventTypesOf` | Métricas de estado por persona (`mood`, `stress` con media de 7 días, `money`, `debt`, `employed`, `bonds`, `pnr_episodes`, `events:<TIPO>`) y el colector que cuenta eventos y los descarta |
| `pairedContrast(pairs, rng)` → `Contrast` | Diferencia pareada brazo − control: n, media, DE, `dz` e intervalo del 95 % por *bootstrap* percentil (`BOOTSTRAP_N` 1 000) |
| `INTERVENTION_KINDS`, `BASE_METRICS`, `EXPERIMENT_LIMITS` y los tipos `Experiment`, `Arm`, `Intervention`, `Subjects`, `MetricId` | Definición del experimento |
| `canDisable`, `withoutCapability` (en `capabilities.ts`) | Desactivar una capacidad solo si ninguna activa depende de ella (028 R-004); el `Runner` lo atiende como entrada `disable_capability` |

## 4. Diseño interno y decisiones
- **Las intervenciones son entradas externas validadas** (CLAUDE.md regla 4): `check` sin cambiar nada, `apply` con patches y eventos con causas. Una rechazada no cambia el mundo.
- **Los eventos de una intervención llegan a los sistemas** (aprendizaje, memoria) en el tick siguiente mediante `Runner` `feedKinds` y `LoopOptions.carried`. Sin ese parámetro, nada cambia: las entradas de charla siguen sin alimentar los sistemas (consolidan por su cuenta).
- **Sin estado en el mundo:** las métricas se calculan al medir y se descartan.

## 5. Invariantes y guardarraíles
- Una intervención rechazada no gasta ids ni cambia el mundo (028 CA-004).
- El dinero solo se mueve con `transfer` (015 R-006): la suma de saldos se conserva.

## 6. Cómo se prueba
- `experiment.test.ts` (6 pruebas): validación de la definición, contraste pareado (media dentro del intervalo, determinista), `canDisable` y colector.
- Con mundo generado: `packages/generators/src/experiment/experiment.test.ts` (CA-001 a CA-004, INV-004, `grant_money`, llegada al aprendizaje) y `apps/cli/src/experiment.test.ts` (CA-005, CA-006, CA-008).

## 7. Paridad con el prototipo
No aplica.

## 8. Pendientes y deuda
- [ ] Intervenciones de apoyo social, conflicto forzado y enfermedad (028 §10).
- [ ] Filtro de cohorte del visor como selector de sujetos.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-10-07 | m5/experimentos | 028 | Módulo creado |
