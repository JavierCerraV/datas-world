---
modulo: web
ruta: apps/web
estado: en-desarrollo
specs: [024, 022, 043, 044, 041]
actualizado: 2026-10-05
---

# Módulo: web

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Visor pixel art y paneles de observación, con el estilo del lienzo aprobado «Visor Data's World» (024 v0.6): barra superior con pestañas, pantalla Mundo, expediente de vida, dashboard y charla. Se implementa por bloques (tareas T1 a T5 de `tasks/M4-observacion.md`); el bloque 1 (estilos y marco) está hecho. Solo lee de la API (022) y no tiene lógica de simulación (024 INV-002). Guía de uso para el equipo: `docs/guia-visor.md`.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 024 | CA-002, CA-004 a CA-012, CA-014 a CA-016 y CA-018 con pruebas; CA-001 y CA-003 aceptados por el usuario (2026-09-27); R-001, R-003 a R-013, R-015, R-016 y R-018 a R-024 (la R-002 la sustituye la R-013; la R-014 y la R-017, la R-021 y la R-022) | CA-019 (cohorte), CA-020 (mazo y fuentes) y CA-021 (revisión visual del usuario frente al lienzo; sustituye a la CA-017); R-026 a R-029 en curso (bloques 2 a 4) |

## 3. API pública
Aplicación: `pnpm dev` (worker + API + visor; `scripts/dev.mjs`) y abrir `http://127.0.0.1:5180` (puerto propio, `DATAS_WORLD_WEB_PORT` para cambiarlo). Solo el visor: `pnpm --filter @datas-world/web dev` (necesita la API en el puerto 8787).

| Archivo | Contenido |
|---|---|
| `src/dw-tokens.css` | **Único archivo con colores** (R-025, CA-018): paleta, radio de 12 px, borde de 3 px, sombra de 5 px y fuentes Lilita One y Nunito; modo oscuro derivado |
| `index.html`, `src/style.css` | Armazón (R-025): barra superior con marca, recursos y controles de tiempo; pestañas Mundo, Expediente, Dashboard y Charla; menú «Más»; botones, segmentos y fichas de recurso |
| `src/expediente.css`, `src/detail.css`, `src/chat.css` | Expediente y dashboard (tarjetas, pestañas, curso de vida, agenda, gráficas); informe, familiograma, «¿por qué?» y series; charla |
| `src/router.ts` | Pantallas por dirección (R-025), puro: `parseRoute`, `hrefOf`, `tabHref` (Expediente y Charla solo con una persona); `setupRouter` |
| `src/main.ts` | Une los módulos y las pantallas: datos iniciales, flujo en vivo (SSE), reloj de vista, tema, teclado |
| `src/types.ts`, `src/api.ts` | Tipos de las respuestas; `api.*` (fetch, también `moves`, `stats`, `metrics`, `dossier`, `demographics`); `dossier-types.ts` con el expediente y la demografía (022 R-015, R-016), `stream` (SSE con `Tick.moves`) y `control` |
| `src/auth.ts` | Acceso a los controles con formulario propio (`askAuth`), credenciales de la sesión (`auth`) y envío de órdenes con reintento (`send`) |
| `src/replay.ts` | Reproducción del movimiento (R-013), pura: `MoveBook` (viajes por persona y `where`), `stepView` (reloj de vista), `VIEW_LAG_MAX` |
| `src/scene.ts` | Quién se dibuja y dónde (R-013), pura: `scene`, `spotIn`, `isOutdoor`, `outdoorRects`, `occupancy` |
| `src/camera.ts` | Cámara (R-014), pura: `frameOf`, `toMap`, `clampZoom`; reloj en español: `clockOf` |
| `src/render.ts` | Mapa del prototipo en un lienzo aparte (`drawMap` → `MapLayer` con las ventanas de cada edificio) |
| `src/figures.ts` | Figuras, noche y selección: `drawFigure`, `darkness`, `drawNight`, `drawArrow`, `drawFrame` |
| `src/mapview.ts` | El mapa en vivo (R-013, R-015, R-021): dibujo por cuadro con las capas, etiqueta de la persona elegida, escala, tooltip, clics, arrastre, rueda, «Seguir» y «Ver todo» |
| `src/overlays.ts` | Capas, panel «Ahora» y escala (R-021): `LAYERS`, `drawPlan`, `nowRows`, `scaleBar` (puros); `setupLayers`, `renderNow`, `renderScale` |
| `src/scenery.ts` | Detalle del prototipo, puro (R-012): `treeSpots`, `parkTrees`, `decorOf`, `TREE_DENSITY` |
| `src/streets.ts` | Ruta por las calles (R-009): `streetPath` (BFS por calles y plazas), `alongPath`, `routeCache` |
| `src/topbar.ts` | Cabecera de Mundo (R-021): fecha y hora, Simulando / En pausa, `SPEEDS`, «+1 día» y `ADVANCES` con «Simulando sin observar», personas, hogares y organizaciones |
| `src/log.ts`, `src/logview.ts` | Registro (R-016): `CATEGORIES`, `kindOf`, `isMinor`, `passes`, `linkNames`, `eventText`, `logRow`, `logTableRow`; su vista en tabla con filtro |
| `src/inspector.ts`, `src/card-compact.ts` | Panel de la derecha (R-021): población, ficha del lugar y ficha compacta (`compactCard`, `criticalNeeds`, `meter`, `whyHere`) |
| `src/panels.ts` | Formato de la población y del lugar: `populationRows`, `populationHtml`, `populationIntro`, `doingOf`, `placeHtml`, `kindEs`, `moodColor`, `placeAt` |
| `src/expediente.ts`, `src/exp-tabs.ts`, `src/exp-tabs2.ts` | Expediente de vida (R-022): cabecera, `identityStrip`, `EXP_TABS` y una función por pestaña (Resumen, Estado, Emociones, Historia, Vínculos, Memoria, Creencias, Aprendizaje, Salud, Economía, Charlas) |
| `src/lifecourse.ts` | Curso de vida del Resumen: `milestones`, `placeLabels`, `lifeCourseSvg` |
| `src/card.ts`, `src/card-life.ts` | Piezas reutilizadas: `tabRelaciones`, `tabCreencias`, `occupationEs`, `mini`; `renderMemories` y `LifeData` |
| `src/dashboard.ts` | Dashboard (R-023): `pyramidSvg`, `occupationSvg`, `niceMax`, `renderDashboard`, `setupDashboard` |
| `src/life.ts`, `src/report.ts`, `src/why.ts` | Familiograma y desarrollo (`renderFamily`, `renderDevelopment`), informe de vida (`renderReport`) y árbol «¿por qué?» |
| `src/chat.ts`, `src/chat-ui.ts`, `src/chat-history.ts` | Charla (043 R-017, 024 R-024): cliente de `/api/chat/*`; pantalla completa con mensajes numerados, panel del porqué (`whyPanel`), estado y lo que sabe, y resumen (`summaryHtml`); charlas guardadas |
| `src/timeline.ts`, `src/world-panel.ts` | Línea temporal (R-010) y series del mundo (R-011), que ahora van en el dashboard |
| `src/format.ts`, `src/logic.ts` | Formato en español (actividades, eventos, causas `causeEs`) y colores y aspecto del prototipo (`styleOf`, `lookOf`, `hash`) |
| `vite.config.ts` | Vite con proxy de `/api` a la API local |

## 4. Diseño interno y decisiones
- **Reproducción del movimiento (R-013).**
  - El visor no dibuja fotos del estado. Lleva un reloj de vista que avanza a la velocidad del mundo, unos segundos detrás del último minuto guardado. Acelera un poco si se queda atrás, se frena si se acerca y nunca pasa del último minuto guardado.
  - Los viajes llegan con cada `tick` del SSE (022 R-012). Con ellos y la posición de partida (`/api/citizens`), `MoveBook.where` dice dónde estaba cada persona en cada minuto.
  - Se dibuja, como el prototipo, solo a quien camina (por las calles, con su paso) o está en un parque o una plaza. Quien está dentro de un edificio no se ve; de noche se encienden las ventanas de los edificios con alguien despierto.
  - Los viajes de más de un día se olvidan, salvo el último de cada persona.
- **Pantallas (R-025).** Barra superior con pestañas y cuatro pantallas con dirección propia (`#/mundo/CIT-…`, `#/expediente/CIT-…/pestaña`, `#/charla/CIT-…`, `#/datos`): el navegador puede volver atrás y los enlaces se comparten. Las pantallas ocultas no se destruyen: el mapa sigue corriendo detrás.
  - Estilo del lienzo (bloque 1): todo sale de `dw-tokens.css`; fondo azul y rojo, paneles crema, bordes gruesos y botones con relieve. Los controles de tiempo (pausa, velocidades, avanzar) y la hora están en la barra superior de todas las pantallas. Las pestañas Expediente y Charla llevan a la última persona elegida y están desactivadas si no hay ninguna.
  - Modo oscuro por el sistema o con el botón de la barra de pestañas (se recuerda en este navegador); es una variante provisional hasta la CA-021.
  - Por debajo de 1000 px el panel pasa bajo el mapa; por debajo de 700 px las pestañas muestran solo su icono.
- **Capas (R-021).** Personas, Lugares (nombres de los edificios, no de las viviendas), Vínculos (líneas de la persona elegida a sus vínculos), Ánimo (marca de color sobre cada figura) y Día/noche. Objetos se muestra bloqueada: los objetos no tienen posición en el mapa. Las capas se recuerdan en este navegador.
- **Expediente (R-022).** Pide la ficha cada 5 s y el expediente completo cada 30 s. Solo repinta la pestaña si cambió y no hay nada desplegado; la pestaña Charlas no se repinta sola, para no borrar lo elegido en su formulario. Exportar JSON descarga la ficha, el expediente, la historia de vida y el informe.
- **Dashboard (R-023).** La demografía se pide al abrir la pantalla y al cambiar de periodo; las series del antiguo panel del mundo van debajo.
- **Charla (R-024).** Pantalla completa. Si se llega desde la pestaña Charlas del expediente, empieza sola con el modo elegido. Salir de la pantalla es despedirse (043 R-019.6).
- **Velocidades.** Son las del motor (002), rotuladas en minutos del mundo por segundo. `pnpm dev` arranca a 1 min/s para que se vea caminar.
- **Avanzar.** Envía la orden `advance`; el progreso sale de `/api/stats`.
- **Accesos.** Los controles y la charla piden las credenciales con un formulario propio, que se guardan solo durante la sesión. La API ya no responde con `WWW-Authenticate`: con esa cabecera, el navegador abría su propia ventana y la petición quedaba colgada.
- **Panel de la derecha (R-021).** Se refresca cada segundo; la ficha compacta se pide de nuevo cada 1,5 s y el expediente (para «Por qué está aquí») cada 15 s. Solo se repinta lo que cambia.
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
  - CA-002: formato de la ficha (estímulos, causas y eventos).
- **`src/replay.test.ts`** (CA-009, CA-010): dónde está cada persona antes, durante y después de un viaje; quién se dibuja; ventanas; reloj de vista.
- **`src/log.test.ts`** (CA-011) y **`src/card.test.ts`** (CA-012: vínculos, creencias y memoria).
- **`src/dw-style.test.ts`:** CA-018 (ninguna hoja usa colores literales, fuentes ni importaciones fuera de `dw-tokens.css`) y `tabHref`.
- **`src/exp.test.ts`:** CA-014 (cada pestaña del expediente), CA-015 (dashboard), CA-016 (capas, «Ahora» y escala), ficha compacta y direcciones.
- **`panels.test.ts`:** CA-005, CA-006 y lo que hace cada persona.
- **`timeline.test.ts`** (CA-007), **`world-panel.test.ts`** (CA-008) y **`scenery.test.ts`** (R-012).
- **Prueba de punta a punta con Chromium** sobre el mundo de ejemplo: las cuatro pantallas, las pestañas del expediente, charla sandbox completa con modo prueba, oscuro y 375 px (`docs/validaciones/M4-visor-aplus.md`).

## 7. Paridad con el prototipo
Desde la 024 v0.5 la referencia de la interfaz es el lienzo «Visor A+»; `prototipo/index.html` queda como registro histórico (decisión del usuario, 2026-09-30). Del prototipo siguen el mapa, sus detalles, las figuras con su paso, la noche con las ventanas y quién se ve en el mapa.

**Diferencias con el lienzo** (detalle en `docs/validaciones/M4-visor-aplus.md`):
- se conservan las pestañas Memoria y Creencias y el modo oscuro, que el lienzo no dibuja;
- las velocidades son las del motor, en minutos por segundo;
- la capa Objetos está bloqueada;
- el panel de la charla no muestra el valor del visitante ni el malestar acumulado: la API de la charla aún no los expone.
- Hay menos gente en la calle que en el prototipo. Es del motor, no del visor: la escala del mapa (8 m por tile frente a ≈ 45 m) y los viajes por persona (unos 0,7 al día). Queda pendiente de decisión del usuario.

## 8. Pendientes y deuda
- [x] CA-001 y CA-003: aceptados en la revisión del usuario (2026-09-27).
- [x] Recorridos por las calles, línea temporal navegable y pestañas de M3 (M4).
- [ ] CA-021: revisión del usuario frente al lienzo (sustituye a la CA-017). Bloques: T2 Mundo (cohorte, capas, ficha, mapa recoloreado), T3 Expediente, T4 Dashboard y Charla, T5 capturas.
- [ ] Modo oscuro afinado, tras la CA-021.
- [ ] Valor del visitante y malestar acumulado en el panel de la charla (necesita la API de la 043).
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
| 2026-09-30 | m4/visor-a-plus | 024, 022, 043 | Visor A+ (024 v0.5): menú lateral y pantallas con dirección (`router.ts`); estilo del lienzo con IBM Plex y modo oscuro (`style.css`, `expediente.css`, `chat.css`); pantalla Mundo con cabecera nueva (`topbar.ts`), capas, panel «Ahora» y escala (`overlays.ts`, `mapview.ts`), registro en tabla (`logTableRow`) y ficha compacta (`card-compact.ts`, `inspector.ts`); expediente de vida de pantalla completa con once pestañas y curso de vida (`expediente.ts`, `exp-tabs.ts`, `exp-tabs2.ts`, `lifecourse.ts`); dashboard con indicadores, pirámide y ocupación (`dashboard.ts`); charla de pantalla completa (`chat-ui.ts`). Se eliminan la ficha de ocho pestañas (`cardHead`, `tabEstado`, `tabFuncional`, `renderHistory`, `renderLifeTab`), `inspectorTabs` y el diálogo del panel del mundo. 15 pruebas nuevas (`exp.test.ts`: CA-014 a CA-016) |
| 2026-10-05 | m4/visor-datas-world (T1) | 024 | Bloque 1 de la 024 v0.6: `dw-tokens.css` (CA-018), barra superior con pestañas en lugar del menú lateral, controles de tiempo y hora en la barra de todas las pantallas, `tabHref` en el router y pestañas Expediente y Charla hacia la última persona. Las pantallas existentes se recolorean con los tokens; su disposición cambia en los bloques siguientes. Prueba nueva `dw-style.test.ts` |
