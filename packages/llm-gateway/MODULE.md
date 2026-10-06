---
modulo: llm-gateway
ruta: packages/llm-gateway
estado: en-desarrollo
specs: [026, 043, 044, 013, 045]
actualizado: 2026-10-06
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
| 026 | CA-003 a CA-011. R-001, R-003 (con almacén en memoria), R-004, R-006 a R-013 | CA-001 y CA-002 (el mundo con `mock` y el replay sin red se prueban con el worker, L3); R-002 y R-005 (decisiones de nivel 4, M6); el almacén SQLite de `llm_records` (L3) |
| 043 | CA-002, CA-003, CA-009 a CA-012, CA-018. R-002 a R-004, R-010 a R-014, R-023 (streaming, caché y verificación asíncrona) | CA-001, CA-014, CA-015, CA-017 (L3); CA-016 (L4); la medición real de latencia y coste (L4.3) |
| 044 | R-001: extracción de las afirmaciones sobre terceros en el clasificador, con respaldo léxico (L5.1) | Resolución a una persona real, credibilidad e impacto (L5.2, motor); CA-001 a CA-008 |

## 3. API pública
Desde `@datas-world/llm-gateway`:

| Símbolo | Descripción |
|---|---|
| `DEFAULT_CONFIG`, `parseConfig(json)`, `HAIKU` | Configuración por propósito validada con Zod. Por defecto, Haiku 4.5 en los cuatro propósitos de la charla y `null` en `decision`, `diary` y `session` |
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
| `administerInstrument`, `administerBattery`, `itemsText`, `LLM_RANGE`, tipos `ItemPlan`, `PartPlan`, `ItemAnswer` | Una prueba psicométrica como charla (045 R-012, R-013) |
| `ChatSession` (`turn`, `close`, `input`), `TEMPLATES`, `ChatEndedError` | Sesión de charla: tono, postura, `onStance`, texto en streaming, verificación en segundo plano y entrada `chat_session` al cerrar |

## 4. Diseño interno y decisiones
- **SDK oficial para Claude.** El adaptador de Anthropic usa `@anthropic-ai/sdk`: `messages.stream` con `finalMessage()` y `messages.create`. Haiku 4.5 no lleva pensamiento adaptativo ni `effort`, y admite `temperature`.
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

## 8. Pendientes y deuda
- [ ] Almacén SQLite de `llm_records` y lectura de `config/llm.json` en la API (L3).
- [ ] Prueba real con Haiku 4.5: latencia (043 R-023) y coste por charla (L4.3).
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
| 2026-10-06 | m4/bateria-psicometrica | 045 | `psychometrics.ts`: `administerInstrument` aplica un instrumento a una persona como charla en una sola llamada (`dialogue`, salida JSON validada con Zod). El motor da `target` y `disposition` por ítem; el LLM responde con sus palabras y elige una opción dentro de `LLM_RANGE` (±1); fuera de rango, el motor usa la decidida (`corregida`); sin LLM, plantilla (`plantilla`). El prompt no lleva la respuesta verdadera ni los indicadores (CA-010). Pruebas `psychometrics.test.ts` (045 CA-009, CA-010) |
| 2026-10-06 | m4/bateria-psicometrica | 045 | `ItemAnswer.why`: la causa por la que una respuesta cayó a plantilla (`budget`, `timeout`, `invalid`, `disabled`, `network_error`), para que el fallo del proveedor no sea silencioso. `LlmResult.errorDetail`: estado y mensaje del proveedor (acotado, sin claves) cuando la pasarela cae a respaldo por un error de red. `administerBattery`: las seis pruebas de una persona en UNA llamada (`q` identifica la prueba de cada respuesta): 150 llamadas en vez de 900, necesario con proveedores de cuota diaria baja. Probada contra OpenRouter (`nvidia/nemotron-3-super-120b-a12b:free`): 65 de 65 ítems del LLM, ninguno corregido |
