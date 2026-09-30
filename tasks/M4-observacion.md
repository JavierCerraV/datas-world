# M4 — Observación local

Hito del roadmap: API, SSE, visor pixel art, inspector y línea temporal; el mundo corre en local y se observa desde el navegador igual o mejor que el prototipo (`pnpm dev`).

Specs: 022 v0.3 y 024 v0.3 (ampliación aprobada por el usuario el 2026-09-29, P1 a P5). El visor mínimo (bloque V) y las pestañas de M3 ya existen. Rama `m4/observacion`.

## Bloque O — Ampliación
- [x] O1 Población y lugares: `GET /api/places/:id`; panel de población con buscador y ánimo; ficha del lugar al hacer clic (022 R-007, 024 R-008).
- [x] O2 Recorridos por las calles: el viaje en las posiciones y la ruta por calles en el cliente (022 R-008, 024 R-009).
- [x] O3 Línea temporal: días con instantánea, posiciones y fichas de un día pasado; deslizador y vuelta al presente (022 R-009, 024 R-010).
- [x] O4 Panel del mundo: métricas por día con alertas de degeneración y exportación CSV (022 R-010, R-011, 024 R-011).
- [x] O5 Detalle del prototipo y contador de fotogramas (024 R-012).
- [x] O6 Criterios 022 CA-005 a CA-008 y 024 CA-005 a CA-008 (`docs/validaciones/M4-observacion.md`).
- [ ] O7 Revisión del usuario de 024 CA-001 (medido: 2,2 ms por cuadro con 500 figuras) y CA-003.

## Bloque P — Paridad con el prototipo (aprobado por el usuario el 2026-09-29, P1 a P6)
Specs: 024 v0.4, 022 v0.4 y 027 v0.5.
- [x] P1a Movimientos: tabla `movements` (migración 004), el worker anota cada viaje tick a tick y hace flush también por tiempo real (027 R-013, R-014; CA-009).
- [x] P1b Avance sin observar: orden `advance` en el worker y la API, con su progreso (027 R-015, 022 R-013; 027 CA-010).
- [x] P1c API: `/api/moves`, viajes en cada `tick` del SSE, `/api/stats`, ficha con `aboutMe` y el personal de los lugares (022 R-012 a R-014; CA-009 a CA-011).
- [x] P1d Visor: reloj de vista y reproducción de los trayectos; solo se ve a quien camina o está al aire libre; ventanas encendidas de noche (024 R-013; CA-009, CA-010).
- [x] P2 Disposición, interacción y registro del prototipo (024 R-014 a R-016; CA-011).
- [x] P3 Ficha de vida con pestañas y subpestañas; población con el lugar (024 R-017; CA-012).
- [x] P4 Charla mejorada (024 R-018).
- [x] P5 Mundo de demostración con el motor actual (el mundo anterior se conserva con otro nombre).
- [x] P6 Guía para el equipo (`docs/guia-visor.md`, 024 R-019) y validación con capturas lado a lado (`docs/validaciones/M4-paridad-prototipo.md`).
- [ ] P7 Revisión del usuario de la paridad (024 CA-013) y decisión sobre la escala del mapa y los viajes por persona (motor: 003, 016, rutinas).
  - 2026-09-30: el usuario indica que la referencia de la interfaz es el lienzo «Visor A+» y que faltan el expediente de vida y el dashboard. Aprobada como 024 v0.5 el mismo día.
- [x] A1 Menú lateral, estilo y pantalla Mundo con ficha compacta, capas y panel «Ahora» (024 R-020, R-021).
- [x] A2 Expediente de vida de pantalla completa con sus pestañas (024 R-022).
- [x] A3 Dashboard: indicadores, pirámide, ocupación y periodo (024 R-023).
- [x] A4 Charla de pantalla completa con su panel lateral (024 R-024).
- [ ] A5 Capturas de las cuatro pantallas (`docs/validaciones/M4-visor-aplus.md`, hechas) y aceptación del usuario (024 CA-017).
