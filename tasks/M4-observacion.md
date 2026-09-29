# M4 — Observación local

Hito del roadmap: API, SSE, visor pixel art, inspector y línea temporal; el mundo corre en local y se observa desde el navegador igual o mejor que el prototipo (`pnpm dev`).

Specs: 022 v0.3 y 024 v0.3 (ampliación aprobada por el usuario el 2026-09-29, P1 a P5). El visor mínimo (bloque V) y las pestañas de M3 ya existen. Rama `m4/observacion`.

## Bloque O — Ampliación
- [ ] O1 Población y lugares: `GET /api/places/:id`; panel de población con buscador y ánimo; ficha del lugar al hacer clic (022 R-007, 024 R-008).
- [ ] O2 Recorridos por las calles: el viaje en las posiciones y la ruta por calles en el cliente (022 R-008, 024 R-009).
- [ ] O3 Línea temporal: días con instantánea, posiciones y fichas de un día pasado; deslizador y vuelta al presente (022 R-009, 024 R-010).
- [ ] O4 Panel del mundo: métricas por día con alertas de degeneración y exportación CSV (022 R-010, R-011, 024 R-011).
- [ ] O5 Detalle del prototipo y contador de fotogramas (024 R-012).
- [ ] O6 Criterios 022 CA-005 a CA-008 y 024 CA-005 a CA-008; revisión del usuario de 024 CA-001 y CA-003.
