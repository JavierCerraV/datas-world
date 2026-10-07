---
modulo: experiment
ruta: packages/generators/src/experiment
estado: en-desarrollo
specs: [028]
actualizado: 2026-10-07
---

# Módulo: experiment (corrida de un brazo)

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Corre **un brazo** de un experimento (spec 028): parte de una instantánea ya cargada, llega a la rama con el azar de la base, sigue con el azar de la semilla del brazo, aplica sus intervenciones como entradas externas y mide a las personas. Vive en `generators` porque necesita `lifeRunner` y los catálogos (el motor no los conoce). No lee ni escribe disco: la base, la definición y el informe son de `apps/cli`.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 028 | R-001, R-003, R-004, R-005, R-006 (métricas de estado), R-007; CA-001 a CA-004, INV-004 | `psychometrics` por brazo; CA-005 a CA-008 (en `apps/cli`) |

## 3. API pública
| Símbolo | Descripción |
|---|---|
| `runArm(world, def, arm, seed, subjects, catalogs, onDay?)` → `ArmResult` | Corre un brazo con una semilla. Modifica `world`: pásale una copia propia |
| `experimentSubjects(world, subjects)` | Las personas que se miden: las dadas (vivas) o una muestra estratificada de adultos (045) con el flujo `experiment:subjects` |
| `Observation`, `InterventionLog`, `ArmResult` | Observaciones por persona y día, intervenciones aplicadas o rechazadas con su motivo, hashes de la rama y del final, y pico de memoria |

## 4. Diseño interno y decisiones
- **Dos corredores sobre el mismo mundo:** hasta la rama, el de la base (mismo azar para todos los brazos); desde la rama, otro con `createRng(seed)`, los manejadores de intervención y `feedKinds` (028 R-003, R-005).
- **Eventos que se cuentan y se descartan:** cada día se vacía la bandeja del corredor en un `EventCounter` (R-007).
- **Ánimo y estrés:** medias móviles de 7 días de las medidas diarias (como las ventanas de 045).

## 5. Invariantes y guardarraíles
- Los brazos llegan a la rama con el mismo hash (028 INV-004).
- Una intervención rechazada no cambia el mundo y queda en `interventions` con su motivo.

## 6. Cómo se prueba
`experiment.test.ts`: 028 CA-001 a CA-004, INV-004 sobre un mundo generado de 60 personas.

## 7. Paridad con el prototipo
No aplica.

## 8. Pendientes y deuda
- [ ] Más intervenciones (apoyo social, conflicto, enfermedad).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-10-07 | m5/experimentos | 028 | Módulo creado; `lifeRunner` acepta `rngSeed`, `inputs` y `feedKinds` |
