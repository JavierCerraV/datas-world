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
Las piezas puras del estudio de intervención (spec 047): la **guía estructurada** de un protocolo psicológico (sesiones, componentes obligatorios, a qué mecanismo del motor apunta cada uno) y la **cuenta de lo cubierto** en una sesión, de la que sale la fidelidad. No habla con ningún LLM (eso es `packages/llm-gateway/src/therapy`) y todavía no cambia el mundo: la dosis y los eventos `PROTOCOL_SESSION`, `PRACTICE_DONE` y `PROTOCOL_ENDED` llegan en el bloque siguiente.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 047 | R-005 (el manual como guía, no como texto), R-005b (el motor lleva la cuenta de los componentes), R-005c (fidelidad); parte pura de CA-010 | R-004 (dosis sobre los mecanismos del motor), R-006 (práctica), R-012 y R-013 (pruebas en el mundo y regreso a sesión), eventos de §5; CA-001 a CA-007, CA-011, CA-012 |

## 3. API pública
| Símbolo | Descripción |
|---|---|
| `ACT_PNR_3`, `PROTOCOLS` | Guía del protocolo de tres sesiones de ACT centrado en el pensamiento negativo repetitivo (Ruiz y colaboradores, 2019): por sesión, sus componentes con objetivo, forma de trabajarlo, pistas y mecanismo |
| Tipos `Protocol`, `ProtocolSession`, `ProtocolComponent`, `ProtocolId`, `Mechanism`, `SessionNumber` | Forma de una guía. `Mechanism`: `alianza`, `evaluacion`, `yo`, `extincion`, `valores`, `practica` |
| `sessionOf(protocol, n)` | La sesión `n`; lanza si no existe |
| `newProgress()`, `recordExchange(progress, session, componentId)` | Cuenta un intercambio (turno del terapeuta **respondido** por la persona) en un componente. Devuelve `false` y no cuenta si el componente no es de esa sesión |
| `coverage(session, progress)` → `{ covered, missing, fidelity }` | Componentes obligatorios cubiertos (los que alcanzaron su `minTurns`), los que faltan y la proporción cubierta (R-005c) |

## 4. Diseño interno y decisiones
- **Guía, no guion.** Cada componente trae un objetivo, cómo se trabaja y unas pistas, redactados para este proyecto. **No** se copia el texto del manual: el PDF es solo para el piloto y no se versiona (047 §1). Los estudios reales usarán el material que entregue el autor.
- **Sesión por escrito.** Los ejercicios físicos del manual (empujar un papel, dar vueltas a una silla, mirarse a los ojos, escribir con la otra mano) se trabajan imaginados o con una versión verbal; la guía lo dice en cada caso. Es una diferencia deliberada con el protocolo original y un límite del piloto.
- **El motor lleva la cuenta (R-005b).** Un componente está cubierto cuando acumula `minTurns` intercambios, es decir, turnos del terapeuta marcados con ese componente que la persona respondió. Lo que el LLM declare como cubierto no cuenta: así un terapeuta no puede «cubrir» un ejercicio con solo nombrarlo.
- **Fidelidad (R-005c).** Proporción de componentes obligatorios cubiertos. Todos los componentes del protocolo son obligatorios; el campo `required` queda para protocolos futuros.
- **Mecanismo.** Cada componente apunta a un mecanismo del motor (R-004). `alianza`, `evaluacion` y `practica` no llevan dosis propia: preparan o encargan el trabajo.
- **Memoria.** La guía es una constante compartida (unos 12 kB de texto); el progreso de una sesión es un mapa de menos de diez contadores que vive fuera del estado del mundo.

## 5. Invariantes y guardarraíles
- Nada de este módulo lee ni escribe `WorldState`.
- Los ids de los componentes son únicos en todo el protocolo y llevan el número de su sesión (`s1.…`), comprobado por prueba.

## 6. Cómo se prueba
`packages/engine/src/protocol/protocol.test.ts` (`pnpm vitest run packages/engine/src/protocol`): forma de la guía, cuenta de intercambios y fidelidad.

## 7. Paridad con el prototipo
No aplica: el prototipo no tenía protocolos.

## 8. Pendientes y deuda
- [ ] Dosis por mecanismo y entradas externas del protocolo (R-004, §5).
- [ ] Adherencia a la práctica diaria (R-006).
- [ ] Revisar la guía con el autor del protocolo antes de cualquier estudio real.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-10-08 | m5/estudio-protocolo (bloque 2) | 047 | Módulo nuevo: guía estructurada `ACT_PNR_3` (3 sesiones, 22 componentes con objetivo, forma de trabajo, pistas y mecanismo) y cuenta de lo cubierto en una sesión (`recordExchange`, `coverage`), con la fidelidad de R-005c |
