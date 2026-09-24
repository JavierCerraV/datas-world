---
id: 002
nombre: time
estado: aprobada
hito: M0
depende_de: []
version: 0.1
---

# 002 — Tiempo

## 1. Propósito
Reloj global del mundo, calendario, velocidades de simulación y controles (pausa, paso, avanzar N días). Implementa la sección de la visión sobre el tiempo (1x–1000x, pause/step/rewind/replay). Rewind/replay se detallan en 023 y 027.

## 2. Alcance
**Incluye:** `WorldMinute`, conversión a calendario, tick, velocidades, scheduler de eventos futuros, controles.
**Fuera de alcance:** instantáneas y rewind (027/023), niveles de simulación (021).

## 3. Modelo de datos
```ts
type WorldMinute = number;      // entero ≥ 0 desde epoch

interface CalendarView {        // derivado, nunca almacenado
  year: number; month: number; day: number;
  weekday: 0|1|2|3|4|5|6;       // 0 = lunes
  hour: number; minute: number;
  isWeekend: boolean; isHoliday: boolean;
}

type Speed = 0 | 1 | 10 | 100 | 1000;   // 0 = pausa

interface ScheduledItem {
  at: WorldMinute;
  id: EntityId;                 // desempate determinista
  kind: string;                 // 'SALARY_PAYMENT', 'APPOINTMENT', …
  payload: unknown;
}
```

## 4. Reglas
- **R-001** — El calendario es gregoriano sin zonas horarias ni horario de verano. Festivos definidos en `WorldConfig` (lista por fecha).
- **R-002** — Cada tick suma `tickMinutes`. El resultado de la simulación **no depende de la velocidad**: la velocidad solo determina cuántos ticks se ejecutan por segundo real.
- **R-003** — Velocidad objetivo: 1x = 1 min de mundo por segundo real (≈ 0,2 ticks/s con tick de 5 min); 1000x = 1 000 min/s. Si la CPU no alcanza la velocidad pedida, el worker ejecuta tan rápido como pueda y lo reporta (`effectiveSpeed`).
- **R-004** — El scheduler es una cola de prioridad por `(at, id)`; nunca por orden de inserción implícito.
- **R-005** — "Avanzar N días" ejecuta los ticks sin pausas de tiempo real y sin emitir notificaciones intermedias salvo progreso cada 5 %.
- **R-006** — "Paso" ejecuta exactamente un tick y deja el mundo en pausa.

## 5. Eventos
| Tipo | Cuándo | Payload |
|---|---|---|
| `DAY_STARTED` | minuto 00:00 de cada día | fecha |
| `SPEED_CHANGED` | orden externa | de, a |

## 6. Invariantes
- **INV-001** — `now` es múltiplo de `tickMinutes` y nunca decrece (salvo rewind, que carga otro estado).

## 7. Criterios de aceptación
- **CA-001** — *Dado* epoch 2027-01-04 00:00, *cuando* `now = 1440·31 + 8·60 + 32`, *entonces* el calendario es 2027-02-04 08:32, jueves.
- **CA-002** — *Dado* el mismo mundo avanzado 7 días a 1x y a 1000x, *entonces* los hashes de estado son idénticos.
- **CA-003** — *Dado* dos elementos programados en el mismo minuto, *cuando* se extraen, *entonces* salen en orden de id.
- **CA-004** — *Dado* un mundo pausado, *cuando* se ejecuta "paso", *entonces* `now` aumenta en `tickMinutes` y el estado queda en pausa.
- **CA-005** — *Dado* un mundo vacío, *cuando* se avanza 365 días desde la CLI, *entonces* termina en < 2 s y hay 365 `DAY_STARTED`.

## 8. Parámetros
| Parámetro | Defecto |
|---|---|
| `tickMinutes` | 5 |
| Velocidades | 0, 1, 10, 100, 1000 |

## 10. Preguntas abiertas
- [ ] ¿Tick variable (más fino en nivel 4)? Propuesta: no en MVP; subticks dentro de acciones si hace falta.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial |
| 2026-09-24 | 0.1 | Estado → aprobada |
