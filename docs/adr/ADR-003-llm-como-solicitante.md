# ADR-003 — El LLM como solicitante, nunca como fuente de verdad

- **Estado:** aceptada
- **Fecha:** 2026-09-23

## Contexto

La visión permite usar modelos de lenguaje para expresión natural (diálogos, diarios, reflexiones) y para decisiones complejas de nivel 4, pero advierte que el mundo no debe depender de ellos.

## Decisión

1. El MVP (M0–M5) **no usa LLM**. Existe un proveedor `mock` determinista para las interfaces.
2. En M6 se introduce `packages/llm-gateway`:
   - El LLM recibe **solo el conocimiento de la persona** (creencias, memorias, estado subjetivo), nunca la verdad del mundo.
   - Devuelve **propuestas estructuradas** validadas con Zod (`{ action, target, reason }`) o **texto de expresión** marcado como tal.
   - El motor valida precondiciones; si la propuesta es inválida se descarta y se registra `LLM_PROPOSAL_REJECTED`.
   - Las respuestas se guardan en caché por `hash(prompt, persona, estado)` y se registran como entradas externas para que el replay sea reproducible sin volver a llamar al modelo.
   - Presupuesto diario configurable (tokens y €); al agotarse, el sistema cae a reglas.
3. Solo personas en **nivel 4** (observadas o en situaciones críticas) pueden usar LLM.

## Consecuencias

- El mundo funciona igual sin conexión o sin presupuesto.
- La reproducibilidad se mantiene porque las respuestas del LLM se tratan como entradas registradas.
