---
id: 019
nombre: causality
estado: implementada
hito: M3
depende_de: [010, 011, 013, 014, 015, 035, 036, 039, 040]
version: 0.2
---

# 019 — Causalidad: por qué pasó, hasta el origen

## 1. Propósito
Poder explicar por qué pasó cualquier cosa, siguiendo sus causas hasta los hechos que la originaron. Es la pregunta guía del proyecto: *¿podemos explicar por qué terminaron donde terminaron?*

Reescritura según la 035 §8 (ADR-007). Hoy cada evento nace con sus causas (014) y el registro está íntegro: en 100 personas × 60 días no hay causas inexistentes, futuras ni eventos sin causa. Pero **las cadenas se cortan en los estados**:
- «se quedó dormido» cita la deuda de sueño; «se enfermó», el estrés; «no pudo pagar», el dinero;
- nada dice qué hechos llevaron a ese estado;
- de 9 434 eventos de la vida diaria, 8 423 (89 %) solo citan estados o fuentes de control, sin ningún hecho detrás.

Esta spec cierra ese hueco:
- cada estado que se cita como causa lleva el **hecho que lo originó**;
- las fuentes de control de una conducta (040) se siguen hasta los hechos que formaron esas funciones (035 §12);
- una consulta `why` devuelve el árbol en español.

## 2. Alcance
**Incluye:**
- el origen de los estados (estrés, deuda de sueño, dinero, enfermedad, desempleo, malestar privado) como referencia a un hecho;
- la validación temporal de las causas al crear el evento;
- la consulta `why` y su presentación en la CLI, la API y el visor;
- los criterios de calidad del registro causal.

**Fuera de alcance:**
- la inferencia causal estadística (se hace fuera, con datos exportados);
- la historia retrospectiva de una vida (020), que usará `why`;
- lo que cada persona *cree* que causó algo (025): aquí se explica la verdad del mundo.

## 3. Modelo de datos
```ts
// Ya existe (014): cada evento lleva sus causas al crearse.
type CauseRef = { event: EntityId; weight: number } | { state: string; entity?: EntityId; value?: number; weight: number };

/** Origen de los estados de una persona (R-005): para cada clave, el último hecho que la llevó a ese estado. */
interface StateOrigins { [key in OriginKey]?: { event: EntityId; at: WorldMinute } }
type OriginKey = 'desempleo' | 'dinero' | 'enfermedad' | 'malestar' | 'sueno' | 'conflicto';
// En la persona: `Citizen.origins`. ≈ 6 claves × 30 B ≈ 0,2 KB por persona.

/** Nodo del árbol de `why` (R-004). */
interface WhyNode {
  kind: 'event' | 'state' | 'source';
  ref: string;            // id del evento, clave del estado o de la fuente
  text: string;           // en español, con nombres
  weight: number;         // aporte, relativo a sus hermanos (R-003)
  at?: WorldMinute;
  children: WhyNode[];
}
```

## 4. Reglas
- **R-001** [M] — **Causas al crear.** Las causas se asignan al crear el evento, nunca después (014). Un sistema que cita un estado cita también su origen (R-005), si lo hay.
- **R-002** [M] — **Nada del futuro.** Toda causa de evento es un evento anterior, lo que se comprueba por su id (los ids de evento crecen con el tiempo, 001): `makeEvent` rechaza una causa con id mayor o igual que el del evento nuevo. Así no hay ciclos ni causas futuras por construcción (CA-002).
- **R-003** [M] — **Pesos como aportes.** El peso de cada causa es su aporte, en [0,1], independiente de los demás: no se normalizan a 1 al crear (la versión 0.1 lo pedía, y ningún sistema lo hace, porque los aportes vienen de mecanismos distintos). `why` los normaliza entre hermanos para mostrarlos.
- **R-004** [M] — **`why(get, id, depth, minWeight)`.** Función pura del motor que recibe la búsqueda de eventos del registro (`get`) y devuelve el árbol de causas hasta la profundidad pedida, sin repetir nodos y sin ramas de peso relativo menor que `minWeight`. Los estados se expanden en su hecho de origen (R-005); las fuentes de control, en los hechos que formaron la función o la regla (R-006). Texto en español con nombres. Determinista (CA-005).
- **R-005** [M] — **Origen de los estados.** Un sistema `origins` (fase `end_of_day`) apunta en `Citizen.origins` el último hecho de cada clave:
  - `desempleo`: `JOB_LOST` (se borra con `JOB_HIRED` o `INFORMAL_WORK_STARTED`);
  - `dinero`: `DEBT_TAKEN`, `PAYMENT_MISSED`, `RENT_LATE`, `JOB_LOST`;
  - `enfermedad`: `FELL_ILL`, `CONDITION_DIAGNOSED` (se borra con `RECOVERED`);
  - `malestar`: `PNR_EPISODE`, `CHAT_CLAIM_BELIEVED`, `CONFRONTATION`, `BREAKUP`;
  - `conflicto`: `ARGUMENT`, `CONFRONTATION`, `BOND_STRAINED`;
  - `sueno`: lo que le quitó horas de sueño, es decir, una actividad elegida (`LEISURE_DONE`) o un episodio de rumiación (`PNR_EPISODE`) dentro de su horario de sueño.

  Los estados que citan las necesidades (010), la enfermedad, la rutina (011) y la economía (015) añaden el evento de origen de su clave, con el peso del estado. Si la deuda de sueño no tiene un hecho detrás, su origen es su horario (un estado con texto: «duerme menos de lo que necesita por su horario»), y la cadena termina ahí con esa explicación.
- **R-006** [T] — **Fuentes de control hasta su origen.** Las causas `fuente.<fuente>:<ref>` de una conducta (040 R-006) se expanden en los eventos de origen (`src`) de la función, la respuesta o la regla que citan (036, 038), como hace `citizen:explain` (035 CA-001). Se leen del estado **actual** de la persona y el árbol lo dice («origen actual de esa función»), porque guardar una copia al crear cada conducta no cabe en el presupuesto.
- **R-007** [M] — **Dónde se consulta.**
  - la CLI: `event:why EVT-… [--depth 4]`;
  - la API: `GET /api/events/:id/why`;
  - el visor: «¿por qué?» en cada evento de la pestaña Historia, con el árbol desplegable.

## 4 bis. Estatus epistémico
- [T]: explicar una conducta por su historia (035 §12); el origen de un estado como el hecho que lo produjo.
- [M]: la tabla de orígenes, los pesos y el umbral de poda del árbol.

## 5. Eventos
No define tipos propios. Cambia las causas de los eventos que citan estados (R-005).

## 6. Invariantes
- **INV-001** — Toda causa de evento existe en el registro y es anterior al efecto (R-002).
- **INV-002** — Ningún evento no espontáneo sin causas (014).
- **INV-003** — `why` no lee la verdad del mundo más allá del registro y del estado persistido; no inventa causas.

## 7. Criterios de aceptación
- **CA-001** — *Dado* un `JOB_LOST` por llegadas tarde, *entonces* `why` con profundidad 5 llega hasta la falta de sueño y, si existe, hasta el hecho que le quitó el sueño (una actividad a deshoras, una rumiación nocturna o un conflicto en el hogar).
- **CA-002** — *Dado* todo el registro de 1 año, *entonces* no hay ciclos ni causas del futuro, y `makeEvent` rechaza una causa posterior.
- **CA-003** — *Dado* 1 año, *entonces* ≥ 95 % de los eventos no espontáneos tienen causas válidas.
- **CA-004** — *Dado* 1 año, *entonces* ≥ 60 % de los eventos de la vida diaria que citan un estado llegan, en profundidad 3, a algún hecho del registro (hoy: 11 %).
- **CA-005** — *Dado* el mismo registro y estado, *entonces* `why` devuelve el mismo árbol, con como mucho `MAX_NODES` nodos.

## 8. Parámetros y calibración
| Parámetro | Valor | Estado |
|---|---|---|
| Profundidad por defecto de `why` | 4 | [M] |
| `MIN_WEIGHT` (peso relativo mínimo de una rama) | 0,1 | [M] |
| `MAX_NODES` | 60 | [M] |
| Horario de sueño para el origen `sueno` | el de su rutina (011) | [M] |

## 9. Métricas y observabilidad
- Proporción de eventos que llegan a un hecho en profundidad 3, por tipo.
- Profundidad media de las cadenas; tipos que terminan siempre en un estado.
- Bytes de `Citizen.origins` por persona.

## 9 bis. Decisiones del usuario (2026-09-29)
Aprobadas las cinco propuestas de §10 (P1 a P5) tal como están.

## 10. Preguntas abiertas (resueltas en §9 bis)
- **P1 — Pesos como aportes.** Los pesos no suman 1 al crear el evento (R-003); `why` los normaliza al mostrarlos. *Propuesta:* sí; ningún sistema los normaliza hoy y hacerlo mezclaría mecanismos distintos.
- **P2 — Origen de los estados en el motor.** Cada persona guarda el último hecho de cada tipo de estado (≈ 0,2 KB) y los sistemas lo citan al crear el evento (R-005). La alternativa es adivinarlo al consultar (buscar en el registro hechos recientes que suelen causar ese estado), que no cuesta memoria pero no es la causa que usó el motor. *Propuesta:* en el motor.
- **P3 — Fuentes de control con su origen actual.** Las causas de una conducta se siguen hasta los hechos que formaron sus funciones con el estado de hoy, avisándolo en el texto (R-006). *Propuesta:* sí; guardar una copia por conducta no cabe.
- **P4 — Rechazo de causas futuras.** `makeEvent` lanza un error si una causa es posterior (R-002). Es un fallo de programación, y así lo detectan las pruebas. *Propuesta:* sí.
- **P5 — «¿Por qué?» en el visor.** Cada evento de la pestaña Historia tiene su árbol de causas desplegable, además de la CLI y la API (R-007). *Propuesta:* sí.

## Adaptación al motor funcional (MF8.1, 2026-09-28)
Según la 035 §8:
- Las causas de una conducta incluyen el vector de aportes por fuente (040 R-006) y la cadena de origen de cada función hasta hechos del registro o del desarrollo (035 CA-001: `citizen:explain`).
- Una función, una relación o una regla sin evento de origen es un error (041 INV-001).

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-28 | — | MF8.1: sección «Adaptación al motor funcional» con lo que cambió en los bloques MF1 a MF7 (o debe cambiar, si la spec sigue en borrador), según la 035 §8. Sin cambios en CA |
| 2026-09-29 | 0.2 | Reescritura sobre el motor funcional (bloque C de M3), tras medir el registro (100 personas × 60 días: íntegro, pero el 89 % de los eventos de la vida diaria se corta en un estado): origen de los estados en la persona (R-005), fuentes de control hasta su origen (R-006), rechazo de causas futuras por id (R-002), pesos como aportes (R-003), `why` en el motor con CLI, API y visor. CA-004 y CA-005 nuevos. Preguntas P1 a P5 para el usuario |
| 2026-09-29 | 0.2 | Decisiones del usuario (§9 bis): P1 a P5 aprobadas |
| 2026-09-29 | 0.2 | Estado → aprobada |
| 2026-09-29 | 0.2 | Implementación (bloque C de M3). En 100 personas × 60 días, los eventos que citan un estado y llegan a un hecho en profundidad 3 pasan del 11 % al 73 % (CA-004 se mide con todas las ramas, sin la poda de lectura del árbol). Hallazgo: en la población actual nadie trasnocha por actividades, así que la deuda de sueño sale del horario (`horario_de_sueno`) y «se quedó dormido» no llega a un hecho; es la verdad del modelo, no un hueco del registro. Los eventos del calendario (salario, arriendo, trayectos, inicio del día) solo tienen estados por naturaleza. Resultados en `docs/validaciones/M3-causalidad.md`. Sin cambios en CA |
| 2026-09-29 | 0.2 | Estado → implementada |
