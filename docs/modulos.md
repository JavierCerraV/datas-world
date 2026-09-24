# Módulos

> Archivo generado por `scripts/guardrails/indice.mjs`. No editar a mano: se actualiza solo a partir del `MODULE.md` de cada módulo.

Cada módulo (paquete, app o sistema del motor) tiene un `MODULE.md` que se actualiza **cada vez que se toca su código**. Plantilla: [`docs/modulos/_plantilla-MODULE.md`](modulos/_plantilla-MODULE.md).

| Módulo | Estado | Specs | Último cambio |
|---|---|---|---|
| [`apps/api`](../apps/api/MODULE.md) | planificado | 022 | 2026-09-23 · Solo `package.json` del workspace. Sin `src/` hasta que su spec esté aprobada (el guardarraíl lo bloquea) |
| [`apps/cli`](../apps/cli/MODULE.md) | en-desarrollo | 001, 002, 027 | 2026-09-24 · Solo documentación: exportaciones de `index.ts` completas; 023 CA-001 marcada como parcial (mundo vacío) |
| [`apps/web`](../apps/web/MODULE.md) | planificado | 024 | 2026-09-23 · Solo `package.json` del workspace. Sin `src/` hasta que su spec esté aprobada (el guardarraíl lo bloquea) |
| [`apps/worker`](../apps/worker/MODULE.md) | en-desarrollo | 002, 027 | 2026-09-24 · `WorldWorker` (arranque, `pump` con órdenes de control y flush por lotes, cierre con `WORLD_CLOSED`) y `main.ts` (bucle de 100 ms, SIGTERM/SIGINT). Script `pnpm worker`. 9 pruebas |
| [`packages/engine`](../packages/engine/MODULE.md) | en-desarrollo | 001, 002, 014, 023 | 2026-09-24 · Solo documentación: tabla de API completa (tipos y constantes que faltaban), paquete `@mundo-social/engine` (el nombre actual), 002 CA-005 cubierta también desde la CLI, 023 CA-001 marcada como parcial (probada con un mundo vacío; la spec pide 100 personas) |
| [`packages/generators`](../packages/generators/MODULE.md) | en-desarrollo | 001, 023 | 2026-09-23 · Esqueleto del paquete: `package.json` (workspace, ESM, `exports` → `src/index.ts`) y `src/index.ts` vacío. Sin API todavía |
| [`packages/llm-gateway`](../packages/llm-gateway/MODULE.md) | planificado | 026 | 2026-09-23 · Documento creado (sin código) |
| [`packages/persistence`](../packages/persistence/MODULE.md) | en-desarrollo | 027 | 2026-09-24 · `WorldSession` (flush e instantáneas compartidos por el worker y la CLI), órdenes de control, cerrojo de escritor, `lastInput`/`countEvents`/`countSnapshots`. Sentencias preparadas una vez: 365 días pasan de 483 MB a 66 MB y de 2,3 s a 0,75 s. 5 pruebas nuevas |
