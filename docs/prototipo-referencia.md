# El prototipo como referencia de comportamiento

`prototipo/index.html` es **el camino**: la simulación que se construye en TypeScript debe comportarse, como mínimo, como el prototipo, y mejorarlo donde las specs lo pidan. Este documento fija qué significa eso de forma comprobable.

> **Alcance desde el 2026-09-25 (ADR-007).** El prototipo sigue siendo la referencia de **mundo** (geografía, lugares, población, hogares), **economía** y **parte visual**. Para la **conducta** (decisiones, emociones, estrés, ánimo, afrontamiento) deja de ser la referencia de paridad: su personalidad a utilidad es justo lo que el motor funcional-contextual sustituye. La referencia de conducta es la batería de validación conductual (spec 042). En la línea base, las métricas de ánimo y estrés pasan a ser comprobaciones de cordura (sin NaN, rangos amplios), no tolerancias de paridad. Las filas de `newAgent` (rasgos y valores), `decide`, `updateNeeds` y `bump` del mapa se leen con esta salvedad.

> **Alcance desde el 2026-09-30 (decisión del usuario; 024 v0.5).** El prototipo ya cumplió su función de guiar la etapa temprana. La referencia de la interfaz pasa a ser el lienzo aprobado «Visor A+» (https://claude.ai/artifact/L27kh8DDNoNa5R9uimn97B). El prototipo queda como registro histórico de solo lectura; la línea base y `pnpm cli validate:parity` son informativas y ya no bloquean.

## Reglas

1. **El prototipo es de solo lectura.** Los guardarraíles bloquean su edición. Si hay que cambiarlo (por ejemplo, para explorar una idea antes de especificarla), el usuario crea `.guardrails/permitir-referencia`, se hace el cambio, se regenera la línea base y se borra el archivo.
2. **Se porta el comportamiento, no el código.** El prototipo es un único archivo con estado global mutable; el motor TS usa funciones puras, tipos, eventos con causas y flujos RNG. Por eso no se busca igualdad bit a bit, sino **paridad estadística**.
3. **Cada `MODULE.md` tiene su sección 7 "Paridad con el prototipo"** con las funciones que porta, los parámetros heredados y las diferencias deliberadas.
4. **La línea base se regenera** con `node scripts/prototipo/linea-base.mjs --seeds 100-109 --days 365` y se guarda en `docs/validaciones/linea-base-prototipo.json` (versionada).

## Mapa prototipo → specs → módulos

| Prototipo (`/*ENGINE*/`) | Qué hace | Spec | Módulo destino |
|---|---|---|---|
| `sm32`, `class RNG` | PRNG con semilla, `range`, `normal`, `pick`, `chance` | 023 | `packages/engine` (rng) |
| `isRoad`, `genWorld`, `buildPlaces` | Mapa 64×40, 3 barrios, calles, edificios | 003, 004 | `generators/src/geography`, `generators/src/places` |
| `newAgent` | Identidad, rasgos (normal 0.5, sd .17, 22 % con rasgo extremo), valores, necesidades, ahorro por estrato, biografía | 007, 009 | `generators/src/population`, `generators/src/personality` |
| `genPopulation`, `famPair`, `linkParent`, `linkSibs` | Hogares y parentesco | 008, 012 | `generators/src/households` |
| `hire`, `genJobs`, `arriveWork`, `fire` | Empleo, llegadas tarde, advertencias, despido | 006 | `engine/src/work` |
| `genRelations`, `rel`, `setRel`, `firstMeet`, `upgrade`, `interact` | Relaciones asimétricas (cercanía, confianza, conflicto), amistades, parejas, discusiones | 012 | `engine/src/relationships` |
| `newObj`, `genObjects`, `giveGift`, `purchase` | Objetos con historia y valor emocional, compras | 005, 015 | `engine/src/objects`, `engine/src/economy` |
| `genFacts`, `addFact`, `share` | Verdad vs creencias, rumores, historias propias (`selfStory`) | 025 | `engine/src/knowledge` |
| `setRoutine`, `wakeFor`, `inSleep`, `sleepUntil` | Rutinas de sueño/trabajo/estudio | 011 | `engine/src/routines` |
| `mStrength`, `mem` | Memoria con decaimiento `i·e^(−edad/τ)`, τ = 5 + 40·i + 10·r días, distorsión | 013 | `engine/src/memory` |
| `ev` | Evento con actores, texto y causas | 014, 019 | `packages/engine` (events) |
| `path`, `go` | Rutas y desplazamiento | 016 | `engine/src/mobility` |
| `decide`, `onStart`, `onEnd` | Elección de actividad | 017 | `engine/src/decision` |
| `updateNeeds`, `bump` | Necesidades, estrés, ánimo | 010 | `engine/src/needs` |
| `daily` | Procesos diarios: salarios, gastos, deudas, cumpleaños, salud | 015, 021 | `engine/src/economy`, `engine/src/simulation` |
| `tick` | Bucle de 5 minutos | 021 | `engine/src/simulation` |
| UI (canvas, inspector, controles) | Visor pixel art | 024 | `apps/web` |

## Parámetros calibrados que se heredan como valores por defecto

| Parámetro | Valor en el prototipo | Spec |
|---|---|---|
| Tick | 5 min | 002 |
| Rasgos | normal(0.5, 0.17) recortada a [0.03, 0.97]; 22 % con un rasgo extremo | 009 |
| Ahorro inicial por estrato (miles COP) | [300–1 600], [800–4 000], [2 500–9 000] | 015 |
| Costo diario por estrato (COP) | 35 000 / 55 000 / 85 000 | 015 |
| Drenaje de energía | 0.045/h (0.058/h en condiciones exigentes) | 010 |
| Umbral para quedarse dormido | energía al despertar < 0.72 | 010 |
| Temperatura base de decisión | 0.3, ruido 0.12 | 017 |
| Ganancia de cercanía por interacción | 0.016 | 012 |
| Límite de discusiones registradas | 1 por par cada 2 días | 012 |
| Histéresis de deuda | entra en deuda con saldo < −200 000 | 015 |

## Línea base (10 semillas × 365 días, ~60 personas)

Valores medios de `docs/validaciones/linea-base-prototipo.json`:

| Métrica | Prototipo | Tolerancia para el motor TS |
|---|---|---|
| Valores NaN o fuera de rango | 0 | 0 (obligatorio) |
| Ánimo medio | 0.54 (sd entre personas 0.09) | 0.46–0.62, sd > 0.05 |
| Estrés medio | 0.33 | 0.25–0.41 |
| Adultos con empleo | 85 % | 70–90 % (spec 007 pide 60–70 %: decidir) |
| Relaciones con cercanía > 0.3 por persona | 16 | 3–15 según spec 012 → **el prototipo se pasa** |
| Memorias activas por persona | 58 | ≤ 200 (spec 013) |
| Eventos por año (por mundo) | amistades 334, compras 213, salud 141, cumpleaños 61, regalos 59, rumores 55, discusiones 50, llegadas tarde 44, objetos perdidos 30, deudas 29, empleos nuevos 20, despidos 15, parejas nuevas 2, rupturas ~0 | cada tipo presente; rupturas > 0 |

## Desviaciones conocidas del prototipo (no copiar)

- **Demasiadas amistades** (334 eventos/año, 16 vínculos cercanos por persona): la ganancia de cercanía o el umbral de `upgrade` son altos. La spec 012 manda.
- **Casi no hay rupturas de pareja** en un año: falta presión acumulada en parejas.
- **Solo 60 personas y ningún nivel de simulación**: el motor TS debe escalar a 500 con la spec 021.
- **Eventos con nombres mezclados** (`LLEGADA_TARDE`, `SALUD`, `AMISTAD`…): en el motor TS todos van en inglés `UPPER_SNAKE_CASE` según la spec 014 (`ARRIVED_LATE`, `FELL_ILL`, `FRIENDSHIP_FORMED`, `OBJECT_GIFTED`, `BIRTHDAY`, `DEBT_TAKEN`, `RUMOR_SPREAD`).
- **Sin rewind ni persistencia**.

## Cuándo se compara

A partir de M2, cada tarea que cambie comportamiento termina con `pnpm cli validate:parity` (comando que se crea en M2). Este compara 10 semillas × 365 días del motor TS con la línea base y escribe el resultado en `docs/validaciones/`. Si una métrica sale de tolerancia, hay dos opciones: se corrige, o se justifica en la spec y en la sección 7 del `MODULE.md`.
