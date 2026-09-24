# Módulos

> Archivo generado por `scripts/guardrails/indice.mjs`. No editar a mano: se actualiza solo a partir del `MODULE.md` de cada módulo.

Cada módulo (paquete, app o sistema del motor) tiene un `MODULE.md` que se actualiza **cada vez que se toca su código**. Plantilla: [`docs/modulos/_plantilla-MODULE.md`](modulos/_plantilla-MODULE.md).

| Módulo | Estado | Specs | Último cambio |
|---|---|---|---|
| [`apps/api`](../apps/api/MODULE.md) | planificado | 022 | 2026-09-23 · Solo `package.json` del workspace. Sin `src/` hasta que su spec esté aprobada (el guardarraíl lo bloquea) |
| [`apps/cli`](../apps/cli/MODULE.md) | en-desarrollo | 001, 002, 027 | 2026-09-24 · La medición de < 2 s de la 002 CA-005 sale de `cli.test.ts` (falso fallo de 2,08 s en la CI, con 15 archivos en paralelo) y pasa a `pnpm bench --check`, en un paso propio de la CI. 1 prueba nueva |
| [`apps/web`](../apps/web/MODULE.md) | planificado | 024 | 2026-09-23 · Solo `package.json` del workspace. Sin `src/` hasta que su spec esté aprobada (el guardarraíl lo bloquea) |
| [`apps/worker`](../apps/worker/MODULE.md) | en-desarrollo | 002, 027 | 2026-09-24 · Renombrado de los paquetes `@mundo-social/*` → `@datas-world/*` (imports y `package.json`). Sin cambios de comportamiento |
| [`packages/engine`](../packages/engine/MODULE.md) | en-desarrollo | 001, 002, 014, 023 | 2026-09-24 · Renombrado de los paquetes `@mundo-social/*` → `@datas-world/*` (imports y `package.json`). Sin cambios de comportamiento |
| [`packages/generators`](../packages/generators/MODULE.md) | en-desarrollo | 001, 023 | 2026-09-23 · Esqueleto del paquete: `package.json` (workspace, ESM, `exports` → `src/index.ts`) y `src/index.ts` vacío. Sin API todavía |
| [`packages/llm-gateway`](../packages/llm-gateway/MODULE.md) | planificado | 026 | 2026-09-23 · Documento creado (sin código) |
| [`packages/persistence`](../packages/persistence/MODULE.md) | en-desarrollo | 027 | 2026-09-24 · Renombrado de los paquetes `@mundo-social/*` → `@datas-world/*` (imports y `package.json`). Sin cambios de comportamiento |
