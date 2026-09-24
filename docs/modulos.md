# Módulos

> Archivo generado por `scripts/guardrails/indice.mjs`. No editar a mano: se actualiza solo a partir del `MODULE.md` de cada módulo.

Cada módulo (paquete, app o sistema del motor) tiene un `MODULE.md` que se actualiza **cada vez que se toca su código**. Plantilla: [`docs/modulos/_plantilla-MODULE.md`](modulos/_plantilla-MODULE.md).

| Módulo | Estado | Specs | Último cambio |
|---|---|---|---|
| [`apps/api`](../apps/api/MODULE.md) | planificado | 022 | 2026-09-23 · Solo `package.json` del workspace. Sin `src/` hasta que su spec esté aprobada (el guardarraíl lo bloquea) |
| [`apps/cli`](../apps/cli/MODULE.md) | en-desarrollo | 001, 002, 027 | 2026-09-24 · El nombre del mundo en las configuraciones de prueba y por defecto pasa de "Villa Cordillera" a "Data's World" (decisión del usuario). Sin cambios de comportamiento |
| [`apps/web`](../apps/web/MODULE.md) | planificado | 024 | 2026-09-23 · Solo `package.json` del workspace. Sin `src/` hasta que su spec esté aprobada (el guardarraíl lo bloquea) |
| [`apps/worker`](../apps/worker/MODULE.md) | en-desarrollo | 002, 027 | 2026-09-24 · El nombre del mundo en las configuraciones de prueba y por defecto pasa de "Villa Cordillera" a "Data's World" (decisión del usuario). Sin cambios de comportamiento |
| [`packages/engine`](../packages/engine/MODULE.md) | en-desarrollo | 001, 002, 014, 023, 029 | 2026-09-24 · `profile.ts` (`profileValue`/`profileNumber`/`profileEntry`/`checkProfile`); `WorldConfig.profile` y `WorldConfig.catalogs` opcionales, validados y dentro del hash; `ENGINE_VERSION` 0.2.0. Los tipos de las entidades se amplían en sus bloques (B a H). 6 pruebas |
| [`packages/generators`](../packages/generators/MODULE.md) | en-desarrollo | 001, 023 | 2026-09-24 · Submódulos `catalogs` y `country` con su MODULE.md; dependencia `zod`; datos en `catalogs/` y `profiles/` |
| [`packages/generators/src/catalogs`](../packages/generators/src/catalogs/MODULE.md) | en-desarrollo | 003, 004, 005, 006, 007, 030 | 2026-09-24 · Esquema Zod, cargador con hash y los 8 catálogos iniciales (lugares con entradas hasta P4, objetos, sectores CIIU, ocupaciones CIUO, niveles CINE, territorio, oficios informales, hechos históricos). 8 pruebas |
| [`packages/generators/src/country`](../packages/generators/src/country/MODULE.md) | en-desarrollo | 029 | 2026-09-24 · Perfiles `CO-2026.09` (46 entradas con fuente) y `prototipo`; carga con Zod y `checkProfile`; festivos de Colombia desde 1984 con la Ley 2578 de 2026. Dependencia nueva: `zod` 4 (ADR-001). 12 pruebas |
| [`packages/llm-gateway`](../packages/llm-gateway/MODULE.md) | planificado | 026 | 2026-09-23 · Documento creado (sin código) |
| [`packages/persistence`](../packages/persistence/MODULE.md) | en-desarrollo | 027 | 2026-09-24 · El nombre del mundo en las configuraciones de prueba y por defecto pasa de "Villa Cordillera" a "Data's World" (decisión del usuario). Sin cambios de comportamiento |
