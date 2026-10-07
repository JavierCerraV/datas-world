---
id: 022
nombre: observability
estado: aprobada
hito: M4
depende_de: [027, 019, 020]
version: 0.6
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
// POST /api/control { cmd: pause|resume|speed|step|advance, arg? }   (basic auth)
// GET  /api/moves?since=, GET /api/stats   (v0.4)
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

### Paridad con el prototipo (v0.4, decisiones del usuario del 2026-09-29, P1 a P4)
- **R-012** [M] — **Movimientos (P1).** `GET /api/moves?since=<minuto>` da los viajes de `movements` (027 R-013) con salida posterior a `since` o aún en curso, en orden de salida. Cada `tick` del SSE lleva los viajes nuevos desde el tick anterior (`moves`), para que el visor reproduzca cada trayecto a su hora.
- **R-013** [M] — **Indicadores y avance (P2).**
  - `GET /api/stats`: personas, hogares, barrios, porcentaje con empleo (personas de 18 a 64 años que no estudian ni están jubiladas), ánimo medio, eventos de hoy y, si hay un avance sin observar en curso, su inicio y su destino (027 R-015);
  - `POST /api/control` acepta `advance` con los minutos a avanzar: 1 día (1440), 1 semana (10080), 1 mes (43200), 3 meses (129600), 6 meses (259200) o 1 año (525600).
- **R-014** [M] — **Ficha completa (P3).**
  - La ficha del ciudadano añade:
    - el nombre de su vivienda y su barrio;
    - hasta cuándo dura lo que hace;
    - lo que otras personas creen de ella (`aboutMe`): por tema, la verdad del mundo, lo que ella cuenta y quién cree cada versión (solo para quien observa, 025 R-008).
  - La ficha del lugar añade su personal: quién trabaja allí y quién lo dirige.

### Visor A+ (v0.5, derivada de la 024 v0.5 aprobada por el usuario el 2026-09-30)
- **R-015** [M] — **Expediente.** `GET /api/citizens/:id/dossier` da lo que el expediente de la 024 R-022 no encuentra en la ficha:
  - identidad: fecha y lugar de nacimiento, estudios, llegada al mundo (fecha y motivo) y hogar con su tamaño y parentesco;
  - «por qué está donde está»: los hechos que explican su ocupación y su lugar actual, con sus causas (019);
  - agenda de hoy: los bloques de su rutina prevista (011) con su clase (dormir, desplazamiento, trabajo, estudio, tiempo libre), su lugar actual y cuándo queda libre;
  - salud: régimen de aseguramiento y desde cuándo (031), condiciones y episodios del sueño;
  - objetos con dueño, fecha de adquisición y precio (005);
  - sus eventos en orden cronológico, marcados como historia de origen (030) o simulación, y los recuentos de eventos, estímulos con función, reglas y charlas;
  - **ventana de eventos (v0.6, decisión del usuario del 2026-10-05):** `?limit=N` (por defecto 150; entre 20 y 5000) devuelve toda la historia de origen y los últimos `N` eventos de la simulación, y `omitted` con los de la simulación que quedan fuera. Los recuentos (`counts.events`), la salud, la llegada y los objetos se calculan siempre con todos los eventos; solo cambia lo que se envía.
- **R-016** [M] — **Demografía.** `GET /api/demographics?period=month|year|all` da, sobre el estado guardado: personas vivas, nacidos y fallecidos del periodo con su tasa bruta por mil, hogares con su tamaño medio, organizaciones, la pirámide por edad (grupos de 10 años, 80 o más) y sexo, y las personas por ocupación; también el recuento «Ahora» (trabajando, en clase, en casa, en la calle) de la 024 R-021.

### Datos del mundo (v0.6, derivada de la 024 v0.6)
- **R-017** [M] — **Distribuciones.** `GET /api/demographics` añade: el ánimo medio y el porcentaje con empleo; histogramas de 10 tramos del ánimo y del estrés; la distribución del dinero en tramos, su mediana y su índice de Gini; los hogares por número de miembros; y el empleo formal por organización.
- **R-018** [M] — **Red de vínculos.** `GET /api/network` da los nodos (id, nombre, edad, sexo, barrio, hogar y ánimo de cada persona viva) y las aristas sin repetir: los vínculos (012) con su tipo, su trato y su tensión, y el parentesco de los hogares (008) como familia o pareja.
- **R-019** [M] — **Ocupación y estrato en la población.** Cada elemento de `GET /api/citizens` (y de `/api/days/:day/citizens`) añade `occupation` (una de las ocupaciones de la R-016) y `stratum` (el de su vivienda, 1 a 6, o `null` si no se conoce). Es lo que necesita el filtro de cohorte de la 024 R-026; no hay lógica nueva, solo se leen datos que ya están en el estado.

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
- **CA-009** — *Dado* un mundo con movimientos guardados, *entonces* `/api/moves?since=` devuelve los que salen después de `since` y los que siguen en curso, con los mismos datos que la base.
- **CA-010** — *Dado* un mundo, *entonces* `/api/stats` coincide con el cálculo sobre el estado guardado, y `advance` con un número de minutos no admitido responde 400.
- **CA-011** — *Dado* una persona sobre la que circula un rumor, *entonces* su ficha lista en `aboutMe` cada versión con quién la cree y si es verdad; la ficha de un lugar de trabajo lista su personal.
- **CA-001** — *Dado* el worker corriendo, *entonces* `/api/health` responde en < 50 ms.
- **CA-002** — *Dado* un cliente SSE desconectado, *cuando* reconecta con `Last-Event-ID`, *entonces* recibe los eventos perdidos.
- **CA-003** — *Dado* una petición a `/api/control` sin credenciales, *entonces* 401; con ellas, la orden queda en `control_commands`.
- **CA-004** — La ficha de `/api/citizens/:id` coincide con el estado guardado (mismos valores que la base) y la posición de `/api/citizens` sigue la R-005.
- **CA-012** — *Dado* un mundo de ejemplo, *entonces* el expediente de una persona coincide con el estado guardado y sus eventos (incluida la historia de origen marcada como tal) y su agenda cubre las 24 horas.
- **CA-013** — *Dado* un mundo de ejemplo, *entonces* `/api/demographics` suma en la pirámide y en la ocupación el total de personas vivas, y cambiar el periodo cambia los nacidos y los fallecidos contados.
- **CA-014** — *Dado* un mundo de ejemplo, *entonces* los histogramas de `/api/demographics` suman la población, el Gini está en [0,1], y `/api/network` da un nodo por persona viva y aristas entre nodos existentes, sin repetir.
- **CA-015** — *Dado* el mundo de ejemplo, *entonces* cada persona de `/api/citizens` trae una ocupación de la lista de la R-016 y un estrato de 1 a 6 o `null`, y alguna tiene estrato (prueba de la API).
- **CA-016** — *Dado* un expediente con más eventos de simulación que el límite, *entonces* `?limit=N` devuelve la historia de origen completa y los últimos N de la simulación, `omitted` es el resto, `counts.events` no cambia y la salud y la llegada salen igual que sin límite (prueba de la API).

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
| 2026-09-29 | 0.3 | Implementación de M4 (O1–O4, `apps/api`). Precisión de R-010: la fila de trayectoria del día d se guarda a las 00:00 del día d y resume el día d − 1, así que cada punto de `/api/metrics` lleva la fecha y los eventos de ese día cerrado. CA-005 a CA-008 verdes. Sin cambios en CA |
| 2026-09-29 | 0.4 | Paridad con el prototipo, aprobada por el usuario (P1 a P4): movimientos para reproducir los trayectos (R-012), indicadores de la barra superior y avance sin observar (R-013), ficha completa con lo que otros creen de la persona y personal del lugar (R-014). CA-009 a CA-011 nuevos |
| 2026-09-29 | 0.4 | Implementación de la paridad (P1 a P4). Precisiones, sin cambios en CA: `/api/world` añade `points` (por dónde se entra a cada lugar, también a las viviendas de un edificio) y `names`; las posiciones, `homeId`; cada evento, `text` legible (lugares, organizaciones y temas de rumor en palabras) y `names`. R-004: los 401 no llevan `WWW-Authenticate`, porque el navegador abría su propia ventana de acceso y la petición del visor quedaba colgada; las credenciales las pide el visor. La verdad de las creencias lee solo los tipos de evento que la deciden. CA-009 a CA-011 verdes |
| 2026-09-30 | 0.5 | Visor A+ (derivada de la 024 v0.5, aprobada por el usuario): expediente (R-015) y demografía (R-016). CA-012 y CA-013 nuevos |
| 2026-10-05 | 0.5 | Precisión derivada de la 024 v0.6 (R-026, filtro de cohorte), sin cambiar reglas anteriores: `/api/citizens` añade `occupation` y `stratum` (R-019, renumerada: la R-017 es de la v0.6 de main). CA-015 nuevo |
| 2026-10-05 | 0.6 | Decisiones del usuario: el avance admite también 3 y 6 meses (R-013) y el expediente se envía por ventanas (`limit` y `omitted`, R-015) para que las historias de vida no pesen. CA-016 nuevo |
| 2026-09-30 | 0.6 | Datos del mundo (derivada de la 024 v0.6): distribuciones en la demografía (R-017) y red de vínculos (R-018). `/api/world` da también `geo.tileMeters` (003 v0.4). CA-014 nuevo |
| 2026-09-30 | 0.6 | Implementación de R-017 y R-018 (`distributions.ts`, `network.ts`). Precisiones: el dinero va en 8 tramos, de «Deuda» a «> 20 M»; el Gini cuenta las deudas como 0; en la red, si dos personas tienen varios lazos, gana el más fuerte (pareja, familia, amistad, compañeros, otros). CA-014 verde |
