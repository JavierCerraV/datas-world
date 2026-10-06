---
modulo: api
ruta: apps/api
estado: en-desarrollo
specs: [022, 043, 026, 044, 041]
actualizado: 2026-09-30
---

# Módulo: api

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
HTTP de consulta y SSE sobre la base que escribe el worker; controles de tiempo escritos en `control_commands`. No muta el estado del mundo (022 R-001). Versión mínima adelantada (bloque V).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 022 | CA-001 a CA-013; R-001 a R-016 | — |

## 3. API pública
Proceso: `pnpm api [--db data/world.db] [--port 8787]` (`src/main.ts`). Controles con `DATAS_WORLD_USER` y `DATAS_WORLD_PASSWORD`; sin ellas, desactivados (503).

| Ruta | Respuesta |
|---|---|
| `GET /api/health` | `{ now, date, status, speed, citizens, rssMb, dbMb }` |
| `GET /api/world` | `{ name, now, date, epoch, status, geo: { width, height, tiles[] }, places: [{ id, kind, name, rect?, door?, open }], population, points, names }`; `points`: por dónde se entra a cada lugar, también a las viviendas (R-012); `names`: el nombre de cada lugar |
| `GET /api/citizens` | posiciones: `[{ id, name, x, y, activity, placeId, moving, mood, age, occupation, stratum, homeId, trip? }]` (R-005; `trip` = `{ from, to, departAt, arriveAt }` con las puertas, R-008) |
| `GET /api/places/:id` | ficha del lugar: `{ id, name, kind, district, open, inside[], residents[], staff[] }`, con los lugares de dentro de un edificio (R-007) y el personal con su puesto y quién dirige (R-014); 400/404 |
| `GET /api/moves?since=` | viajes de `movements` que llegan después de `since` (R-012) |
| `GET /api/stats` | `{ population, households, districts, employedPct, moodMean, eventsToday, advance }` (R-013) |
| `GET /api/days` | `{ today, days: [{ day, date }] }`: los días con instantánea (R-009) |
| `GET /api/days/:day/citizens`, `GET /api/days/:day/citizens/:id` | posiciones y ficha de ese día, desde su instantánea (R-009) |
| `GET /api/metrics` | `{ days: [{ day, date, n, mood, moodSd, stress, stressSd, money, saturated }], events: { TIPO: número por día }, alerts: [{ metric, kind, note }] }` (R-010) |
| `GET /api/export/trajectory.csv`, `GET /api/export/events.csv` | CSV en streaming de la trayectoria y del registro (R-011) |
| `GET /api/citizens/:id` | ficha: identidad, edad, ocupación, hogar, dinero, actividad, lugar, estado, necesidades, emociones, descriptores de temperamento, estados aprendidos, funciones y respuestas más fuertes, reglas (tipo y aporte), relaciones, vínculos, creencias y últimos 20 eventos; desde la v0.4, `home`, `district`, `until` y `aboutMe` (lo que otros creen de la persona, R-014) |
| `GET /api/citizens/:id/dossier?limit=N` | expediente (R-015; `limit` de 20 a 5000, 150 por defecto: la historia de origen entera y los últimos N eventos de la simulación, con `omitted` por los que quedan fuera): `identity` (nacimiento, lugar, estudios, llegada, hogar), `why` (los hechos que explican dónde está), `until`, `agenda` (`blocks` de 0 a 24 h con su clase, `now`, `free`), `family` (padres, pareja, hijos y hermanos con su situación), `health` (régimen, condiciones, enfermedades, veces dormido de más), `objects`, `debts`, `events` (todos, con `origin` = historia de origen) y `counts` |
| `GET /api/demographics?period=month\|year\|all` | demografía (R-016): personas, mujeres y hombres, `births` y `deaths` del periodo con su tasa por mil, `households` con su tamaño medio, `organizations`, `pyramid` (9 grupos de edad × sexo), `occupations` y `now` (trabajando, en clase, en casa, en la calle, en otro lugar); 400 con otro periodo |
| `GET /api/events?since=&limit=` | los últimos `limit` (≤ 200) o los posteriores a `since`; cada evento lleva `text` (con lugares, organizaciones y temas de rumor en palabras) y `names` (el nombre de cada persona que menciona) |
| `GET /api/stream` | SSE: `tick` (`{ now, date, status, moves }`, con los viajes nuevos, R-012) y `event` con `id` = id del evento; `Last-Event-ID` recupera los perdidos |
| `POST /api/control` | `{ cmd: pause\|resume\|speed\|step\|advance, arg? }` con basic auth → `{ queued }`; `advance` solo con 1440, 10080, 43200, 129600, 259200 o 525600 minutos (1 día, 1 semana, 1 mes, 3 meses, 6 meses o 1 año; si no, 400) |

Código: `buildApi(opts)` → `{ app, reader, poll, close }` (`server.ts`); `WorldReader` (`reader.ts`); vistas puras `positions`, `placePoint`, `worldView`, `citizenDetail`, `eventView`, `dateOf` (`views.ts`).

## 4. Diseño interno y decisiones
- **Lectura:** conexión de solo lectura (`openReadonly`); el mundo se recarga con `WorldRepository.loadWorld` solo cuando cambia el minuto persistido (`meta.now`), que `poll` consulta cada segundo (R-006). Las rutas no leen el reloj; `main.ts` sí, para el sondeo, y la hora de las órdenes de control se inyecta (`clock`).
- **Posición (R-005):** puerta del lugar, o la del edificio que la contiene, o el centro de su área; en viaje, interpolación lineal entre las puertas según `trip.departAt`/`trip.arriveAt`. Un lugar fuera del mapa da `x = y = null`.
- **SSE:** cada cliente guarda el último id enviado; en cada recarga recibe `tick` y los eventos posteriores (hasta 200). Sin `Last-Event-ID`, empieza por el último evento guardado.
- **Controles:** la orden se escribe con una conexión de escritura breve (`openWorldDb`) en `control_commands`, que atiende el worker (027). La velocidad vigente sale del último `SPEED_CHANGED`.
- **Días pasados (R-009):** `days.ts` carga la instantánea del día con `repo.loadSnapshot(at)` y guarda las dos últimas en una caché LRU (`DAY_CACHE = 2`, ≈ 5 MB cada una); las vistas son las mismas que las del presente.
- **Métricas (R-010):** `metricsFrom` es pura. La fila de trayectoria del día d se guarda a las 00:00 del día d, así que es el cierre del día d − 1: cada punto lleva la fecha y los eventos de ese día cerrado. Alertas con los umbrales `ALERTS` (desviación < 0,01, más de la mitad pegada a 0 o 1, 30 días subiendo sin parar).
- **Exportación (R-011):** `Readable.from` sobre `iterate()` de SQLite: el CSV de un año no se carga entero en memoria.
- **Observación (v0.4, `observe.ts`):**
  - **Viajes:** cada `tick` del SSE lleva los viajes que llegan después del tick anterior; el visor descarta los repetidos.
  - **Indicadores:** `statsOf` cuenta el empleo como el prototipo: de las personas de 18 a 64 años que no estudian ni están pensionadas.
  - **Lo que otros creen:** `aboutMe` agrupa por tema las creencias de los demás sobre la persona, con su verdad (`beliefTruth`).
  - **Verdad de las creencias:** para decidirla se leen solo los eventos de los tipos que hacen verdad un tema (`TRUTH_TYPES`), una vez por persona y petición. Antes se leían todos: la ficha tardaba 1,8 s y ahora 13 ms, junto con el índice de la migración 005.
- **Expediente y demografía (v0.5, `dossier.ts`, `demographics.ts`):**
  - La agenda es el plan del día de la 011 (`planAt`) en casillas de 10 minutos, con los viajes del día encima como desplazamiento, agrupada en bloques contiguos.
  - La historia de origen son los eventos con minuto negativo (030); la simulación, el resto.
  - La familia usa `relatives` de `life.ts` (ahora exportada) y se queda con el primer grado.
  - Nacidos y fallecidos cuentan `CITIZEN_BORN` y `CITIZEN_DIED` en el periodo; «desde la fundación» incluye la historia de origen.
  - «Ahora» pone a cada persona en una sola categoría: en camino o en un espacio público, «en la calle»; trabajando; estudiando; en su vivienda; o en otro lugar.
- **Acceso sin `WWW-Authenticate`.** Los 401 de los controles y de la charla no llevan esa cabecera: con ella, el navegador abría su propia ventana de acceso y la petición del visor quedaba colgada. Las credenciales las pide el visor.
- **Dependencias:** Fastify (ADR-001) y Zod para validar las entradas (R-002). Memoria del proceso: el mundo cargado (≈ 5 MB con 254 personas) más Fastify.

## 5. Invariantes y guardarraíles
Nunca muta el estado del mundo: solo lee, salvo `control_commands`. Solo escucha en `127.0.0.1`.

## 6. Cómo se prueba
`src/api.test.ts` (6 pruebas) sobre una copia del mundo de ejemplo de M2: CA-001 (salud < 50 ms), mapa y lugares, CA-004 (la ficha coincide con la base y las posiciones con la R-005), eventos, CA-003 (401, orden encolada, 503 sin credenciales) y CA-002 (SSE con `Last-Event-ID`); desde M4 también CA-005 (ficha del lugar) y CA-006 (un día pasado coincide con su instantánea). `src/metrics.test.ts` (3 pruebas): CA-007 (medias, desviación y alertas) y CA-008 (el CSV de eventos tiene una fila por evento). `src/observe.test.ts` (3 pruebas): CA-009 (viajes), CA-010 (indicadores y `advance` no admitido) y CA-011 (`aboutMe` y personal).

## 7. Paridad con el prototipo
Expone lo que el inspector del prototipo muestra (menos relaciones, memoria y creencias, que llegan con M3), más la capa funcional.

## 8. Pendientes y deuda
- [x] `/api/events/:id/why` (019), informe de vida (020), exportación CSV y métricas (M4).
- [x] Viajes por las calles: la API da el viaje y el visor traza la ruta (M4).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-23 | kit de arranque | — | Documento creado (sin código) |
| 2026-09-23 | m0/a-tooling (A5) | — | Solo `package.json` del workspace. Sin `src/` hasta que su spec esté aprobada (el guardarraíl lo bloquea) |
| 2026-09-26 | visor/minimo (V1) | 022 | Primera implementación: `views.ts`, `reader.ts`, `server.ts` (Fastify, SSE, controles con basic auth) y `main.ts`. Dependencias: `fastify`, `zod`, `@datas-world/engine` |
| 2026-09-27 | charla/l3-mundo (L3) | 043, 026, 022 | Charla con ciudadanos (`chat.ts`): rutas `/api/chat/sessions` para abrir, turnos por SSE (`stance` → `token` → `done`), cerrar, consultar y listar, todas con basic auth. La charla en el mundo encola `chat_open` y `chat_session` para el worker y pone el tiempo real mientras dura. `sweep` cierra por inactividad o por compromiso. Pasarela de fábrica con `config/llm.json`, cliente de Anthropic creado al primer uso y `llm_records` en SQLite. Conexión de escritura solo para los datos del laboratorio y las órdenes. Dependencias nuevas: `@datas-world/llm-gateway` y `@datas-world/generators` (catálogos y ontología). 4 pruebas (043 CA-001, CA-015, CA-017, CA-018) |
| 2026-09-27 | charla/l4 (L4.3) | 043 | La apertura en el mundo espera al evento `CONVERSATION_STARTED` o `CONVERSATION_DECLINED`, no solo a la orden: el worker marca la orden antes de guardar sus eventos (lo descubrió la prueba de humo con worker y API reales) |
| 2026-09-27 | claude/wonderful-carson-4c4i3k (arreglo de la charla) | 043 | Un fallo al recargar el mundo ya no tumba la API (`poll` y `sweep` lo registran y reintentan). El cierre siempre termina la charla aunque falle el resumen (`ChatSession.input()`). Al arrancar, las charlas que quedaron abiertas se cierran con motivo `interrupted` y, en el mundo, se consolidan con sus turnos guardados (R-019.6). El 409 dice qué charla está abierta (`openSessionId`), y la velocidad anterior se guarda en `CHAT_SESSION_STARTED` para restaurarla. 1 prueba nueva |
| 2026-09-27 | claude/wonderful-carson-4c4i3k (charla sustituida) | 043 | Abrir otra charla en el mundo ya no responde 409: cierra la anterior (viva o huérfana) con motivo `replaced`, la consolida y hereda su velocidad previa para restaurarla al final. Solo hay 409 si la anterior está a mitad de un turno. CA-015 lo prueba |
| 2026-09-27 | charla/l5 (L5.2) | 044 | El evento SSE `stance` lleva las afirmaciones evaluadas (`claims`: de quién, credibilidad, impacto o motivo del descarte) y se guardan en el turno del visitante. Las validadas viajan en la entrada `chat_session` para el worker (044 R-010) |
| 2026-09-28 | mf/7-desarrollo (MF7.6) | 041, 022 | Ruta nueva `GET /api/citizens/:id/life` (`life.ts`): los episodios del desarrollo por etapa (fecha, edad, quién intervino, texto del catálogo, lo aprendido en palabras y el hecho que lo causó) y el familiograma extenso (bisabuelos a hijos, con generación, años, si vive fuera del mundo y calidad de la relación por los episodios en que intervino). `nameOf` se exporta. `life.test.ts` (3 pruebas, 041 CA-005 y CA-006) sobre un mundo generado al vuelo: con el registro completo, un mundo de ejemplo pesaría ≈ 25 MB |
| 2026-09-28 | m3/relaciones (R6) | 012, 022 | La ficha del ciudadano lleva `bonds` (los 15 de más trato: etiquetas, trato, tensión, confianza, encuentros y el afecto de cada lado, cada uno de su almacén) y `attachment` (apego como métrica, P4) |
| 2026-09-29 | m3/memoria (M6) | 013, 022 | `GET /api/citizens/:id/life` añade `chapters` (tema, fechas, edad, tono y el hecho que lo abrió) y `memories` (texto, fuente, valencia de hoy y de entonces, intensidad, repasos y capítulo). Carga también los eventos de los recuerdos y de los capítulos |
| 2026-09-29 | m3/causalidad (C3) | 019, 022 | Ruta nueva `GET /api/events/:id/why?depth=4` (1 a 6): el árbol de causas (`why` del motor) con nombres y la fecha de cada hecho; 400 si el id no es válido y 404 si no existe. 1 prueba |
| 2026-09-29 | m3/historia (H3) | 020, 022 | Ruta nueva `GET /api/citizens/:id/report`: el informe de vida (`lifeReport` del motor) con la trayectoria guardada, y la fecha y el texto de cada hecho citado. 1 prueba |
| 2026-09-29 | m3/creencias (K3) | 025, 022 | La ficha del ciudadano lleva `beliefs`: lo que cree de otros (tema, de quién lo sabe, credibilidad y bocas) y, solo para quien observa, si es verdad (`beliefTruth` con los hechos de esa persona, 025 R-008) |
| 2026-09-29 | m4/observacion (O1–O4) | 022 | Rutas nuevas: `/api/places/:id` (`places.ts`, R-007), `/api/days` y los días pasados (`days.ts`, R-009, caché de 2 instantáneas), `/api/metrics` y la exportación CSV en streaming (`metrics.ts`, R-010 y R-011). Las posiciones llevan `age` y `trip` (R-008). Las métricas asignan a cada punto de trayectoria los eventos del día que cierra. 4 pruebas nuevas (CA-005 a CA-008) |
| 2026-09-29 | m4/observacion (paridad, P1–P4) | 022, 024 | `observe.ts`: `/api/moves`, viajes en cada `tick` del SSE, `/api/stats` con el avance en curso, `aboutMe` y vivienda, barrio y «hasta cuándo» en la ficha; personal en la ficha del lugar; `advance` en `/api/control`. `/api/world` añade `points` y `names`; las posiciones, `homeId`; los eventos, `text` legible y `names`. La verdad de las creencias lee solo los tipos de evento que la deciden (1,8 s → 13 ms). Los 401 sin `WWW-Authenticate` (el navegador abría su ventana de acceso). 3 pruebas nuevas (CA-009 a CA-011) |
| 2026-09-30 | m4/visor-a-plus | 022 | Rutas nuevas `GET /api/citizens/:id/dossier` (`dossier.ts`, R-015) y `GET /api/demographics` (`demographics.ts`, R-016) para el expediente y el dashboard del Visor A+. `relatives` de `life.ts` se exporta. `dossier.test.ts`: 4 pruebas (CA-012, CA-013 y la CA-016 de la 024) |
| 2026-10-05 | m4/visor-datas-world (T2) | 022, 024 | `/api/citizens` añade `occupation` y `stratum` (R-017, CA-014) para el filtro de cohorte del visor; `OCCUPATIONS` y `occupationOf` pasan de `demographics.ts` a `views.ts` (se reexportan) para no crear un ciclo. Prueba nueva en `api.test.ts` |
| 2026-10-05 | m4/visor-datas-world (T6) | 022 | `/api/citizens/:id/dossier` acepta `limit` y devuelve `omitted` (R-015, CA-015): los recuentos, la salud y la llegada se calculan con todos los eventos. `advance` admite también 3 y 6 meses (`ADVANCE_MINUTES`, R-013). Prueba nueva en `dossier.test.ts` |
