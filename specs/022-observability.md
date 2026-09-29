---
id: 022
nombre: observability
estado: aprobada
hito: M4
depende_de: [027, 019, 020]
version: 0.3
---

# 022 — Observación, API y métricas

## 1. Propósito
Ver el mundo sin alterarlo: API de consulta, flujo en vivo, controles de tiempo, métricas de salud y exportación para investigación.

## 2. Alcance
**Incluye (bloque V, versión mínima adelantada por decisión del usuario del 2026-09-26):**
- endpoints de lectura del mundo, las personas y los eventos;
- flujo en vivo por SSE;
- controles de tiempo autenticados;
- salud del proceso.

**En M3** llegaron el árbol causal (`/api/events/:id/why`, 019), el informe de vida (`/api/citizens/:id/report`, 020), los vínculos, recuerdos y creencias en la ficha.

**En M4 (v0.3):** lugares, viaje para dibujar el recorrido, días pasados, métricas con alertas de degeneración y exportación CSV (R-007 a R-011).

## 3. Modelo de datos
```ts
// Proceso apps/api (Fastify), solo lectura de la base del mundo (openReadonly). Escribe únicamente en
// control_commands (R-001), como la CLI.
// GET  /api/health                → { now, date, status, speed, citizens, rssMb, dbMb }
// GET  /api/world                 → { name, now, date, epoch, geo: { width, height, tiles[] },
//                                     places: [{ id, kind, name, rect?, door?, open }], population }
// GET  /api/citizens              → [{ id, name, x, y, activity, placeId?, moving, mood }]   (posiciones, R-005)
// GET  /api/citizens/:id          → ficha: identidad, edad, ocupación, hogar, necesidades, emociones, estado,
//                                     actividad y lugar, temperamento (descriptores), funciones más fuertes,
//                                     reglas con su aporte y tipo, red (aristas), últimos 20 eventos con causas
// GET  /api/events?since=&limit=  → eventos posteriores a `since` (id), como mucho `limit` (≤ 200)
// GET  /api/stream                → SSE: `tick` { now, date } y `event` (id = id del evento); Last-Event-ID
// POST /api/control { cmd: pause|resume|speed|step, arg? }   (basic auth)
```

## 4. Reglas
- **R-001** — La API nunca muta el estado del mundo; los controles solo escriben en `control_commands`, que atiende el worker.
- **R-002** — Validación de entrada y salida con Zod.
- **R-003** — SSE con reconexión y `Last-Event-ID`: al reconectar, el cliente recibe los eventos posteriores a ese id guardados en la base.
- **R-004** — Controles protegidos con basic auth. Las credenciales salen de `DATAS_WORLD_USER` y `DATAS_WORLD_PASSWORD`; sin ellas, los controles están desactivados (503).
- **R-005** [M] — **Posición de una persona:** la puerta de su lugar (`loc.place`) o, en un viaje, la interpolación lineal entre la puerta de origen y la de destino según `trip.departAt`/`trip.arriveAt`. Un lugar fuera del mapa (La Capital) no tiene posición: la persona se marca `moving` fuera del mapa.
- **R-006** [M] — **Lectura del mundo:** la API recarga el mundo de la base cuando cambia el minuto persistido (consulta cada segundo). No lee el reloj dentro de la lógica de respuesta (solo el bucle de sondeo).

### Ampliación de M4 (v0.3, decisiones del usuario del 2026-09-29)
- **R-007** [M] — **Lugares (P1).** `GET /api/places/:id` devuelve el lugar (nombre, tipo, barrio, horario), quién está dentro ahora y, si es vivienda, quién vive allí.
- **R-008** [M] — **El viaje para dibujarlo (P2).** Cada posición en camino lleva su viaje: puerta de origen y de destino, y minuto de salida y de llegada. El visor dibuja el recorrido por las calles; el motor no cambia (el tiempo de viaje sigue siendo el de la 016).
- **R-009** [M] — **Días pasados (P3).**
  - `GET /api/days` da los días con instantánea;
  - `GET /api/days/:day/citizens` y `GET /api/days/:day/citizens/:id` dan las posiciones y la ficha tal como estaban ese día, leídas de la instantánea (027 R-004);
  - se guardan en memoria como mucho `DAY_CACHE` instantáneas decodificadas.
- **R-010** [M] — **Métricas del mundo (P4).** `GET /api/metrics` da, por día:
  - de la trayectoria (020 R-001): ánimo y estrés medios con su desviación, y la mediana del dinero;
  - del registro: los eventos por tipo;
  - alertas de degeneración: desviación entre personas casi nula (< 0,01), más de la mitad de las personas en 0 o en 1, o una serie que crece sin parar los últimos 30 días.
- **R-011** [M] — **Exportación (P4).** `GET /api/export/trajectory.csv` y `GET /api/export/events.csv` (tipo, minuto, participantes, payload y causas en JSON), en streaming, para analizar fuera (019: la inferencia estadística se hace fuera).

## 5. Eventos
No define tipos propios (usa los de otras specs).

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-005** — *Dado* un lugar con gente dentro, *entonces* `/api/places/:id` los lista con los mismos datos que el estado guardado; una vivienda lista a sus residentes.
- **CA-006** — *Dado* un día pasado con instantánea, *entonces* sus posiciones y fichas coinciden con las de esa instantánea, y pedir días pasados no cambia el `stateHash` del presente.
- **CA-007** — *Dado* un mundo con trayectoria, *entonces* `/api/metrics` da una fila por día con sus medias, y una serie constante entre personas levanta la alerta de desviación nula.
- **CA-008** — *Dado* un mundo con eventos, *entonces* los CSV se leen de vuelta con el mismo número de filas que la base.
- **CA-001** — *Dado* el worker corriendo, *entonces* `/api/health` responde en < 50 ms.
- **CA-002** — *Dado* un cliente SSE desconectado, *cuando* reconecta con `Last-Event-ID`, *entonces* recibe los eventos perdidos.
- **CA-003** — *Dado* una petición a `/api/control` sin credenciales, *entonces* 401; con ellas, la orden queda en `control_commands`.
- **CA-004** — La ficha de `/api/citizens/:id` coincide con el estado guardado (mismos valores que la base) y la posición de `/api/citizens` sigue la R-005.

## 8. Parámetros y calibración
| Parámetro | Valor | Estado |
|---|---|---|
| Sondeo de la base | 1 s | [M] |
| Tope de eventos por consulta | 200 | [M] |
| `DAY_CACHE` (instantáneas decodificadas en memoria) | 2 | [M] |
| Alertas: desviación nula · saturación · crecimiento | < 0,01 · > 50 % en 0 o 1 · 30 días seguidos al alza | [M] |
| Puerto | 8787 (`DATAS_WORLD_API_PORT`) | [M] |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite). Desde M4.

## 10. Preguntas abiertas
- [ ] Revisar parámetros con los resultados de la primera validación.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-26 | 0.2 | Versión mínima adelantada (bloque V, decisión del usuario): endpoints concretos de mundo, personas, ficha, eventos y SSE; posición interpolada (R-005); recarga por sondeo (R-006); credenciales por variables de entorno; CA-004. Árbol causal, informe de vida, exportación y métricas quedan para M4 |
| 2026-09-26 | 0.2 | Estado → aprobada |
| 2026-09-26 | 0.2 | Implementación del bloque V1 (`apps/api`). Precisiones: la posición de una vivienda sin puerta propia es la de su edificio, o el centro de su área; sin `Last-Event-ID`, el SSE empieza por el último evento guardado; la velocidad vigente sale del último `SPEED_CHANGED`; la API solo escucha en 127.0.0.1. CA-001 a CA-004 verdes. Sin cambios en CA |
| 2026-09-28 | — | 041 R-009: ruta de solo lectura `GET /api/citizens/:id/life` (episodios del desarrollo y familiograma). Sin cambios en CA |
| 2026-09-29 | 0.3 | Ampliación de M4, aprobada por el usuario (P1 a P5): lugares (R-007), el viaje para dibujar el recorrido por las calles (R-008), días pasados desde las instantáneas (R-009), métricas con alertas de degeneración (R-010) y exportación CSV (R-011). CA-005 a CA-008 nuevos. En M3 llegaron el árbol causal y el informe de vida |
