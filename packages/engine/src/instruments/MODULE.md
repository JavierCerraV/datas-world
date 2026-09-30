---
modulo: instruments
ruta: packages/engine/src/instruments
estado: en-desarrollo
specs: [045]
actualizado: 2026-09-30
---

# Módulo: instruments

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
El núcleo puro de la capa de investigación (spec 045): indicadores del motor, respuesta determinista de una persona a un instrumento, selección de a quién se aplica y estadística de los resultados.

No lee el registro de eventos ni la base de datos: quien llama (la API o la CLI) le pasa los hechos y la trayectoria de cada persona, como en el informe de vida (020). No cambia el mundo: aplicar en modo `observacion` no toca el estado (045 INV-001). La ingesta del PDF con un LLM, la biblioteca y las tablas viven fuera del motor (API, pasarela 026 y persistencia 027).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 045 | CA-003 (respuestas idénticas con la misma semilla; el mundo no cambia), CA-008 (cuatro formas de selección), CA-009 (descriptiva, grupos y *d*). R-004, R-005, R-007 y R-009 en su parte de cálculo | CA-001, CA-002, CA-007, CA-010 (ingesta, revisión y biblioteca: API); CA-004 y CA-005 (validación en el mundo de ejemplo, I10); CA-006 (muestras: persistencia); R-006 (estilo de respuesta, ver §8); R-008 `en_el_mundo` |

## 3. API pública
Desde `@datas-world/engine`:

| Símbolo | Descripción |
|---|---|
| `INDICATORS`, `INDICATORS_VERSION`, `IndicatorKey` | Catálogo cerrado de indicadores (R-004). `catalogs/indicators.json` de los generadores lo describe para la pasarela y el visor; una prueba comprueba que coinciden |
| `indicatorValues(input)` | Valores en [0,1] de todos los indicadores para una persona en la ventana de `recallDays` días. `input`: la vista del mundo, el id, sus hechos, su trayectoria y el minuto |
| `answerInstrument(instrument, values, rng)` | Respuesta de la persona (R-005): opción de cada ítem con su base, puntuación, subescalas y categoría. `rng` es el flujo `sys:instrument/<adm>/<cit>` |
| `responseRng(root, administration, citizen)` | El flujo con nombre de una respuesta (023) |
| `scoreOf(instrument, answers)`, `categoryOf(instrument, score)` | Puntuación y categoría |
| `candidatesOf(view, extra?)`, `ageGroup(age)` | Personas del mundo (sin antepasados fuera del mundo), con edad, si viven y sus variables de agrupación (`sexo`, `edad` en grupos de 10 años y las que añada `extra`), en orden de id |
| `resolveSelection(selection, candidates, minAge, rng, samples?)` | A quién se aplica (R-007): `todos`, `azar` (simple o estratificado), `seleccionados` e `individual` |
| `describeScores(values)`, `groupStats(rows, meets?)`, `cohenD(a, b)`, `cronbachAlpha(matrix)`, `pearson(x, y)` | Estadística (R-009) |
| Tipos `Instrument`, `InstrumentItem`, `Selection`, `ResponseResult`, `Candidate`, `Descriptive`, `GroupRow` | Modelo de datos de la 045 §3 en su parte de cálculo |

## 4. Diseño interno y decisiones
- **Entradas ya leídas.** Igual que `lifereport`: la API lee los hechos y la trayectoria de SQLite y se los pasa. El motor no hace E/S.
- **Indicadores calibrados como síntomas.** Cada indicador vale 0 cuando no hay síntoma y 1 en el extremo, con umbrales [M] en `INDICATOR_PARAMS` (p. ej. el ánimo bajo empieza a contar por debajo de 0,6). Sin esto, el ánimo medio del pueblo (≈ 0,5) daría a todos una puntuación moderada. Los umbrales se calibran con la validación I10 (CA-004, CA-005).
- **Respuesta.** Intensidad latente = media ponderada de los indicadores del ítem (con peso negativo cuenta `1 − v`), más ruido normal (σ = 0,05) del flujo de la persona; en los ítems invertidos, `1 − intensidad`. La opción es la de valor más cercano a la intensidad escalada al rango de opciones (empate: la menor). Un ítem sin correspondencia no puntúa (`value: null`).
- **Azar.** Cada respuesta tiene su flujo (`sys:instrument` → aplicación → persona) y el muestreo el suyo (`sys:instrument` → aplicación → `muestreo`). Cambiar a quién se aplica no cambia la respuesta de nadie.
- **Muestreo estratificado.** Asignación proporcional con restos mayores (empates por nombre de estrato), y dentro de cada estrato muestreo sin reemplazo por Fisher-Yates parcial. Cada estrato queda a ±1 de su proporción (CA-008).
- **Estadística.** Desviación típica muestral (n − 1), cuartiles por interpolación lineal (tipo 7), *d* de Cohen con la desviación típica combinada y alfa de Cronbach con varianzas muestrales. Sin pruebas de significación (fuera de alcance, 045 §2).

## 5. Invariantes y guardarraíles
- 045 INV-001: ninguna función recibe un `World` mutable ni devuelve parches; aplicar no cambia el `stateHash` (prueba).
- 045 INV-002: misma semilla, mismo instante y mismos datos dan la misma respuesta y la misma muestra (pruebas).
- 045 INV-003: `answerInstrument` rechaza un instrumento que no esté `revisado` y cualquier indicador fuera del catálogo.
- Determinismo (CLAUDE.md regla 2): sin `Math.random`, sin fechas; orden por id.
- No lee el temperamento (009 R-006, prueba de arquitectura).

## 6. Cómo se prueba
- `src/instruments/instruments.test.ts`: indicadores, respuesta, selección y estadística con el mundo de prueba de `testing.ts` y datos sintéticos.
- `pnpm test`.

## 7. Paridad con el prototipo
No aplica: el prototipo no tiene instrumentos.

## 8. Pendientes y deuda
- [ ] R-006 (estilo de respuesta): la spec lo deriva del temperamento, pero 009 R-006 solo deja leer el temperamento a los mecanismos de aprendizaje. Hasta decidirlo con el usuario, el estilo es neutro (aquiescencia y deseabilidad 0) y solo hay ruido.
- [ ] Validación en el mundo de ejemplo tras 60 días (I10): varianza, alfa y validez convergente.
- [ ] Modo `en_el_mundo` (R-008): evento `INSTRUMENT_ANSWERED` y recuerdo.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-30 | I1–I3, I7 | 045 | Módulo nuevo: indicadores, respuesta determinista, selección (todos, azar, seleccionados, individual) y estadística (descriptiva, grupos, *d*, alfa, Pearson) |
