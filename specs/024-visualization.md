---
id: 024
nombre: visualization
estado: borrador
hito: M4
depende_de: [022, 003, 004]
version: 0.1
---

# 024 — Visualización pixel art

## 1. Propósito
Ventana visual al mundo en pixel art 2D: mapa, personas moviéndose, día/noche, inspector y línea temporal. Solo lectura. Referencia: `prototipo/index.html`.

## 2. Alcance
**Incluye:** mapa, sprites, cámara, paneles, controles de tiempo, accesibilidad.
**Fuera de alcance:** edición del mundo.

## 3. Modelo de datos
```ts
// apps/web: Vite + TS + Canvas 2D, sin framework de UI en MVP.
// Módulos: map-renderer, sprite-atlas, camera, inspector, event-log, timeline, controls, api-client (SSE).
```

## 4. Reglas
- **R-001** — Tiles de 8 px escalados por entero (imageSmoothing desactivado); 60 fps de render independientes del ritmo de ticks.
- **R-002** — Interpolación de posiciones en cliente entre actualizaciones.
- **R-003** — Inspector con pestañas: Estado, Relaciones, Memoria, Historia, Creencias (como el prototipo).
- **R-004** — Diseño responsive: en móvil el inspector pasa a hoja inferior.
- **R-005** — Accesibilidad: contraste AA, controles por teclado, textos en español.

## 5. Eventos
No define tipos propios (usa los de otras specs).

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* 500 personas, *entonces* el render mantiene ≥ 50 fps en un portátil medio.
- **CA-002** — *Dado* un clic en una persona, *entonces* el inspector muestra datos que coinciden con `/api/citizens/:id`.
- **CA-003** — *Dado* una pantalla de 375 px, *entonces* todos los controles son usables.

## 8. Parámetros y calibración
Por definir durante la revisión.

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] ¿Sprites propios dibujados a mano o generados proceduralmente (como el prototipo)?

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
