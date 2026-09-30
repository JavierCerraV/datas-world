---
id: 024
nombre: visualization
estado: aprobada
hito: M4
depende_de: [022, 003, 004]
version: 0.3
---

# 024 — Visualización pixel art

## 1. Propósito
Ventana visual al mundo en pixel art 2D: mapa, personas moviéndose, día/noche, inspector y línea temporal. Solo lectura. Referencia: `prototipo/index.html`.

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

## 8. Parámetros y calibración
| Parámetro | Valor | Estado |
|---|---|---|
| Tamaño de tile | 8 px | prototipo |
| Escala inicial | 3 (entera, 1–6) | [M] |
| Opacidad máxima de la noche | 0,45 | [M] |

## 9. Métricas
Fps del render (visible en el visor).

## 10. Preguntas abiertas
- [ ] ¿Sprites propios dibujados a mano o generados proceduralmente (como el prototipo)? En el bloque V, procedurales.

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
