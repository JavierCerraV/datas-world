---
id: 021
nombre: simulation
estado: borrador
hito: M2
depende_de: [001, 002, 017, 014]
version: 0.2
---

# 021 — Bucle de simulación, registro de sistemas y niveles de detalle

## 1. Propósito
Orquestar los sistemas en cada tick y asignar a cada persona un nivel de simulación (0–4) para gastar CPU donde importa. El bucle no conoce los sistemas concretos: recorre un **registro de sistemas enchufables** (ADR-005, idea A), de modo que añadir complejidad al mundo sea registrar un sistema nuevo y no reescribir el bucle.

## 2. Alcance
**Incluye:** interfaz `System`, registro y orden de sistemas, niveles, promoción/degradación, variantes estadísticas de baja resolución, presupuesto de CPU.
**Fuera de alcance:** persistencia (027), el contenido de cada sistema (lo define su spec).

## 3. Modelo de datos
```ts
type SimLevel = 0|1|2|3|4;
// 0: estadístico (resumen diario)  1: rutina por bloques  2: decisiones por tick
// 3: interacciones y memoria detalladas  4: observada / crítica (LLM opcional en M6)
interface SimBudget { maxLevel4: number; maxLevel3: number; targetTicksPerSecond: number; }

type Cadence = 'tick' | 'hour' | 'day';   // cada cuánto se ejecuta

interface System {
  id: string;                    // 'needs', 'decision', 'memory.consolidation'…
  phase: Phase;                  // fase del tick donde corre (R-001)
  order: number;                 // desempate dentro de la fase (menor primero)
  capability: Capability;        // capacidad que lo activa (spec 001 R-007)
  cadence: Cadence;
  minLevel: SimLevel;            // personas con nivel < minLevel no pasan por run()
  run(view: WorldView, ctx: TickCtx, rng: Rng): SystemOutput;
  // Variante de baja resolución para personas con nivel < minLevel (opcional, R-006):
  runCoarse?(view: WorldView, ctx: TickCtx, rng: Rng): SystemOutput;
}

type Phase = 'scheduler' | 'needs' | 'decision' | 'actions' | 'interactions'
           | 'economy' | 'information' | 'memory' | 'end_of_day';

interface TickCtx {
  now: WorldMinute;
  citizens: readonly number[];   // índices densos que corresponden a este sistema, ascendentes
  level: (idx: number) => SimLevel;
}

interface SystemOutput { patches: Patch[]; events: WorldEvent[]; actions?: ActionRequest[]; }

// WorldView: acceso de solo lectura al estado (incluidos los componentes de la spec 001 §3.1).
// Ningún sistema escribe: devuelve parches que el bucle aplica al final de su fase.
```

## 4. Reglas
- **R-001** — Orden fijo por tick, por fases: scheduler → necesidades → decisiones → acciones → interacciones → economía → información → memoria → fin de día → volcado. Dentro de una fase, los sistemas corren por `(order, id)` ascendente.
- **R-002** — Se promociona a nivel ≥3 a quien está siendo observado, a quien está en un evento importante o con estado extremo; se degrada tras inactividad.
- **R-003** — Los niveles bajos producen resultados estadísticamente equivalentes (mismas medias de necesidades, gasto y contactos) validados por pruebas.
- **R-004** — El cambio de nivel no altera el determinismo: depende solo de estado y entradas registradas (la observación es una entrada externa).
- **R-005** — **Registro.** El registro es una lista estática y ordenada en `packages/engine`. En cada tick solo se ejecutan los sistemas cuya `capability` está en `world.capabilities`. Registrar dos sistemas con el mismo `id` es un error al arrancar.
- **R-006** — **Variantes gruesas.** Una persona con nivel < `minLevel` pasa por `runCoarse` si existe; si no, el sistema no la toca. `runCoarse` trabaja con cadencia `hour` o `day` y aproxima el efecto acumulado de `run`.
- **R-007** — **Aislamiento.** Un sistema solo lee a través de `WorldView` y solo cambia el estado con los parches que devuelve; los parches de una fase se aplican antes de la fase siguiente, en orden de sistema y luego de emisión. Las `ActionRequest` pasan por la validación de la spec 017.
- **R-008** — **Flujos RNG.** El bucle entrega a cada sistema `rng.fork('sys:' + id)`; el sistema deriva por persona con `fork(citizenId)` (spec 023 R-002). Así, registrar un sistema nuevo no altera el azar de los existentes.
- **R-009** — **Presupuesto.** Si los candidatos a nivel 3 o 4 superan `maxLevel3`/`maxLevel4`, se eligen por prioridad (observado > evento importante > estado extremo) y luego por id ascendente.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `SIM_LEVEL_CHANGED` | debug | de, a, motivo |  |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).
- **INV-003** — El orden de ejecución de sistemas es función pura de `(registro, capabilities)`.

## 7. Criterios de aceptación
- **CA-001** — *Dado* 100 personas en nivel 1 vs nivel 2 durante 30 días, *entonces* la diferencia de medias de ánimo y gasto es < 5 %.
- **CA-002** — *Dado* 500 personas, *entonces* se simulan ≥ 1 año de mundo en < 10 min en el servidor objetivo.
- **CA-003** — *Dado* que se observa a una persona, *entonces* sube a nivel 4 y el evento de observación se registra como entrada externa.
- **CA-004** — *Dado* un registro con los sistemas A (fase needs) y B (fase decision), *cuando* se registra C en una fase intermedia, *entonces* la secuencia de números aleatorios que reciben A y B no cambia.
- **CA-005** — *Dado* un sistema que intenta mutar `WorldView`, *entonces* la prueba falla (la vista es de solo lectura en tipos y en tiempo de ejecución en modo prueba).
- **CA-006** — *Dado* un mundo sin la capacidad `relationships`, *entonces* ningún sistema con esa capacidad se ejecuta; al activarla, empieza a ejecutarse desde el tick siguiente.
- **CA-007** — *Dado* 10 000 personas con al menos 95 % en nivel 0–1, *entonces* `pnpm bench` mide RSS < 1 GB y ≥ 1 día de mundo por segundo en local (peldaño 5).

## 8. Parámetros y calibración
| Parámetro | Valor por defecto |
|---|---|
| maxLevel4 | 5 |
| maxLevel3 | 50 |
| inactividad antes de degradar | 3 días de mundo |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite). Tiempo medio por sistema y por tick (el bench desglosa por `id`).

## 10. Preguntas abiertas
- [ ] ¿La observación debe cambiar el mundo? (Propuesta: solo el nivel de detalle, nunca el resultado esperado.)
- [ ] ¿`WorldView` de solo lectura con `Readonly<>` de TypeScript basta, o también `Object.freeze` en pruebas? (Propuesta: tipos siempre, congelado solo en pruebas por coste.)
- [ ] ¿Qué sistemas necesitan `runCoarse` desde M2? (Propuesta: needs, routines y economy.)

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-23 | 0.2 | Registro de sistemas enchufables por fases y capacidades, variantes gruesas, flujos RNG por sistema, presupuesto de niveles y CA de escala 10 000 (ADR-005, idea A) |
