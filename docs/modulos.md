# Módulos

> Archivo generado por `scripts/guardrails/indice.mjs`. No editar a mano: se actualiza solo a partir del `MODULE.md` de cada módulo.

Cada módulo (paquete, app o sistema del motor) tiene un `MODULE.md` que se actualiza **cada vez que se toca su código**. Plantilla: [`docs/modulos/_plantilla-MODULE.md`](modulos/_plantilla-MODULE.md).

| Módulo | Estado | Specs | Último cambio |
|---|---|---|---|
| [`apps/api`](../apps/api/MODULE.md) | planificado | 022 | 2026-09-23 · Solo `package.json` del workspace. Sin `src/` hasta que su spec esté aprobada (el guardarraíl lo bloquea) |
| [`apps/cli`](../apps/cli/MODULE.md) | en-desarrollo | 001, 002, 027 | 2026-09-24 · El nombre del mundo en las configuraciones de prueba y por defecto pasa de "Villa Cordillera" a "Data's World" (decisión del usuario). Sin cambios de comportamiento |
| [`apps/web`](../apps/web/MODULE.md) | planificado | 024 | 2026-09-23 · Solo `package.json` del workspace. Sin `src/` hasta que su spec esté aprobada (el guardarraíl lo bloquea) |
| [`apps/worker`](../apps/worker/MODULE.md) | en-desarrollo | 002, 027 | 2026-09-24 · El nombre del mundo en las configuraciones de prueba y por defecto pasa de "Villa Cordillera" a "Data's World" (decisión del usuario). Sin cambios de comportamiento |
| [`packages/engine`](../packages/engine/MODULE.md) | en-desarrollo | 001, 002, 003, 004, 006, 014, 023, 029 | 2026-09-24 · Tipos `Organization`, `Position`, `Shift`, `NewOrganization`, `NewPosition` y `addOrganization` validado (ids de puesto `ORG-0001/P01`, supervisor por índice). 2 pruebas |
| [`packages/generators`](../packages/generators/MODULE.md) | en-desarrollo | 001, 023 | 2026-09-24 · Submódulo `organizations` (organizaciones y puestos) |
| [`packages/generators/src/catalogs`](../packages/generators/src/catalogs/MODULE.md) | en-desarrollo | 003, 004, 005, 006, 007, 030 | 2026-09-24 · `place_kinds` 2026.09.2: atributo `occupations` (`{ boss, staff[] }`, códigos CIUO) en los 8 lugares de trabajo de M1 |
| [`packages/generators/src/country`](../packages/generators/src/country/MODULE.md) | en-desarrollo | 029 | 2026-09-24 · Nueva entrada `gen.jobs.bossWageFactor` = 1,6 en `CO-2026.09` (estimado, del prototipo): ya son 47 entradas |
| [`packages/generators/src/geography`](../packages/generators/src/geography/MODULE.md) | en-desarrollo | 003, 029 | 2026-09-24 · Plantilla `prototipo-64x40` con parcelas y puertas; `generateGeography` (mapa y jerarquía territorial con estrato y DIVIPOLA ficticio); `districtAt`. 7 pruebas: 003 CA-001 a CA-005 |
| [`packages/generators/src/organizations`](../packages/generators/src/organizations/MODULE.md) | en-desarrollo | 006, 029 | 2026-09-24 · `generateOrganizations`: 8 organizaciones, 45 puestos con ocupación CIUO, sueldo mensual con suelo en el salario mínimo (o diario en el perfil prototipo), turnos legales y cultura. 5 pruebas: 006 CA-007 (sueldos y turnos) y CA-002 en parte |
| [`packages/generators/src/places`](../packages/generators/src/places/MODULE.md) | en-desarrollo | 004, 029 | 2026-09-24 · `generatePlaces`: 23 lugares de la plantilla, 13 edificios con 82 viviendas, horario y capacidad del catálogo, tiles pintados. 8 pruebas: 004 CA-001, CA-002, CA-003, CA-006, INV-002, R-007 |
| [`packages/llm-gateway`](../packages/llm-gateway/MODULE.md) | planificado | 026 | 2026-09-23 · Documento creado (sin código) |
| [`packages/persistence`](../packages/persistence/MODULE.md) | en-desarrollo | 027 | 2026-09-24 · El mapa del mundo se guarda una vez en `meta.geo` y se carga con el mundo; los lugares con campos anidados se cargan con su tipo. 1 prueba nueva (mundo con mapa y lugares: guardar, cargar e instantánea con el mismo hash) |
