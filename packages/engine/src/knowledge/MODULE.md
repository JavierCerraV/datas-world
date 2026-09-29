---
modulo: knowledge
ruta: packages/engine/src/knowledge
estado: estable
specs: [025, 012, 036, 044]
actualizado: 2026-09-29
---

# Módulo: knowledge

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Conocimiento, creencias y rumores (spec 025 v0.2): lo que cada persona sabe o cree de otras, por presenciarlo o porque se lo contaron en un encuentro (012), evaluado con el mecanismo de la charla (044). La verdad se calcula solo para el análisis.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 025 | CA-001, CA-003, CA-004 (unidad); CA-002 y CA-005 (100 personas × 1 año en `packages/generators`) | — |

## 3. API pública
- `createKnowledgeSystem({ cat, chat, onto, claim, p })`: fase `end_of_day`, orden 7, capacidad `beliefs`, cada tick. Aplica lo presenciado, lo oído (`RUMOR_TOLD`, con `RUMOR_DISTORTED` e intenciones) y lo corregido (`BELIEF_CORRECTED`).
- `tellInEncounter(view, teller, listener, here, deps, now, rng)`: lo que cuenta quien se abre en un encuentro. Lo llama el sistema de encuentros de la 012.
- `topicsOf`, `learnBelief` (`learn`), `hear`, `closeness`, `beliefTruth` (solo análisis).
- `KNOWLEDGE_DEFAULTS`, `SEEN` (`visto`), `TELL` (`social.contar`), `topicOf`; tipos `TopicDef`, `KnowledgeCatalog`, `KnowledgeParams`, `TellSide`, `TellDeps`, `Hearing`, `Listener`.

## 4. Diseño interno y decisiones
- **Temas (R-001).** El catálogo `rumor_topics` (generadores) define, para cada tema:
  - el evento que lo hace verdad y de quién trata (su `citizenId` o los dos del par);
  - su grupo y estado: dos temas del mismo grupo con distinto estado se contradicen;
  - su nivel (1 = versión deformada) y a qué escala.

  Las afirmaciones de la charla que se pueden repetir (`infiel`, `quiere_separarse`, `consiente_relacion_abierta`) están en el catálogo sin evento: son siempre falsas en el mundo.
- **Presenciar (R-002).** Lo saben quienes participan en el hecho y quienes viven con la persona, con credibilidad 1. Lo visto siempre entra y desplaza la versión contraria. Una versión contraria de oídas solo entra si es más creíble que la que ya tiene.
- **Contar (R-003 a R-006), en el encuentro.** Solo quien eligió abrirse (012 R-002).
  - **Corrige primero:** si el otro cree de un tercero otra versión (otro estado o una deformada) y él la sabe con más credibilidad, se la corrige. La creencia del otro baja en proporción a su confianza en quien corrige, y entra la versión de quien corrige.
  - **Si no, cuenta:** con probabilidad `P_TELL × fuerza de contar`, cuenta la creencia más grave y creíble sobre alguien que el otro conoce. No repite lo que ya le contó a esa persona.
  - **Oculta lo suyo:** lo propio que le duele no lo cuenta si aprendió más a evadir que a abrirse.
  - **Deforma a veces:** con probabilidad `DISTORT`, cuenta la versión peor.
  - **Credibilidad del oyente:** se calcula con la fórmula de la 044 (la función de quien cuenta, la confianza en el tercero), multiplicada por `0,5 + 0,5 ×` la credibilidad de quien cuenta, así que baja con cada boca.
  - **Contar se aprende:** se refuerza o se castiga según la postura con que respondió el otro.
- **El tercero no participa** en el `RUMOR_TOLD`: no se entera de que hablan de él (INV-003).
- **Aplicar al final del tick.** El encuentro solo emite el evento. El sistema de conocimiento guarda la creencia del oyente con el evento como causa, empareja su afecto por el tercero con lo oído (036) y, si le preocupa, activa el pensamiento (039) y forma una intención (044) citando el rumor. En la fase `memory` chocaría con el sistema `private`, que también parchea la mente.
- **Coste.** Hasta 12 creencias por persona (≈ 0,6 KB). El año de 100 personas pasa de 147 s a unos 152 s.

## 5. Invariantes y guardarraíles
- INV-001: credibilidades en [0,1]; tope `maxBeliefs`.
- INV-003: `tellInEncounter` y `hear` no leen la verdad de un tercero (prueba CA-003: cambiar su ocupación no cambia nada). `beliefTruth` solo lo usan la API y las pruebas.

## 6. Cómo se prueba
- `knowledge.test.ts` (7 pruebas): temas y quién lo presencia, contradicciones, verdad para el análisis, CA-001 (lo oculta quien evade; lo cuenta su hogar; otro sigue sin saberlo), CA-004 (quien cuenta con éxito cuenta más; contar se aprende), corrección antes de contar y sin repetir, CA-003.
- `packages/generators/src/relationships-world.test.ts`: CA-002 y CA-005 en 1 año.
- `packages/llm-gateway/src/chat/chat.test.ts`: lo que cree de otros en la vista de la charla (P5).

## 7. Paridad con el prototipo
El prototipo tiene rumores sin fuente ni verdad separada (55 por mundo y año); se porta la idea, no el código. Aquí, con 100 personas, unos 2 600 relatos al año, de los que 32 se deforman y 18 se corrigen.

## 8. Pendientes y deuda
- [ ] La mentira activa (025 fuera de alcance; con la capa clínica).
- [ ] Calibración PA-150 a PA-152: se cuenta mucho (≈ 26 relatos por persona y año) y casi solo se habla de pareja nueva, peleas y enfermedades, porque son los hechos más frecuentes.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-29 | m3/creencias (K1) | 025 | Documento creado desde la plantilla (sin código) |
| 2026-09-29 | m3/creencias (K1–K4) | 025 | Módulo implementado: temas, presenciar, contar en los encuentros como conducta aprendida, deformación, ocultar, corrección, consecuencias (afecto, pensamiento, intención) y verdad solo para el análisis. 7 pruebas |
| 2026-09-29 | m3/cierre | 025 | Nadie deforma lo que cuenta de sí mismo (en la revisión de cierre, alguien contaba de sí «es agresivo») |
