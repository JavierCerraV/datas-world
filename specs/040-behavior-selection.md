---
id: 040
nombre: behavior-selection
estado: borrador
hito: MF (bloque MF3)
depende_de: [035, 036, 017, 021]
version: 0.1
---

# 040 — Competencia entre fuentes de control y selección de conducta (capa 6)

## 1. Propósito
Cómo se decide qué conducta se emite cuando compiten varias fuentes de control (documento rector §9, §11.4). Sustituye a la función de utilidad de la 017, de la que conserva:
- el validador de acciones (R-006);
- el compromiso hasta `act.until`;
- la integración con la movilidad.

Cada conducta emitida guarda su **vector de aportes por fuente**, que es la base de la explicación (019, 020).

## 2. Alcance
**Incluye:** puntos de decisión, repertorio candidato, aportes por fuente, regla de elección, vector de aportes, hábitos como fuente, operaciones motivadoras, contexto social, integración con la rutina (011) y el esparcimiento (032).
**Fuera de alcance:** el aprendizaje que sigue a la consecuencia (036–039).

## 3. Modelo de datos (preliminar)
```ts
interface Candidate { response: ResponseClass; target?: EntityId; sources: SourceContribution[]; value: number; }
interface SourceContribution { source: ControlSource; contribution: number; ref?: EntityId | StimulusId; }
// Estados aprendidos que puede leer (y solo estos, además de las capas 2–5):
//   hist.discountK, hist.variability (036), fuerzas de respuesta y hábitos (036), reglas aplicables (038),
//   estado privado (039), operaciones motivadoras (010/036).
```

## 4. Reglas
- **R-001** [M] — **Puntos de decisión.** Como en la 017 v0.2: bloques con flexibilidad ≥ 0,5, fin de un compromiso, operación motivadora crítica, o un evento privado con carga aversiva por encima de umbral (039).
- **R-002** [T] — **Candidatas.** Las respuestas con fuerza > 0 en el contexto presente (incluida la generalización, 036 R-004), las que especifican las reglas aplicables (038) y las acciones que señalan redes de valor presentes (038 R-006). La rutina de 011 entra como reglas de pliance y tracking de la persona, no como una opción privilegiada.
- **R-003** [T] — **Fuentes de control** de cada candidata:
  - consecuencia inmediata esperada (fuerza × eficacia del reforzador según la operación motivadora);
  - consecuencias demoradas descontadas con `hist.discountK`;
  - reglas por tipo (038 R-004);
  - valores y augmentals (038);
  - hábito (fuerza de la respuesta en el contexto con poca dependencia de la consecuencia, 036);
  - funciones aversivas presentes (el alivio esperado suma a las respuestas de evitación; la aversión del estímulo resta a las de acercamiento);
  - contexto social (presencia de otros con función discriminativa).
- **R-004** [E] fenómeno / [M] forma — **Elección.** Igualación generalizada: la probabilidad de cada candidata es proporcional a `value^a` (Baum; referencia a verificar), implementada como softmax con temperatura `T = f(hist.variability)`:
  - `hist.variability` es un estado aprendido (036 R-012);
  - la temperatura no la da el temperamento: su valor inicial sí sale de `tmp.variability0`, pero la 040 solo lee el estado aprendido.
- **R-005** [E] — **Igualación.** En elecciones concurrentes con tasas de reforzamiento distintas, la proporción de respuestas tiende a igualar la proporción de reforzamiento (Herrnstein; referencia a verificar), con subigualación por la variabilidad.
- **R-006** [T] — **Vector de aportes.**
  - La conducta emitida lleva `sources`.
  - Las causas del evento resultante son los 3 aportes mayores. Cada uno enlaza con los eventos de origen de la función o la regla implicada (019): "fue a la sesión porque (regla de pliance dicha por la madre, 2011; valor familia) pese a (función aversiva del lugar, adquirida en 2024)".
- **R-007** [T] — **Operaciones motivadoras.** Hambre, fatiga y soledad (010) no suman utilidad: multiplican la eficacia de los reforzadores relevantes (036 R-010).
- **R-008** [M] — **Validación.** El validador de la 017 (R-006) se conserva: una acción imposible se rechaza y se elige otra candidata.

## 4 bis. Estatus epistémico
- [E]: ley de igualación y subigualación; descuento hiperbólico.
- [T]: fuentes de control y su competencia; operaciones motivadoras.
- [M]: la suma de aportes como valor de la candidata, la softmax como implementación de la igualación y los puntos de decisión.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas |
|---|---|---|---|
| `BEHAVIOR_EMITTED` (nivel ≥ 3) | cada conducta seleccionada | citizenId, respuesta, contexto, aportes | los 3 aportes mayores con sus orígenes |

Las conductas de nivel 2 no emiten este evento: su vector va en las causas del evento que produzcan (`LEISURE_DONE`, `ARRIVED_LATE`…).

## 6. Invariantes
- **INV-001** — Probabilidades finitas en [0,1] que suman 1 (017 INV-001).
- **INV-002** — La selección no lee `tmp.*` ni `pers.*` (prueba de arquitectura, 009 R-006).
- **INV-003** — Toda conducta emitida tiene vector de aportes (035 INV-001).

## 7. Criterios de aceptación (iniciales)
- **CA-001** — Ley de igualación en elecciones concurrentes (042 V-4).
- **CA-002** — Preferencia por lo inmediato e inversión de preferencias (042 V-5).
- **CA-003** — Con hambre crítica y comida disponible, se elige comer en > 95 % (017 CA-001, conservado; ahora por operación motivadora).
- **CA-004** — La prueba de arquitectura falla si la selección lee el temperamento (009 CA-B).
- **CA-005** — Todo evento aplicado por una decisión lleva entre sus causas al menos un aporte con su origen (017 CA-005, reformulado).

## 8. Parámetros y calibración
| Parámetro | Valor | Estado |
|---|---|---|
| Exponente de sensibilidad `a` | 0,8 | [M], PA-017 |
| `T(variability)` | 0,15 + 0,4 × variability | [M], PA-105 |

## 10. Preguntas abiertas
PA-015 a PA-018 (§11.4), PA-019 a PA-022 (§11.5), PA-036 a PA-039 (§11.8), PA-118.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-25 | 0.1 | Borrador (Fase A, ADR-007) |
