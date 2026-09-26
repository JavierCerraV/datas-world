---
modulo: functions
ruta: packages/engine/src/functions
estado: en-desarrollo
specs: [036, 040, 037, 035, 009, 042, 021, 010]
actualizado: 2026-09-25
---

# Módulo: functions

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Capa 2 del motor funcional (spec 036): qué significa cada estímulo para cada persona (funciones aprendidas), cuánto tiende a emitir cada respuesta (fuerzas operantes) y los mecanismos de aprendizaje directo que los cambian. No elige conductas (040, MF3) ni tiene capa verbal (037, MF4).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 036 | CA-001 a CA-005 (batería en `lab/battery.test.ts`); R-001 a R-012; INV-001 a INV-003 | R-011 con ventana de imputación para consecuencias demoradas (hoy, la consecuencia del ocio llega en el mismo tick que la elección) |
| 040 | R-009 (aprendizaje de la selección), R-011 (inicialización de `hist.*`) | — |
| 009 | CA-E (la sensibilidad aversiva da funciones aversivas más fuertes a igual historia) | — |
| 010 | Emociones por evento moduladas por la activación basal y la función aprendida del estímulo (MF2.5) | Emociones desde todas las funciones presentes (MF6) |
| 021 | Sistema `learning` en la fase `memory`, sobre `TickCtx.events` | — |

## 3. API pública
| Símbolo | Descripción |
|---|---|
| `StimulusClass`, `Ontology`, `createOntology(classes)` | Clases de estímulo con rasgos y tipo; la ontología las guarda por clave. La construye `buildOntology` de los generadores |
| `FunctionStore`, `FunctionEntry`, `ResponseEntry`, `Inhibition`, `emptyStore()` | Almacén por persona (`Citizen.functions`): funciones `f` (estímulo, valor, contexto, inhibiciones, habituación, ensayos, reforzadores, origen, fuentes, último ensayo), fuerzas `r` y la cuenta `pruned` |
| `LearningParams`, `LEARNING_DEFAULTS`, `learningParams(profile, date)` | Parámetros de la 036 §8; el perfil puede sobrescribirlos en `learning.params` |
| `Sensitivity`, `NEUTRAL`, `sensitivityOf(view, row)` | Sensibilidades del temperamento: `0,5 + tmp.*` (apetitiva, aversiva, activación, habituación, social) |
| `pair(store, onto, trial, P, sens)` | Ensayo respondiente (R-001, R-003, R-005, R-006, R-007) |
| `operant(store, r, ctx, outcome, now, P, sens)` | Aprendizaje operante (R-002) |
| `netValue`, `ownValue`, `elicited`, `distance`, `gradient` | Valor neto con generalización, valor propio con la inhibición del contexto, respuesta elicitada con habituación |
| `isGeneralized(f)`, `reinforcingValue(f, ctx, now, P, mo)` | Reforzador generalizado (R-008) y su eficacia bajo una operación motivadora |
| `prune(store, P)` | Poda por topes (INV-003) |
| `EVENT_LEARNING`, `WORLD_STIMULI`, `LearningRule` | Qué enseña cada evento del mundo [M] y las clases que usa |
| `createLearningSystem(onto)`, `storeOf(view, row)` | Sistema de la fase `memory` y copia de trabajo del almacén |
| `elicitationGain(view, row, type)` | Ganancia de las emociones de un evento (010): `activación × (0,75 + 0,5·|v del estímulo principal|)` |
| `initLearnedStates(world)` | 040 R-011: columnas `hist.discountK` (`K_MIN × (K_MAX/K_MIN)^tmp.discount0`, por día) y `hist.variability` (`tmp.variability0`), y fuerza inicial de cada afición (`leisureStrength0(afinidad)` = 0,2 + 0,4 × afinidad, respuesta `leisureResponse(clave)` = `ocio.<clave>`) |
| `discountKOf`, `variabilityOf`, `discounted(A, días, k)`, `K_MIN`, `K_MAX`, `DEFAULT_K`, `DEFAULT_VARIABILITY` | Lectura de los estados aprendidos (con valores por defecto sin columnas) y descuento hiperbólico (036 R-009) |
| `operant(…, source?)` | La fuerza guarda sus últimos 3 eventos de origen (`ResponseEntry.src`, 040 R-006) |

## 4. Diseño interno y decisiones
- **Respondiente (R-001):** Rescorla-Wagner por estímulo, `Δv = α·β·sens·(λ − neto)`, con β y sensibilidad según la valencia. Cada estímulo del evento es un ensayo propio (no un compuesto) [M].
- **Extinción (R-003):** un ensayo sin consecuencia de un estímulo con función propia del mismo signo que la expectativa no borra la función: crea inhibición en ese contexto, que decae con `inhTauDays` (recuperación espontánea) y no vale en otros contextos (renovación). El paso se divide por la sensibilidad de esa valencia [M].
- **Discriminación (R-005):** si la expectativa viene solo de la generalización, el estímulo gana un valor propio opuesto (inhibición condicionada); la suma de Spence estrecha el gradiente y desplaza el pico.
- **Generalización (R-004):** gradiente gaussiano de la distancia de rasgos, solo entre clases del mismo tipo (lugar con lugar, término con término). Entre tipos la distancia es 1: la transferencia entre tipos es relacional (capa verbal, 037) [M]. Con generalización entre tipos, la casa bloqueaba el aprendizaje de las actividades hechas en ella.
- **Habituación (R-006):** solo en estímulos sin función aprendida (una exposición repetida a algo neutro); en un estímulo condicionado la extinción ya reduce la respuesta. Se recupera con `habTauDays`; una consecuencia deshabitúa.
- **Reforzadores (R-007, R-008):** cada función guarda los reforzadores con los que se emparejó; con 3 distintos es generalizado y su eficacia no depende de la operación motivadora.
- **Sistema:** en la fase `memory` (después de la economía y el trabajo), por cada evento con regla aprenden sus participantes y, si participa un hogar, su jefe o jefa. Contexto del ensayo: el tipo de lugar del evento. Escribe el almacén entero como parche `entity` (copia por JSON: la vista es de solo lectura). Persistencia: viaja con la entidad en SQLite.
- **Aprendizaje de la selección (040 R-009, `selection.ts`) [M]:** `LEISURE_DONE` enseña con λ = 0,2 + 0,4 × afinidad (lo que esa persona disfruta esa actividad; la ficha resume la historia hasta MF7) y actualiza la fuerza `ocio.<clave>` (contingencia conducta → consecuencia, 036 R-011). La fuerza de partida es ese mismo λ, así que sin cambios en la historia no deriva. Variabilidad: +0,01 × (1 − v) si se refuerza una actividad distinta de la anterior, −0,01 × v si es la misma (el rechazo de la elegida lo suma el sistema de decisiones). Descuento: `SALARY_PAID` acerca `ln k` a `ln K_MIN` un 1 %; `JOB_LOST` lo acerca a `ln K_MAX` un 5 %.
- **Estados aprendidos:** solo `history.ts` lee `tmp.discount0` y `tmp.variability0` (al generar); la selección lee `hist.*`.
- **Memoria:** en un año de vida diaria (254 personas), 9 funciones de media por persona (máximo 16) y ≈ 2 KB de JSON (máximo 3,5 KB); el tope es 256 funciones.

## 5. Invariantes y guardarraíles
- 036 INV-001 (toda función tiene origen `direct`/`discriminated` y sus eventos fuente), INV-002, INV-003 (topes con poda).
- Mecanismo registrado (035 §5): puede leer `tmp.*` (`sensitivity.ts`); nadie más de la vida diaria lo lee.
- Sin azar: el mismo historial da el mismo aprendizaje.

## 6. Cómo se prueba
- `lab/battery.test.ts`: batería 042 (V-1, V-2, V-3, V-6), 036 CA-004/009 CA-E, CA-005 y origen.
- `generators/src/stimuli/stimuli.test.ts`: 14 días de vida diaria (60 personas) dejan funciones con su evento de origen y la actividad de ocio disfrutada queda apetitiva.
- `needs/needs.test.ts`: las emociones de un evento dependen de la activación basal.

## 7. Paridad con el prototipo
No aplica (ADR-007 §7): la referencia es la batería 042.

## 8. Pendientes y deuda
- [ ] MF3: descuento, operaciones motivadoras y variabilidad; contingencias conducta → consecuencia (R-011).
- [ ] Rasgos propios por tipo de lugar y actividad: dentro de una familia la generalización es completa (PA-131).
- [ ] Ensayos compuestos (una expectativa para todos los estímulos presentes) si la batería lo pide (bloqueo, V-7).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-25 | mf/2-funciones | — | Documento creado desde la plantilla (sin código) |
| 2026-09-25 | mf/2-funciones (MF2.2, MF2.3, MF2.5) | 036, 009, 010, 021 | Primera implementación: tipos y almacén por persona, mecanismos R-001 a R-008, reglas de los eventos de M2, sistema `learning` y ganancia de elicitación de las emociones. Generalización solo dentro de un tipo; habituación solo sin función aprendida |
| 2026-09-26 | mf/3-seleccion (MF3.1, MF3.3) | 040, 036 | `history.ts` (estados aprendidos `hist.discountK` y `hist.variability`, inicialización desde el temperamento, fuerza inicial de las aficiones) y `selection.ts` (aprendizaje de la selección). `ResponseEntry.src` y `operant(…, source)`. `LEISURE_DONE` enseña según la afinidad. `LearningRule.lambda` recibe la vista |
| 2026-09-26 | mf/4-red | 037, 036, 010 | `directValue` (valor neto aprendido o primario, 037 R-003). `elicitationGain` usa el valor funcional (aprendido o derivado por la red). Estímulos nuevos en `WORLD_STIMULI`: `verbal.despido`, `verbal.llegar_tarde`, `verbal.no_pagar`; `JOB_LOST` incluye `verbal.despido` |
