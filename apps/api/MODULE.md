---
modulo: api
ruta: apps/api
estado: en-desarrollo
specs: [022, 043, 026]
actualizado: 2026-09-26
---

# Módulo: api

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
HTTP de consulta y SSE sobre la base que escribe el worker; controles de tiempo escritos en `control_commands`. No muta el estado del mundo (022 R-001). Versión mínima adelantada (bloque V).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 022 | CA-001 a CA-004; R-001 a R-006 | Árbol causal, informe de vida, exportación CSV y métricas de degeneración (M4) |

## 3. API pública
Proceso: `pnpm api [--db data/world.db] [--port 8787]` (`src/main.ts`). Controles con `DATAS_WORLD_USER` y `DATAS_WORLD_PASSWORD`; sin ellas, desactivados (503).

| Ruta | Respuesta |
|---|---|
| `GET /api/health` | `{ now, date, status, speed, citizens, rssMb, dbMb }` |
| `GET /api/world` | `{ name, now, date, epoch, status, geo: { width, height, tiles[] }, places: [{ id, kind, name, rect?, door?, open }], population }` |
| `GET /api/citizens` | posiciones: `[{ id, name, x, y, activity, placeId, moving, mood }]` (R-005) |
| `GET /api/citizens/:id` | ficha: identidad, edad, ocupación, hogar, dinero, actividad, lugar, estado, necesidades, emociones, descriptores de temperamento, estados aprendidos, funciones y respuestas más fuertes, reglas (tipo y aporte), relaciones y últimos 20 eventos |
| `GET /api/events?since=&limit=` | los últimos `limit` (≤ 200) o los posteriores a `since` |
| `GET /api/stream` | SSE: `tick` (`{ now, date, status }`) y `event` con `id` = id del evento; `Last-Event-ID` recupera los perdidos |
| `POST /api/control` | `{ cmd: pause\|resume\|speed\|step, arg? }` con basic auth → `{ queued }` |

Código: `buildApi(opts)` → `{ app, reader, poll, close }` (`server.ts`); `WorldReader` (`reader.ts`); vistas puras `positions`, `placePoint`, `worldView`, `citizenDetail`, `eventView`, `dateOf` (`views.ts`).

## 4. Diseño interno y decisiones
- **Lectura:** conexión de solo lectura (`openReadonly`); el mundo se recarga con `WorldRepository.loadWorld` solo cuando cambia el minuto persistido (`meta.now`), que `poll` consulta cada segundo (R-006). Las rutas no leen el reloj; `main.ts` sí, para el sondeo, y la hora de las órdenes de control se inyecta (`clock`).
- **Posición (R-005):** puerta del lugar, o la del edificio que la contiene, o el centro de su área; en viaje, interpolación lineal entre las puertas según `trip.departAt`/`trip.arriveAt`. Un lugar fuera del mapa da `x = y = null`.
- **SSE:** cada cliente guarda el último id enviado; en cada recarga recibe `tick` y los eventos posteriores (hasta 200). Sin `Last-Event-ID`, empieza por el último evento guardado.
- **Controles:** la orden se escribe con una conexión de escritura breve (`openWorldDb`) en `control_commands`, que atiende el worker (027). La velocidad vigente sale del último `SPEED_CHANGED`.
- **Dependencias:** Fastify (ADR-001) y Zod para validar las entradas (R-002). Memoria del proceso: el mundo cargado (≈ 5 MB con 254 personas) más Fastify.

## 5. Invariantes y guardarraíles
Nunca muta el estado del mundo: solo lee, salvo `control_commands`. Solo escucha en `127.0.0.1`.

## 6. Cómo se prueba
`src/api.test.ts` (6 pruebas) sobre una copia del mundo de ejemplo de M2: CA-001 (salud < 50 ms), mapa y lugares, CA-004 (la ficha coincide con la base y las posiciones con la R-005), eventos, CA-003 (401, orden encolada, 503 sin credenciales) y CA-002 (SSE con `Last-Event-ID`).

## 7. Paridad con el prototipo
Expone lo que el inspector del prototipo muestra (menos relaciones, memoria y creencias, que llegan con M3), más la capa funcional.

## 8. Pendientes y deuda
- [ ] `/api/events/:id/why` (019), informe de vida (020), exportación CSV y métricas (M4).
- [ ] Viajes por las calles (hoy, línea recta).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-23 | kit de arranque | — | Documento creado (sin código) |
| 2026-09-23 | m0/a-tooling (A5) | — | Solo `package.json` del workspace. Sin `src/` hasta que su spec esté aprobada (el guardarraíl lo bloquea) |
| 2026-09-26 | visor/minimo (V1) | 022 | Primera implementación: `views.ts`, `reader.ts`, `server.ts` (Fastify, SSE, controles con basic auth) y `main.ts`. Dependencias: `fastify`, `zod`, `@datas-world/engine` |
| 2026-09-27 | charla/l3-mundo (L3) | 043, 026, 022 | Charla con ciudadanos (`chat.ts`): rutas `/api/chat/sessions` para abrir, turnos por SSE (`stance` → `token` → `done`), cerrar, consultar y listar, todas con basic auth. La charla en el mundo encola `chat_open` y `chat_session` para el worker y pone el tiempo real mientras dura. `sweep` cierra por inactividad o por compromiso. Pasarela de fábrica con `config/llm.json`, cliente de Anthropic creado al primer uso y `llm_records` en SQLite. Conexión de escritura solo para los datos del laboratorio y las órdenes. Dependencias nuevas: `@datas-world/llm-gateway` y `@datas-world/generators` (catálogos y ontología). 4 pruebas (043 CA-001, CA-015, CA-017, CA-018) |
| 2026-09-27 | charla/l4 (L4.3) | 043 | La apertura en el mundo espera al evento `CONVERSATION_STARTED` o `CONVERSATION_DECLINED`, no solo a la orden: el worker marca la orden antes de guardar sus eventos (lo descubrió la prueba de humo con worker y API reales) |
| 2026-09-27 | claude/wonderful-carson-4c4i3k (arreglo de la charla) | 043 | Un fallo al recargar el mundo ya no tumba la API (`poll` y `sweep` lo registran y reintentan). El cierre siempre termina la charla aunque falle el resumen (`ChatSession.input()`). Al arrancar, las charlas que quedaron abiertas se cierran con motivo `interrupted` y, en el mundo, se consolidan con sus turnos guardados (R-019.6). El 409 dice qué charla está abierta (`openSessionId`), y la velocidad anterior se guarda en `CHAT_SESSION_STARTED` para restaurarla. 1 prueba nueva |
