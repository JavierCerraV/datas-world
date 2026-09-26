# Bloque V — Visor mínimo adelantado

Decisión del usuario (2026-09-26): adelantar una versión mínima del visor de M4 antes de MF6, para ver el mundo en pantalla. No cambia el motor: solo lee la base que escribe el worker.

Specs: 022 v0.2 y 024 v0.2 (versiones mínimas). Rama `visor/minimo`.

## Bloque V1 — API de solo lectura (022)
- [x] V1.1 `apps/api` con Fastify: `/api/health`, `/api/world`, `/api/citizens`, `/api/citizens/:id`, `/api/events`. Validación con Zod.
- [x] V1.2 SSE `/api/stream` con `Last-Event-ID`; recarga del mundo por sondeo.
- [x] V1.3 `POST /api/control` con basic auth (variables de entorno).
- [x] V1.4 Criterios: 022 CA-001 a CA-004.

## Bloque V2 — Visor (024)
- [ ] V2.1 `apps/web` con Vite + TS + Canvas 2D: mapa, lugares, personas, día y noche, cámara.
- [ ] V2.2 Inspector (Estado, Historia, Funcional), registro de eventos y controles de tiempo.
- [ ] V2.3 Diseño adaptable y teclado.
- [ ] V2.4 `pnpm dev` (worker + api + web) y guía de uso para el usuario.
- [ ] V2.5 Criterios: 024 CA-002 y CA-004 con pruebas; CA-001 y CA-003 con revisión del usuario.
