---
id: 024
nombre: visualization
estado: aprobada
hito: M4
depende_de: [022, 003, 004]
version: 0.6
---

# 024 — Visualización pixel art

## 1. Propósito
Ventana visual al mundo en pixel art 2D: mapa, personas moviéndose, día/noche, inspector y línea temporal. Solo lectura. Referencia: el lienzo aprobado «Visor A+» (v0.5).

## 2. Alcance
**Incluye (bloque V, versión mínima adelantada):**
- mapa de tiles y lugares con los colores del prototipo;
- personas como figuras de pixel art con aspecto estable por persona;
- día y noche;
- cámara con desplazamiento y zoom por enteros;
- inspector de una persona;
- registro de eventos en vivo;
- controles de tiempo;
- diseño adaptable.

**En M3** llegaron las pestañas y secciones de vínculos, recuerdos, informe de vida, creencias y el «¿por qué?» de cada evento.

**En M4 (v0.3):** población y lugares, recorridos por las calles, línea temporal, panel del mundo y detalle visual del prototipo (R-008 a R-012). Sprites dibujados a mano: fuera de alcance.

## 3. Modelo de datos
```ts
// apps/web: Vite + TS + Canvas 2D, sin framework de UI (ADR-001). Solo lee de la API (022).
// Módulos: api-client (fetch + SSE), map-renderer, people (posición e interpolación), camera, inspector,
// event-log, controls. Lógica pura (interpolación, colores, día/noche, formato) separada del DOM y probada.
```

## 4. Reglas
- **R-001** — Tiles de 8 px escalados por entero (`imageSmoothingEnabled = false`); render con `requestAnimationFrame`, independiente del ritmo de ticks.
- **R-002** — Interpolación de posiciones en cliente entre actualizaciones (lineal durante 1 s).
- **R-003** [M] — **Inspector con pestañas:** Estado (necesidades, emociones, ánimo, estrés, actividad y lugar), Historia (últimos eventos con sus causas legibles) y Funcional (funciones más fuertes, reglas con su tipo y aporte, relaciones). Relaciones, Memoria y Creencias llegan con M3.
- **R-004** — Diseño adaptable: por debajo de 700 px de ancho el inspector pasa a hoja inferior.
- **R-005** — Accesibilidad: contraste AA, controles por teclado (espacio pausa, + y − velocidad, flechas mueven la cámara, Esc cierra el inspector), textos en español.
- **R-006** [M] — **Aspecto de una persona:** piel, pelo, camisa y pantalón elegidos por un hash de su id sobre las paletas del prototipo; el mismo en cada carga (sin azar del motor).
- **R-007** [M] — **Día y noche:** un velo azul oscuro con opacidad según la hora del mundo (0 a mediodía, 0,45 a medianoche, transición al amanecer y al atardecer).

### Ampliación de M4 (v0.3, decisiones del usuario del 2026-09-29)
- **R-008** [M] — **Población y lugares (P1).** Sin nadie elegido, el panel muestra la población:
  - un buscador por nombre;
  - por persona, un punto con el color de su ánimo, su edad y lo que hace.

  Un clic en un lugar muestra su ficha (022 R-007): horario, quién está dentro y, si es vivienda, quién vive allí.
- **R-009** [M] — **Recorridos por las calles (P2).** Quien va de camino sigue la ruta más corta por las calles entre las dos puertas (búsqueda en anchura sobre los tiles de calle, como el prototipo). Avanza por ella según la fracción del viaje. Si no hay ruta, va en línea recta. Las rutas se guardan en memoria del cliente.
- **R-010** [M] — **Línea temporal (P3).**
  - Un deslizador por días lleva a cualquier día con instantánea (022 R-009);
  - en el pasado, el mapa y la ficha muestran ese día, con un aviso visible;
  - el mundo sigue corriendo y un botón vuelve al presente.
- **R-011** [M] — **Panel del mundo (P4).** Gráficas por día de:
  - el ánimo y el estrés medios, con su franja de desviación;
  - la mediana del dinero;
  - los eventos por tipo (los más frecuentes).

  Muestra las alertas de degeneración de la 022 R-010 y los enlaces de exportación CSV.
- **R-012** [M] — **Detalle del prototipo (P5).** Árboles, el dibujo de cada tipo de lugar y los detalles del mapa se portan del prototipo (su comportamiento visual, no su código), con un contador de fotogramas visible.

### Paridad con el prototipo (v0.4, decisiones del usuario del 2026-09-29, P1 a P6)
Tras la revisión del usuario («no se parece en nada al prototipo; las personas quedan en círculos frente a los edificios»), el visor se rehace sobre el prototipo. Estas reglas sustituyen a la R-002 y amplían la R-003, la R-008 y la R-009.

- **R-013** [M] — **Reproducción del movimiento (P1).**
  - El visor lleva su propio reloj de vista, que avanza a la velocidad del mundo y va unos segundos por detrás del último minuto guardado (como mucho `VIEW_LAG_MAX`; si se queda más atrás, salta).
  - Con los viajes de la 022 R-012 y la posición de partida de cada persona, calcula dónde está cada una en el minuto de la vista:
    - camina por las calles (R-009) entre su salida y su llegada;
    - si no, está en su lugar.
  - Como en el prototipo, solo se dibuja a quien va de camino o está en un lugar al aire libre (parques y plazas, en puntos repartidos dentro). Dentro de un edificio no se ve; de noche se encienden las ventanas de los edificios con gente dentro.
  - Mientras hay un avance sin observar (022 R-013), el mapa muestra «Simulando sin observar» con el porcentaje, como el prototipo.
- **R-014** [M] — **Disposición del prototipo (P2).**
  - Barra superior:
    - título en fuente pixel;
    - reloj grande con la fecha y «Día N de simulación»;
    - botón Pausar;
    - velocidades del motor (002) rotuladas en minutos de mundo por segundo;
    - «Avanzar» 1 día, 1 semana, 1 mes y 1 año;
    - indicadores: personas, con empleo, ánimo medio y eventos de hoy;
    - acceso al panel del mundo y a la línea temporal.
  - Mapa que llena su espacio, ajustado y centrado, con zoom de 1 a 6 y los botones −, +, «Seguir» (la cámara sigue a la persona elegida) y «Ver todo».
  - Registro de eventos bajo el mapa.
  - Inspector a la derecha (410 px).
  - Mismos colores y tipografías que el prototipo (Atkinson Hyperlegible y Pixelify Sans), en claro y en oscuro.
- **R-015** [M] — **Interacción con el mapa (P2).**
  - Al pasar el ratón, un tooltip con el nombre y lo que hace, o con el lugar y cuántas personas hay dentro.
  - Un clic elige a la persona o el lugar:
    - la persona elegida lleva encima una flecha amarilla que parpadea;
    - si está dentro de un edificio, parpadea el borde del edificio;
    - el lugar elegido queda enmarcado.
- **R-016** [M] — **Registro de eventos (P2).**
  - Filtros: Todos, Trabajo, Relaciones, Economía, Salud e Información, más «Incluir menores» (ocio, sueño y rutina).
  - Cada evento lleva la hora, una etiqueta de su clase (buena, mala, aviso o información, siempre con texto), el texto con los nombres pulsables y su «Por qué».
- **R-017** [M] — **Ficha de vida (P3).**
  - Cabecera: nombre, id, edad, vivienda, barrio, la línea «Ahora: … hasta las …» y el botón Charlar.
  - Pestañas: Estado, Relaciones, Memoria, Historia, Creencias, Vida, Funcional y Charlas.
    - **Estado:** barras de necesidades, ánimo y estrés; recursos y situación; temperamento.
    - **Relaciones:** cada vínculo desde las dos perspectivas.
    - **Memoria:** recuerdos con su fuerza y los casi olvidados atenuados.
    - **Historia:** informe de vida y trayectoria de eventos con su «¿por qué?».
    - **Creencias:** lo que cree de otros y lo que otros creen de esta persona frente a la verdad.
    - **Vida:** subpestañas Informe, Desarrollo y Familia.
  - La ficha del lugar lista su personal (022 R-014).
  - Sin nadie elegido, la población muestra por persona su nombre, edad y lo que hace con el nombre del lugar («trabajando en …», «camino a casa»). Aparece nada más abrir el visor.
- **R-018** [M] — **Charla mejorada (P4, amplía la 043 R-017).**
  - Panel junto al mapa (el mundo sigue a la vista), con la figura pixel de la persona y su ánimo y estrés.
  - Mensajes en burbujas; indicador «escribiendo…» mientras llega la respuesta; Enter envía y Mayúsculas+Enter salta de línea.
  - En cada respuesta, un desplegable con por qué respondió así.
  - Al despedirse, un resumen de lo que cambió en la persona durante la charla (ánimo y estrés antes y después, y si la recordará).
- **R-019** [M] — **Guía para el equipo (P6).** Una guía breve en `docs/` explica cómo arrancar el visor y qué muestra cada parte.

### Visor A+ (v0.5, decisiones del usuario del 2026-09-30)
La referencia de la interfaz pasa a ser el lienzo aprobado «Datas World — Visor A+» (https://claude.ai/artifact/L27kh8DDNoNa5R9uimn97B). `prototipo/index.html` ya cumplió su función de guiar la etapa temprana y deja de ser la referencia. Estas reglas sustituyen a la R-014 y a la R-017, amplían la R-011 y sustituyen el panel de la R-018 por una pantalla. Se conservan el modo oscuro y las pestañas Memoria y Creencias.

- **R-020** [M] — **Estructura y estilo.** Menú lateral oscuro de 64 px con *Mundo* y *Datos*, y bajo «Investig.» *Estudio* y *Muestra* desactivados con su aviso (028 y 034). Cabecera blanca de 56 px con migas de pan. Estilo del lienzo: IBM Plex Sans y Mono, fondo #f5f4f1, acento #a84a32, bordes #e3e0d9, con modo oscuro equivalente. El mapa sigue en pixel art (R-001, R-006, R-007, R-009, R-013).
- **R-021** [M] — **Pantalla Mundo.**
  - Cabecera: «Mundo · Data's World › barrio», fecha y hora grandes con «día N de simulación», estado (Simulando / En pausa), velocidades y «+1 día» (se mantienen semana, mes y año en un menú), y personas, hogares y organizaciones.
  - Sobre el mapa: panel **Capas** (Personas, Lugares, Objetos, Vínculos, Ánimo, Día/noche) y panel **Ahora** (cuántas personas trabajan, están en clase, en casa y en la calle), escala en metros y botones + y −.
  - Etiqueta flotante sobre la persona elegida («id · nombre · actividad»).
  - Registro de eventos bajo el mapa en tabla: Hora, Tipo, Qué pasó y Causas, con filtro y «Abrir línea de tiempo».
  - A la derecha, **ficha compacta**: id, nombre, sexo, edad y trabajo; botones «Ampliar expediente» y «Charlar»; actividad, lugar, hogar y dinero; barras de estado con el aviso de necesidad crítica; «Por qué está aquí» con sus causas; y el enlace «Ver historia, vínculos, aprendizaje y salud →».
- **R-022** [M] — **Expediente de vida (pantalla completa).**
  - Cabecera: Mundo / Personas / Expediente id, «datos al … · en vivo», y los botones «Exportar JSON», «Charlar» y «Reducir» (vuelve al mapa con la ficha compacta).
  - Franja de identidad: nombre completo, sexo, edad, fecha y lugar de nacimiento, estudios, trabajo y hogar; y «Ahora», ánimo, estrés y alertas.
  - Pestañas:
    - **Resumen:** identidad, «por qué está donde está», curso de vida en una línea temporal por lugares (historia de origen de la 030 y simulación) y contadores de eventos, estímulos con función, reglas verbales y charlas;
    - **Estado y necesidades:** ánimo, estrés, necesidades con su umbral crítico explicado y la agenda de hoy (rutina prevista en una franja de 24 h con «ahora», lugar, si se mueve y cuándo queda libre);
    - **Emociones:** las activas con su evento de origen, o el texto de que no hay ninguna;
    - **Historia:** tabla cronológica con filtro Todos / Historia de origen / Simulación, y su «¿por qué?»;
    - **Vínculos:** familia en tabla (parentesco y situación), las relaciones desde las dos perspectivas y la red relacional (037);
    - **Aprendizaje:** funciones de estímulos, reglas verbales, fuerza de respuestas, estados aprendidos y temperamento;
    - **Salud:** aseguramiento (031), condiciones y episodios;
    - **Economía y objetos:** dinero, ocupación, cargo, hogar y objetos con dueño, fecha y precio;
    - **Charlas:** las anteriores con su resumen, y el formulario para iniciar una (modo En el mundo o Sandbox, modo prueba, y la disponibilidad según su rutina).
  - Memoria y Creencias (M3), que el lienzo no dibuja, se conservan como dos pestañas más tras Vínculos. El Informe y el Desarrollo de la pestaña Vida pasan a Resumen e Historia.
- **R-023** [M] — **Dashboard (pantalla Datos).** Cabecera con «datos al …», periodo (Último mes, Último año, Desde la fundación) y «Exportar CSV». Indicadores: personas, nacidos y fallecidos del periodo con su tasa bruta por mil, hogares con su tamaño medio y organizaciones. Gráficas: pirámide por edad y sexo en grupos de 10 años, y personas por ocupación, cada una con «Ver como tabla» y el valor al pasar el cursor. Debajo, las series por día y las alertas de la R-011. El aviso de Estudio y Muestra queda al pie.
- **R-024** [M] — **Charla (pantalla completa, sustituye al panel de la R-018).** Cabecera con el expediente de origen, id de la charla, «Modo prueba» y «Despedirse»; franja con el modo, la hora de inicio y la duración, hasta cuándo está libre, el lugar y «El mundo sigue en tiempo real». Mensajes con número, hora, tono o postura y tiempo de respuesta, y las afirmaciones verificadas. Selector de tono en modo prueba. Panel lateral: por qué respondió así en el último turno (aportes de las fuentes de la 040 y probabilidades), estado de la charla (valor del visitante, malestar, necesidades en vivo, verificación) y lo que sabe la persona.

### Retrato, carga y datos (v0.6, decisiones del usuario del 2026-09-30, tras revisar el Visor A+)
- **R-025** [M] — **Retrato pixel art.** Cada persona tiene un retrato pixel art (busto de 12 × 14 píxeles: pelo, cara con ojos, cuello y camisa) con los mismos colores de su figura del mapa (R-006), estable por su id y escalado por enteros sin suavizado. Aparece en la ficha compacta, en la franja del expediente, en la cabecera de la charla y, pequeño, en la lista de población.
- **R-026** [M] — **Indicador de carga.** Mientras llega lo que necesita una pestaña del expediente (la ficha, el expediente, la historia de vida o el informe), la pestaña muestra un esqueleto animado con el texto «Cargando …» y `aria-busy`; lo mismo el dashboard al abrirlo o cambiar de periodo. Con movimiento reducido, sin animación.
- **R-027** [M] — **Pantalla Datos rediseñada.** Ligera y legible, con las marcas de la guía de visualización (líneas de 1,5–2 px que no engordan al ensanchar la gráfica, barras de ≤ 24 px, rejilla fina, etiquetas directas selectivas, leyenda con dos o más series, cursor con tooltip y «Ver como tabla»):
  - indicadores: personas, nacidos, fallecidos, hogares, organizaciones, ánimo medio y con empleo;
  - pirámide por edad y sexo y personas por ocupación (R-023);
  - distribución del ánimo y del estrés (histogramas) y del dinero, con su mediana y su índice de Gini;
  - hogares por tamaño y empleo por organización;
  - **red de vínculos en 3D:** una persona por nodo, color por barrio, aristas por tipo de vínculo (familia, pareja, amistad, compañeros, otros) con filtros; se gira arrastrando, se acerca con la rueda o los botones, «Restablecer», y un clic abre el expediente. La disposición es un modelo de fuerzas en 3D con semilla fija por id: la misma red siempre se dibuja igual;
  - series por día (R-011) en tres gráficas pequeñas en fila.

## 5. Eventos
No define tipos propios (usa los de otras specs).

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4). La web no tiene lógica de simulación.

## 7. Criterios de aceptación
- **CA-001** — *Dado* 500 personas, *entonces* el render mantiene ≥ 50 fps en un portátil medio (medido con el contador de fps del visor).
- **CA-002** — *Dado* un clic en una persona, *entonces* el inspector muestra los datos de `/api/citizens/:id` (prueba del formateo con una ficha de ejemplo).
- **CA-003** — *Dado* una pantalla de 375 px, *entonces* todos los controles son usables (revisión manual del usuario).
- **CA-004** — La interpolación, el aspecto por id y el velo de día y noche son deterministas y están probados.
- **CA-005** — La ruta por las calles solo pisa tiles de calle (salvo las dos puertas), es la más corta y la posición a mitad de viaje está sobre ella (prueba sobre un mapa pequeño).
- **CA-006** — El buscador de la población filtra por nombre sin distinguir mayúsculas ni tildes, y la ficha de un lugar muestra a quién hay dentro (pruebas del formateo).
- **CA-007** — En la línea temporal, elegir un día pasado pide sus datos a la 022 R-009 y el aviso de «día pasado» se muestra; volver al presente reanuda el vivo (prueba de la lógica).
- **CA-008** — El panel del mundo dibuja una serie por métrica y muestra cada alerta que da la API (prueba del formateo).
- **CA-009** — *Dado* un viaje con su salida y su llegada, *entonces* la posición en el reloj de vista está en su lugar de origen antes de salir, sobre la ruta durante el viaje y en su destino después; quien está en un edificio no se dibuja y quien está en un parque sí (prueba de la lógica).
- **CA-010** — El reloj de vista avanza a la velocidad del mundo, nunca pasa del último minuto guardado y salta si se queda más de `VIEW_LAG_MAX` atrás (prueba de la lógica).
- **CA-011** — El filtro del registro clasifica cada tipo de evento en su categoría y oculta los menores salvo que se pidan (prueba del formateo).
- **CA-012** — Cada pestaña de la ficha muestra los datos de una ficha de ejemplo, incluidas las perspectivas de un vínculo y lo que otros creen de la persona (prueba del formateo).
- **CA-013** — Revisión visual: capturas del visor y del prototipo lado a lado (claro, oscuro y 375 px) en `docs/validaciones/`, y aceptación del usuario.
- **CA-014** — Cada pestaña del expediente muestra los datos de un expediente de ejemplo (prueba del formateo).
- **CA-015** — La pirámide y la ocupación cuentan bien una población de ejemplo, y el periodo cambia los nacidos y los fallecidos (pruebas de la API y del formateo).
- **CA-016** — El panel «Ahora» cuenta a cada persona en una sola categoría y las capas ocultan lo que se apaga (prueba de la lógica).
- **CA-017** — Revisión visual: capturas del visor junto a las cuatro pantallas del lienzo en `docs/validaciones/`, y aceptación del usuario. Sustituye a la CA-013.
- **CA-018** — El retrato de una persona es el mismo en cada llamada, usa los colores de su figura y difiere entre personas (prueba de la lógica).
- **CA-019** — Una pestaña del expediente cuyos datos no han llegado muestra el esqueleto con `aria-busy="true"`, y al llegar lo sustituye (prueba del formateo).
- **CA-020** — Los histogramas cuentan a toda la población y la red 3D coloca los nodos igual en dos llamadas, sin NaN, y su proyección respeta la rotación (prueba de la lógica).

## 8. Parámetros y calibración
| Parámetro | Valor | Estado |
|---|---|---|
| Tamaño de tile | 8 px | prototipo |
| Escala inicial | 3 (entera, 1–6) | [M] |
| Opacidad máxima de la noche | 0,5 (la del prototipo) | [M] |
| `VIEW_LAG_MAX` (retraso máximo del reloj de vista) | 90 min de mundo, o 5 s reales a la velocidad del mundo si es más | [M] |

## 9. Métricas
Fps del render (visible en el visor).

## 10. Preguntas abiertas
- [x] Paridad con el prototipo aprobado «Visor A+»: resuelta en la v0.5 (R-020 a R-024).
## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-26 | 0.2 | Versión mínima adelantada (bloque V, decisión del usuario): módulos concretos, inspector con pestañas Estado, Historia y Funcional, aspecto estable por id, día y noche, atajos de teclado, CA-004. Línea temporal navegable, recorridos por calles y pestañas de M3 quedan para M4 |
| 2026-09-26 | 0.2 | Estado → aprobada |
| 2026-09-26 | 0.2 | Implementación del bloque V2 (`apps/web`). Precisiones: varias personas en la misma puerta se reparten en un círculo pequeño para verse; el registro omite `DAY_STARTED` y `TRIP_TAKEN`; las credenciales de los controles se piden al primer 401 y quedan en `sessionStorage`; `pnpm dev` crea el mundo si no existe y detiene el worker con la orden `stop` (cierre limpio también en Windows). CA-002 y CA-004 verdes; CA-001 y CA-003 pendientes de la revisión del usuario. Sin cambios en CA |
| 2026-09-27 | 0.2 | CA-001 y CA-003 aceptados en la revisión del usuario («el visor es funcional para esta etapa») |
| 2026-09-28 | — | 041 R-009 (decisión del usuario): pestaña **Vida** en la ficha, con el familiograma extenso y la historia de vida por etapas. Sin cambios en CA |
| 2026-09-29 | 0.3 | Ampliación de M4, aprobada por el usuario (P1 a P5): población y lugares (R-008), recorridos por las calles (R-009), línea temporal (R-010), panel del mundo (R-011) y detalle del prototipo con contador de fotogramas (R-012). CA-005 a CA-008 nuevos; CA-001 (fps con 500 personas) se vuelve a revisar con el detalle portado |
| 2026-09-29 | 0.3 | Implementación de M4 (O1–O5, `apps/web`). Precisiones: en R-011, etiqueta directa hasta 4 series (con 5 tipos de evento, solo leyenda); en R-012, el azar del prototipo (árboles y bancos) se sustituye por un hash de la posición, y la línea central de la carretera no se porta porque el mapa ya no es una rejilla fija. El generador llega hoy a 254 personas con el mapa actual, así que CA-001 se midió dibujando 500 figuras: 2,2 ms por cuadro. CA-005 a CA-008 verdes; CA-001 y CA-003 quedan para la revisión del usuario |
| 2026-09-29 | 0.4 | Paridad con el prototipo, aprobada por el usuario (P1 a P6) tras su revisión («no se parece en nada al prototipo»): reproducción del movimiento con reloj de vista (R-013, sustituye a la R-002), disposición del prototipo (R-014), interacción con el mapa (R-015), registro con filtros (R-016), ficha de vida con pestañas y subpestañas (R-017), charla mejorada (R-018, amplía la 043 R-017) y guía para el equipo (R-019). Opacidad de la noche 0,5, como el prototipo. CA-009 a CA-013 nuevos |
| 2026-09-29 | 0.4 | Implementación de la paridad (P1 a P6), probada de punta a punta con capturas (`docs/validaciones/M4-paridad-prototipo.md`). Precisiones:<br>- las pestañas de la ficha pasan a dos líneas cuando no caben;<br>- el lugar de «Ahora» es un enlace a su ficha;<br>- el acceso usa un formulario propio;<br>- `pnpm dev` arranca a 1 min/s y con credenciales locales si no hay otras.<br>Hallazgo: el visor dibuja cada trayecto simulado, pero hay mucha menos gente en la calle que en el prototipo (0,36 personas de media), por el modelo: 8 m por tile (≈ 45 m en el prototipo) y unos 0,7 viajes por persona y día. Queda para decisión del usuario. CA-009 a CA-012 verdes; CA-013 pendiente de su revisión |
| 2026-09-30 | — | Propuesta v0.5 en *Preguntas abiertas*: paridad con el prototipo aprobado «Visor A+» (menú lateral, ficha compacta, expediente de vida de pantalla completa, dashboard y charla de pantalla completa). Pendiente de aprobación; sin cambios en reglas ni CA vigentes |
| 2026-09-30 | 0.5 | Visor A+, aprobado por el usuario: el lienzo pasa a ser la referencia de la interfaz y `prototipo/index.html` deja de serlo. Menú lateral y estilo (R-020), pantalla Mundo con ficha compacta, capas y «Ahora» (R-021), expediente de vida de pantalla completa (R-022), dashboard (R-023) y charla de pantalla completa (R-024). Se conservan el modo oscuro y las pestañas Memoria y Creencias. CA-014 a CA-017 nuevos; la CA-017 sustituye a la CA-013 |
| 2026-09-30 | 0.5 | Implementación del Visor A+ (`apps/web`, con 022 R-015 y R-016 en `apps/api`), probada de punta a punta con capturas (`docs/validaciones/M4-visor-aplus.md`). Precisiones:<br>- la capa Objetos se muestra bloqueada: los objetos aún no tienen posición en el mapa;<br>- las velocidades siguen siendo las del motor, en minutos por segundo;<br>- el panel de la charla muestra ánimo, estrés y alimentación en vivo, turnos y verificación; el valor del visitante y el malestar acumulado del lienzo esperan a la API de la 043;<br>- cada pantalla tiene su dirección (`#/expediente/CIT-…/pestaña`). CA-014 a CA-016 verdes; CA-017 pendiente de la revisión del usuario |
| 2026-09-30 | 0.6 | Tras revisar el Visor A+, el usuario pide (decisión del 2026-09-30): el retrato pixel art de cada persona en su ficha (R-025), un indicador de carga en las pestañas del expediente (R-026) y una pantalla Datos menos densa, con líneas finas y más información, incluida una red de vínculos en 3D (R-027). CA-018 a CA-020 nuevos |
| 2026-09-30 | 0.6 | Implementación de la v0.6 (`apps/web`), probada en el navegador con capturas (`docs/validaciones/M4-visor-aplus.md`). Precisiones: el retrato lleva pelo largo y mechón según el id; la Historia se pinta por páginas de 100 eventos (lo que más tardaba al cambiar de pestaña era reconstruir la pantalla entera y pintar todos los eventos); en la red, la pareja se dibuja en el color de acento; la escala del mapa lee los metros por tile del mundo (003 v0.4). CA-018 a CA-020 verdes |
