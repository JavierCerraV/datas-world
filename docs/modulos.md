# Módulos

> Archivo generado por `scripts/guardrails/indice.mjs`. No editar a mano: se actualiza solo a partir del `MODULE.md` de cada módulo.

Cada módulo (paquete, app o sistema del motor) tiene un `MODULE.md` que se actualiza **cada vez que se toca su código**. Plantilla: [`docs/modulos/_plantilla-MODULE.md`](modulos/_plantilla-MODULE.md).

| Módulo | Estado | Specs | Último cambio |
|---|---|---|---|
| [`apps/api`](../apps/api/MODULE.md) | planificado | 022 | 2026-09-23 · Solo `package.json` del workspace. Sin `src/` hasta que su spec esté aprobada (el guardarraíl lo bloquea) |
| [`apps/cli`](../apps/cli/MODULE.md) | en-desarrollo | 001, 002, 027 | 2026-09-24 · El nombre del mundo en las configuraciones de prueba y por defecto pasa de "Villa Cordillera" a "Data's World" (decisión del usuario). Sin cambios de comportamiento |
| [`apps/web`](../apps/web/MODULE.md) | planificado | 024 | 2026-09-23 · Solo `package.json` del workspace. Sin `src/` hasta que su spec esté aprobada (el guardarraíl lo bloquea) |
| [`apps/worker`](../apps/worker/MODULE.md) | en-desarrollo | 002, 027 | 2026-09-24 · El nombre del mundo en las configuraciones de prueba y por defecto pasa de "Villa Cordillera" a "Data's World" (decisión del usuario). Sin cambios de comportamiento |
| [`packages/engine`](../packages/engine/MODULE.md) | en-desarrollo | 001, 002, 003, 004, 014, 023, 029 | 2026-09-24 · `Place` gana `capacity` y `openingHours` (tipo `OpeningHours`), validados en `addPlace`. 1 prueba |
| [`packages/generators`](../packages/generators/MODULE.md) | en-desarrollo | 001, 023 | 2026-09-24 · Submódulo `places` (lugares de las parcelas y viviendas) |
| [`packages/generators/src/catalogs`](../packages/generators/src/catalogs/MODULE.md) | en-desarrollo | 003, 004, 005, 006, 007, 030 | 2026-09-24 · Esquema Zod, cargador con hash y los 8 catálogos iniciales (lugares con entradas hasta P4, objetos, sectores CIIU, ocupaciones CIUO, niveles CINE, territorio, oficios informales, hechos históricos). 8 pruebas |
| [`packages/generators/src/country`](../packages/generators/src/country/MODULE.md) | en-desarrollo | 029 | 2026-09-24 · Perfiles `CO-2026.09` (46 entradas con fuente) y `prototipo`; carga con Zod y `checkProfile`; festivos de Colombia desde 1984 con la Ley 2578 de 2026. Dependencia nueva: `zod` 4 (ADR-001). 12 pruebas |
| [`packages/generators/src/geography`](../packages/generators/src/geography/MODULE.md) | en-desarrollo | 003, 029 | 2026-09-24 · Plantilla `prototipo-64x40` con parcelas y puertas; `generateGeography` (mapa y jerarquía territorial con estrato y DIVIPOLA ficticio); `districtAt`. 7 pruebas: 003 CA-001 a CA-005 |
| [`packages/generators/src/places`](../packages/generators/src/places/MODULE.md) | en-desarrollo | 004, 029 | 2026-09-24 · `generatePlaces`: 23 lugares de la plantilla, 13 edificios con 82 viviendas, horario y capacidad del catálogo, tiles pintados. 8 pruebas: 004 CA-001, CA-002, CA-003, CA-006, INV-002, R-007 |
| [`packages/llm-gateway`](../packages/llm-gateway/MODULE.md) | planificado | 026 | 2026-09-23 · Documento creado (sin código) |
| [`packages/persistence`](../packages/persistence/MODULE.md) | en-desarrollo | 027 | 2026-09-24 · El mapa del mundo se guarda una vez en `meta.geo` y se carga con el mundo; los lugares con campos anidados se cargan con su tipo. 1 prueba nueva (mundo con mapa y lugares: guardar, cargar e instantánea con el mismo hash) |
