# Índice de especificaciones

Estados: `borrador` → `en-revision` → `aprobada` → `implementada` (→ `obsoleta`).
Solo se implementa lo que está **aprobada**. Toda spec nueva se crea con `/nueva-spec` a partir de `_plantilla.md`.

Las specs 001–024 corresponden a la lista del documento de visión. 025–028 se añaden porque la visión las exige de forma transversal (conocimiento vs verdad, uso del LLM, persistencia en un disco de 5 GB y experimentos).

<!-- INDICE:INICIO (generado por scripts/guardrails/indice.mjs, no editar a mano) -->
| Spec | Título | Hito | Depende de | Estado | Módulos que la implementan |
|---|---|---|---|---|---|
| [001](001-world.md) | Mundo |  |  |  | — |
| [002](002-time.md) | Tiempo |  |  |  | — |
| [003](003-geography.md) | Geografía |  |  |  | — |
| [004](004-places.md) | Lugares |  |  |  | — |
| [005](005-objects.md) | Objetos con historia |  |  |  | — |
| [006](006-organizations.md) | Organizaciones |  |  |  | — |
| [007](007-population.md) | Población |  |  |  | — |
| [008](008-households.md) | Hogares |  |  |  | — |
| [009](009-personality.md) | Personalidad y valores |  |  |  | — |
| [010](010-needs.md) | Necesidades, emociones y salud |  |  |  | — |
| [011](011-routines.md) | Rutinas |  |  |  | — |
| [012](012-relationships.md) | Relaciones asimétricas |  |  |  | — |
| [013](013-memory.md) | Memoria autobiográfica |  |  |  | — |
| [014](014-events.md) | Eventos |  |  |  | — |
| [015](015-economy.md) | Economía |  |  |  | — |
| [016](016-mobility.md) | Movilidad |  |  |  | — |
| [017](017-decision-engine.md) | Motor de decisiones |  |  |  | — |
| [018](018-learning.md) | Aprendizaje y hábitos |  |  |  | — |
| [019](019-causality.md) | Causalidad |  |  |  | — |
| [020](020-history.md) | Historia e informe de vida |  |  |  | — |
| [021](021-simulation.md) | Bucle de simulación, registro de sistemas y niveles de detalle |  |  |  | — |
| [022](022-observability.md) | Observación, API y métricas |  |  |  | — |
| [023](023-reproducibility.md) | Reproducibilidad y azar |  |  |  | — |
| [024](024-visualization.md) | Visualización pixel art |  |  |  | — |
| [025](025-knowledge.md) | Conocimiento, creencias y rumores |  |  |  | — |
| [026](026-llm-gateway.md) | Pasarela LLM |  |  |  | — |
| [027](027-persistence.md) | Persistencia |  |  |  | — |
| [028](028-experiments.md) | Experimentos y ramas |  |  |  | — |
<!-- INDICE:FIN -->

## Orden sugerido de revisión
1. **M0:** 001, 002, 014, 023, 027 (001, 002, 023 y 027 están más desarrolladas; 014 es corta y define la forma de los eventos).
2. **M1:** 003 → 004 → 006 → 009 → 007 → 008 → 005.
3. **M2:** 010 → 011 → 015 → 016 → 017 → 021.
4. **M3:** 013 → 012 → 025 → 019 → 020.
