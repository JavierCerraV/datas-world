---
modulo: measurement
ruta: packages/engine/src/measurement
estado: en-desarrollo
specs: [045]
actualizado: 2026-10-06
---

# Módulo: measurement

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Aplicar cuestionarios psicométricos a las personas del mundo (spec 045): el catálogo de los seis instrumentos, su corrección, los indicadores de la persona, la respuesta **verdadera** de cada ítem, la disposición a decirla tal cual o no (minimiza, exagera, miente, imprecisa) y la selección de la muestra. No cambia el mundo (INV-001) y no habla con ningún LLM: la expresión en estilo de charla está en `llm-gateway` (`psychometrics`).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 045 | CA-001, CA-004, CA-005, CA-008 (aquí); CA-002, CA-003, CA-006, CA-007 (en `apps/cli`); CA-009, CA-010 (en `llm-gateway`) | Ejecución real con LLM (necesita `ANTHROPIC_API_KEY`) |

## 3. API pública
| Símbolo | Descripción |
|---|---|
| `INSTRUMENTS`, `INSTRUMENT_IDS`, `optionsOf` | Los seis instrumentos con ítems (texto literal de la ficha), escala, subescalas, cortes y fuente |
| `scoreInstrument(id, respuestas)` → `Score` | Suma, subescalas del DASS-21 y banda de la ficha; lanza si falta un ítem o sale de la escala |
| `indicatorsOf({ world, id, profile, trajectory, events })` → `Indicators` | Los indicadores [0,1] de la persona (045 §4 bis); solo lee su estado, su historia y su aprendizaje |
| `truthfulResponses(id, ind, rng)` → `{ t, p }` | Respuesta verdadera por ítem (045 R-003, R-004) |
| `dispose(id, t, ind, rng, trust)` → `Disposed` | Disposición por ítem y lo que dirá `r_i` (045 R-011) |
| `adults(world)`, `selectSample(pool, n, rng)`, `AGE_GROUPS`, `N_SAMPLE` | Muestra estratificada (045 R-005) |
| `MEASURE_PARAMS`, `CANDOR_PARAMS` | Parámetros [M] (045 §8) |

## 4. Diseño interno y decisiones
- **Cuatro capas:** indicadores → constructo del instrumento → `p_i` por ítem (`0,75·constructo + extras + sesgo + origen + ruido`) → opción de la escala. El GHQ-12 compara «ahora» con «lo habitual».
- **Indicadores que sí varían.** El primer intento saturaba: el valor de `verbal.aprobacion` es 1 en casi todas, las reglas son las mismas de rutina para todas y las emociones están en 0 en una foto. Por eso: ánimo y estrés son los de la última semana de la trayectoria (las pruebas preguntan por la semana); las emociones se completan desde el ánimo y el estrés; lo aversivo y la aprobación pesan por exposición (ensayos), no por el valor saturado. Limitación abierta: el *pliance* y el *tracking* por reglas casi no varían entre personas (038 solo siembra reglas de rutina).
- **Origen de la escala (`MEASURE_PARAMS.origin`).** GPQ-9, GTQ y AAQ-II llevan un desplazamiento fijo para que una persona de indicadores medios quede cerca del promedio no clínico de la ficha. Sin él, GPQ-9 salía en ~38 (clínico, 27+) y GTQ en ~40 (clínico, ~48) para todo el mundo. Se interpretan diferencias entre personas y tomas, no el nivel absoluto.
- **Sin sesgo de signo en el GHQ-12:** las opciones de la ficha ya van de mejor (0) a peor (3) también en los ítems positivos, así que todos suben con el malestar.
- **Flujos con nombre** (`measure:<instrumento>:<id>:<toma>`, `measure:candor:…`, `measure:sample`): cambiar un ítem no mueve los demás (siempre se consumen 4 valores por ítem en `dispose`).
- Sin estado nuevo en el mundo: 0 bytes por persona.

## 5. Invariantes y guardarraíles
- Medir solo lee el mundo; no escribe parches ni eventos (045 INV-001, probado en `apps/cli`).
- No lee `pers.*` / `tmp.*`: solo lo vivido y lo aprendido (045 INV-002).
- Toda respuesta está en la escala de su ítem (045 INV-003, `scoreInstrument` lanza si no).

## 6. Cómo se prueba
`measurement.test.ts` (13 pruebas): corrección y cortes, DASS-21, respuestas de personas fabricadas (pérdida de empleo, cambio frente a lo habitual, pliance), probabilidades de disposición y muestra. Con mundo generado y libro de Excel: `apps/cli/src/psychometrics.test.ts`.

## 7. Paridad con el prototipo
No aplica: el prototipo no tiene pruebas psicométricas.

## 8. Pendientes y deuda
- [ ] Pesos de los ítems, probabilidades de distorsión y origen de las escalas sin validar con datos humanos (PA-155).
- [ ] Reglas de *pliance*/*tracking* con variación entre personas (hoy casi iguales).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-10-05 | Batería psicométrica | 045 | Módulo creado (catálogo, corrección, indicadores, respuesta y disposición) |
| 2026-10-06 | Batería psicométrica | 045 | Indicadores con proxies que varían, origen de escala, `lieFracStranger` 0,25, API y pruebas documentadas |
