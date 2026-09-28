---
id: 044
nombre: chat-consequences
estado: aprobada
hito: Bloque L (ampliación, petición del usuario 2026-09-27) · completa con 012, 013 y 025 en M3–M6
depende_de: [008, 010, 014, 019, 023, 026, 036, 037, 038, 040, 043]
version: 0.2
---

# 044 — Consecuencias de la charla: lo que se dice sobre otros sale de la charla

## 1. Propósito
Hoy una charla `in_world` solo deja en el ciudadano su recuerdo, un aprendizaje acotado y un pequeño cambio de ánimo (043 R-020 a R-022). Lo que el visitante **dice sobre otras personas** no tiene consecuencias.

Ejemplo del usuario (2026-09-27): el visitante le propone a un ciudadano una relación abierta. Él se niega. Entonces el visitante le dice que su esposa está de acuerdo. El ciudadano se molesta, pero:
- la reacción debería ser **más fuerte** y depender de su historia de aprendizaje;
- al terminar, debería **llamar a su esposa** al celular o **confrontarla en casa**;
- eso genera un **conflicto** en la pareja, que a su vez cambia lo que pasa después (efecto mariposa).

Esta spec convierte lo dicho en la charla en **creencias** del ciudadano, **reacciones** según su historia e **intenciones** que actúa en el mundo. Todo con eventos encadenados por causas, para poder responder a la pregunta guía: *¿podemos explicar por qué terminó donde terminó?* La respuesta llega hasta la frase del visitante.

Sigue:
- ADR-003: el LLM **propone** qué se afirmó; el motor valida y decide;
- regla de oro 3: el ciudadano cree lo que oyó, no lo que es verdad en el mundo;
- ADR-007: la fuerza de la reacción sale de su historia (036, 037, 038, 040), no de un rasgo.

## 2. Alcance
**Incluye:**
- las afirmaciones del visitante sobre terceros cercanos (pareja, familia del hogar, jefe, compañeros), de un catálogo cerrado;
- la creencia mínima que deja cada afirmación, con su fuente y su credibilidad;
- el impacto emocional según la historia, con efecto en la postura durante la charla y en el estrés después;
- las intenciones tras la charla: llamar ahora, confrontar al encontrarse, callar y rumiar, o preguntar con calma;
- el encuentro entre los dos ciudadanos, con la respuesta del otro según **su** historia y **su** creencia;
- la tensión de la pareja o del vínculo, que decae con el tiempo;
- la cadena de eventos con causas hasta el turno de la charla.

**Fuera de alcance:**
- las relaciones completas (012) y la memoria episódica (013): aquí se usa lo mínimo, y se sustituye cuando existan;
- el conocimiento completo (025): la creencia de esta spec es la forma mínima de su `Belief`;
- la difusión a terceros (rumores): es la siguiente ampliación, en la 025;
- la conversación en lenguaje natural entre ciudadanos: el encuentro se decide por reglas; el LLM solo podrá narrarlo después (026, `diary`).

## 3. Modelo de datos
```ts
/** Una afirmación del visitante sobre un tercero (catálogo `chat_claims`). */
interface ChatClaim {
  seq: number;              // turno de la charla
  about: EntityId;          // persona real resuelta desde la vista del ciudadano ("su esposa" → CIT-…)
  predicate: string;        // clave del catálogo: 'consiente_relacion_abierta', 'infiel', 'habla_mal_de_ti'…
  llmRef?: string;          // registro de la pasarela (replay sin red)
}

/** Creencia mínima (forma reducida de 025 `Belief`). Vive en la persona, no en el mundo. */
interface Belief {
  about: EntityId;
  predicate: string;
  source: string;           // 'EXT-0001', o un CIT cuando llegue la 025
  credibility: number;      // [0,1]
  at: WorldMinute;
  cause: EventId;           // CHAT_CLAIM_BELIEVED
}

/** Intención pendiente tras la charla (se resuelve en el bucle, 021). */
interface Intention {
  kind: 'llamar' | 'confrontar' | 'rumiar' | 'preguntar';
  target: EntityId;
  urgency: number;          // [0,1]
  expiresAt: WorldMinute;
  cause: EventId;
}

/** Tensión mínima de un vínculo (hasta la 012). Clave: par de ids ordenado. */
interface BondTension { a: EntityId; b: EntityId; tension: number /* [0,1] */; trust: number /* [0,1] */ }
```
Coste de memoria: unas pocas creencias e intenciones por persona que charló (< 200 B cada una). Las tensiones solo existen en los vínculos tocados: menos de 1 KB en el mundo típico.

## 4. Reglas
- **R-001** [M] — **Extracción de afirmaciones.** En cada turno del visitante, el clasificador (043 R-004, propósito `classify`) devuelve también las afirmaciones sobre terceros, con salida validada:
  - `predicate` del catálogo `chat_claims`;
  - `about` como relación: `pareja`, `madre`, `hijo`, `jefe`…

  El motor resuelve la relación a una persona real **desde la vista del ciudadano** (su hogar, su familia y su trabajo). Si no la conoce (no tiene pareja, por ejemplo), la afirmación se descarta con el motivo. Sin LLM hay reglas léxicas de respaldo, como en los tonos.
- **R-002** [T] idea / [M] fórmula — **Credibilidad.** Cuánto cree lo que oyó (PA-138):

  `credibilidad = clamp(CRED_BASE + CRED_SOURCE × v(ext.EXT) ± CRED_TRUST × (confianza − 0,5) − CRED_CONTRA × contradicción)`

  El signo del término de confianza es el del valor de partida de la afirmación: confiar en el tercero hace más creíble lo bueno («te extraña») y menos creíble lo malo («te es infiel»).

  - `v(ext.EXT)`: la función aprendida del visitante (043 R-018). Si viene siendo hostil, se le cree menos.
  - `confianza`: la del vínculo con el tercero (R-007).
  - `contradicción`: si su propia historia (eventos de su vista) contradice la afirmación.

  **Nunca** se consulta lo que el tercero piensa o hizo de verdad (regla de oro 3).
- **R-003** [T] idea / [M] fórmula — **Impacto según la historia.** Cada predicado presenta un estímulo verbal del catálogo 036: `consiente_relacion_abierta` e `infiel` presentan `verbal.traicion`, y `habla_mal_de_ti` presenta `verbal.desprecio`. Su función para esta persona sale de su historia:
  - aprendizaje directo (036): p. ej. vivió una infidelidad en su historia generada (030);
  - transformación por la red (037): p. ej. `traición` coordinada con `abandono`, si su padre se fue;
  - reglas y valores (038): si tiene activo el dominio `pareja/familia`, la afirmación se opone a su valor y suma carga.

  `impacto = credibilidad × |f(estímulo)| × cercanía(tercero) × (1 + VALUE_AMP × valorOpuesto)`

  Dos personas con historias distintas reaccionan distinto a la misma frase (CA-002).
- **R-004** [M] — **Reacción en la charla.** El impacto entra en la carga aversiva de la conversación (043 R-007) en ese turno. Así sube la probabilidad de `contraatacar`, `poner_limite` o `terminar`, según lo que su historia haya reforzado. La postura la sigue eligiendo la 040.
- **R-005** [M] — **Efecto emocional mayor.** El estrés sube `STRESS_K × impacto`, con un tope propio `MAX_CLAIM_STRESS_DELTA`, mayor que el de la charla (043 R-022). Así una revelación pesa más que un mal tono. Decae con la dinámica normal de la 010.
- **R-006** [T] idea / [M] competencia — **Intención tras la charla.** Si `impacto ≥ INTENT_THRESHOLD`, la consolidación (043 R-019.6) crea una intención hacia el tercero. El tipo lo decide la selección de la 040 entre cuatro respuestas, con sus fuentes:

  | Respuesta | Cuándo gana |
  |---|---|
  | `llamar` | Urgencia alta, tiene celular y el tercero no está en el mismo lugar |
  | `confrontar` | Espera a coincidir (casa, trabajo); historia de confrontación reforzada |
  | `rumiar` | Historia de evitación o castigo al confrontar; el estrés queda alto más tiempo |
  | `preguntar` | Credibilidad media e historia de preguntar con éxito |

  La intención caduca en `INTENT_TTL_MIN`. Mientras está viva, entra como fuente en sus decisiones.
- **R-007** [M] — **Tensión del vínculo** (mínima, hasta la 012). Cada par con historia compartida tiene `tension` y `trust`. Se inicializan en la primera consecuencia desde su historia generada (030). La tensión decae `TENSION_DECAY_DAY` por día.
- **R-008** [T] idea / [M] reglas — **El encuentro.** Cuando la intención se ejecuta (llamada inmediata o coincidencia en el mismo lugar):
  1. Se emite `CONFRONTATION` entre los dos.
  2. El tercero responde según **su** historia y **lo que cree** de sí: negar, explicar, contraatacar o callar (040 con el catálogo de posturas de 043). Como nunca dijo eso, en general niega; negar bajo acusación puede ser aversivo para él.
  3. El resultado cambia la tensión y la confianza de los dos (acotadas por `MAX_TENSION_DELTA`), el estrés de ambos y, si la negación es creíble, la creencia del primero (baja su credibilidad).
  4. El tercero aprende algo del visitante por lo que le cuentan. Por ejemplo, «un extraño anda diciendo cosas» es una creencia sobre `EXT-0001` con fuente el primero.
- **R-009** [T] — **Efecto mariposa.** Las consecuencias no terminan en el conflicto. La tensión y el estrés actúan como operaciones motivadoras (040 R-007) en los días siguientes: dormir peor, rendir menos en el trabajo, salir o quedarse en casa, buscar a otra persona. Cada evento cita el anterior. No se programan desenlaces: salen de las reglas que ya existen.
- **R-010** [M] — **Determinismo y replay.** Las afirmaciones validadas viajan en la entrada `chat_session` (043 R-019.6), con sus `llmRef`. El resto (credibilidad, impacto, intención, encuentro) es puro sobre el estado, con los flujos del `Rng` `claims:<CIT>` e `intent:<CIT>`. El replay reproduce el mismo conflicto sin red.
- **R-011** [M] — **Sandbox.** En `sandbox` se muestran la afirmación detectada, la credibilidad y el impacto en el panel «Por qué respondió así», sin crear creencias, intenciones ni eventos del mundo.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `CHAT_CLAIM_HEARD` | Consolidación, por afirmación válida | `citizenId, about, predicate, seq, sessionId` | `CONVERSATION_HELD` |
| `CHAT_CLAIM_BELIEVED` | Credibilidad ≥ `BELIEF_MIN` | `citizenId, about, predicate, credibility, impact` | `CHAT_CLAIM_HEARD`, fuentes de R-002 y R-003 (estímulo, regla o valor) |
| `INTENTION_FORMED` | Impacto ≥ `INTENT_THRESHOLD` | `citizenId, kind, target, urgency, expiresAt` | `CHAT_CLAIM_BELIEVED`, fuentes de la 040 |
| `PHONE_CALL_MADE` | Se ejecuta `llamar` | `from, to, reason` | `INTENTION_FORMED` |
| `CONFRONTATION` | Llamada o coincidencia | `a, b, topic, responseA, responseB` | `PHONE_CALL_MADE` o `INTENTION_FORMED` y el lugar |
| `BOND_STRAINED` | Cambia la tensión | `a, b, tensionBefore, tensionAfter, trustBefore, trustAfter` | `CONFRONTATION` |
| `INTENTION_EXPIRED` | Caduca sin ejecutarse (p. ej. rumió) | `citizenId, kind, target` | `INTENTION_FORMED` |

## 6. Invariantes
- **INV-001** — Ninguna función de esta spec lee el estado real del tercero para decidir lo que el ciudadano cree (regla de oro 3).
- **INV-002** — Todo `CONFRONTATION` tiene, en su cadena de causas, un `CHAT_CLAIM_HEARD` (o, cuando llegue la 025, otra fuente de la creencia).
- **INV-003** — Tensión, confianza y credibilidad siempre en `[0,1]`; cada charla cambia la tensión como mucho en `MAX_TENSION_DELTA`.

## 7. Criterios de aceptación
- **CA-001** — *Dado* un ciudadano con pareja en su hogar, *cuando* el visitante dice «su esposa está de acuerdo con la relación abierta», *entonces* se emite `CHAT_CLAIM_HEARD` con `about` = la pareja real y `predicate` = `consiente_relacion_abierta`.
- **CA-002** — *Dada* la misma frase a dos ciudadanos, uno con historia de traición (evento generado o relación en la red) y otro sin ella, *entonces* el impacto del primero es mayor, y su probabilidad de `contraatacar` o `terminar` también.
- **CA-003** — *Dado* un visitante con función aprendida muy negativa (fue hostil antes), *entonces* la credibilidad es menor que con un visitante neutro, y cambiar el estado real de la pareja no cambia la credibilidad (INV-001).
- **CA-004** — *Dado* impacto alto, celular y la pareja en otro lugar, *entonces* hay `PHONE_CALL_MADE` en menos de `CALL_DELAY_MAX_MIN` minutos del mundo tras la charla, seguido de `CONFRONTATION` y `BOND_STRAINED`. *Si* la pareja está en casa, `CONFRONTATION` ocurre al coincidir.
- **CA-005** — `pnpm cli citizen:report` de ambos ciudadanos explica el conflicto con la cadena hasta el turno de la charla (`/revisar-causalidad` sin eslabones rotos).
- **CA-006** — Replay: la misma entrada `chat_session` con sus afirmaciones produce el mismo hash sin llamar al LLM.
- **CA-007** — En `sandbox`, el panel muestra la afirmación, la credibilidad y el impacto, y el mundo no cambia (hash igual).
- **CA-008** — Con impacto bajo (poca credibilidad), no se forma intención y no hay conflicto.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto | Rango | Fuente / justificación |
|---|---|---|---|
| `CRED_BASE` | 0,4 | 0–1 | [M] PA-138 |
| `CRED_SOURCE`, `CRED_TRUST`, `CRED_CONTRA` | 0,3 · 0,4 · 0,6 | 0–1 | [M] PA-138 |
| `BELIEF_MIN` | 0,3 | 0–1 | [M] |
| `VALUE_AMP` | 0,5 | 0–2 | [M] 038 R-007 |
| `STRESS_K`, `MAX_CLAIM_STRESS_DELTA` | 0,5 · 0,35 | 0–1 | [M] PA-139 (mayor que `MAX_MOOD_DELTA` de 043) |
| `INTENT_THRESHOLD` | 0,2 | 0–1 | [M] PA-139; decisión del usuario (opción A, 2026-09-27): con 0,35 nadie actuaba |
| `INTENT_TTL_MIN` | 2 880 (2 días) | 60–10 080 | [M] |
| `CALL_DELAY_MAX_MIN` | 30 | 1–240 | [M] |
| `MAX_TENSION_DELTA`, `TENSION_DECAY_DAY` | 0,3 · 0,05 | 0–1 | [M] PA-140 |

## 9. Métricas y observabilidad
- Por charla: afirmaciones detectadas, creídas y descartadas (con el motivo).
- Distribución de las intenciones (`llamar`, `confrontar`, `rumiar`, `preguntar`) en la batería (043 R-015), con un guion nuevo de «revelación sobre la pareja». Alerta si una sola respuesta supera el 80 %: sería un personaje genérico.
- Largo de las cadenas causales desde `CHAT_CLAIM_HEARD` a 7 y 30 días (efecto mariposa medible).

## 10. Preguntas abiertas
Resueltas por el usuario el 2026-09-27 (todas según la propuesta):
- [x] **P1.** Catálogo inicial `chat_claims` con 8 afirmaciones: `consiente_relacion_abierta`, `infiel`, `habla_mal_de_ti`, `quiere_separarse`, `te_miente_con_dinero`, `te_van_a_despedir`, `te_admira`, `te_extrana`.
- [x] **P2.** Celular: nuevo tipo en `object_kinds` (005). Lo tiene toda persona de 14 años o más, con acceso según el estrato (029).
- [x] **P3.** La tensión mínima del vínculo (R-007) se guarda en la persona, solo para los vínculos tocados, sin adelantar la 012. Cuando llegue la 012, la absorbe.
- [x] **P4.** En el encuentro, el tercero aprende algo sobre el visitante (R-008.4): una creencia sobre `EXT-0001` con fuente su pareja. Abre la puerta a los rumores de la 025.
- [x] **P5.** Spec propia (044), no ampliación de la 043.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-27 | 0.1 | Borrador a petición del usuario tras probar la charla: lo dicho sobre otros deja creencias, reacción según la historia, intenciones (llamar o confrontar) y conflicto encadenado con causas (efecto mariposa) |
| 2026-09-27 | 0.2 | Preguntas P1 a P5 resueltas por el usuario según la propuesta: 8 afirmaciones en `chat_claims`; celular desde los 14 años según el estrato; tensión mínima guardada en la persona hasta la 012; el tercero aprende sobre el visitante en el encuentro; spec propia |
| 2026-09-28 | 0.2 | Estado → aprobada |
| 2026-09-27 | 0.2 | Precisiones de L5.1: la clave `te_extraña` se escribe `te_extrana` (las claves de catálogo no admiten ñ). Las relaciones (`pareja`, `madre`, `padre`, `hijo`, `hermano`, `jefe`, `companero`) van en un catálogo propio, `chat_relations`, con cómo resolverlas desde la vista y su cercanía por defecto para R-003. El celular reutiliza el tipo `tecnologia.telefono` (005) en vez de crear otro, con `callAccess` por estrato. Estímulos verbales nuevos en la 036: `verbal.abandono`, `verbal.afecto`, `verbal.desprecio` y `verbal.traicion`. Las afirmaciones salen en la misma llamada del clasificador de tono, sin coste extra. Sin cambios en CA |
| 2026-09-27 | 0.2 | Precisiones de L5.2: (1) R-002: el término de confianza lleva el signo del valor de partida; con signo fijo, confiar en la pareja haría más creíble que es infiel. (2) R-001: si hay varios hijos, hermanos o compañeros, se toma el primero por id hasta que la 012 dé el más cercano; el jefe es quien ocupa el puesto supervisor. (3) R-002: la contradicción con su historia queda en 0 hasta la memoria episódica (013). (4) R-005: el estrés de la revelación solo viene de lo creído; lo no creído pesa únicamente por hacer más tensa la charla (043 R-022). (5) R-007: confianza de partida 0,6 con la familia y 0,5 con los demás [M] (PA-140). Parámetros en `ChatParams.claims`. Sin cambios en CA |
| 2026-09-27 | 0.2 | Precisiones de L5.3: (1) R-006: solo forman intención las afirmaciones creídas que pegan en contra, una por tercero (la de más impacto). Las fuentes de las cuatro respuestas salen de lo reforzado en sus charlas (contraatacar o poner un límite, callar o evadir, abrirse); la urgencia empuja a llamar y la duda a preguntar. El azar sale del flujo `intent:<CIT>` de la semilla en ese minuto (R-010). (2) R-008: tres sistemas en fases sucesivas del tick (llamada → confrontación → vínculo) para que cada evento cite al anterior. La llamada ocurre cuando los dos están despiertos. El tercero elige entre negar, explicar, contraatacar o callar; negar parte con fuerza 0,6 [M]. La gravedad de cada combinación está en una tabla [M] y la tensión sube `MAX_TENSION_DELTA × gravedad × (0,5 + 0,5 × impacto)`. Bajan las dos confianzas y sube el estrés de ambos. Una negación o explicación baja la creencia de quien reclama `× (1 − 0,5 × confianza)`. (3) R-006: quien rumia suma 0,005 de estrés por hora [M]. (4) Eventos: `PHONE_CALL_MADE` lleva la urgencia; `CONFRONTATION`, la vía y el impacto; `BOND_STRAINED`, las dos confianzas. (5) Medición (semilla 482917, 25 personas con pareja, valores por defecto): todas creen la revelación, pero ninguna forma intención (impacto 0,24 a 0,29 frente al umbral 0,35), y el impacto casi no varía entre personas porque la historia generada no enseña la traición. Pendiente de calibrar con el usuario (PA-139). Sin cambios en CA |
| 2026-09-27 | 0.2 | Decisión del usuario (opción A): `INTENT_THRESHOLD` baja de 0,35 a 0,2, porque con 0,35 nadie actuaba. Nueva medición (semilla 482917, 25 personas con pareja, un desconocido invasivo dice que la pareja acepta una relación abierta): las 25 forman una intención; 18 preguntan, 5 rumian, 1 confronta y 1 llama. En los encuentros, la pareja explica (14) o niega (6). Sin cambios en CA |
