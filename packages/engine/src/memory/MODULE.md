---
modulo: memory
ruta: packages/engine/src/memory
estado: estable
specs: [013, 036, 037, 039]
actualizado: 2026-09-29
---

# Módulo: memory

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Memoria autobiográfica (spec 013 v0.3): lo que cada persona recuerda de lo vivido, con la saliencia que le dan sus propias funciones, que se olvida, se reconstruye al recordar, se generaliza en relaciones de la red (037) y se ordena en capítulos. No es la historia objetiva (020) ni el registro (014).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 013 | CA-001 a CA-006, CA-008, CA-009 (unidad); CA-007 en `packages/generators` (partida y 1 año) | — |

## 3. API pública
- `createMemorySystem(onto, p?)`: fase `end_of_day`, orden 10, capacidad `memory`, cada tick. Codifica lo del tick, repasa y, al cambiar de día, olvida, consolida (si el mundo tiene `consolidation`) y rehace los capítulos.
- Episodios (`episodes.ts`): `encodeEvent`, `remembererOf`, `episodeValue`, `addMemory`, `retention`, `decayDay` (exportado como `memoryDecayDay`), `trim` (`trimMemory`), `recall`, `rehearse`, `distortion`.
- Capítulos y red (`consolidate.ts`): `openChapter`, `updateChapters`, `consolidate` (`consolidateMemory`).
- `MEMORY_KINDS`, `peopleOf` (`kinds.ts`): qué deja cada tipo de evento.
- Tipos `Memory`, `Chapter`, `MemoryStore` (`Citizen.memory`), `MemoryParams`, `MEMORY_DEFAULTS`, `emptyMemory`, `CHAT_RECALL`.

## 4. Diseño interno y decisiones
- **Saliencia (R-001).** `valor = λ × (0,5 + mayor |función| de lo presente) + 0,5 × afecto medio por las personas presentes`; `saliencia = |valor| × (0,5 + 0,5 × importancia) × habituación` (× 0,3 si ya hay un recuerdo del mismo tipo con lo mismo en 7 días). λ y los estímulos de cada tipo están en `MEMORY_KINDS`, separada de `EVENT_LEARNING` (036): lo que se aprende y lo que se recuerda no coinciden (un despido enseña sobre el trabajo, y se recuerda con el valor que tenía el trabajo, `dominio.trabajo`).
- **Olvido en ley de potencia (R-004).** `retención = (1 + días/τ)^(−β')`, `β' = β / ((1 + |valencia|)(1 + repasos))`, τ = 7 días, β = 0,5. Cada día se aplica la razón entre la retención de hoy y la de ayer: se olvida rápido al principio y cada vez más despacio (ley de Jost), sin guardar la intensidad inicial. Sustituye la vida media de 30 días de la spec: con ella, los recuerdos de infancia no llegaban a la adultez.
- **Reconstrucción (R-007).** El blanco es el mismo `valor` con las funciones de hoy; la distorsión es `|valencia − valencia0|`.
- **Repaso (R-008).** Un `PNR_EPISODE` repasa (hasta 5 veces) los recuerdos que contienen su foco; un `THOUGHT_DERIVED`, los que contienen su destino; un encuentro de la 012 (`lastEncounter` del tick), el recuerdo más intenso con esa persona. La charla repasa lo que recordó al consolidarse (`conversation/consolidate.ts`).
- **Consolidación (R-009).** Clave: la primera persona (o el lugar) del episodio y su consecuencia (`us`). Con 3 episodios se crea `principal causes consecuencia` con `s = 1 − (1 − 0,15)^n` y origen `observed`; cada nuevo la refuerza `0,15 × (1 − s)`; uno de signo contrario (signo de la consecuencia en `US_SIGN`) la debilita a la mitad. Eventos `SCHEMA_FORMED` al crearla y `SCHEMA_REVISED` al cruzar 0,5.
- **Capítulos (R-010).** Un evento con tema (`MEMORY_KINDS.theme`) codificado con intensidad ≥ 0,6 cierra el capítulo abierto y abre otro, con el episodio como ancla. El tono es la media de la valencia actual de sus episodios. Por encima de 12, sale de la persona el más antiguo cerrado; su `CHAPTER_OPENED` sigue en el registro.
- **Un solo sistema.** Codificar, repasar y el trabajo diario van juntos: dos sistemas de la misma fase que parchean `memory` se pisarían (los parches se aplican al final de la fase).

## 5. Invariantes y guardarraíles
- INV-001: valencias en [−1,1] e intensidades en [0,1] (redondeo a 3 decimales).
- INV-002: `trim` tras cada tick; los capítulos se recortan en `updateChapters`.
- INV-003: `openChapter` cierra el abierto antes de abrir otro.
- INV-004: la reconstrucción usa solo lo codificado y las funciones de la persona.
- INV-005: las anclas no se olvidan (`trim` las excluye).

## 6. Cómo se prueba
- `memory.test.ts` (10 pruebas): CA-001 a CA-006, CA-008, CA-009, habituación, tope con anclas y repaso por la rumiación.
- `packages/generators/src/memory-world.test.ts`: memoria de partida (CA-007, amnesia infantil, INV-002 a INV-005).
- `packages/generators/src/relationships-world.test.ts`: el año de 100 personas también comprueba la memoria (KB, topes, esquemas, reconstrucción).
- `packages/llm-gateway/src/chat/chat.test.ts`: la charla recibe los recuerdos (P5 a).

## 7. Paridad con el prototipo
El prototipo guarda recuerdos como texto con intensidad; se porta la idea (recuerdo subjetivo que se olvida), no el código.

## 8. Pendientes y deuda
- [ ] Calibración PA-146 a PA-148 (saliencia, olvido, sesgo del ánimo, reconstrucción). En un año la distorsión media es pequeña (0,007): se nota en quien rumia, no en todos.
- [ ] Los recuerdos de origen `session` llegan con la capa clínica (034).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-29 | m3/memoria (M1) | 013 | Documento creado desde la plantilla (sin código) |
| 2026-09-29 | m3/memoria (M1–M5) | 013 | Módulo implementado: episodios con saliencia desde las funciones, olvido en ley de potencia, recuperación con sesgo del ánimo, reconstrucción, repaso por la rumiación y los encuentros, consolidación en la red y capítulos. 10 pruebas |
