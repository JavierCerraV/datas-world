---
modulo: web
ruta: apps/web
estado: en-desarrollo
specs: [024, 022, 043, 044, 041]
actualizado: 2026-09-27
---

# Módulo: web

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Visor pixel art y paneles de observación. Solo lee de la API (022) y no tiene lógica de simulación (024 INV-002). Versión mínima adelantada (bloque V).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 024 | CA-002, CA-004 a CA-008 con pruebas; CA-001 y CA-003 aceptados por el usuario (2026-09-27); R-001 a R-012 | Revisión del usuario de CA-001 y CA-003 con el detalle de M4 |

## 3. API pública
Aplicación: `pnpm dev` (worker + API + visor; `scripts/dev.mjs`) y abrir `http://127.0.0.1:5180` (puerto propio, `DATAS_WORLD_WEB_PORT` para cambiarlo). Solo el visor: `pnpm --filter @datas-world/web dev` (necesita la API en el puerto 8787).

| Archivo | Contenido |
|---|---|
| `index.html`, `src/style.css` | Estructura y estilos: cabecera, mapa con controles, panel lateral (inspector y registro); hoja inferior por debajo de 700 px |
| `src/types.ts` | Tipos de las respuestas de la API |
| `src/api.ts` | `api.*` (fetch), `stream` (EventSource: `tick` y `event`) y `control` (basic auth) |
| `src/logic.ts` | Lógica pura: `TILE_COLORS`, `styleOf`, `hash`, `lookOf` (R-006), `nightAlpha` (R-007), `timeOf`, `interpolate` (R-002), `spread` |
| `src/format.ts` | Formateo en español: `ACTIVITY_ES`, `EVENT_ES`, `stimulusEs`, `causeEs`, `eventEs`, `inspectorTabs` (R-003) |
| `src/render.ts` | Canvas: `drawMap` (tiles, árboles, parques, plazas y edificios con su adorno, una vez) y `drawPerson` |
| `src/scenery.ts` | Detalle del prototipo, puro (R-012): `treeSpots`, `parkTrees`, `decorOf`, `TREE_DENSITY` |
| `src/panels.ts` | Panel de población y ficha del lugar (R-008): `populationRows`, `populationHtml`, `placeHtml`, `moodColor`, `placeAt`, `setupPeoplePanel` |
| `src/streets.ts` | Recorridos por las calles (R-009): `streetPath` (BFS por calles y plazas), `alongPath`, `routeCache`, `onTheWay` |
| `src/timeline.ts` | Línea temporal (R-010): `momentAt`, `urlsFor`, `banner`, `setupTimeline` |
| `src/world-panel.ts` | Panel del mundo (R-011): `lineChart`, `renderWorldPanel`, `topEvents`, `labelYs`, `bindChartHover`, `setupWorldPanel` |
| `src/input.ts` | Arrastre, rueda y clic sobre el mapa: `setupMapInput` |
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
- **Población y lugares (R-008):** el panel lateral lista a todos con un punto del color de su ánimo (rojo a verde) y un buscador sin tildes; se oculta mientras hay una ficha abierta. Un clic en el mapa abre la persona más cercana o, si no hay, la ficha del lugar.
- **Calles (R-009):** la API da el viaje (puertas y horas); el cliente traza la ruta por calles con un BFS sobre el mapa, la guarda en caché por par de puertas y coloca a la persona según la hora. Solo es dibujo: el motor no cambia.
- **Línea temporal (R-010):** el deslizador elige un día con instantánea; en el pasado las posiciones y las fichas salen de `/api/days/:day/…`, el tick no las refresca y un aviso dice qué día se ve. «Presente» vuelve al vivo.
- **Panel del mundo (R-011):** diálogo desde el botón «Mundo». Tres gráficas SVG de líneas, cada una con un solo eje: ánimo y estrés con su franja de ± desviación, la mediana del dinero y los 5 tipos de evento más frecuentes. Llevan leyenda con 2 o más series y etiqueta directa hasta 4, separadas 12 px. Al pasar el ratón, un cursor con tooltip. Además, la tabla de los últimos 14 días, las alertas y los enlaces CSV. Colores categóricos en orden fijo (`--series-1…5`): se validaron con el script de paleta en claro y en oscuro. En claro, 4 tonos quedan por debajo de 3:1 contra el panel, y lo compensan las etiquetas directas y la tabla.
- **Detalle del prototipo (R-012):** árboles sueltos en la hierba lejos de calles y edificios (densidad 0,22), motas de hierba y bordillo hacia la calle; parques con senderos en cruz, estanque, árboles y bancos; plazas adoquinadas; edificios con tejado a franjas, alero, toldo en comercio y ocio, y el adorno de su tipo (cruz, chimenea, bandera, pesas). El azar del prototipo se sustituye por un hash de la posición o del id: el mapa sale igual en cada carga.
- **Dependencia:** Vite (ADR-001), solo de desarrollo. El visor construido pesa ≈ 16 KB de JS.

## 5. Invariantes y guardarraíles
Solo lee: la única escritura es pedir órdenes de control a la API (022 R-001). Sin lógica de simulación.

## 6. Cómo se prueba
`src/web.test.ts` (6 pruebas): CA-004 (aspecto por id, velo nocturno, interpolación, reparto en puertas, estilos) y CA-002 (las pestañas del inspector muestran los valores de una ficha de ejemplo; estímulos, causas y eventos legibles). Desde M4: `panels.test.ts` (CA-005 recorrido por calles, CA-006 población y lugar), `timeline.test.ts` (CA-007), `world-panel.test.ts` (CA-008, 3 pruebas) y `scenery.test.ts` (R-012, 3 pruebas). Capturas con Edge sin ventana del mapa y del panel en claro y oscuro, y medida del coste por cuadro con 500 figuras (`docs/validaciones/M4-observacion.md`). Prueba de humo manual de `pnpm dev`: se crea el mundo, el worker avanza, la API y el visor responden, la orden de velocidad se aplica y el cierre es limpio.

## 7. Paridad con el prototipo
Mapa, colores, figuras y día y noche portados del prototipo (`prototipo/index.html`). Desde M4 también los árboles, parques y adornos de los edificios, y los viajes por las calles. Diferencias: el inspector añade la pestaña Funcional; los árboles y los bancos salen de un hash y no del RNG del prototipo; la carretera no lleva la línea discontinua central, porque el mapa ya no es una rejilla fija de calles.

## 8. Pendientes y deuda
- [x] CA-001 y CA-003: aceptados en la revisión del usuario (2026-09-27).
- [x] Recorridos por las calles, línea temporal navegable y pestañas de M3 (M4).
- [ ] Revisión del usuario de CA-001 (fps con 500 personas; medido: 2,2 ms por cuadro) y CA-003 con el detalle nuevo.
- [ ] 500 personas reales: el generador llega hoy a 254 con el mapa actual.

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
| 2026-09-28 | mf/7-desarrollo (MF7.6) | 041, 024 | Pestaña **Vida** en la ficha (`life.ts`, decisión del usuario): familiograma extenso en SVG (cuadrado hombre, círculo mujer, borde doble la persona, cruz si murió, borde punteado si vive fuera del mundo; relación verde cercana, roja en zigzag conflictiva, gris punteada distante) y la historia de vida por etapas, desplegables, con quién intervino, lo aprendido y la causa. Se carga al entrar en la pestaña. 2 pruebas |
| 2026-09-28 | m3/relaciones (R6) | 012, 024 | Sección **Vínculos** en el estado de la ficha (quién, etiquetas, trato, afecto suyo y de vuelta, tensión si la hay) y **Apego** en lo funcional (estilo, seguridad, evitación). Textos de los eventos de relación. Campos opcionales para mundos anteriores a M3. 1 prueba |
| 2026-09-29 | m3/memoria (M6) | 013, 024 | Pestaña **Vida**: «Lo que recuerda, por etapas de su vida» (capítulos con su tono y sus recuerdos, marcando si lo recuerda peor o mejor de lo que lo vivió) antes de la historia de desarrollo, que pasa a llamarse «lo que vivió» (`renderMemory`). 1 prueba |
| 2026-09-29 | m3/causalidad (C3) | 019, 024 | «¿por qué?» desplegable en cada evento de la pestaña Historia (`why.ts`): carga `/api/events/:id/why` al abrirlo y guarda el árbol y los abiertos, porque la ficha se repinta con cada tick. Hechos con fecha y peso; estados y fuentes en cursiva. 2 pruebas |
| 2026-09-29 | m3/historia (H3) | 020, 024 | Sección **Informe** al principio de la pestaña Vida (`report.ts`): gráfica del ánimo y el estrés por día (SVG), etapas vividas y recordadas lado a lado, diferencias, lo que cambió su vida con su «¿por qué?» y el perfil con barras («sin datos» si no hay base). Se carga aparte de la historia. 2 pruebas |
| 2026-09-29 | m3/creencias (K3) | 025, 024 | Sección **Lo que cree de otros** en el estado de la ficha: de quién, qué, de quién lo sabe, cuánto lo cree y si es verdadero o falso (para quien observa). 1 prueba |
| 2026-09-29 | m4/observacion (O1–O5) | 024, 022 | Ampliación de M4 (P1 a P5): panel de población con buscador y color de ánimo, ficha del lugar al hacer clic (`panels.ts`, `input.ts`, R-008); personas que caminan por las calles (`streets.ts`, R-009); línea temporal con los días pasados (`timeline.ts`, R-010); panel del mundo con gráficas, alertas y CSV (`world-panel.ts`, R-011); árboles, parques, plazas y adornos del prototipo (`scenery.ts`, `render.ts`, R-012). Con 500 figuras, 2,2 ms por cuadro. 12 pruebas nuevas (CA-005 a CA-008 y R-012) |
