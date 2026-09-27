---
modulo: conversation
ruta: packages/engine/src/conversation
estado: en-desarrollo
specs: [043, 036, 038, 040, 010, 011]
actualizado: 2026-09-27
---

# Módulo: conversation

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Motor de la charla con ciudadanos (spec 043). Hace cuatro cosas:
- convierte el tono de cada turno del visitante en un estímulo con función para esa persona;
- elige la postura del ciudadano con las fuentes de control de la 040;
- aprende dentro de la charla;
- en una charla `in_world`, consolida en el mundo lo vivido: recuerdo, aprendizaje acotado y efecto emocional.

Todo es puro y determinista. No genera texto (eso es la pasarela, 026) ni hace E/S. Tampoco aplica entradas externas: eso lo hace el worker en el bloque L3.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 043 | CA-004, CA-005, CA-006, CA-007, CA-008 (la parte del motor: termina antes del turno 20), CA-013, CA-019 y CA-020 (la parte del motor: la postura forzada). R-005 a R-009, R-019.1, R-020 a R-022; INV-003 e INV-004 | CA-001 a CA-003, CA-009 a CA-012 (L2); CA-014, CA-015, CA-017, la respuesta 409 de CA-008 y el cierre por compromiso de CA-020 (L3); CA-016 y CA-018 (L4) |

## 3. API pública
Desde `@datas-world/engine`:

| Símbolo | Descripción |
|---|---|
| `ToneDef`, `StanceDef`, `ChatCatalog` | Tonos (`stimulus`, `magnitude`, `prior`) y posturas (`escape`, `w0`) de `chat_tones` y `chat_stances`, inyectados |
| `CHAT_DEFAULTS`, `ChatParams` | Parámetros de 043 §8: decaimiento de la carga, pesos de las fuentes, ventana de ocupado, topes de huella y `k` del ánimo |
| `startConversation(store, visitorId)` → `ConversationState` | Charla nueva con una copia de trabajo del almacén de funciones |
| `toneValue(store, lc, tone, now)` | R-005: `clamp(prior + netValue)` |
| `visitorSaid(state, lc, cat, tone, now, params)` → `{ toneValue, visitorValue, aversiveLoad }` | Turno del visitante: aprende la consecuencia del turno anterior (R-009), empareja al visitante (R-006) y actualiza la carga (R-007) |
| `stanceOptions(...)`, `selectStance(..., rng, forced?)` → `StanceChoice` | R-008: aportes por fuente de cada postura y elección por softmax; `forced` para el fin por compromiso (sin azar) |
| `citizenAnswered(state, stance)` | Anota una postura ya decidida (la consolidación la usa con las del registro) |
| `visitorValue(state)`, `stanceStrength(store, stance)`, `summarize(state)` | Valor del visitante, fuerza vigente de una postura y resumen para el recuerdo (R-020) |
| `chatAvailability(view, row, now, params)` → `Availability` | R-019.1: dormida no; en una obligación, `busyWindowMin`; libre, hasta su próximo compromiso firme (`freeUntil` de la 040) |
| `openingEvent(view, row, visitorId, sessionId, availability, cause)` | `CONVERSATION_STARTED` o `CONVERSATION_DECLINED` con sus causas |
| `consolidateChat(view, input, cat, lc, params, now, cause, emit)` → `Consolidation` | R-019.6, R-020 a R-022: rehace el aprendizaje sobre el almacén actual, lo escribe acotado y emite `CONVERSATION_HELD` y `LEARNED_FROM_CONVERSATION` |

## 4. Diseño interno y decisiones
- **Función del tono (R-005, opción A del usuario):** `prior + netValue`. `netValue` ya incluye la generalización, y en la ontología actual los términos verbales casi no distinguen valencia (aprobación → insulto: gradiente 0,92). Con la suma, la base social no se anula.
- **Visitante (R-006):** es el estímulo `ext.<EXT-…>` en el almacén de la persona. Se empareja con `lambda = función × magnitud` del tono (Rescorla-Wagner de la 036, estímulo social).
- **Carga (R-007):** `carga × (1 − 0,2) + magnitud × max(0, −función)`.
- **Aprendizaje en la charla (R-009):** el turno siguiente del visitante es la consecuencia del anterior:
  - la postura anterior se refuerza en proporción a cuánto mejora el trato (036 R-002);
  - el estímulo anterior aprende qué le sigue (036 R-001): tras un insulto viene más hostilidad, así que el insulto se vuelve más aversivo.

  Las respuestas son `conv.<postura>` y empiezan en `w0`.
- **Fuentes de la postura (R-008)**, con `e` el escape de la postura:
  - `fuerza`: la forma logarítmica de la 040;
  - `reforzador`: `(1 − e) × lo apetitivo + e × lo aversivo del turno`;
  - `negativo`: `e × carga`;
  - `motivadora`: lo que añade la energía baja o el estrés alto;
  - `regla`: reglas con antecedente = estímulo del tono y respuesta = postura;
  - `valor`: la red de valor del estímulo, solo en posturas de acercamiento.

  La elección es por softmax con la temperatura de `hist.variability`. Es un módulo de selección: la política de arquitectura y ESLint le prohíben importar el temperamento.
- **Consolidación (R-021, R-022):** se rehace la charla sobre el almacén actual, sin azar, porque las posturas vienen en la entrada. Cada función o fuerza cambia como mucho `maxLearningDelta`, y el ánimo y el estrés como mucho `maxMoodDelta`:
  - intensidad: `0,6·tanh(carga máxima) + 0,4·min(1, turnos/20)`;
  - valencia: la media del valor del visitante.
- **Coste de memoria:** el mundo solo cambia en quien ha charlado en `in_world`: hasta 8 respuestas `conv.*`, la función del visitante y las de los estímulos verbales, dentro de los topes de la 036.

## 5. Invariantes y guardarraíles
- 043 INV-003: la postura no lee `tmp.*` ni `pers.*`. Lo comprueban la política de arquitectura (`selectionModules`) y ESLint.
- 043 INV-004: valores en rango; ningún cambio consolidado supera su tope (CA-013).
- Determinismo: sin azar fuera de `selectStance`, que usa el `rng` recibido. La consolidación es igual con la misma entrada.

## 6. Cómo se prueba
`src/conversation/conversation.test.ts` (11 pruebas). Replican los catálogos de la charla (el motor no lee archivos):
- R-005: la aprobación aprendida no vuelve agradable un insulto;
- CA-004: 200 charlas amables frente a 200 groseras;
- CA-005: el insulto aprendido −0,8 frente a −0,2, y la política de arquitectura;
- CA-006: la regla «si me faltan al respeto, me voy»;
- CA-007: el guion victimizante sobre 50 personas con historias distintas;
- CA-008: el guion hostil de 20 turnos;
- R-006 y R-007: el visitante aversivo y la carga;
- CA-020: la postura forzada sin consumir azar;
- CA-019: la disponibilidad en un mundo con rutina;
- CA-013: la consolidación de una charla grosera;
- el determinismo de la consolidación.

Distribución de la última postura con los catálogos reales (300 charlas por guion, sin historia aprendida):

| Guion | Posturas más frecuentes |
|---|---|
| amable | responder breve 45 %, abrirse 26 % |
| victimizante | responder breve 36 %, abrirse 20 %, evadir 19 %, aplacar 12 % |
| grosero | evadir 33 %, terminar 28 % |
| hostil | terminar 66 % |

## 7. Paridad con el prototipo
No aplica: el prototipo no tiene charla.

## 8. Pendientes y deuda
- [ ] L2: la vista de la persona, el prompt, el clasificador y la expresión (`packages/llm-gateway`).
- [ ] L3: el worker aplica `chat_open` y `chat_session`. Falta la actividad `conversation` en `act.kind`, que las rutinas y la selección deben respetar mientras dura la charla, y el fin por compromiso o inactividad (R-019.5).
- [ ] Calibrar `w0`, `escape`, los pesos de las fuentes y los topes con las pruebas avanzadas (PA-134, PA-136, PA-137).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-27 | charla/l1-motor (L1.1) | 043 | Documento creado desde la plantilla (sin código) |
| 2026-09-27 | charla/l1-motor (L1.2 a L1.6) | 043, 036, 038, 040 | Primera implementación: función del tono (`prior + netValue`), visitante, carga, aprendizaje en la charla, fuentes y elección de la postura, disponibilidad de la charla casual y consolidación acotada con `CONVERSATION_HELD` y `LEARNED_FROM_CONVERSATION`. 11 pruebas |
| 2026-09-27 | charla/l3-mundo (L3) | 043 | `inputs.ts`: manejadores `chat_open` (disponibilidad, `CONVERSATION_STARTED` o `CONVERSATION_DECLINED`, columna `chat.until` y actividad `conversation`) y `chat_session` (consolidación y vuelta a su día); `defineChatColumns` |
