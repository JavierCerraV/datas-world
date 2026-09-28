---
modulo: web
ruta: apps/web
estado: en-desarrollo
specs: [024, 022, 043, 044]
actualizado: 2026-09-27
---

# Módulo: web

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Visor pixel art y paneles de observación. Solo lee de la API (022) y no tiene lógica de simulación (024 INV-002). Versión mínima adelantada (bloque V).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 024 | CA-002 y CA-004 con pruebas; CA-001 y CA-003 aceptados por el usuario (2026-09-27); R-001 a R-007 | Línea temporal navegable, recorridos por las calles y pestañas de M3 (M4) |

## 3. API pública
Aplicación: `pnpm dev` (worker + API + visor; `scripts/dev.mjs`) y abrir `http://127.0.0.1:5180` (puerto propio, `DATAS_WORLD_WEB_PORT` para cambiarlo). Solo el visor: `pnpm --filter @datas-world/web dev` (necesita la API en el puerto 8787).

| Archivo | Contenido |
|---|---|
| `index.html`, `src/style.css` | Estructura y estilos: cabecera, mapa con controles, panel lateral (inspector y registro); hoja inferior por debajo de 700 px |
| `src/types.ts` | Tipos de las respuestas de la API |
| `src/api.ts` | `api.*` (fetch), `stream` (EventSource: `tick` y `event`) y `control` (basic auth) |
| `src/logic.ts` | Lógica pura: `TILE_COLORS`, `styleOf`, `hash`, `lookOf` (R-006), `nightAlpha` (R-007), `timeOf`, `interpolate` (R-002), `spread` |
| `src/format.ts` | Formateo en español: `ACTIVITY_ES`, `EVENT_ES`, `stimulusEs`, `causeEs`, `eventEs`, `inspectorTabs` (R-003) |
| `src/render.ts` | Canvas: `drawMap` (tiles y edificios, una vez) y `drawPerson` |
| `src/chat.ts`, `src/chat-ui.ts` | Charla (043 R-017): cliente de `/api/chat/*`, formato y diálogo |
| `src/chat-history.ts` | Pestaña «Charlas» de la ficha: `renderChatList`, `renderTranscript`, `showChatHistory` (carga cada transcripción al desplegarla) |
| `src/main.ts` | Aplicación: cámara (arrastrar, rueda, flechas), clic en una persona, inspector, registro, controles y teclado (R-005) |
| `vite.config.ts` | Vite con proxy de `/api` a la API local |

## 4. Diseño interno y decisiones
- **Mapa:** se pinta una vez en un lienzo aparte a 8 px por tile con los colores del prototipo (tiles y estilos de edificio por tipo de lugar) y cada cuadro lo copia escalado por un entero (1–6), sin suavizado.
- **Personas:** figura de 3 × 6 px con colores elegidos por un hash FNV-1a del id (estable, sin azar). Posición interpolada durante 1 s entre dos actualizaciones; varias personas en la misma puerta se reparten en un círculo pequeño para verse.
- **En vivo:** `EventSource` a `/api/stream`. Cada `tick` pide `/api/citizens` y, si hay una ficha abierta, la refresca. El registro muestra los eventos, salvo `DAY_STARTED` y `TRIP_TAKEN`, que serían ruido.
- **Controles:** pausa, paso y velocidad envían órdenes a `/api/control`. Si responde 401, se piden usuario y contraseña, que quedan en `sessionStorage` solo durante la sesión.
- **Tipos:** `tsconfig.json` propio con los tipos del navegador (`DOM`); el de la raíz excluye `apps/web`. `pnpm typecheck` revisa los dos. ESLint usa los globales del navegador en `apps/web/src`.
- **Dependencia:** Vite (ADR-001), solo de desarrollo. El visor construido pesa ≈ 16 KB de JS.

## 5. Invariantes y guardarraíles
Solo lee: la única escritura es pedir órdenes de control a la API (022 R-001). Sin lógica de simulación.

## 6. Cómo se prueba
`src/web.test.ts` (6 pruebas): CA-004 (aspecto por id, velo nocturno, interpolación, reparto en puertas, estilos) y CA-002 (las pestañas del inspector muestran los valores de una ficha de ejemplo; estímulos, causas y eventos legibles). Prueba de humo manual de `pnpm dev`: se crea el mundo, el worker avanza, la API y el visor responden, la orden de velocidad se aplica y el cierre es limpio.

## 7. Paridad con el prototipo
Mapa, colores, figuras y día y noche portados del prototipo (`prototipo/index.html`). Diferencias: los viajes van en línea recta; el inspector añade la pestaña Funcional y aún no tiene Relaciones, Memoria ni Creencias.

## 8. Pendientes y deuda
- [x] CA-001 y CA-003: aceptados en la revisión del usuario (2026-09-27).
- [ ] Recorridos por las calles, línea temporal navegable y pestañas de M3 (M4).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-23 | kit de arranque | — | Documento creado (sin código) |
| 2026-09-23 | m0/a-tooling (A5) | — | Solo `package.json` del workspace. Sin `src/` hasta que su spec esté aprobada (el guardarraíl lo bloquea) |
| 2026-09-26 | visor/web (V2) | 024, 022 | Primera implementación del visor mínimo: mapa, personas, día y noche, cámara, inspector (Estado, Historia, Funcional), registro en vivo, controles y teclado. `pnpm dev` (`scripts/dev.mjs`) |
| 2026-09-27 | visor/web (V2.5) | 024 | CA-001 y CA-003 aceptados en la revisión del usuario |
| 2026-09-27 | charla/l4 (L4.1) | 043, 024 | Vista de chat (`chat.ts`, `chat-ui.ts`): botón «Charlar» en la ficha y diálogo con inicio (modo en el mundo o sandbox, modo prueba), conversación en streaming (SSE sobre `fetch`, porque es un POST), tono y postura de cada turno con sus motivos y probabilidades, marcas de coherencia al llegar la verificación, panel «Lo que sabe» y «Despedirse». Estilo de laboratorio sobre las variables existentes; en móvil ocupa la pantalla. Los atajos del mapa no actúan al escribir ni con la charla abierta. La velocidad de tiempo real entra en la lista de velocidades. 3 pruebas |
| 2026-09-27 | claude/wonderful-carson-4c4i3k (pestaña Charlas) | 043, 024 | Pestaña **Charlas** en la ficha (`chat-history.ts`): charlas guardadas de la persona, la más reciente primero, con fecha, modo y cómo terminó; al desplegar una, su transcripción con el tono y la postura de cada turno. Se carga al entrar en la pestaña, no con cada tick. Si queda otra charla en el mundo abierta, el diálogo ofrece cerrarla. 2 pruebas |
| 2026-09-27 | claude/wonderful-carson-4c4i3k (charla sustituida) | 043 | Cerrar el diálogo por cualquier vía (✕, Esc) o salir de la página termina la charla (`endChat` con `keepalive`). El botón Enviar se reactiva al abrir otra charla (quedaba desactivado tras una despedida). Motivo `replaced` en la pestaña Charlas |
| 2026-09-27 | claude/wonderful-carson-4c4i3k (puerto) | 024 | El visor usa el puerto 5180 (`DATAS_WORLD_WEB_PORT`) con `strictPort`: el 5173 lo ocupaba otro proyecto con Vite y el navegador abría ese. `scripts/dev.mjs` y las guías de uso muestran el puerto nuevo |
| 2026-09-27 | charla/l5 (L5.2) | 044 | El panel «Por qué respondió así» muestra primero lo que oyó sobre un tercero: de quién, qué, cuánto se lo cree y cuánto le afecta, o por qué no cuenta (`claimLine`, 044 R-011). 1 prueba |
