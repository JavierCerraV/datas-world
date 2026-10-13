---
modulo: llm-gateway
ruta: packages/llm-gateway
estado: en-desarrollo
specs: [026, 043, 044, 013, 046, 047]
actualizado: 2026-10-08
---

# Módulo: llm-gateway

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Hace dos cosas:
- **Pasarela LLM** (spec 026): es la única puerta a los proveedores de modelos. Quien llama pide un resultado para un propósito (`dialogue`, `classify`, `verify`, `summarize`…). La pasarela elige el modelo por configuración, busca en el registro, comprueba el presupuesto, llama con tiempo máximo, valida y registra.
- **Capa de charla** (spec 043): la vista de la persona, el prompt, el clasificador de tono, la expresión, el verificador y la sesión que une todo esto con el motor de conversación (`@datas-world/engine`, `conversation/`).

El LLM expresa; no decide la postura ni cambia el mundo (ADR-003). No hace E/S de disco. El proceso que la usa (API y CLI) lee `config/llm.json` y guarda los registros.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 026 | CA-003 a CA-013. R-001, R-003 (con almacén en memoria), R-004, R-006 a R-015 | CA-001 y CA-002 (el mundo con `mock` y el replay sin red se prueban con el worker, L3); R-002 y R-005 (decisiones de nivel 4, M6); el almacén SQLite de `llm_records` (L3) |
| 043 | CA-002, CA-003, CA-009 a CA-012, CA-018. R-002 a R-004, R-010 a R-014, R-023 (streaming, caché y verificación asíncrona) | CA-001, CA-014, CA-015, CA-017 (L3); CA-016 (L4); la medición real de latencia y coste (L4.3) |
| 044 | R-001: extracción de las afirmaciones sobre terceros en el clasificador, con respaldo léxico (L5.1) | Resolución a una persona real, credibilidad e impacto (L5.2, motor); CA-001 a CA-008 |
| 047 | R-005 (terapeuta como agente: qué recibe y qué no), R-005b (diálogo por turnos con salida estructurada), R-005c (fidelidad). R-005d y R-005e (la persona en consulta con la charla de la 043), R-005f (terapeuta por función: lectura, sin cuentas de pasos, cierre). CA-005 (transcripción con postura), CA-008, CA-009, CA-010, CA-013 (memoria entre sesiones; no sabe que es una simulación) | El compromiso por sesión; medidas (R-007); complacencia (R-008); la dosis y los eventos son del motor |

## 3. API pública
Desde `@datas-world/llm-gateway`:

| Símbolo | Descripción |
|---|---|
| `DEFAULT_CONFIG`, `parseConfig(json)`, `HAIKU`, `HAIKU_5_5` | Configuración por propósito validada con Zod. Por defecto, Haiku 4.5 en los cuatro propósitos de la charla y `null` en `therapist`, `decision`, `diary` y `session`. `HAIKU_5_5`: modelo y precio de `claude-haiku-5-5`, para la configuración de un estudio (047) |
| `EFFORTS`, tipo `Effort`; `ModelConfig.temperature?`, `effort?`, `thinking?` | Parámetros que dependen del modelo (026 R-014): solo se envían, y solo entran en la clave del registro, si están configurados |
| `Gateway` (`run(req)`, `metrics()`, `budgetLeft()`) | Núcleo: registro, presupuesto, tiempo máximo, reparación, coste y métricas. Nunca lanza por un fallo del proveedor: devuelve `source: 'fallback'` con su motivo |
| `anthropicAdapter(client?)`, `buildAnthropicParams` | Adaptador con el SDK oficial `@anthropic-ai/sdk`: streaming, caché en la última parte cacheable del sistema y `output_config.format` |
| `openaiCompatibleAdapter({ baseUrl?, apiKey? })` | Otro proveedor o un modelo local (`LLM_BASE_URL`, `LLM_API_KEY`), por `fetch` |
| `mockAdapter(respond?, { chunkDelayMs })` | Proveedor determinista para las pruebas y la batería |
| `MemoryRecordStore`, `recordKey`, tipos `RecordStore`, `LlmRecord` | Registro de respuestas (sha256 de la petición canónica) con LRU que conserva los que afectan al mundo |
| `chatCatalogs(catalogs)` | Tonos, posturas y guiones de los catálogos `chat_*`, en la forma de la pasarela y del motor |
| `buildPersonView(input)`, tipos `PersonView`, `ViewFact` | Vista mínima de la persona (043 §3) |
| `expressionRequest`, `instructions`, `renderView`, `stancePart` | Prompt de la expresión: instrucciones y vista cacheables; postura y estado vivo aparte |
| `classifyTone`, `lexicalTone` | Tono del turno: etiqueta, clasificador LLM o reglas léxicas. En la misma llamada, las afirmaciones sobre terceros (`visitorClaims`, 044 R-001) |
| `lexicalClaims` | Respaldo léxico de las afirmaciones: palabra clave de `chat_claims` y relación de `chat_relations` nombrada como palabra completa (la primera del mensaje) o la única que admite |
| `verifyReply` | Afirmaciones marcadas contra la vista y adherencia a la postura |
| `administerInstrument`, `administerBattery`, `itemsText`, `LLM_RANGE`, tipos `ItemPlan`, `PartPlan`, `ItemAnswer` | Una prueba psicométrica como charla (046 R-012, R-013) |
| `ChatSession` (`turn`, `close`, `input`), `TEMPLATES`, `ChatEndedError` | Sesión de charla: tono, postura, `onStance`, texto en streaming, verificación en segundo plano y entrada `chat_session` al cerrar |
| `runTherapySession(input)`, `MAX_TURNS_SESSION`, tipos `TherapySessionInput`, `TherapySessionResult`, `PatientReply`, `SessionEnd` | Una sesión del protocolo como diálogo (047 R-005b): el terapeuta (propósito `therapist`) habla, `respond` trae lo que dice la persona, y el motor cuenta lo cubierto. Devuelve transcripción, fidelidad, lo que faltó, la formulación del caso, la **nota de cierre** (`note`, la memoria del terapeuta para `history` de la sesión siguiente) y cómo terminó (`completa`, `cierre`, `tope`, `abandono`, `sin_llm`). No cambia el mundo |
| `therapistRequest(ctx)`, `sessionNoteRequest(ctx)`, `TherapistSchema`, tipos `TherapistContext`, `TherapistOutput`, `TherapyTurn`, `SessionNote` | Petición de un turno del terapeuta: papel y guía de la sesión cacheables; admisión, formulación, pendientes y turnos que quedan, aparte |
| `patientResponder(chat, log?)`, tipo `PatientTurnLog` | La persona en la sesión: une una `ChatSession` en escenario `consulta` con `runTherapySession`. `log` recoge lo que el motor decidió en cada turno (tono, postura, nivel, si habló el LLM o la plantilla, verificación) |
| `ChatSessionOptions.setting` (`chat` | `consulta`), `minLevel`; tipo `ChatSetting` | Escenario de la charla para la persona (047 R-005e) y nivel de intimidad mínimo (R-005d). Sin ellos la charla de la 043 es la de siempre |
| `meteredGateway(gateway)` → `{ gateway, usage() }`, tipo `UsageTotals` | Vista de la pasarela que lleva su propia cuenta de llamadas, tokens y coste por propósito y modelo (026 R-015). Comparte adaptadores, registro y presupuesto con la original |
| `complacencyOf(transcript)`, `complacencyMarkers(text)`, tipos `Complacency`, `Marker` | Complacencia en la transcripción por reglas léxicas (047 R-008): turnos en que el texto acepta, promete, agradece o elogia, cuántos con una postura cerrada, cuántos de aplacar, y respuestas largas con postura de callar |
| `therapistQuality(transcript)`, `REPEAT_SIMILARITY`, tipo `TherapistQuality` | Calidad del terapeuta por reglas léxicas (047 R-005f): turnos en que tutea, hace dos preguntas, repite una pregunta anterior o elogia con fórmula |
| `keepSilence(text)`, `SILENCE_WORDS`; `TurnOutcome.trimmed`; `ViewInput.consult` | En consulta: la respuesta de una postura de callar queda en su primera frase corta (047 R-005g), y la vista de la persona resume sus episodios de rumia, sus sesiones y su práctica (R-013, `chat/consult.ts`) |

## 4. Diseño interno y decisiones
- **SDK oficial para Claude.** El adaptador de Anthropic usa `@anthropic-ai/sdk`: `messages.stream` con `finalMessage()` y `messages.create`. Haiku 4.5 no lleva pensamiento adaptativo ni `effort`, y admite `temperature`.
- **Parámetros según el modelo (R-014).** Haiku 5.5 es al revés: razona con pensamiento adaptativo regulado por `effort` y devuelve un error 400 si recibe `temperature`. Por eso `temperature`, `effort` y `thinking` son opcionales y la pasarela no añade ninguno por su cuenta. `effort` viaja en `output_config`, junto al formato. La clave del registro los incluye solo cuando están: una prueba fija el hash de una petición de antes para que los registros guardados sigan valiendo. El precio de Haiku 5.5 sube 5 veces por encima de 100 000 tokens de prompt y `costMicros` no lo calcula (ningún prompt se acerca).
- **Salidas estructuradas por esquema JSON** (`output_config.format`). El esquema sale de Zod (`z.toJSONSchema`, sin `$schema`) y la pasarela valida con Zod: un solo camino de validación para todos los proveedores (R-010).
- **Streaming por callback** (`onText`). El iterable del SDK queda dentro del adaptador.
- **Caché (R-008).** Instrucciones y vista van primero, con `cache_control` en la última parte cacheable. La postura y el estado vivo cambian cada turno y van después, para no invalidar el prefijo.
- **Registro (R-003).** La clave es el sha256 del proveedor, el modelo, el propósito, los parámetros, los mensajes y el esquema. La misma charla reproducida reutiliza las respuestas sin red (043 CA-009).
- **Presupuesto (R-004).** Contadores de tokens por día y de coste por mes, con el reloj real (la pasarela no es el motor). El coste se cuenta en millonésimas de dólar: la lectura de caché cuesta el 10 % y la escritura el 125 %.
- **Vista (043 R-003).** Incluye solo los eventos en los que la persona participa, más los nacimientos y muertes de su familia cercana. El ocio de la semana va resumido. El estado vivo no entra en la parte cacheable.
- **Recuerdos (013 P5 a).** Si la persona tiene memoria, lo reciente no es la lista de hechos: son sus `CHAT_RECALL` recuerdos más relevantes (`recall`, con el sesgo del ánimo), cada uno como hecho con id `MEM-…`, su texto (el del evento, el del episodio de desarrollo del catálogo o lo que le contaron) y cómo lo recuerda hoy («lo recuerda como algo muy doloroso»…). Los hechos de su historia de origen siguen. `chatCatalogs` lee `development_episodes` si llega (`memories`).
- **Dependencias nuevas:**
  - `@anthropic-ai/sdk`: la vía obligada para llamar a Claude (026, ADR-003);
  - `zod`: ya estaba en el monorepo;
  - `@datas-world/generators`: solo para pruebas.

  Solo cargan en la API y la CLI; el worker no las usa. La memoria que añaden es la LRU de 500 registros (≈ 1 MB).
- **Terapeuta (047).** Es un agente, no un guion: su prompt le explica cómo conducir una sesión por escrito (turnos cortos, una pregunta por turno, no suponer, no premiar el «sí», adaptar el ejercicio) y le da la guía de **esa** sesión. `therapistRequest` no recibe la vista de la persona ni el mundo: por su firma solo puede usar el nombre, la admisión, sus notas y el texto dicho; la postura y las notas de la transcripción se guardan pero no vuelven al prompt. **No sabe que es una simulación** (decisión del usuario): su prompt lo sitúa en una consulta con una persona de un pueblo de Colombia. **Memoria entre sesiones:** al cerrar, una llamada aparte le pide la nota clínica de la sesión (texto libre, menos de 150 palabras); la sesión siguiente recibe todas las notas anteriores en `history`, además de la formulación. Si la nota falla, vale la formulación. El motor cuenta los componentes (`recordExchange`): lo que el LLM declara en `covered` se guarda como `claimed` y no afecta a la fidelidad. Si el terapeuta falla, la sesión se corta con `sin_llm` y su motivo, sin plantilla: una sesión inventada contaminaría el estudio.
- **La persona en consulta (047 R-005e).** Mismas reglas de la 043 (postura decidida por el motor, hechos solo de su vista), con tres diferencias en su prompt: sabe que está con un psicólogo al que aceptó ver; puede decir lo que piensa o nota en el momento durante un ejercicio, si encaja con su estado; y se le pide no dar la razón por quedar bien y corregir lo que el psicólogo suponga mal. El nivel de intimidad no baja de «conocido»; lo íntimo sigue dependiendo de la confianza que gane el terapeuta.
- **Terapeuta por función (047 R-005f).** La primera sesión real mostró un terapeuta pendiente de cubrir pasos: repitió una pregunta palabra por palabra para llenar los intercambios que el prompt le mostraba como pendientes (`s1.jerarquia (1/3)`), y elogiaba («perfecto»). Cambios: el prompt fija prioridades (relación, función, protocolo) y qué hacer ante el ataque, el cambio de tema, el silencio y el «sí» sin contenido; ya no se le muestran cuentas ni mínimos de intercambios; un campo `read` (el primero del JSON) le hace leer la función antes de decidir qué decir, y se guarda en la transcripción sin volver al prompt; `close` le deja cerrar la sesión. La fidelidad se sigue midiendo con la misma regla, sin que él la persiga.
- **Lo que cambió tras el piloto (047 v0.8).** El terapeuta tuteaba en casi todos los turnos pese a la instrucción, y repetía preguntas: el prompt ahora da ejemplos de las dos formas y pide revisar sus turnos antes de preguntar. Solo una sesión de nueve llegó a los ejercicios de «dejar de empujar»: la guía marca qué componentes son ejercicios y dice cuándo la exploración ya basta, sin volver a darle cuentas de turnos. El texto de la persona con postura de callar a veces era una confidencia: ahora se acorta a su primera frase (`keepSilence`), sin añadir palabras. Para las otras posturas cerradas solo se refuerza el prompt y se mide.
- **Vista en consulta (R-013).** `consultFacts` añade a la vista de la persona, en nivel íntimo, tres resúmenes de sus propios hechos (sesiones, rumia del último mes, práctica), en palabras llanas, y quita los tipos de evento que no le dicen nada. Fuera de consulta la vista de la 043 no cambia.

## 5. Invariantes y guardarraíles
- 026 INV-004: ninguna clave de API se escribe en registros ni en métricas (CA-010). Las claves solo se leen del entorno.
- 043 INV-002: el prompt no contiene eventos ajenos ni `isTrue` (CA-002).
- La pasarela no cambia el mundo. Lo que llega al mundo pasa por la entrada `chat_session` que aplica el worker (043 R-019).

## 6. Cómo se prueba
- `src/gateway.test.ts` (9 pruebas): 026 CA-003 a CA-011. El adaptador compatible con OpenAI se prueba contra un servidor HTTP local.
- `src/chat/stranger.test.ts` (10 pruebas): 043 CA-021 a CA-024 (el prompt de un desconocido no lleva su intimidad, la confianza se gana con turnos cálidos, la cautela cambia la postura y la primera respuesta dice que no lo conoce).
- `src/chat/chat.test.ts` (9 pruebas), con el mundo de la semilla 482917 y Santiago Osorio (CIT-000019): 043 CA-002, CA-003, CA-009 a CA-012, CA-018, el tono y el cierre de una charla terminada.

## 7. Paridad con el prototipo
No aplica: el prototipo no usa LLM.
- `src/therapy/patient.test.ts` (3 pruebas): 047 R-005e (prompt de consulta, nivel mínimo, la charla normal no cambia), sesión completa con terapeuta y persona en llamadas separadas, y abandono.
- `src/therapy/therapy.test.ts` (11 pruebas): 047 R-005f (la lectura se guarda y no vuelve al prompt ni llega a la persona; pendientes sin números; cierre por decisión del terapeuta), 047 CA-013 (nota de cierre y memoria), CA-008 (qué lleva y qué no el prompt del terapeuta), CA-009 (un terapeuta `mock` que reacciona da sesiones distintas a dos personas), CA-010 (fidelidad al llegar al tope, lo declarado no cuenta), abandono y fallo del LLM.
- `src/therapy/quality.test.ts` (3 pruebas), `src/therapy/complacency.test.ts` (4) y `src/therapy/selfview.test.ts` (4): medidas léxicas del terapeuta y de la complacencia, y la vista de la persona en consulta (047 CA-012).

## 8. Pendientes y deuda
- [ ] Almacén SQLite de `llm_records` y lectura de `config/llm.json` en la API (L3).
- [ ] Prueba real con Haiku 4.5: latencia (043 R-023) y coste por charla (L4.3).
- [ ] Ninguna sesión real con `claude-haiku-5-5` todavía: el prompt del terapeuta está sin probar con el modelo (047, piloto).
- [ ] `trueInWorld` de las afirmaciones para el informe de la batería (L4).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-23 | kit de arranque | — | Documento creado (sin código) |
| 2026-09-27 | charla/l2-pasarela (L2) | 026, 043 | Primera implementación: configuración por propósito, `Gateway` (registro, presupuesto, tiempo máximo, reparación, coste y métricas), adaptadores Anthropic (SDK oficial), compatible con OpenAI y `mock`; capa de charla (vista, prompt, clasificador, verificador y `ChatSession`). 18 pruebas |
| 2026-09-27 | claude/wonderful-carson-4c4i3k (arreglo de la charla) | 043 | `ChatSession.input()`: la entrada de consolidación sin resumen, para cerrar aunque falle la llamada `summarize` |
| 2026-09-27 | charla/l5 (L5.1) | 044, 043 | El clasificador de tono devuelve también las afirmaciones del visitante sobre terceros cercanos (`visitorClaims`: `predicate` de `chat_claims`, `about` de `chat_relations`) en la misma llamada, sin otra llamada al LLM; descarta relaciones que la afirmación no admite. Respaldo léxico `lexicalClaims` (palabra completa: «padre» no está en «compadre»). `chatCatalogs` lee `chat_claims` y `chat_relations` si llegan; si no, la charla sigue igual. La API ya las guarda en el turno del visitante. 4 pruebas |
| 2026-09-27 | charla/l5 (L5.2) | 044 | `ChatSession.turn` evalúa las afirmaciones con el motor (`claimsHeard`) antes de elegir la postura, las devuelve en `TurnOutcome.claims` y en `onStance`, y guarda las validadas en los turnos de la entrada `chat_session` (R-010). `chatCatalogs().engine` incluye afirmaciones y relaciones |
| 2026-09-27 | charla/l5 (L5.4) | 044 | Prueba de 044 CA-007: el turno evalúa la afirmación (lo que muestra el panel) sin cambiar el hash del mundo |
| 2026-09-29 | m3/memoria (M4) | 013 | La vista de la charla lleva lo que la persona recuerda en lugar de los eventos recientes (013 P5 a), con la valencia reconstruida en palabras; `ViewInput.memoryText` y `ChatCatalogs.memories` para contar los recuerdos de infancia. 1 prueba |
| 2026-09-29 | m3/creencias (K3) | 025 | La vista de la charla lleva lo que la persona cree de otros y de quién lo sabe («Cree que Luis: perdió el empleo. Se lo contó Marta; lo cree»), nunca si es verdad (025 R-009, P5). `ViewInput.topicText` y `ChatCatalogs.topics` (de `chat_claims` y `rumor_topics`). 1 prueba |
| 2026-10-05 | claude/busy-mayer-fj6x13 (043 v0.7) | 043 | Revelación gradual (`disclosure.ts`): cada hecho de la vista lleva su nivel (`ViewFact.level`: 1 personal, 2 íntimo, también si no se sabe) y `discloseView` filtra la vista según el nivel que abre la familiaridad del visitante, ANTES del prompt; el verificador recibe esa misma vista abierta. El prompt dice con quién habla (`TRUST_TEXT`) y, sin LLM, la primera respuesta a un desconocido es «¿Y usted quién es? No lo conozco.» (`STRANGER_TEMPLATE`). `TurnOutcome.level` y `StanceInfo.exposure` nuevos. Prueba nueva `stranger.test.ts` |
| 2026-10-06 | m4/bateria-psicometrica | 046 | `psychometrics.ts`: `administerInstrument` aplica un instrumento a una persona como charla en una sola llamada (`dialogue`, salida JSON validada con Zod). El motor da `target` y `disposition` por ítem; el LLM responde con sus palabras y elige una opción dentro de `LLM_RANGE` (±1); fuera de rango, el motor usa la decidida (`corregida`); sin LLM, plantilla (`plantilla`). El prompt no lleva la respuesta verdadera ni los indicadores (CA-010). Pruebas `psychometrics.test.ts` (046 CA-009, CA-010) |
| 2026-10-06 | m4/bateria-psicometrica | 046 | `ItemAnswer.why`: la causa por la que una respuesta cayó a plantilla (`budget`, `timeout`, `invalid`, `disabled`, `network_error`), para que el fallo del proveedor no sea silencioso. `LlmResult.errorDetail`: estado y mensaje del proveedor (acotado, sin claves) cuando la pasarela cae a respaldo por un error de red. `administerBattery`: las seis pruebas de una persona en UNA llamada (`q` identifica la prueba de cada respuesta): 150 llamadas en vez de 900, necesario con proveedores de cuota diaria baja. Probada contra OpenRouter (`nvidia/nemotron-3-super-120b-a12b:free`): 65 de 65 ítems del LLM, ninguno corregido. El adaptador `openai_compatible` incluye el cuerpo (acotado) de las respuestas de error, para distinguir límite por minuto, por día o de crédito |
| 2026-10-07 | fix/dass-rango-llm | 046 | `allowedRange(ins, target)` y `DOWN_ONLY`: en el DASS-21 el LLM solo puede elegir igual o por debajo de lo que decidió el motor (en la primera corrida duplicó la puntuación: 11,4 dicho frente a 4,9 verdadero). El prompt y las dos validaciones usan la misma función. Las demás pruebas, con el margen simétrico de siempre |
| 2026-10-08 | feat/gateway-haiku-5-5 | 026, 047 | Pasarela lista para `claude-haiku-5-5` (026 R-014, CA-012, CA-013): `temperature` pasa a ser opcional y no se envía si falta (el modelo la rechaza con un 400); `effort` (`output_config.effort`) y `thinking: "disabled"` nuevos, en la configuración, la llamada y la clave del registro (solo cuando están: las claves anteriores no cambian). Propósito `therapist` (047 R-005), desactivado por defecto. `HAIKU_5_5` con su precio. El adaptador `openai_compatible` también omite la temperatura ausente |
| 2026-10-08 | m5/estudio-protocolo (bloque 2) | 047 | `therapy/`: el terapeuta del estudio como agente LLM (`therapistRequest`) y la sesión como diálogo (`runTherapySession`), con la cuenta de componentes del motor, fidelidad, formulación del caso entre turnos y cuatro finales (`completa`, `tope`, `abandono`, `sin_llm`). La persona entra por `respond`; conectarla a la charla de la 043 es el bloque siguiente |
| 2026-10-08 | m5/estudio-protocolo (bloque 3) | 047 | A petición del usuario, el terapeuta ya no sabe que es una simulación y tiene memoria de las sesiones anteriores (`sessionNoteRequest`, `TherapySessionResult.note`, `history`). La persona entra en la sesión con la charla de la 043 (`patientResponder`) en un escenario `consulta` (`ChatSessionOptions.setting`, `minLevel`), con su postura guardada en la transcripción |
| 2026-10-08 | m5/estudio-protocolo (terapeuta) | 047 | Terapeuta por función tras la primera sesión real (R-005f): prompt reescrito para un clínico con experiencia en consultantes difíciles, campos `read` y `close` en `TherapistSchema`, `TherapyTurn.read`, final `cierre`, y pendientes sin cuentas de intercambios |
| 2026-10-08 | m5/estudio-protocolo (uso por sesión) | 026, 047 | `meteredGateway`: una vista medida de la pasarela, para informar tokens y coste de cada sesión y cada toma del estudio |
| 2026-10-09 | m5/estudio-protocolo (reanudación) | 026 | `meteredGateway`: lo que sale del registro cuenta con sus tokens y su coste originales, así el informe de una sesión reanudada es el mismo que si no se hubiera cortado |
| 2026-10-12 | m5/estudio-protocolo (complacencia) | 047 | `therapy/complacency.ts`: complacencia en la transcripción por reglas léxicas (R-008), declarada como medida burda; una negativa o un límite no cuentan, y «sí» se distingue del «si» condicional |
| 2026-10-12 | m5/estudio-protocolo (tras el piloto) | 047 | Sin tocar el motor: `chat/consult.ts` (lo que la persona sabe de sí misma en consulta), `keepSilence` para la postura de callar, prompt de consulta con lo que se cuenta en cada postura, prompt del terapeuta (usted, no repetir, ejercicios marcados) y `therapy/quality.ts` |
