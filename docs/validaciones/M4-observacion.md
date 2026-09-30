# M4 — Validación de la observación local

Fecha: 2026-09-29 · Rama `m4/observacion` · Specs 022 v0.3 y 024 v0.3 (ampliación P1 a P5 aprobada por el usuario).

## Qué se añadió

| Bloque | Qué ve quien observa | Specs |
|---|---|---|
| O1 | Panel **Población**: todas las personas con edad, actividad y un punto del color de su ánimo, con buscador. Un clic en un edificio abre su ficha: quién está dentro, horario y quién vive allí | 022 R-007, 024 R-008 |
| O2 | Las personas caminan **por las calles** entre la puerta de salida y la de llegada, en vez de cruzar en línea recta | 022 R-008, 024 R-009 |
| O3 | **Línea temporal**: un deslizador elige un día pasado; el mapa y las fichas muestran ese día (desde su instantánea) con un aviso, y «Presente» vuelve al vivo | 022 R-009, 024 R-010 |
| O4 | Botón **Mundo**: gráficas por día del ánimo y el estrés medios con su franja de desviación, la mediana del dinero y los 5 eventos más frecuentes; alertas de degeneración; descarga en CSV de la trayectoria y del registro | 022 R-010, R-011, 024 R-011 |
| O5 | Detalle del prototipo: árboles, parques con senderos, estanque y bancos, plazas, tejados a franjas, toldos y el adorno de cada tipo (cruz del hospital, chimenea, bandera del colegio, pesas del gimnasio) | 024 R-012 |

## Criterios

| Criterio | Cómo se comprueba | Resultado |
|---|---|---|
| 022 CA-005 | `api.test.ts`: la ficha de un lugar lista a quien está dentro y a quien vive allí | verde |
| 022 CA-006 | `api.test.ts`: las posiciones de un día pasado coinciden con su instantánea | verde |
| 022 CA-007 | `metrics.test.ts`: medias, desviación y alertas (sin variación, saturación, crecimiento) | verde |
| 022 CA-008 | `metrics.test.ts`: el CSV de eventos tiene una fila por evento de la base | verde |
| 024 CA-005 | `panels.test.ts`: la ruta va solo por calles y plazas y une las dos puertas | verde |
| 024 CA-006 | `panels.test.ts`: población ordenada y filtrada, color de ánimo y ficha del lugar | verde |
| 024 CA-007 | `timeline.test.ts`: un día pasado pide sus datos y muestra el aviso; el final es el presente | verde |
| 024 CA-008 | `world-panel.test.ts`: una serie por métrica, cada alerta de la API y los enlaces CSV | verde |
| 024 R-012 | `scenery.test.ts`: árboles fuera de calles y edificios, con la densidad del prototipo y estables; adornos por tipo | verde |
| 024 CA-001 | fps con 500 personas | medido; **pendiente de la revisión del usuario** |
| 024 CA-003 | revisión visual frente al prototipo | **pendiente de la revisión del usuario** |

## Prueba en el navegador

- Se sirvió una copia del mundo de ejemplo de M2 avanzada 12 días. Con Edge sin ventana, se capturaron el mapa y el panel del mundo en claro y en oscuro, a 1400 × 900.
- Las capturas revelaron tres defectos, ya corregidos:
  1. El cursor de las gráficas se quedaba fijo en el borde izquierdo: el atributo `hidden` no oculta elementos SVG. Ahora usa `visibility`.
  2. El último día de eventos caía a casi cero. La fila de trayectoria del día d se guarda a las 00:00 del día d y resume el día d − 1. Ahora cada punto lleva la fecha y los eventos de ese día cerrado (precisión en el historial de la 022).
  3. Con 5 tipos de evento, las etiquetas directas se pisaban. Ahora solo hay etiqueta directa hasta 4 series, separadas al menos 12 px; con más, basta la leyenda.
- **Paleta de las gráficas.** Se usa el orden categórico fijo, validado con el script de paleta:
  - en oscuro (#1a2129) pasan todas las comprobaciones;
  - en claro (#f5f6f8) pasan todas, pero 4 tonos quedan por debajo de 3:1 de contraste. Lo compensan las etiquetas directas, la leyenda y la tabla de los últimos 14 días.

## Rendimiento (024 CA-001)

El generador llega hoy a **254 personas** con el mapa actual (igual que en el bench de M3). Por eso no hay un mundo de 500 con el que medir.

Se midió en el navegador, con los mismos módulos del visor, el coste de un cuadro:
- copiar el mapa escalado ×3;
- dibujar 500 figuras;
- aplicar el velo nocturno.

| Medida | Valor |
|---|---|
| Pintar el mapa base con todo el detalle (una vez al cargar) | 4,5 ms |
| Un cuadro con 500 figuras | 2,2 ms (≈ 460 fps de techo; el visor limita a 60) |
| Contador del visor con 199 personas | 60 fps |

La medida se hizo sin GPU (Edge sin ventana), así que en un navegador normal debería ir igual o mejor.

## Pendiente

- **Revisión del usuario de 024 CA-001 y CA-003.** Con `pnpm dev`, abrir el visor y comprobar:
  - la fluidez;
  - el aspecto frente a `prototipo/index.html`;
  - el panel Mundo;
  - la línea temporal.
- **Mundo de 500 personas reales:** necesita un mapa con más vivienda. Es trabajo del generador, fuera de M4.
