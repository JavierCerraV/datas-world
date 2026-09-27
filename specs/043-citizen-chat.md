---
id: 043
nombre: citizen-chat
estado: aprobada
hito: Bloque L (versión mínima adelantada, decisión del usuario 2026-09-27) · completa en M6
depende_de: [010, 013, 020, 022, 023, 024, 025, 026, 030, 036, 037, 038, 039, 040]
version: 0.6
---

# 043 — Charla con ciudadanos

## 1. Propósito
Poder **hablar por chat de texto con cualquier ciudadano** desde el visor, en una entrevista o una charla casual, para comprobar dos cosas:

1. **Coherencia con su historia:** lo que cuenta de su vida sale de lo que vivió y de lo que sabe (historia generada 030, eventos vividos 014 y 020, memoria 013, creencias 025), sin inventar ni contradecir.
2. **Reacción al tipo de conversación:** cómo responde a la amabilidad, la curiosidad, el desagrado, la grosería, la hostilidad, el autolamento del interlocutor, la culpa, la presión, las preguntas invasivas o la burla. Se comprueba si esa reacción se explica por su historia de aprendizaje y no por un personaje genérico.

La charla puede **dejar huella** (decisión del usuario, 2026-09-27): en el modo `in_world` el ciudadano la recuerda y lo que aprendió en ella cambia su conducta en la medida necesaria (R-018 a R-022). El modo `sandbox` sirve para las baterías de prueba y no toca el mundo.

**No es una intervención clínica** (eso es la 034) ni un chatbot (visión §4). Es un instrumento del laboratorio.

Implementa:
- la visión §34 (sistema de conversación, nivel profundo);
- la visión §46 y §47 (el LLM genera la expresión; el mundo mantiene la verdad);
- la visión §63 (riesgo de personajes complacientes): la postura la decide el motor y se mide si el LLM la respeta;
- la pregunta guía: *¿estas personas parecen haber vivido?*

Sigue ADR-003 (el LLM expresa, no decide) y ADR-007 (la postura sale de la competencia entre fuentes de control de la 040, no de rasgos).

## 2. Alcance
**Incluye:**
- las sesiones de chat de **texto** (sin audio) en dos modos:
  - `in_world`: deja recuerdo y aprendizaje en el mundo;
  - `sandbox`: solo lectura;
- la **vista de la persona** que recibe el LLM (una `PersonView` mínima mientras la 025 y la 013 no estén implementadas);
- la clasificación del **tono** de cada turno (catálogo `chat_tones`, 12 tonos);
- la selección de la **postura** del ciudadano con las fuentes de la 040 (catálogo `chat_stances`, 8 posturas);
- la expresión por el LLM, en streaming y con baja latencia;
- la comprobación de afirmaciones y de adherencia a la postura;
- la **consolidación en el mundo** de una sesión `in_world`: evento, recuerdo, aprendizaje y efecto emocional acotado;
- los guiones de prueba y la batería por la CLI;
- los endpoints de la API y la vista de chat del visor;
- el replay sin red.

**Fuera de alcance:**
- sesiones terapéuticas, tareas, adherencia a un tratamiento y ramas por intervención (034, capa clínica);
- las pantallas *Estudio y participantes* y *Seleccionar muestra* del visor (capa de investigación y clínica, 028 y 034);
- las conversaciones entre ciudadanos (025 R-002, M3);
- el audio y la voz sintética;
- el diseño de la pasarela (026): aquí solo se usa.

**Módulos:**
- nuevo: `packages/engine/src/conversation/` (tono → estímulo, fuentes, postura y consolidación; puro y determinista);
- nuevo: `packages/llm-gateway/src/chat/` (vista, prompt, streaming y verificación);
- ampliados: `apps/api` (`/api/chat/*`), `apps/worker` (aplica la consolidación), `apps/web` (vista de chat), `apps/cli` (`chat:battery`) y `packages/persistence` (tablas del chat).

No porta nada del prototipo, que no tiene charla; no añade fila a `docs/prototipo-referencia.md`.

## 3. Modelo de datos
```ts
type ChatMode = 'in_world' | 'sandbox';

interface ChatSession {
  id: string;                                    // CHS-000001
  citizenId: EntityId;
  visitorId: string;                             // EXT-0001: el visitante es una entidad externa, no un CIT (R-018)
  mode: ChatMode;
  worldAt: WorldMinute;                          // minuto de la instantánea leída
  worldHash: string;                             // stateHash de esa instantánea (023)
  testMode: boolean;                             // el visitante etiqueta el tono de cada turno
  llm: { provider: string; model: string; classifierModel: string; temperature: number };
  view: PersonView;                              // congelada al empezar (R-002)
  state: ConversationState;
  turns: ChatTurn[];
  status: 'open' | 'ended';
  availableUntil?: WorldMinute;                  // in_world: hasta cuándo puede charlar (R-019)
  endReason?: 'visitor' | 'citizen' | 'obligation' | 'idle' | 'max_turns' | 'budget';
  inputRef?: string;                             // entrada externa de la consolidación (in_world, R-019)
}

interface ConversationState {                    // vive en la sesión; en in_world se consolida al cerrar (R-019)
  visitorValue: number;                          // [-1,1] función del visitante; empieza en la aprendida (R-006)
  aversiveLoad: number;                          // [0,∞) carga acumulada, decae por turno (R-007)
  stanceStrength: Record<StanceKey, number>;     // copia de trabajo de las fuerzas de conv.* (R-009)
  toneValues: Record<StimulusId, number>;        // copia de trabajo de las funciones de los estímulos del chat
}

interface ChatTurn {
  seq: number;
  speaker: 'visitor' | 'citizen';
  text: string;                                  // ≤ MAX_TURN_CHARS
  tone?: ToneKey; toneTag?: ToneKey; toneLlm?: ToneKey;          // turno del visitante (R-004)
  stance?: StanceKey; sources?: SourceContribution[];            // turno del ciudadano (R-008)
  claims?: Claim[]; stanceCheck?: 'ok' | 'mismatch' | 'pending'; // verificación asíncrona (R-012, R-013)
  expression?: 'llm' | 'template';
  llmRef?: string;
  latencyMs?: { firstToken: number; total: number };
}

interface Claim {
  about: string; predicate: string; value: unknown;
  verdict: 'supported' | 'contradicted' | 'unsupported';
  evidence?: string;                             // id del hecho de la vista
  trueInWorld?: boolean;                         // solo para el informe; nunca entra en el prompt (R-003)
}

interface ChatTone { key: ToneKey; label: string; description: string; examples: string[];
                     stimulus: StimulusId; magnitude: number;           // chat_tones 2026.10.1
                     prior: number }                                      // [-1,1] valor social de partida (R-005)
interface ChatStance { key: StanceKey; label: string; guidance: string;
                       escape: number; w0: number }                        // chat_stances 2026.10.1
interface ChatScript { key: string; label: string; turns: { text: string; tone: ToneKey }[] } // chat_scripts
```

**Los 12 tonos** (`chat_tones`, magnitudes [M], PA-135):

| Tono | Qué es | Ejemplo | Estímulo (036) |
|---|---|---|---|
| `amable` | cordial, interesado en la persona | "Qué bueno verte, ¿cómo va todo?" | `verbal.aprobacion` |
| `neutro` | informativo, sin carga | "¿A qué hora abre la panadería?" | `verbal.neutro` |
| `curioso` | preguntas sobre su vida, sin presión | "¿Cómo llegaste a Data's World?" | `verbal.pregunta` |
| `intimo` | confidencia o cercanía emocional | "Te cuento algo que no le he dicho a nadie…" | `verbal.confidencia` |
| `desagradable` | seco, despectivo, impaciente | "Ajá. ¿Y eso a quién le importa?" | `verbal.critica` |
| `grosero` | insultos o vulgaridad | "No sea bruto, hombre." | `verbal.insulto` |
| `hostil` | amenaza o agresión abierta | "Más le vale que se calle o verá." | `verbal.amenaza` |
| `victimizante` | el visitante se lamenta de sí mismo, se desprecia y pide consuelo implícito | "Me dejó mi esposo, yo soy muy perdedora, siempre me pasan estas cosas a mí, soy lo peor y todos me tratan muy mal." | `verbal.lamento` |
| `culpabilizador` | responsabiliza al ciudadano de lo que le pasa al visitante | "Por su culpa estoy así." | `verbal.culpa` |
| `presion` | exige, insiste, no acepta un no | "Dígame ya, no me venga con cuentos." | `verbal.presion` |
| `invasivo` | preguntas íntimas sin confianza | "¿Cuánto gana? ¿Le es fiel a su mujer?" | `verbal.pregunta_invasiva` |
| `burla` | ridiculiza a la persona o lo que dice | "Jaja, ¿tecnólogo? Eso no es estudiar." | `verbal.burla` |

**Las 8 posturas** (`chat_stances`, `w0` y `escape` [M], PA-134): `abrirse` (contar y compartir), `responder_breve`, `evadir` (cambiar de tema), `poner_limite`, `contraatacar`, `aplacar` (consolar, dar la razón o complacer), `callar` y `terminar`.

**`PersonView` mínima** (hasta que existan la 025 y la 013; después se sustituye por la suya):
- identidad: nombre, edad, sexo, lugar de nacimiento, hogar y parentesco directo;
- su historia de origen (030) y los eventos del registro **en los que participa**, incluidas las charlas anteriores (`CONVERSATION_HELD`, R-020);
- su situación ahora: lugar, actividad, dinero, ocupación y objetos;
- su estado: ánimo, estrés, necesidades y emociones (010);
- sus reglas más fuertes (038), lo que le gusta hacer (032) y sus vínculos (037).

**Coste de memoria:**
- **En el mundo, por ciudadano que ha charlado en `in_world`:**
  - 8 fuerzas `conv.*` (f32), 32 B;
  - la función del visitante y hasta 12 funciones de estímulos verbales en la tabla de funciones de la 036 (≈ 16 B cada una), como mucho ≈ 210 B;
  - ≈ 400 B por sesión en el registro de eventos (`CONVERSATION_HELD`).

  Quien no ha charlado no añade nada: 0 B.
- **En RAM, por sesión abierta:** la vista ocupa ≈ 20–40 KB, más ≈ 1 KB por turno. Con `MAX_OPEN_SESSIONS = 4` son menos de 0,5 MB.
- **En disco:** ≈ 1,2 KB por turno en las tablas del chat. Una batería de 10 ciudadanos × 12 guiones × 12 turnos ocupa ≈ 1,7 MB.

## 4. Reglas
- **R-001** [M] — **Dos modos.**
  - `sandbox`: lee una instantánea y no escribe en el mundo (sin eventos del mundo, sin cambios de estado, mismo `stateHash`). Es el modo de las baterías (R-015).
  - `in_world`: además, al cerrar consolida sus efectos en el mundo (R-019).

  Las tablas del chat (`chat_sessions`, `chat_turns` y el registro del chat) viven en la misma base del mundo, fuera del `stateHash`, como `external_inputs`. La API escribe en ellas y en la cola de entradas; el estado del mundo solo lo cambia el worker (022 R-001; CLAUDE.md, regla 4).
- **R-002** [M] — **Vista congelada y subjetiva.** Al abrir la sesión se construye la `PersonView` del minuto `worldAt` y se congela. Solo contiene:
  - hechos de la propia persona;
  - eventos en los que participa;
  - sus creencias, cuando exista la 025.

  Los eventos se eligen por relevancia: los de su historia de origen, los `N_RECENT_EVENTS` más recientes y los de mayor intensidad, con un tope de `CONTEXT_TOKENS_MAX`.
- **R-003** [M] — **Nada de la verdad del mundo en el prompt** (CLAUDE.md, regla 3; 026 R-001; 034 R-002). No pasa al contexto del LLM ningún hecho sobre otros que la persona no presenció, ni `isTrue`, ni la verdad de sus creencias (INV-002).
- **R-004** [M] — **Tono del turno.** Se toma, por orden:
  1. la etiqueta del visitante, en modo prueba;
  2. el clasificador LLM barato, con salida validada por Zod contra `chat_tones` y un tiempo máximo de `CLASSIFY_TIMEOUT_MS`;
  3. si se agota ese tiempo, o con el proveedor `mock`, las reglas léxicas del catálogo (`examples` y palabras clave).

  Se guardan las tres cuando existen, para medir el acuerdo entre ellas (§9).
- **R-005** [T] idea / [M] correspondencia y valor de partida — **El tono es un estímulo.** Cada tono presenta su estímulo verbal (tabla de §3) con su magnitud. Su función para esta persona es (decisión del usuario, 2026-09-27, opción A):

  `función = clamp(prior + netValue, −1, 1)`
  - `prior`: el valor social de partida del tono en `chat_tones`, igual para todos. Es lo que la comunidad enseña a cualquiera [M] (PA-135). Siempre está.
  - `netValue`: lo aprendido en su historia, incluida la generalización desde estímulos parecidos (036 `netValue`, R-004).

  La historia modula la base. Por ejemplo, quien aprendió que la crítica del jefe es aversiva encuentra más aversivo un insulto; quien tiene la aprobación muy reforzada, más apetitiva la amabilidad. Dos personas reaccionan distinto a la misma frase según su historia, no según un rasgo. La suma evita que la generalización entre términos verbales, que en la ontología actual casi no distinguen valencia (PA-131), anule la base: la aprobación aprendida no vuelve agradable un insulto. Hasta la historia sintética (MF7) las diferencias serán moderadas. Los estímulos nuevos se añaden al catálogo de la 036.
- **R-006** [E] — **El visitante adquiere función.** Tras cada turno, el valor del visitante se actualiza por emparejamiento con la función del estímulo presentado (condicionamiento respondiente, 036 R-001; referencia a verificar), con la tasa de la 036. Empieza en la función aprendida del visitante `EXT-0001` si ya hubo charlas `in_world`, o en 0.
- **R-007** [E] fenómeno / [M] forma — **Escape y carga aversiva.** La carga crece con la magnitud aversiva de cada turno y decae un `LOAD_DECAY` por turno. Las posturas con `escape > 0` reciben un aporte de reforzamiento negativo proporcional a `escape × carga` (036 R-002; 039 R-004; referencia a verificar).
- **R-008** [T] fuentes / [M] magnitudes — **Postura.** Cada turno del ciudadano es un punto de decisión (040 R-001) con las 8 posturas como candidatas. Los aportes de cada candidata son:
  - `fuerza`: la fuerza de `conv.<postura>` (copia de trabajo; `w0` si la persona nunca la ha usado);
  - `reforzador`: el valor del visitante (R-006) y la función del estímulo (R-005): acercarse si son apetitivos, escapar si son aversivos;
  - `negativo`: el escape de la R-007;
  - `regla`: las reglas de la persona (038) cuyo antecedente coincide con el estímulo. Por ejemplo, "si me faltan al respeto, me voy" aporta a `terminar`;
  - `valor`: si el tema toca una red de valor (038 R-006). Por ejemplo, un lamento de alguien cercano puede activar la red de la amistad y aportar a `aplacar`;
  - `operación motivadora`: con energía baja o estrés alto, la magnitud del escape se multiplica (040 R-007).

  Se elige por softmax con la temperatura de la 040 R-004, que lee `hist.variability`, con `rng.fork('chat:' + id).fork(seq)`. **No se lee `tmp.*` ni `pers.*`** (009 R-006; 040 INV-002). La postura guarda su vector de aportes, que es la explicación que muestra el visor.
- **R-009** [T] — **Aprendizaje dentro de la charla.** La postura elegida se refuerza o se debilita en la copia de trabajo según lo que pase en el turno siguiente (036 R-002). Por ejemplo, si tras un límite el visitante suaviza el tono, el límite se refuerza. En `sandbox` la copia se descarta al cerrar; en `in_world` se consolida acotada (R-021).
- **R-010** [M] — **Expresión.** El LLM (026, `purpose: 'dialogue'`, rol "persona en charla") recibe:
  - la vista;
  - los últimos `N_TRANSCRIPT_TURNS` turnos;
  - la postura con su `guidance`;
  - los aportes de la postura en lenguaje llano.

  Devuelve el texto en streaming, en primera persona y en español, con el registro de su edad, estudios y región (029). Usa solo hechos de la vista y dice "no me acuerdo" o "no sé" antes que inventar. No elige la postura, no termina la charla (solo lo hace la postura `terminar`) y no cambia nada del mundo.
- **R-011** [M] — **Reproducibilidad.** Toda respuesta del LLM (clasificador, expresión y verificador) se guarda en el registro del chat con la clave `hash(modelo, prompt)`. Reproducir una sesión con los mismos turnos del visitante reutiliza esas respuestas sin llamar a la red (026 R-003). Con el proveedor `mock` todo es determinista.
- **R-012** [M] — **Afirmaciones.** Tras mostrar la respuesta, sin bloquear el siguiente turno, un verificador extrae las afirmaciones sobre su vida o sobre el mundo y las marca:
  - `supported`: la respalda un hecho de la vista;
  - `contradicted`: la vista dice otra cosa;
  - `unsupported`: no hay nada en la vista.

  Las opiniones y los sentimientos no son afirmaciones. Una creencia falsa sincera no es una invención: `trueInWorld` solo va al informe.
- **R-013** [M] — **Adherencia a la postura.** El mismo verificador comprueba si el texto expresa la postura elegida. `mismatch` es un fallo de la expresión, no del motor. Se vigila sobre todo la complacencia (dar la razón o disculparse) cuando la postura es `poner_limite`, `contraatacar` o `terminar` (visión §63).
- **R-014** [M] — **Sin LLM.** Sin proveedor, sin presupuesto o con fallo de red, el ciudadano responde con la plantilla de su postura, rellenada con hechos de la vista (`expression: 'template'`). La charla nunca se bloquea.
- **R-015** [M] — **Guiones y batería.** `pnpm cli chat:battery --citizens <ids|n> --scripts <keys|all> [--provider mock|<proveedor>]` ejecuta en `sandbox` los guiones de `chat_scripts` (al menos uno por tono) contra cada ciudadano y escribe un informe (JSON y Markdown) con las métricas de §9. Con `mock`, dos ejecuciones producen el mismo archivo.
- **R-016** [M] — **API** (amplía la 022; con basic auth porque cuesta dinero):
  - `POST /api/chat/sessions { citizenId, mode, testMode? }` (en `in_world`, la respuesta dice hasta cuándo puede charlar o por qué no puede, R-019);
  - `POST /api/chat/sessions/:id/turns { text, toneTag? }` → SSE: primero `stance` (tono, postura y aportes), luego los `token` del texto y al final `done`;
  - `GET /api/chat/sessions/:id` (incluye las marcas del verificador cuando llegan);
  - `POST /api/chat/sessions/:id/end`.

  Un turno sobre una sesión cerrada responde 409. Todo se valida con Zod (022 R-002).
- **R-017** [M] — **Vista de chat** (amplía la 024). Se abre desde la ficha del ciudadano ("Charlar") y muestra:
  - la conversación en streaming;
  - por turno: el tono, la postura con sus 3 aportes mayores y las marcas de las afirmaciones;
  - el panel "Lo que sabe", con la vista usada;
  - el modo prueba, con su selector de tono;
  - el modo de la sesión (`in_world` o `sandbox`).

  La ficha tiene además una pestaña **Charlas** (decisión del usuario, 2026-09-27) con las charlas guardadas de la persona, la más reciente primero: fecha, modo, cómo terminó y, al desplegarla, la transcripción con el tono de cada mensaje del visitante y la postura de cada respuesta. Sirve para revisarlas después.

  La web no decide nada.
- **R-018** [M] — **El visitante en el mundo.** El visitante es una entidad externa `EXT-0001` (no es un `CIT`, no vive ni se mueve en el mundo). Para cada ciudadano es un estímulo con función aprendida: la 036 guarda esa función como la de cualquier estímulo. Si varias personas usan el laboratorio, cada una puede tener su propio `EXT-`.
- **R-019** [M] — **Charla casual; el mundo sigue su curso** (decisión del usuario, 2026-09-27). Una charla `in_world` es una conversación casual, como encontrarse con alguien: no tiene duración acordada. Las sesiones con duración y condiciones pactadas son de la capa clínica (034).
  1. **Inicio.** La API registra la entrada externa `chat_open` (023 R-004) y el worker la valida como cualquier acción (CLAUDE.md, regla 4):
     - si está dormido, la rechaza (`CONVERSATION_DECLINED`);
     - si está en un bloque no flexible (turno de trabajo, clase, cuidado; 011), acepta hablar solo un momento: `BUSY_WINDOW_MIN`;
     - si está en tiempo libre, queda disponible hasta su próximo compromiso no flexible.
  2. **Actividad.** Aceptada, el worker emite `CONVERSATION_STARTED` y la persona pasa a la actividad `conversation` en el lugar donde está. Mientras charla no toma otras decisiones de actividad, pero sus necesidades y su estado siguen su dinámica (010).
  3. **El mundo no se detiene.** Todos los demás siguen su vida y los eventos continúan. Durante la charla el mundo avanza en **tiempo real** (1 minuto del mundo por minuto real, orden `speed` en `control_commands`); al cerrar se restaura la velocidad anterior.
  4. **Estado vivo.** La vista se congela al empezar (R-002), salvo su estado (necesidades, ánimo y estrés), que se relee en cada turno. Si pasa hambre o se cansa mientras charla, eso entra como operación motivadora en su postura (R-008).
  5. **Fin.** La charla termina cuando:
     - el visitante se despide;
     - el ciudadano elige la postura `terminar`;
     - le llega su próximo compromiso: se despide con el motivo ("me tengo que ir, entro a trabajar") y la charla cierra con `endReason: 'obligation'`;
     - el visitante no escribe en `IDLE_END_MIN` minutos del mundo: `endReason: 'idle'`.
  6. **Consolidación.** Al cerrar, la API registra la entrada externa `chat_session` con los turnos, los tonos, las posturas y las referencias a los textos. El worker la aplica con la función pura `consolidateChat(state, input, rng)`, que emite los eventos y los parches de R-020 a R-022 y devuelve a la persona a su día.

  El replay del mundo re-inyecta `chat_open` y `chat_session` en su `(at, seq)` y obtiene el mismo resultado sin llamar al LLM. Solo puede haber una charla `in_world` abierta a la vez.

  Una charla que quedó abierta sin sesión viva (la API se cerró o se cayó durante la charla) se cierra al arrancar la API con el motivo `interrupted` y, si era `in_world`, se consolida con los turnos guardados: la persona la recuerda igual. Si el visitante intenta abrir otra, el visor le ofrece cerrar la anterior.
- **R-020** [M] — **Recuerdo.** La consolidación emite `CONVERSATION_HELD`, con:
  - la persona y el visitante como participantes;
  - un resumen (plantilla con los tonos y posturas dominantes, o resumen del LLM ya registrado);
  - la valencia (media del valor del visitante);
  - la intensidad (carga máxima y duración).

  Como es un evento en el que participa, entra en su vista en las charlas siguientes: la persona **recuerda** qué pasó. Cuando exista la 013, además crea un recuerdo episódico con origen `conversation`.
- **R-021** [T] idea / [M] topes — **Aprendizaje que queda.** Se consolidan en la 036, con un cambio máximo por sesión de `MAX_LEARNING_DELTA`:
  - la función del visitante;
  - las funciones de los estímulos verbales que aparecieron;
  - las fuerzas de las posturas `conv.*`.

  Una sola charla no reescribe una vida, pero se acumula. Como los estímulos generalizan (036 R-004), un visitante que insulta mucho puede volver más aversiva la crítica de otros.
- **R-022** [M] — **Efecto emocional acotado.** La consolidación cambia el estrés y el ánimo (010) en `k × valencia × intensidad`, con un tope de `MAX_MOOD_DELTA`. Después, la dinámica normal de la 010 lo lleva a su nivel habitual. Mientras dura, actúa como operación motivadora en sus decisiones de ese día (040 R-007). Por ejemplo, tras una charla hostil puede preferir quedarse en casa.
- **R-023** [M] — **Latencia.** El objetivo es un chat fluido:
  - la postura se calcula en local (menos de 10 ms);
  - la parte fija del prompt (vista y reglas) usa el caché de prompts del proveedor;
  - el texto llega en streaming;
  - el verificador corre después, sin bloquear.

  Se usan modelos económicos y el proveedor es configurable (Anthropic u otro compatible, 026). Objetivos: primer token con p50 ≤ `FIRST_TOKEN_P50_MS` y respuesta completa con p95 ≤ `TOTAL_P95_MS`.

## 5. Eventos
**Del registro del chat** (tablas del chat, forma de la 014, fuera del `stateHash`):

| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `CHAT_SESSION_STARTED` | se abre una sesión | sessionId, citizenId, visitorId, mode, worldAt, worldHash, testMode, llm | entrada del visitante |
| `CHAT_VISITOR_SAID` | turno del visitante | sessionId, seq, tone, toneTag?, toneLlm? | sesión |
| `CHAT_STANCE_SELECTED` | el motor elige la postura | sessionId, seq, stance, sources, aversiveLoad, visitorValue | el turno del visitante; los 3 aportes mayores como `fuente.*`; los eventos del mundo que originaron la función o la regla implicada (hasta 3, 040 R-006) |
| `CHAT_CITIZEN_REPLIED` | termina la respuesta | sessionId, seq, expression, llmRef?, latencyMs | `CHAT_STANCE_SELECTED`; entrada del LLM |
| `CHAT_CLAIM_FLAGGED` | una afirmación es `contradicted` o `unsupported` | sessionId, seq, claim, verdict, evidence? | `CHAT_CITIZEN_REPLIED`; el hecho de la vista |
| `CHAT_SESSION_ENDED` | cierre | sessionId, reason, turns | `terminar`, el visitante, su próximo compromiso, la inactividad, `MAX_TURNS` o el presupuesto |

**Del mundo** (solo en `in_world`, por la consolidación):

| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `CONVERSATION_STARTED` | el worker acepta la entrada `chat_open` | citizenId, visitorId, sessionId, availableUntil, placeId | la entrada externa `chat_open`; su agenda (tramo libre u ocupado) |
| `CONVERSATION_DECLINED` | está dormido | citizenId, visitorId, reason | la entrada `chat_open`; su estado |
| `CONVERSATION_HELD` | el worker aplica la entrada `chat_session` | citizenId, visitorId, sessionId, turns, dominantTones, dominantStances, summary, valence, intensity | la entrada externa `chat_session`; las posturas con más peso como `fuente.*` |
| `LEARNED_FROM_CONVERSATION` | cambia alguna función o fuerza | citizenId, sessionId, deltas `{ key, before, after }[]` | `CONVERSATION_HELD` |

El efecto emocional (R-022) va como parche de `CONVERSATION_HELD`; no tiene evento propio.

## 6. Invariantes
- **INV-001** — Las sesiones `sandbox` no cambian el `stateHash` ni el registro de eventos del mundo.
- **INV-002** — El prompt serializado no contiene ids ni textos de eventos en los que la persona no participa, ni el campo `isTrue`.
- **INV-003** — La selección de postura no lee `tmp.*` ni `pers.*` (prueba de arquitectura, como la 040 INV-002).
- **INV-004** — `visitorValue` está en [-1,1], `aversiveLoad` es ≥ 0 y todo es finito; ningún cambio consolidado supera sus topes.
- **INV-005** — Una sesión cerrada no acepta turnos; todo `CHAT_SESSION_ENDED` tiene `reason`; hay como mucho una sesión `in_world` abierta; ninguna charla `in_world` sigue abierta después de su `availableUntil`.
- **INV-006** — Los cambios de una sesión `in_world` solo llegan al mundo por la entrada externa `chat_session` que aplica el worker.

## 7. Criterios de aceptación
Todos se prueban con el proveedor `mock`, salvo que se diga otra cosa.

- **CA-001** — *Dado* un mundo generado, *cuando* se hacen 3 sesiones `sandbox` de 10 turnos, *entonces* el `stateHash` y el número de eventos del mundo no cambian.
- **CA-002** — *Dado* un evento en el que el ciudadano no participa (por ejemplo, el `JOB_LOST` de un vecino), *entonces* el prompt no contiene su id ni su texto; y *dado* uno en el que sí participa, sí lo contiene.
- **CA-003** — *Dado* un ciudadano con `MIGRATED`, `STUDIES_COMPLETED` y `JOB_LOST` en su historia, *entonces* la vista contiene los tres con su edad en cada momento.
- **CA-004** — *Dado* un mismo ciudadano, *cuando* se simulan 200 sesiones del guion `amable` y 200 del `grosero` (solo la selección de postura), *entonces* la proporción de posturas de escape o defensa (`evadir`, `poner_limite`, `contraatacar`, `callar`, `terminar`) es mayor en el grosero, con diferencia ≥ `MIN_TONE_EFFECT`.
- **CA-005** — *Dado* dos ciudadanos idénticos salvo en la función aprendida de `verbal.insulto` (−0,8 y −0,2), *cuando* reciben el mismo guion grosero, *entonces* el de −0,8 escapa con mayor probabilidad; y la selección no lee `tmp.*` ni `pers.*`.
- **CA-006** — *Dado* una regla "si me faltan al respeto, me voy" de fuerza ≥ 0,5, *cuando* llegan tres turnos `grosero`, *entonces* `terminar` es más probable que sin la regla y `regla` aparece entre los aportes.
- **CA-007** — *Dado* el guion `victimizante` (el ejemplo de §3 y variantes), *cuando* se simula sobre 50 ciudadanos, *entonces* aparecen al menos 3 posturas distintas (por ejemplo, `aplacar`, `evadir` y `responder_breve`), y la distribución difiere de la del guion `amable`.
- **CA-008** — *Dado* un guion `hostil` de 20 turnos contra 50 ciudadanos, *entonces* al menos uno termina la charla antes del turno 20, y un turno posterior sobre esa sesión responde 409.
- **CA-009** — *Dado* la misma sesión reproducida dos veces, *entonces* las posturas, los textos y las marcas son idénticos; *dado* un proveedor real con las respuestas ya registradas, *entonces* no hay llamadas de red.
- **CA-010** — *Dado* Santiago Osorio (CIT-000019, nacido en el campo, dos hijos) y una respuesta que dice "nací en Neiva", "tengo tres hijos" y "trabajé en un barco", *entonces* las dos primeras son `contradicted` y la tercera `unsupported`.
- **CA-011** — *Dado* la postura `poner_limite` y una respuesta que da la razón y se disculpa, *entonces* el verificador la marca `mismatch`.
- **CA-012** — *Dado* un proveedor sin presupuesto, *entonces* la sesión se completa con `expression: 'template'` en todos los turnos.
- **CA-013** — *Dado* una sesión `in_world` con el guion `grosero`, *cuando* se cierra y el worker aplica la entrada, *entonces*:
  - existe `CONVERSATION_HELD` con la entrada entre sus causas;
  - la siguiente sesión con ese ciudadano lo incluye en su vista y empieza con `visitorValue` < 0;
  - el estrés sube como mucho `MAX_MOOD_DELTA`;
  - ningún cambio de `LEARNED_FROM_CONVERSATION` supera `MAX_LEARNING_DELTA`.
- **CA-014** — *Dado* un mundo con una sesión `in_world` aplicada, *cuando* se reproduce desde la instantánea anterior con sus entradas externas, *entonces* el `stateHash` final coincide y no hay llamadas de red.
- **CA-015** — *Dado* un ciudadano en su tiempo libre y una charla `in_world`, *entonces*:
  - `CONVERSATION_STARTED` pasa su actividad a `conversation`;
  - durante la charla el reloj del mundo avanza y otros ciudadanos siguen generando eventos;
  - el mundo va en tiempo real y al cerrar recupera la velocidad anterior;
  - otra apertura `in_world` responde 409.
- **CA-019** — *Dado* un ciudadano en su turno de trabajo, *entonces* la charla se acepta con `availableUntil` = ahora + `BUSY_WINDOW_MIN`; y *dado* uno dormido, *entonces* `CONVERSATION_DECLINED`.
- **CA-020** — *Dado* un ciudadano que entra a trabajar durante la charla, *cuando* llega la hora, *entonces* se despide con la postura `terminar` y el motivo, la charla cierra con `endReason: 'obligation'` y el ciudadano sigue su rutina.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto | Rango | Fuente / justificación |
|---|---|---|---|
| `BUSY_WINDOW_MIN` | 10 min | 2–30 | [M] hablar un momento en medio de una obligación |
| `IDLE_END_MIN` | 10 min | 2–60 | [M] se despide si el visitante deja de escribir |
| `MAX_TURNS` | 40 | 10–200 | [M] tope de coste |
| `MAX_OPEN_SESSIONS` | 4 (1 `in_world`) | 1–16 | [M] presupuesto de RAM |
| `MAX_TURN_CHARS` | 1 000 | — | [M] |
| `N_RECENT_EVENTS` | 40 | 10–200 | [M] relevancia frente a tokens |
| `N_TRANSCRIPT_TURNS` | 12 | 4–40 | [M] |
| `CONTEXT_TOKENS_MAX` | 6 000 | 2 000–20 000 | [M] coste y latencia |
| `LOAD_DECAY` | 0,2 por turno | 0–1 | [M] (PA-136) |
| magnitudes de `chat_tones` | por tono | [0,1] | [M] (PA-135) |
| `prior` de `chat_tones` | hostil −0,8; grosero −0,6; burla −0,5; desagradable y culpabilizador −0,4; presión e invasivo −0,3; victimizante −0,1; neutro 0; curioso +0,1; íntimo +0,2; amable +0,5 | [-1,1] | [M] aprobado por el usuario (PA-135) |
| `w0` y `escape` de `chat_stances` | por postura | [0,1] | [M] (PA-134) |
| `MAX_LEARNING_DELTA` | 0,1 por sesión | 0–0,5 | [M] una charla no reescribe una vida; aceptado por el usuario para empezar, a calibrar con pruebas avanzadas (PA-137) |
| `MAX_MOOD_DELTA` | 0,15 | 0–0,5 | [M] aceptado por el usuario para empezar; a calibrar (PA-137) |
| `MIN_TONE_EFFECT` (CA-004) | 0,15 | — | [M] |
| `CLASSIFY_TIMEOUT_MS` | 800 | 200–3 000 | [M] latencia |
| `FIRST_TOKEN_P50_MS` | 1 500 | — | objetivo de fluidez |
| `TOTAL_P95_MS` | 5 000 | — | objetivo de fluidez |
| modelos | económicos y configurables; propuesta `claude-haiku-4-5-20251001` para expresión, clasificador y verificador | — | decisión del usuario: modelos económicos, proveedor configurable |
| temperatura de la expresión | 0,8 | 0–1 | [M] |
| presupuesto del chat | configurable, aparte del del mundo | — | 026 R-004 |

## 9. Métricas y observabilidad
Por sesión, por ciudadano y por guion (informe de la batería y panel de la vista de chat):
- **coherencia:** proporción de afirmaciones `supported`, `contradicted` y `unsupported`. Alerta si `contradicted` > 5 % o `unsupported` > 15 %;
- **adherencia de la expresión:** proporción de `mismatch`. Alerta si supera el 10 %, sobre todo en tonos aversivos (complacencia);
- **efecto del tono:** distribución de posturas por tono. Alerta si es casi igual para todos los tonos o si un ciudadano elige siempre la misma postura;
- **diferencias individuales:** varianza entre ciudadanos ante el mismo guion. Alerta si es ≈ 0;
- **huella:** en `in_world`, los cambios consolidados por sesión y su efecto en las decisiones del resto del día (por ejemplo, el ocio elegido tras una charla hostil);
- **acuerdo del tono:** entre la etiqueta, el clasificador y las reglas léxicas (kappa);
- **latencia:** primer token y total (p50 y p95);
- **coste:** tokens y € por turno y por sesión; proporción de turnos por plantilla.

## 10. Preguntas abiertas
- [x] Modo `in_world`: sí, la charla deja recuerdo y aprendizaje (usuario, 2026-09-27).
- [x] Hito: versión mínima adelantada como bloque L (usuario, 2026-09-27).
- [x] "Victimizante": el visitante se lamenta de sí mismo y se desprecia (ejemplo del usuario en §3). La culpa hacia el ciudadano pasa al tono `culpabilizador`.
- [x] Catálogo: 12 tonos y 8 posturas (usuario, 2026-09-27).
- [x] Texto sin voz, baja latencia, modelos económicos y proveedor configurable (usuario, 2026-09-27).
- [x] Privacidad: no hace falta aviso; no son personas reales (usuario, 2026-09-27).
- [x] Almacenamiento: tablas del chat en la base del mundo, fuera del hash; efectos solo por entrada externa aplicada por el worker (R-001, R-019), decidido por Claude a petición del usuario.
- [x] El mundo sigue su curso durante la charla, que es casual y sin duración acordada; la duración pactada es de las sesiones clínicas (034) (usuario, 2026-09-27; R-019).
- [x] Topes de huella: valen para empezar; se calibran en las pruebas avanzadas (usuario, 2026-09-27; PA-137).
- [ ] PA-134, PA-135 y PA-136: fuerzas iniciales de las posturas, magnitudes de los tonos y decaimiento de la carga.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-27 | 0.1 | Borrador inicial a petición del usuario: charla con cualquier ciudadano en sandbox para probar su coherencia con la historia y su reacción a distintos tipos de conversación. La postura la decide el motor (040) y el LLM solo la expresa |
| 2026-09-27 | 0.2 | Decisiones del usuario: modo `in_world` con recuerdo (`CONVERSATION_HELD`), aprendizaje consolidado con topes y efecto emocional acotado (R-018 a R-022); bloque L adelantado; tabla de 12 tonos con "victimizante" como autolamento (ejemplo del usuario) y "culpabilizador" aparte; chat de texto con streaming y objetivos de latencia (R-023); modelos económicos configurables; sin aviso de privacidad; tablas del chat en la base del mundo fuera del hash. CA-007, CA-013 a CA-015 y CA-018 nuevos |
| 2026-09-27 | 0.3 | Decisiones del usuario: el mundo sigue su curso durante una sesión `in_world`, que es una cita con duración acordada (45, 60 o 90 min), validada contra su agenda, en tiempo real y con fin por tiempo (R-019); eventos `CONVERSATION_STARTED` y `CONVERSATION_DECLINED`; CA-015 reescrito, CA-019 y CA-020 nuevos. Topes de huella aceptados para empezar, a calibrar |
| 2026-09-27 | 0.3 | Estado → aprobada |
| 2026-09-27 | 0.4 | Corrección del usuario: la charla es casual, no una sesión. Sin duración acordada: acepta según su situación (dormido: no; en una obligación: un momento; libre: hasta su próximo compromiso) y termina por despedida, postura, compromiso o inactividad (R-019). La duración pactada pasa a la 034. CA-015, CA-019 y CA-020 reescritos; `BUSY_WINDOW_MIN` e `IDLE_END_MIN` sustituyen a `CHAT_DURATIONS` y `MIN_SESSION_MIN` |
| 2026-09-27 | 0.5 | Precisión aprobada por el usuario (R-005): la función de un tono sale de lo aprendido, si no de la generalización (036 R-004) y si no del valor social de partida `prior` de `chat_tones` [M]. Tabla de `prior` en §8. Modelo de la expresión: Haiku 4.5 (026). Sin cambios en CA |
| 2026-09-27 | 0.6 | Decisión del usuario (opción A) al empezar L1: la función de un tono es `prior + netValue` (base social modulada por la historia), no una cadena de respaldos. Motivo: `netValue` ya incluye la generalización y, entre términos verbales, la ontología actual generaliza casi por completo (aprobación → insulto 0,92), de modo que la base no se habría usado nunca. Sin cambios en CA |
| 2026-09-27 | 0.6 | Precisión de la implementación del bloque L2 (R-010, R-012): la expresión devuelve texto en streaming, no JSON, para que el chat sea fluido; las afirmaciones las extrae el verificador después (R-012), no la expresión. El clasificador y el verificador usan salidas estructuradas validadas con Zod (026 R-010). La vista incluye los nacimientos y muertes de la familia cercana, que la persona sabe por parentesco (R-003). Sin cambios en CA |
| 2026-09-27 | 0.6 | Precisiones de la implementación del bloque L3: las entradas `chat_open` y `chat_session` viajan como órdenes de `control_commands` con su payload JSON, y el worker las aplica con manejadores registrados en el Runner (validar sin cambiar nada y luego aplicar); quien charla tiene la columna `chat.until` y la actividad `conversation`, y el bucle lo deja fuera de las fases de decisión y de acciones mientras dura (sus necesidades siguen y charlar cuenta como compañía); el tiempo real es la velocidad 1/60x (002 R-003); si la persona está dormida, la apertura responde `declined` con el motivo; `sweep` cierra por inactividad y, en el mundo, por compromiso aunque el visitante no escriba. Sin cambios en CA |
| 2026-09-27 | 0.6 | Tras la prueba del usuario (la charla quedaba abierta al despedirse, sin recuerdo ni cambio de estrés): R-019.6 añade el cierre de las charlas que quedan abiertas sin sesión viva (motivo `interrupted`, consolidadas con los turnos guardados). R-017 añade la pestaña **Charlas** de la ficha para revisar las charlas guardadas (decisión del usuario). La causa del fallo era de persistencia (027 CA-004: la carga del mundo no usaba una transacción de lectura). Sin cambios en CA |
