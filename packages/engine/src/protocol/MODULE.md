---
modulo: protocol
ruta: packages/engine/src/protocol
estado: en-desarrollo
specs: [047]
actualizado: 2026-10-08
---

# Módulo: protocol

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Las piezas puras del estudio de intervención (spec 047): la **guía estructurada** de un protocolo psicológico (sesiones, componentes obligatorios, a qué mecanismo del motor apunta cada uno) y la **cuenta de lo cubierto** en una sesión, de la que sale la fidelidad. También la **dosis**: cómo una sesión o una práctica cambian a la persona, con ensayos de aprendizaje sobre los mecanismos que ya existen, y las entradas externas con que eso entra al mundo. No habla con ningún LLM (eso es `packages/llm-gateway/src/therapy`).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 047 | R-004 (dosis por mecanismo), R-005 (el manual como guía), R-005b (el motor lleva la cuenta), R-005c (fidelidad), R-006 (práctica), R-013 (probabilidad de asistir), eventos de §5. CA-003, CA-004, INV-001; parte pura de CA-010 | Reglas de seguimiento hacia acciones valiosas (038 R-002, parte de R-004); episodios de rumia en la vista de la persona (R-013); CA-001, CA-011, CA-012 |

## 3. API pública
| Símbolo | Descripción |
|---|---|
| `ACT_PNR_3`, `PROTOCOLS` | Guía del protocolo de tres sesiones de ACT centrado en el pensamiento negativo repetitivo (Ruiz y colaboradores, 2019): por sesión, sus componentes con objetivo, forma de trabajarlo, pistas y mecanismo |
| Tipos `Protocol`, `ProtocolSession`, `ProtocolComponent`, `ProtocolId`, `Mechanism`, `SessionNumber` | Forma de una guía. `Mechanism`: `alianza`, `evaluacion`, `yo`, `extincion`, `valores`, `practica` |
| `sessionOf(protocol, n)` | La sesión `n`; lanza si no existe |
| `newProgress()`, `recordExchange(progress, session, componentId)` | Cuenta un intercambio (turno del terapeuta **respondido** por la persona) en un componente. Devuelve `false` y no cuenta si el componente no es de esa sesión |
| `coverage(session, progress)` → `{ covered, missing, fidelity }` | Componentes obligatorios cubiertos (los que alcanzaron su `minTurns`), los que faltan y la proporción cubierta (R-005c) |
| `sessionDose(session, exchanges, scale?)` → `{ dose, engagement }`; tipos `Dose`, `Exchange` | De la sesión a la dosis: cada intercambio sobre un componente de `yo`, `extincion` o `valores` suma el compromiso de la persona según su postura; la suma se redondea a ensayos. `engagement`: compromiso medio de la sesión |
| `applyDose(store, onto, P, sens, dose, strength, now, source?)` → `DoseEffect` | Aplica los ensayos al almacén de la persona: refuerza `yo.enmarque`, extingue las cinco `evit.*` y refuerza hasta cuatro dominios vitales ya apetitivos. `strength` 1 = sesión, 0,5 = práctica |
| `practiceProbability({ stress, energy, hasValue })`, `attendProbability(therapistValue)`, `hasValue(store)` | Adherencia diaria a la práctica (R-006) y probabilidad de volver a sesión (R-013) |
| `protocolInputs({ onto })`, `PROTOCOL_FEED_KINDS`; tipos `ProtocolSessionInput`, `ProtocolPracticeInput` | Manejadores de las entradas externas `protocol_session`, `protocol_practice` y `protocol_end` para el `Runner`. Emiten `PROTOCOL_SESSION`, `PRACTICE_DONE` y `PROTOCOL_ENDED` |
| `PROTOCOL_PARAMS`, `NO_DOSE` | Parámetros [M]: compromiso por postura, fuerza de la práctica, base de práctica y de asistencia, dominios máximos |

## 4. Diseño interno y decisiones
- **Guía, no guion.** Cada componente trae un objetivo, cómo se trabaja y unas pistas, redactados para este proyecto. **No** se copia el texto del manual: el PDF es solo para el piloto y no se versiona (047 §1). Los estudios reales usarán el material que entregue el autor.
- **Sesión por escrito.** Los ejercicios físicos del manual (empujar un papel, dar vueltas a una silla, mirarse a los ojos, escribir con la otra mano) se trabajan imaginados o con una versión verbal; la guía lo dice en cada caso. Es una diferencia deliberada con el protocolo original y un límite del piloto.
- **El motor lleva la cuenta (R-005b).** Un componente está cubierto cuando acumula `minTurns` intercambios, es decir, turnos del terapeuta marcados con ese componente que la persona respondió. Lo que el LLM declare como cubierto no cuenta: así un terapeuta no puede «cubrir» un ejercicio con solo nombrarlo.
- **Fidelidad (R-005c).** Proporción de componentes obligatorios cubiertos. Todos los componentes del protocolo son obligatorios; el campo `required` queda para protocolos futuros.
- **Mecanismo.** Cada componente apunta a un mecanismo del motor (R-004). `alianza`, `evaluacion` y `practica` no llevan dosis propia: preparan o encargan el trabajo.
- **Memoria.** La guía es una constante compartida (unos 12 kB de texto); el progreso de una sesión es un mapa de menos de diez contadores que vive fuera del estado del mundo.
- **La dosis sale de la postura, no del texto (INV-001).** `protocol_session` recibe solo, por cada turno, el componente que se trabajaba y la postura que el motor ya había elegido para la persona. Con todas las posturas evasivas la dosis es cero aunque el LLM haya escrito un acuerdo (CA-004).
- **Ensayos, no un efecto fijo.** Un ensayo lleva la fuerza de la respuesta hacia su meta con la tasa operante de la 036 (`w += tasa × sensibilidad × (meta − w)`): hacia 1 el «Yo», hacia 0 la evitación. Con `strength` 0,5 el paso es la mitad. Así la ganancia depende de dónde parte cada persona y de su sensibilidad, y lo que pase después en su vida (039 R-004, R-007) puede sostenerla o deshacerla.
- **Valores.** Se refuerzan los dominios que ya le importan (función apetitiva), no se crean. Quien no tiene ninguno no recibe dosis de valores, y su «Yo» se extinguirá en la vida diaria (039 R-007): es un límite real del modelo que el informe puede mostrar.
- **La práctica tiene azar propio.** Flujo `protocol:practice:<persona>:<minuto>` de la semilla del mundo: no consume el azar del resto, así que los dos brazos de un estudio siguen comparables.
- **Sin estado nuevo por persona.** Todo queda en su almacén de funciones (036) y en los eventos.

## 5. Invariantes y guardarraíles
- Nada de este módulo lee ni escribe `WorldState`.
- Los ids de los componentes son únicos en todo el protocolo y llevan el número de su sesión (`s1.…`), comprobado por prueba.

## 6. Cómo se prueba
`pnpm vitest run packages/engine/src/protocol`: `protocol.test.ts` (forma de la guía, cuenta de intercambios y fidelidad), `dose.test.ts` (de la sesión a la dosis, CA-003, CA-004, media dosis de la práctica, adherencia) e `inputs.test.ts` (las tres entradas sobre un mundo de una persona: evento con causa, rechazo sin cambios, práctica reproducible).

## 7. Paridad con el prototipo
No aplica: el prototipo no tenía protocolos.

## 8. Pendientes y deuda
- [ ] Reglas propias de seguimiento hacia acciones valiosas (038 R-002): la parte de R-004 que falta.
- [ ] Análisis de sensibilidad de la dosis (`scale`, R-009) en el informe.
- [ ] Revisar la guía con el autor del protocolo antes de cualquier estudio real.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-10-08 | m5/estudio-protocolo (bloque 2) | 047 | Módulo nuevo: guía estructurada `ACT_PNR_3` (3 sesiones, 22 componentes con objetivo, forma de trabajo, pistas y mecanismo) y cuenta de lo cubierto en una sesión (`recordExchange`, `coverage`), con la fidelidad de R-005c |
| 2026-10-08 | m5/estudio-protocolo (bloque 4) | 047 | Dosis del protocolo: `sessionDose` y `applyDose` (ensayos sobre `yo.enmarque`, `evit.*` y dominios vitales), adherencia y asistencia, y las entradas `protocol_session`, `protocol_practice` y `protocol_end` con sus eventos |
