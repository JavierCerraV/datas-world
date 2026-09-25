# Índice de especificaciones

Estados: `borrador` → `en-revision` → `aprobada` → `implementada` (→ `obsoleta`).
Solo se implementa lo que está **aprobada**. Toda spec nueva se crea con `/nueva-spec` a partir de `_plantilla.md`.

Las specs 001–024 corresponden a la lista del documento de visión. 025–028 se añaden porque la visión las exige de forma transversal (conocimiento vs verdad, uso del LLM, persistencia en un disco de 5 GB y experimentos).

<!-- INDICE:INICIO (generado por scripts/guardrails/indice.mjs, no editar a mano) -->
| Spec | Título | Hito | Depende de | Estado | Módulos que la implementan |
|---|---|---|---|---|---|
| [001](001-world.md) | Mundo | M0 | 002, 023 | implementada | `apps/cli`, `packages/engine`, `packages/engine/src/simulation`, `packages/generators`, `packages/generators/src/population` |
| [002](002-time.md) | Tiempo | M0 |  | implementada | `apps/cli`, `apps/worker`, `packages/engine`, `packages/engine/src/simulation` |
| [003](003-geography.md) | Geografía | M1 | 001, 023, 029 | implementada | `packages/engine`, `packages/generators/src/amenities`, `packages/generators/src/catalogs`, `packages/generators/src/geography`, `packages/generators/src/history` |
| [004](004-places.md) | Lugares | M1 (generación) · M2 (ocupación y horarios) | 003, 029 | aprobada | `packages/engine`, `packages/generators/src/amenities`, `packages/generators/src/catalogs`, `packages/generators/src/history`, `packages/generators/src/places` |
| [005](005-objects.md) | Objetos con historia | M1 (objetos iniciales) · M2–M3 (transferencias, valor emocional, pérdidas) | 001, 007, 008, 014, 023, 029 | aprobada | `packages/engine`, `packages/generators/src/catalogs`, `packages/generators/src/objects` |
| [006](006-organizations.md) | Organizaciones y ocupación | M1 (generación y empleo inicial) · M2 (desempeño, despidos, contratación) | 004, 023, 029 | aprobada | `packages/engine`, `packages/engine/src/routines`, `packages/generators/src/catalogs`, `packages/generators/src/employment`, `packages/generators/src/health`, `packages/generators/src/history`, `packages/generators/src/organizations` |
| [007](007-population.md) | Población | M1 (generación) · peldaño 4 (nacimientos y muertes) | 001, 003, 004, 006, 008, 009, 014, 023, 029 | implementada | `packages/engine`, `packages/generators/src/catalogs`, `packages/generators/src/employment`, `packages/generators/src/history`, `packages/generators/src/population` |
| [008](008-households.md) | Hogares | M1 (plantillas y composición) · M2–M3 (economía del hogar, clima, mudanzas) | 001, 004, 023, 029 | aprobada | `packages/engine`, `packages/generators/src/catalogs`, `packages/generators/src/population` |
| [009](009-personality.md) | Personalidad y valores | M1 (generación) · M2–M3 (efectos y cambio lento) | 001, 023 | aprobada | `packages/engine/src/needs`, `packages/generators/src/catalogs`, `packages/generators/src/leisure`, `packages/generators/src/personality`, `packages/generators/src/population` |
| [010](010-needs.md) | Necesidades, emociones y salud del día a día | M2 (5 necesidades, emociones, estrés, ánimo, enfermedad aguda) · M3 (seguridad, autonomía, propósito) | 007, 009, 021, 031, 032 | aprobada | `packages/engine/src/needs`, `packages/engine/src/routines` |
| [011](011-routines.md) | Rutinas | M2 · M5 (hábitos que la ajustan, 018) | 002, 004, 006, 010, 021, 029, 032 | aprobada | `packages/engine/src/routines` |
| [012](012-relationships.md) | Relaciones asimétricas | M3 | 007, 009, 013 | borrador | — |
| [013](013-memory.md) | Memoria autobiográfica | M3 (episódica) · M5 (consolidación) | 014, 010, 021 | borrador | — |
| [014](014-events.md) | Eventos | M2 | 001, 002 | implementada | `packages/engine`, `packages/generators/src/population` |
| [015](015-economy.md) | Economía | M2 | 006, 007, 008, 021, 029, 031, 032, 033 | aprobada | — |
| [016](016-mobility.md) | Movilidad | M2 | 003, 004, 005, 015, 021, 033 | aprobada | — |
| [017](017-decision-engine.md) | Motor de decisiones | M2 (decisión con estado propio e información pública) · M3 (con creencias, 025) | 009, 010, 011, 015, 016, 021, 032 | aprobada | — |
| [018](018-learning.md) | Aprendizaje y hábitos | M5 | 017, 013 | borrador | — |
| [019](019-causality.md) | Causalidad | M3 | 014 | borrador | — |
| [020](020-history.md) | Historia e informe de vida | M3 | 014, 019, 013 | borrador | — |
| [021](021-simulation.md) | Bucle de simulación, registro de sistemas y niveles de detalle | M2 (registro de sistemas, niveles 1 y 2) · M3–M4 (niveles 3 y 4, observación) · M7 (nivel 0, escala) | 001, 002, 017, 014 | aprobada | `packages/engine/src/needs`, `packages/engine/src/routines`, `packages/engine/src/simulation` |
| [022](022-observability.md) | Observación, API y métricas | M4 | 027, 019, 020 | borrador | `apps/api` |
| [023](023-reproducibility.md) | Reproducibilidad y azar | M0 (base) · M5 (rewind/replay y ramas) | 001, 002 | aprobada | `apps/cli`, `packages/engine`, `packages/engine/src/simulation`, `packages/generators` |
| [024](024-visualization.md) | Visualización pixel art | M4 | 022, 003, 004 | borrador | `apps/web` |
| [025](025-knowledge.md) | Conocimiento, creencias y rumores | M3 | 012, 013, 014 | borrador | — |
| [026](026-llm-gateway.md) | Pasarela LLM | M6 | 017, 025, 021 | borrador | `packages/llm-gateway` |
| [027](027-persistence.md) | Persistencia | M0 (base) · M4 (retención) | 001, 002, 014 | aprobada | `apps/cli`, `apps/worker`, `packages/persistence` |
| [028](028-experiments.md) | Experimentos y ramas | M5 | 023, 027, 022 | borrador | — |
| [029](029-country-profile.md) | Perfil de país: Colombia | M1 (demografía, territorio, festivos, salario base) · M2 (reglas laborales y de economía) | 001, 002 | implementada | `apps/cli`, `packages/engine`, `packages/engine/src/routines`, `packages/generators/src/amenities`, `packages/generators/src/country`, `packages/generators/src/employment`, `packages/generators/src/geography`, `packages/generators/src/health`, `packages/generators/src/history`, `packages/generators/src/leisure`, `packages/generators/src/objects`, `packages/generators/src/organizations`, `packages/generators/src/personality`, `packages/generators/src/places`, `packages/generators/src/population` |
| [030](030-generated-history.md) | Historia generada (1900 → presente) | M1 | 001, 003, 004, 006, 007, 008, 014, 023, 029 | implementada | `apps/cli`, `packages/engine`, `packages/generators/src/catalogs`, `packages/generators/src/health`, `packages/generators/src/history` |
| [031](031-health-profile.md) | Ficha de salud | M1 (ficha inicial) · M2 (efectos en necesidades, rutinas y economía) · peldaño 4 (evolución de las condiciones) | 006, 007, 008, 009, 010, 014, 023, 029, 030 | aprobada | `packages/engine/src/needs`, `packages/generators/src/health`, `packages/generators/src/leisure` |
| [032](032-leisure.md) | Esparcimiento | M1 (ficha inicial) · M2 (actividades en la rutina y gasto) · M3 (con amigos) · M5 (hábitos que cambian) | 004, 007, 009, 010, 011, 012, 015, 023, 029, 031, 033 | aprobada | `packages/generators/src/leisure` |
| [033](033-urban-amenities.md) | Dotación urbana | M1 (dotación inicial y nueva plantilla de mapa) · M2 (uso: horarios, capacidad, viajes a la ciudad) · peldaño 4+ (crecimiento) | 003, 004, 006, 016, 023, 029, 030 | aprobada | `packages/generators/src/amenities`, `packages/generators/src/leisure` |
| [034](034-clinical-sessions.md) | Sesiones e intervenciones | Después (capa clínica, tras M7; ver docs/roadmap.md) · enganches en M3–M6 (ver §2) | 010, 012, 013, 017, 019, 020, 023, 025, 026, 028, 031 | borrador | — |
<!-- INDICE:FIN -->

## Orden sugerido de revisión
1. **M0:** 001, 002, 014, 023, 027 (001, 002, 023 y 027 están más desarrolladas; 014 es corta y define la forma de los eventos).
2. **M1:** 003 → 004 → 006 → 009 → 007 → 008 → 005.
3. **M2:** 010 → 011 → 015 → 016 → 017 → 021.
4. **M3:** 013 → 012 → 025 → 019 → 020.
