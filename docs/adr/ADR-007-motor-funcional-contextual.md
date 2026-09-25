# ADR-007 — Motor de comportamiento funcional-contextual

- **Estado:** propuesta (pendiente de revisión del usuario)
- **Fecha:** 2026-09-25
- **Documentos base:** `docs/investigacion/motor-comportamiento-humano.md` (documento rector) y `docs/investigacion/mchugh-naturaleza-verbal-gozo-sufrimiento.pdf`.

## Contexto

Hasta M2 la conducta sale de una **función de utilidad** (spec 017) cuyos términos incluyen rasgos de personalidad (spec 009 v0.3):
- la impulsividad fija la temperatura de la elección;
- la responsabilidad suma utilidad a las obligaciones y resta minutos de sueño;
- el neuroticismo multiplica el estrés;
- el afrontamiento se deriva del neuroticismo;
- los valores son 12 escalares.

El documento rector (§12) prohíbe exactamente ese tipo de explicación: "evita porque es evitativo". El objetivo del proyecto es construir personas cuyos patrones **emerjan de su historia** y se puedan reconstruir funcionalmente (§12), no fabricar pacientes.

## Decisión

### 1. Seis capas con una dirección de dependencias fija

| Capa | Qué contiene | Spec | Lee | Escribe |
|---|---|---|---|---|
| 1. Temperamento | Descriptores Big Five y parámetros de aprendizaje `tmp.*` | 009 v1.0 | — | parámetros (generación, `TRAIT_SHIFT`) |
| 2. Estímulos y funciones | Ontología compartida, funciones por persona con origen, aprendizaje respondiente y operante, extinción contextual, generalización, reforzadores generalizados, registro de contingencias | 036 | 1, contexto, consecuencias | funciones, fuerzas de respuesta |
| 3. Red relacional | Marcos con Crel, vinculación mutua y combinatoria perezosa, transformación de funciones con Cfunc | 037 | 1 (tasas), 2 | relaciones, funciones derivadas (caché) |
| 4. Reglas, valores y augmentals | Reglas como redes; pliance, tracking y augmenting; valores como redes jerárquicas con red opuesta | 038 | 2, 3 | reglas, historia de seguimiento |
| 5. Eventos privados y flexibilidad | Pensamientos y emociones como estímulos; proceso de PNR; evitación experiencial; repertorio de enmarque jerárquico con el deíctico "Yo" | 039 | 1–4 | eventos privados, repertorios |
| 6. Selección de conducta | Competencia entre fuentes de control; igualación o softmax; vector de aportes por fuente | 040 | 2–5 y estados aprendidos, **nunca 1** | conducta emitida (acción, 017 R-006) |

Dirección: 1 → 2 → 3 → 4 → 5 → 6 → consecuencias → 2… La capa 6 no lee la 1. Si el temperamento debe influir en algo que la capa 6 usa (variabilidad, descuento), lo hace fijando el **valor inicial y la plasticidad** de un estado aprendido (`hist.variability`, `hist.discountK`). Ese estado lo actualiza la historia, y es lo único que lee la capa 6.

Las necesidades de la 010 pasan a ser **operaciones motivadoras**: cambian la eficacia de los reforzadores, no son objetivos que se suman a la utilidad.

### 2. Estado por persona acotado y derivación perezosa
- Funciones, relaciones, reglas, fuerzas de respuesta y eventos privados viven en almacenes por persona con topes, poda por fuerza y archivo en SQLite de lo podado (ADR-005, idea B; spec 027).
- Las relaciones derivadas y las funciones transformadas **no se guardan**: se calculan bajo demanda con profundidad limitada y se guardan en una caché por persona que se invalida al cambiar la red.
- Presupuesto objetivo: ≈ 16 KB adicionales por persona. Hoy son ≈ 16 KB por persona viva (M1), así que el total sería ≈ 32 KB, dentro del objetivo de 40 KB del peldaño 4 (ver `impacto-motor-funcional.md` §6).

### 3. Explicabilidad funcional como contrato
Cada conducta emitida guarda su **vector de aportes por fuente de control** (consecuencia inmediata, demorada, regla por tipo, valor o augmental, hábito, función aversiva presente, operación motivadora, contexto social). Las causas del evento resultante se construyen desde ese vector y desde los eventos que dieron origen a cada función (spec 019). Esto sustituye al `explain` de factores de utilidad de la 017.

### 4. Big Five → temperamento por mapeo configurable (opción a)
El Big Five se genera primero, como hoy, y una tabla de mapeo configurable con ruido residual por persona produce los parámetros `tmp.*` (009 v1.0 R-002).
- **Por qué:**
  - conserva la generación validada de M1 y su paridad con el prototipo;
  - permite enchufar la tabla de expertos sin cambiar código;
  - deja un descriptor legible para informes.
- **Alternativa (b), descartada y reversible:** generar los `tmp.*` directamente y calcular el Big Five como descriptor observable desde la conducta emergente (por ejemplo, con escalas conductuales sobre la trayectoria).
  - Es más pura (el descriptor no causa nada), pero pierde la paridad de generación y retrasa el enganche de la tabla de expertos.
  - Se puede cambiar en el futuro sin tocar las capas 2–6, porque estas solo leen `tmp.*`.

### 5. Guardarraíl anticircularidad verificable
- Una prueba de arquitectura en `packages/engine` y una regla de ESLint (`no-restricted-imports`) fallan si un módulo de selección de conducta, o cualquier sistema fuera de la lista permitida, lee `tmp.*`, lee `pers.*` o importa el módulo de temperamento (009 R-006, CA-B).
- Va en `pnpm check` (y por tanto en el pre-commit y en la CI).
- No modifica `scripts/guardrails/`: así evitamos tocar los guardarraíles sin necesidad, y la prueba vive junto al código que protege.

### 6. Estatus epistémico explícito
Toda regla de conducta lleva [E], [T] o [M] (plantilla de specs, §4 bis). Lo que depende de un juicio experto se implementa como [M] parametrizado y se registra en `docs/investigacion/preguntas-abiertas.md`.

### 7. El prototipo deja de ser la referencia de conducta
Para decisiones, emociones, estrés y ánimo, la referencia pasa a ser la **batería de validación conductual** (spec 042). El prototipo sigue siendo la referencia de mundo, economía y parte visual (`docs/prototipo-referencia.md`).

## Alternativas consideradas

- **Mantener la utilidad y "enriquecerla"** con más términos (valores en red, hábitos): no elimina la circularidad, porque la personalidad seguiría sumando a la elección.
- **Aprendizaje por refuerzo genérico (TD/Q-learning) como núcleo:** modela bien la adquisición operante, pero no la vinculación derivada, la transformación de funciones, la conducta gobernada por reglas ni la red de valores. Se usa como **pieza** de la capa 2 (actualizaciones tipo Rescorla-Wagner y TD), no como arquitectura.
- **Redes neuronales o LLM como generadores de conducta:** opacos a la explicación funcional y no deterministas sin mucho esfuerzo; contrarios a la regla de oro 7 y a ADR-003.
- **Rasgos clínicos como variables de estado** (`experiential_avoidance`, `rumination`): prohibido por el documento rector §7–§8; los patrones deben ser procesos.

## Consecuencias

- **Specs:**
  - 009 se reescribe (v1.0);
  - 017 y 018 quedan sustituidas por 040 y 036;
  - 010, 011, 012, 013, 014, 019, 020, 021, 025, 031 y 032 se adaptan (tabla en 035 §8);
  - specs nuevas: 035–042.
- **Migración:** un adaptador temporal `@deprecated` (`temperament/legacy.ts`) mantiene funcionando necesidades, rutinas, decisiones y generadores mientras se construyen las capas. Se elimina en el bloque MF7 y una comprobación falla si sigue existiendo después (plan en `tasks/MF-motor-funcional.md`).
- **Mundos:** cambian los catálogos de personalidad, así que cambian los hashes de los mundos nuevos (009 INV-002). El mundo de ejemplo de M1 se sigue cargando (027 R-011) mediante una migración que descarta las columnas eliminadas.
- **Hoja de ruta:** el motor funcional se intercala entre M2 y M3 (hito MF), porque la vida social de M3 (012, 025) se escribe directamente sobre él.
- **Coste:** más estado por persona y cálculo de derivaciones. Hay que medirlo con `pnpm bench` en cada bloque MF.

## Specs afectadas

009 (1.0), 010, 011, 012, 013, 014, 017, 018, 019, 020, 021, 023, 025, 031, 032; nuevas 035–042.
