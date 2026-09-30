---
modulo: web
ruta: apps/web
estado: en-desarrollo
specs: [024, 022, 043, 044, 041]
actualizado: 2026-09-29
---

# Módulo: web

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Visor pixel art y paneles de observación, con la disposición y el comportamiento del prototipo (`prototipo/index.html`). Solo lee de la API (022) y no tiene lógica de simulación (024 INV-002). Guía de uso para el equipo: `docs/guia-visor.md`.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 024 | CA-002, CA-004 a CA-012 con pruebas; CA-001 y CA-003 aceptados por el usuario (2026-09-27); R-001 y R-003 a R-019 (la R-002 la sustituye la R-013) | CA-013: revisión del usuario de las capturas lado a lado (`docs/validaciones/M4-paridad-prototipo.md`) |

## 3. API pública
Aplicación: `pnpm dev` (worker + API + visor; `scripts/dev.mjs`) y abrir `http://127.0.0.1:5180` (puerto propio, `DATAS_WORLD_WEB_PORT` para cambiarlo). Solo el visor: `pnpm --filter @datas-world/web dev` (necesita la API en el puerto 8787).

| Archivo | Contenido |
|---|---|
| `index.html`, `src/style.css` | Disposición del prototipo: barra superior, mapa con sus controles, registro bajo el mapa, inspector y panel de charla; colores, fuentes y modo oscuro del prototipo |
| `src/detail.css`, `src/chat.css` | Estilos del informe, familiograma, «¿por qué?», charlas guardadas y panel del mundo; y de la charla |
| `src/main.ts` | Une los módulos: datos iniciales, flujo en vivo (SSE), reloj de vista, teclado |
| `src/types.ts`, `src/api.ts` | Tipos de las respuestas; `api.*` (fetch, también `moves`, `stats`, `metrics`), `stream` (SSE con `Tick.moves`) y `control` |
| `src/auth.ts` | Acceso a los controles con formulario propio (`askAuth`), credenciales de la sesión (`auth`) y envío de órdenes con reintento (`send`) |
| `src/replay.ts` | Reproducción del movimiento (R-013), pura: `MoveBook` (viajes por persona y `where`), `stepView` (reloj de vista), `VIEW_LAG_MAX` |
| `src/scene.ts` | Quién se dibuja y dónde (R-013), pura: `scene`, `spotIn`, `isOutdoor`, `outdoorRects`, `occupancy` |
| `src/camera.ts` | Cámara (R-014), pura: `frameOf`, `toMap`, `clampZoom`; reloj en español: `clockOf` |
| `src/render.ts` | Mapa del prototipo en un lienzo aparte (`drawMap` → `MapLayer` con las ventanas de cada edificio) |
| `src/figures.ts` | Figuras, noche y selección: `drawFigure`, `darkness`, `drawNight`, `drawArrow`, `drawFrame` |
| `src/mapview.ts` | El mapa en vivo (R-013 a R-015): dibujo por cuadro, tooltip, clics, arrastre, rueda, «Seguir» y «Ver todo» |
| `src/scenery.ts` | Detalle del prototipo, puro (R-012): `treeSpots`, `parkTrees`, `decorOf`, `TREE_DENSITY` |
| `src/streets.ts` | Ruta por las calles (R-009): `streetPath` (BFS por calles y plazas), `alongPath`, `routeCache` |
| `src/topbar.ts` | Barra superior (R-014): reloj, Pausar, `SPEEDS`, `ADVANCES` con «Simulando sin observar», indicadores |
| `src/log.ts`, `src/logview.ts` | Registro (R-016): `CATEGORIES`, `kindOf`, `isMinor`, `passes`, `linkNames`, `eventText`, `logRow`; su vista con filtros |
| `src/inspector.ts` | Inspector (R-017): población, ficha del lugar y ficha de la persona con pestañas |
| `src/panels.ts` | Formato de la población y del lugar: `populationRows`, `populationHtml`, `populationIntro`, `doingOf`, `placeHtml`, `kindEs`, `moodColor`, `placeAt` |
| `src/card.ts` | Ficha: `TABS`, `cardHead`, `nowLine`, `tabEstado`, `tabRelaciones`, `tabCreencias`, `tabFuncional`, `bar`, `mini` |
| `src/card-life.ts` | Pestañas que cargan datos aparte: `renderMemories`, `renderHistory`, `renderLifeTab` (subpestañas Informe, Desarrollo, Familia), `LifeData` |
| `src/life.ts`, `src/report.ts`, `src/why.ts` | Familiograma y desarrollo (`renderFamily`, `renderDevelopment`), informe de vida (`renderReport`) y árbol «¿por qué?» |
| `src/chat.ts`, `src/chat-ui.ts`, `src/chat-history.ts` | Charla (043 R-017, 024 R-018): cliente de `/api/chat/*`; panel con burbujas, porqué por respuesta y resumen (`summaryHtml`); pestaña Charlas |
| `src/timeline.ts`, `src/world-panel.ts` | Línea temporal (R-010) y panel del mundo (R-011) |
| `src/format.ts`, `src/logic.ts` | Formato en español (actividades, eventos, causas `causeEs`) y colores y aspecto del prototipo (`styleOf`, `lookOf`, `hash`) |
| `vite.config.ts` | Vite con proxy de `/api` a la API local |

## 4. Diseño interno y decisiones
- **Reproducción del movimiento (R-013).**
  - El visor no dibuja fotos del estado. Lleva un reloj de vista que avanza a la velocidad del mundo, unos segundos detrás del último minuto guardado. Acelera un poco si se queda atrás, se frena si se acerca y nunca pasa del último minuto guardado.
  - Los viajes llegan con cada `tick` del SSE (022 R-012). Con ellos y la posición de partida (`/api/citizens`), `MoveBook.where` dice dónde estaba cada persona en cada minuto.
  - Se dibuja, como el prototipo, solo a quien camina (por las calles, con su paso) o está en un parque o una plaza. Quien está dentro de un edificio no se ve; de noche se encienden las ventanas de los edificios con alguien despierto.
  - Los viajes de más de un día se olvidan, salvo el último de cada persona.
- **Disposición (R-014).** Es la del prototipo: barra superior en dos filas, mapa y registro a la izquierda e inspector de 410 px a la derecha. La charla ocupa esa columna, ensanchada a 520 px, para que el mapa siga a la vista.
  - Fuentes: Atkinson Hyperlegible y Pixelify Sans, de Google Fonts, como el prototipo.
  - La cámara ajusta el mapa a su espacio, con zoom de 1 a 6 sobre el ajuste y escala entera desde ×3.
- **Velocidades.** Son las del motor (002), rotuladas en minutos del mundo por segundo. `pnpm dev` arranca a 1 min/s para que se vea caminar.
- **Avanzar.** Envía la orden `advance`; el progreso sale de `/api/stats`.
- **Accesos.** Los controles y la charla piden las credenciales con un formulario propio, que se guardan solo durante la sesión. La API ya no responde con `WWW-Authenticate`: con esa cabecera, el navegador abría su propia ventana y la petición quedaba colgada.
- **Inspector (R-017).**
  - Se refresca cada segundo: la población con el texto de lo que hace cada uno según el reloj de vista, y la ficha, pedida de nuevo cada 1,5 s.
  - Solo se repinta lo que cambia: se conserva la búsqueda escrita, la pestaña y los «¿por qué?» abiertos.
  - Memoria, Historia y Vida se cargan una vez por persona (`LifeData`).
- **Registro (R-016).**
  - Guarda los últimos 600 eventos y pinta como mucho 150, dos veces por segundo, como el prototipo.
  - Las personas del texto (`EventView.text` con `names`) son botones que abren su ficha.
  - Las posturas de un encuentro y las causas salen en palabras.
- **Tipos y dependencias.**
  - `tsconfig.json` propio con los tipos del navegador (`DOM`); el de la raíz excluye `apps/web`.
  - Vite (ADR-001), solo de desarrollo.

## 5. Invariantes y guardarraíles
Solo lee: la única escritura es pedir órdenes de control y la charla a la API (022 R-001). Sin lógica de simulación: lo que se ve ya pasó en el mundo.

## 6. Cómo se prueba
- **`src/web.test.ts`:**
  - CA-004: aspecto por id, noche del prototipo y estilos;
  - cámara y reloj;
  - CA-002: el inspector muestra una ficha de ejemplo.
- **`src/replay.test.ts`** (CA-009, CA-010): dónde está cada persona antes, durante y después de un viaje; quién se dibuja; ventanas; reloj de vista.
- **`src/log.test.ts`** (CA-011) y **`src/card.test.ts`** (CA-012, las ocho pestañas).
- **`panels.test.ts`:** CA-005, CA-006 y lo que hace cada persona.
- **`timeline.test.ts`** (CA-007), **`world-panel.test.ts`** (CA-008) y **`scenery.test.ts`** (R-012).
- **Prueba de punta a punta con Edge sin ventana** sobre el mundo de demostración: mapa, noche, tooltip, «Seguir», ficha de un lugar, las pestañas, avanzar un día, día pasado, panel del mundo, charla sandbox completa, oscuro y 375 px (`docs/validaciones/M4-paridad-prototipo.md`).

## 7. Paridad con el prototipo
**Se portan del prototipo:**
- la disposición, los colores, las fuentes, el mapa y sus detalles;
- las figuras con su paso y la noche con las ventanas encendidas;
- quién se ve en el mapa, el tooltip, «Seguir» y «Ver todo»;
- el registro con filtros y porqué, la población con lo que hace cada uno y dónde;
- las fichas de persona y lugar, con las pestañas del prototipo (Estado, Relaciones, Memoria, Historia, Creencias).

**Diferencias:**
- Se añaden las pestañas Vida, Funcional y Charlas, el panel del mundo, la línea temporal y la charla.
- No hay «Semilla / Regenerar»: el visor no crea mundos (se hace con la CLI).
- Hay menos gente en la calle que en el prototipo. Es del motor, no del visor: la escala del mapa (8 m por tile frente a ≈ 45 m) y los viajes por persona (unos 0,7 al día). Queda pendiente de decisión del usuario.

## 8. Pendientes y deuda
- [x] CA-001 y CA-003: aceptados en la revisión del usuario (2026-09-27).
- [x] Recorridos por las calles, línea temporal navegable y pestañas de M3 (M4).
- [ ] CA-013: revisión del usuario de la paridad con el prototipo.
- [ ] Decisión del usuario sobre la escala del mapa y los viajes por persona (specs 003, 016 y de rutinas), para que haya tanta gente en la calle como en el prototipo.
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
| 2026-09-29 | m4/observacion (paridad, P1–P6) | 024, 022, 043 | Visor rehecho sobre el prototipo tras la revisión del usuario (024 v0.4). Reproducción del movimiento con reloj de vista y viajes anotados (`replay.ts`, `scene.ts`; sustituye a la interpolación y al reparto en la puerta, que se eliminan de `logic.ts`, y a `input.ts`). Disposición, barra superior con velocidades, «Avanzar» e indicadores (`topbar.ts`), cámara con «Seguir» y «Ver todo» (`camera.ts`, `mapview.ts`), noche con ventanas y selección (`figures.ts`), registro con filtros (`log.ts`, `logview.ts`), inspector con ficha de ocho pestañas y subpestañas de Vida (`inspector.ts`, `card.ts`, `card-life.ts`), formulario de acceso (`auth.ts`) y charla en panel con burbujas, porqué y resumen (`chat-ui.ts`, `chat.css`). 13 pruebas nuevas (CA-009 a CA-012) |
