---
id: 040
nombre: behavior-selection
estado: aprobada
hito: MF (bloque MF3)
depende_de: [035, 036, 017, 021]
version: 0.2
---

# 040 — Competencia entre fuentes de control y selección de conducta (capa 6)

## 1. Propósito
Cómo se decide qué conducta se emite cuando compiten varias fuentes de control (documento rector §9, §11.4). Sustituye a la función de utilidad de la 017, de la que conserva:
- el validador de acciones (R-006 de la 017);
- el compromiso hasta `act.until`;
- la integración con la movilidad.

Cada conducta emitida guarda su **vector de aportes por fuente**, que es la base de la explicación (019, 020).

## 2. Alcance
**Incluye:** puntos de decisión, repertorio candidato, aportes por fuente, regla de elección, vector de aportes, fuerza de respuesta como fuente, operaciones motivadoras, descuento de consecuencias demoradas, integración con la rutina (011) y el esparcimiento (032), y los estados aprendidos `hist.discountK` y `hist.variability` (036 R-009, R-012).
**Fuera de alcance:** el aprendizaje respondiente (036); reglas verbales y valores (038, MF5); estado privado y evitación experiencial (039, MF6); contexto social (M3). Mientras no existan, sus fuentes no aportan y la rutina entra como una regla fija [M].

## 3. Modelo de datos
```ts
type ControlSource = 'reforzador' | 'fuerza' | 'demorado' | 'regla' | 'aversion' | 'coste';
interface SourceContribution { source: ControlSource; contribution: number; ref?: string; origins?: EntityId[] }
interface Candidate { action: ActionRequest; value: number; sources: SourceContribution[] }
// Estados aprendidos (f32 por persona), inicializados por el temperamento al generar y leídos solo desde aquí:
//   hist.discountK  (036 R-009): pendiente del descuento, por día.
//   hist.variability (036 R-012): en [0,1].
// Fuerzas de respuesta: `Citizen.functions.r` (036), con `src` (eventos de origen, los 3 últimos).
```
`ref` nombra el estado o la función implicada (`need.fun`, `ocio.deporte.futbol`, `lugar.ocio.bar`); `origins`, los eventos que la formaron (019).

## 4. Reglas
- **R-001** [M] — **Puntos de decisión.** Como en la 017 v0.2: bloques con flexibilidad ≥ 0,5, fin de un compromiso u operación motivadora crítica (hambre < 0,1). El evento privado aversivo (039) se añade en MF6.
- **R-002** [T] — **Candidatas.** Seguir la rutina, comer, dormir un rato (con energía < 0,3) y cada actividad de la ficha de esparcimiento (032) posible ahora (lugar abierto, tiempo de ida, estancia y vuelta). La rutina entra como regla de la persona, no como opción privilegiada. Desde MF5 se añaden las respuestas que especifican las reglas aplicables (038) y desde MF4 las de fuerza generalizada.
- **R-003** [T] fuentes / [M] magnitudes — **Aportes** de cada candidata; su suma es su valor:
  - `reforzador`: magnitud del reforzador × operación motivadora (R-007). Comer: 1,5 × (1 − hambre) y 4 × max(0, 0,25 − hambre)/0,25 con hambre crítica. Dormir un rato: 0,3 + 2 × (0,3 − energía). Descansar en casa: 0,3 + 0,2 × (1 − energía). Esparcimiento: 0,8 × (1 − diversión), más 0,4 × (1 − compañía) si no es solitaria. Saciedad específica de cada actividad: 3 × (min(2, tiempo desde la última vez / intervalo) − 1), con intervalo = 30 días / frecuencia de la ficha.
  - `fuerza`: fuerza de la respuesta (036 R-002), `0,5 × ln(max(0,02, w) / 0,25)`. La forma logarítmica hace que la softmax sea la igualación generalizada sobre las fuerzas (R-004). Las respuestas de esparcimiento empiezan con `w = 0,2 + 0,4 × afinidad` (la ficha resume la historia hasta que llegue la historia sintética, MF7); comer, dormir y la rutina no tienen fuerza aprendida en MF3.
  - `demorado`: consecuencias demoradas descontadas, `A / (1 + k · D)` (036 R-009), con `k = hist.discountK`. Obligaciones de la rutina (buscar empleo, tareas, cuidar, estudiar): `A = 0,4`, `D = 5 días` (sus consecuencias llegan después).
  - `regla`: la rutina como regla [M] hasta la 038: obligaciones 0,45 (estudiar 0,35), diligencias 0,45, siesta infantil 2.
  - `aversion`: funciones aversivas presentes (036): `0,5 × min(0, neto(actividad) + neto(lugar))` en las de acercamiento.
  - `coste`: dinero, −0,3 × min(1, coste total / 50 000); viaje, −0,25 × min(2, minutos de ida / 60); esfuerzo, −0,3 × exigencia física × max(0, 0,5 − energía).
- **R-004** [E] fenómeno / [M] forma — **Elección.** Softmax sobre los valores con temperatura `T = 0,15 + 0,4 × hist.variability`. Con solo la fuerza como fuente, `p ∝ w^(0,5/T)`: igualación generalizada (Baum; referencia a verificar). La 040 no lee el temperamento: lee `hist.variability`, que empieza en `tmp.variability0`.
- **R-005** [E] — **Igualación.** En elecciones concurrentes con programas de intervalo variable, la proporción de respuestas tiende a la de reforzadores, con subigualación (Herrnstein; referencia a verificar).
- **R-006** [T] — **Vector de aportes.** La acción elegida lleva sus aportes. Las causas del evento resultante (`LEISURE_DONE`) son los 3 aportes de mayor magnitud como `fuente.<fuente>` (con `value`, peso y la entidad), más los eventos de origen de la función o fuerza implicada (hasta 3).
- **R-007** [T] — **Operaciones motivadoras.** Hambre, fatiga, aburrimiento y soledad (010) no suman utilidad propia: multiplican la magnitud del reforzador relevante (036 R-010). La saciedad por haberlo hecho hace poco es la operación motivadora específica de cada actividad.
- **R-008** [M] — **Validación.** El validador de la 017 se conserva: una acción imposible se rechaza y se elige otra candidata.
- **R-009** [M] — **Aprendizaje de la selección** (036 R-002, R-009, R-011, R-012):
  - la consecuencia de una actividad de esparcimiento (`LEISURE_DONE`, λ = 0,2 + 0,4 × afinidad) actualiza la fuerza de esa respuesta y la función de la actividad (036);
  - `hist.variability`: sube 0,05 × (1 − v) cuando la opción elegida se rechaza (fracaso de la respuesta dominante) y 0,01 × (1 − v) cuando se refuerza una actividad distinta de la anterior; baja 0,01 × v cuando se refuerza la misma;
  - `hist.discountK`: cada `SALARY_PAID` (una demora larga reforzada) acerca `ln k` a `ln kMin` un 1 %; cada `JOB_LOST` (la recompensa prometida deja de llegar) la acerca a `ln kMax` un 5 %.
- **R-010** [M] — **Quedarse dormido.** El exceso de sueño por falta de energía se multiplica por `1,3 − 1 / (1 + k · 5)`: quien descuenta mucho la consecuencia demorada de llegar tarde se queda dormido más. `OVERSLEPT` cita `descuento` (`hist.discountK`) en lugar de la responsabilidad.
- **R-011** [M] — **Inicialización.** Al generar: `hist.discountK = kMin × (kMax / kMin)^tmp.discount0` por día (kMin 0,02, kMax 2; mediana 0,2), y `hist.variability = tmp.variability0`. Un mundo sin estas columnas usa k = 0,2 y variabilidad 0,5.

## 4 bis. Estatus epistémico
- [E]: ley de igualación y subigualación; descuento hiperbólico e inversión de preferencias.
- [T]: fuentes de control y su competencia; operaciones motivadoras.
- [M]: las magnitudes de cada aporte (portadas de la 017), la suma de aportes, la forma logarítmica de la fuerza, la softmax, los puntos de decisión, la dinámica de `k` y de la variabilidad y la demora de 5 días de las obligaciones.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas |
|---|---|---|---|
| `BEHAVIOR_EMITTED` (nivel ≥ 3) | cada conducta seleccionada | citizenId, respuesta, contexto, aportes | los 3 aportes mayores con sus orígenes |

Las conductas de nivel 2 no emiten este evento: su vector va en las causas del evento que produzcan (`LEISURE_DONE`). `ARRIVED_LATE` cita `OVERSLEPT`, que cita el descuento (R-010).

## 6. Invariantes
- **INV-001** — Probabilidades finitas en [0,1] que suman 1 (017 INV-001).
- **INV-002** — La selección no lee `tmp.*` ni `pers.*` (prueba de arquitectura, 009 R-006). Los estados `hist.*` se inicializan desde el temperamento solo en `functions/` (mecanismo registrado).
- **INV-003** — Toda conducta emitida tiene vector de aportes (035 INV-001).

## 7. Criterios de aceptación
- **CA-001** — Ley de igualación (042 V-4): dos respuestas con intervalo variable (probabilidad total de reforzador armado 0,2 por ensayo), proporciones 1:1, 2:1, 4:1 y 8:1 en ambos sentidos, 1 000 ensayos, 3 semillas: pendiente de log(respuestas) sobre log(reforzadores) en 0,7–1,0 y R² > 0,9.
- **CA-002** — Descuento (042 V-5), con k = 0,2 y variabilidad 0,5: elige 10 ahora frente a 15 en 7 días en > 50 %; y 10 en 30 días frente a 15 en 37 en < 50 %.
- **CA-003** — Con hambre crítica y comida disponible, se elige comer en > 95 % (017 CA-001, conservado; ahora por operación motivadora).
- **CA-004** — La prueba de arquitectura falla si la selección lee el temperamento (009 CA-B); `decision/` y `routines/system.ts` ya no importan el adaptador.
- **CA-005** — Todo `LEISURE_DONE` lleva entre sus causas al menos un aporte `fuente.*` y, si la fuerza está entre los 3 mayores, sus eventos de origen (017 CA-005, reformulado).
- **CA-006** — A igual situación, una persona con `hist.discountK` alto sigue menos la rutina de obligaciones y se queda dormida más que una con k bajo.

## 8. Parámetros y calibración
| Parámetro | Valor | Estado |
|---|---|---|
| Escala de la fuerza | 0,5 × ln(w / 0,25) | [M], PA-017 |
| `T(variability)` | 0,15 + 0,4 × variability | [M], PA-105 |
| kMin, kMax (por día) | 0,02; 2 | [M], PA-104 |
| Demora de las obligaciones y de llegar tarde | 5 días | [M], PA-104 |
| Tasas de la variabilidad | 0,05 (rechazo), 0,01 (refuerzo) | [M], PA-105 |

## 10. Preguntas abiertas
PA-015 a PA-018 (§11.4), PA-019 a PA-022 (§11.5), PA-036 a PA-039 (§11.8), PA-104, PA-105, PA-118.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-25 | 0.1 | Borrador (Fase A, ADR-007) |
| 2026-09-26 | 0.2 | Concreción para MF3: fuentes con magnitudes (portadas de la 017 sin rasgos), forma logarítmica de la fuerza (comprobada en borrador: V-4 da pendiente 0,64–0,75 y R² ≈ 1 según la riqueza del programa), descuento en obligaciones y en quedarse dormido, dinámica de `k` y de la variabilidad, inicialización y CA-006. Reglas, valores, estado privado y contexto social quedan para MF4–MF6 y M3 |
| 2026-09-26 | 0.2 | Estado → aprobada |
| 2026-09-26 | 0.2 | Implementación del bloque MF3. Precisiones: (1) el aporte de la fuerza es `1,5 × ln(max(0,02, w) / 0,46)`, no `0,5 × ln(w / 0,25)`: con escala 0,5 la igualación de V-4 no llegaba a 0,7 (con 1, 0,69; con 1,5, 0,72; por encima se satura), y la referencia 0,46 hace que el mundo generado haga el mismo volumen de ocio que con la 017 (a menos del 2 % en 30 días y 3 semillas); supuse una afinidad media de 0,5 y es 0,77; (2) V-4 da pendiente 0,72 y R² ≈ 1; V-5, 76 % y 48 %: la inversión tiene el signo correcto pero es pequeña; (3) CA-006 se prueba en la selección (obligaciones) y con el multiplicador del exceso de sueño (`oversleepFactor`), porque en el escenario de insomnio el exceso sale casi todo de la deuda de sueño; (4) la saciedad específica conserva la frecuencia de la ficha (032) como intervalo del reforzador, y la fuerza aprendida se suma como fuente aparte. Sin cambios en CA |
| 2026-09-26 | 0.2 | Bloque MF4 (037 R-006): la fuente `aversion` usa el valor funcional (aprendido o derivado por la red relacional, el de mayor magnitud) y cita los eventos de las relaciones del camino. Sin cambios en CA |
| 2026-09-26 | 0.2 | Bloque MF5 (038): la fuente `regla` de las obligaciones es el aporte de las reglas de la persona (sin reglas, el número fijo de antes); fuente nueva `valor` (038 R-006); la aversión se calcula sin las raíces de valor. Sin cambios en CA |
| 2026-09-28 | 0.2 | MF6.2 (039 R-004): fuente nueva `alivio`. Con un episodio de PNR abierto, dormir un rato y cada afición valen `2 × carga × fuerza de la evitación aprendida` (`evit.dormir`, `evit.distraccion`), y dormir se ofrece aunque no haya agotamiento. Sin cambios en CA |
