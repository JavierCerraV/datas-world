# Índice de especificaciones

Estados: `borrador` → `en-revision` → `aprobada` → `implementada` (→ `obsoleta`).
Solo se implementa lo que está **aprobada**. Toda spec nueva se crea con `/nueva-spec` a partir de `_plantilla.md`.

Las specs 001–024 corresponden a la lista del documento de visión. 025–028 se añaden porque la visión las exige de forma transversal (conocimiento vs verdad, uso del LLM, persistencia en un disco de 5 GB y experimentos).

<!-- INDICE:INICIO (generado por scripts/guardrails/indice.mjs, no editar a mano) -->
| Spec | Título | Hito | Depende de | Estado | Módulos que la implementan |
|---|---|---|---|---|---|
| [001](001-world.md) | Mundo | M0 | 002, 023 | aprobada | `apps/cli`, `packages/engine`, `packages/generators` |
| [002](002-time.md) | Tiempo | M0 |  | implementada | `apps/cli`, `apps/worker`, `packages/engine` |
| [003](003-geography.md) | Geografía | M1 | 001, 023, 029 | aprobada | `packages/engine`, `packages/generators/src/catalogs`, `packages/generators/src/geography` |
| [004](004-places.md) | Lugares | M1 (generación) · M2 (ocupación y horarios) | 003, 029 | aprobada | `packages/engine`, `packages/generators/src/catalogs` |
| [005](005-objects.md) | Objetos con historia | M1 (objetos iniciales) · M2–M3 (transferencias, valor emocional, pérdidas) | 001, 007, 008, 014, 023, 029 | aprobada | `packages/generators/src/catalogs` |
| [006](006-organizations.md) | Organizaciones y ocupación | M1 (generación y empleo inicial) · M2 (desempeño, despidos, contratación) | 004, 023, 029 | aprobada | `packages/generators/src/catalogs` |
| [007](007-population.md) | Población | M1 (generación) · peldaño 4 (nacimientos y muertes) | 001, 003, 004, 006, 008, 009, 014, 023, 029 | aprobada | `packages/generators/src/catalogs` |
| [008](008-households.md) | Hogares | M1 (plantillas y composición) · M2–M3 (economía del hogar, clima, mudanzas) | 001, 004, 023, 029 | aprobada | — |
| [009](009-personality.md) | Personalidad y valores | M1 (generación) · M2–M3 (efectos y cambio lento) | 001, 023 | aprobada | — |
| [010](010-needs.md) | Necesidades, emociones y salud | M2 | 007, 009 | borrador | — |
| [011](011-routines.md) | Rutinas | M2 | 010, 006, 004, 002 | borrador | — |
| [012](012-relationships.md) | Relaciones asimétricas | M3 | 007, 009, 013 | borrador | — |
| [013](013-memory.md) | Memoria autobiográfica | M3 (episódica) · M5 (consolidación) | 014, 010, 021 | borrador | — |
| [014](014-events.md) | Eventos | M2 | 001, 002 | implementada | `packages/engine` |
| [015](015-economy.md) | Economía | M2 | 006, 008, 007 | borrador | — |
| [016](016-mobility.md) | Movilidad | M2 | 003, 004 | borrador | — |
| [017](017-decision-engine.md) | Motor de decisiones | M2 | 010, 011, 012, 015 | borrador | — |
| [018](018-learning.md) | Aprendizaje y hábitos | M5 | 017, 013 | borrador | — |
| [019](019-causality.md) | Causalidad | M3 | 014 | borrador | — |
| [020](020-history.md) | Historia e informe de vida | M3 | 014, 019, 013 | borrador | — |
| [021](021-simulation.md) | Bucle de simulación, registro de sistemas y niveles de detalle | M2 | 001, 002, 017, 014 | borrador | — |
| [022](022-observability.md) | Observación, API y métricas | M4 | 027, 019, 020 | borrador | `apps/api` |
| [023](023-reproducibility.md) | Reproducibilidad y azar | M0 (base) · M5 (rewind/replay y ramas) | 001, 002 | aprobada | `packages/engine`, `packages/generators` |
| [024](024-visualization.md) | Visualización pixel art | M4 | 022, 003, 004 | borrador | `apps/web` |
| [025](025-knowledge.md) | Conocimiento, creencias y rumores | M3 | 012, 013, 014 | borrador | — |
| [026](026-llm-gateway.md) | Pasarela LLM | M6 | 017, 025, 021 | borrador | `packages/llm-gateway` |
| [027](027-persistence.md) | Persistencia | M0 (base) · M4 (retención) | 001, 002, 014 | aprobada | `apps/cli`, `apps/worker`, `packages/persistence` |
| [028](028-experiments.md) | Experimentos y ramas | M5 | 023, 027, 022 | borrador | — |
| [029](029-country-profile.md) | Perfil de país: Colombia | M1 (demografía, territorio, festivos, salario base) · M2 (reglas laborales y de economía) | 001, 002 | aprobada | `packages/engine`, `packages/generators/src/country`, `packages/generators/src/geography` |
| [030](030-generated-history.md) | Historia generada (1900 → presente) | M1 | 001, 003, 004, 006, 007, 008, 014, 023, 029 | aprobada | `packages/generators/src/catalogs` |
<!-- INDICE:FIN -->

## Orden sugerido de revisión
1. **M0:** 001, 002, 014, 023, 027 (001, 002, 023 y 027 están más desarrolladas; 014 es corta y define la forma de los eventos).
2. **M1:** 003 → 004 → 006 → 009 → 007 → 008 → 005.
3. **M2:** 010 → 011 → 015 → 016 → 017 → 021.
4. **M3:** 013 → 012 → 025 → 019 → 020.
