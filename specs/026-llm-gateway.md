---
id: 026
nombre: llm-gateway
estado: borrador
hito: Bloque L (lo que necesita la charla, 043) · M6 (decisiones y diarios)
depende_de: [021, 023, 025, 040]
version: 0.2
---

# 026 — Pasarela LLM

## 1. Propósito
Uso opcional de modelos de lenguaje para **expresión** (charlas, diarios), **clasificación** y **verificación**, y en M6 para **propuestas de decisión** de nivel 4. Todo sin romper el determinismo ni el presupuesto (ADR-003; visión §46, §47 y §63).

La pasarela es la única puerta a los proveedores: el resto del sistema pide "un resultado para este propósito" y no sabe qué modelo ni qué proveedor lo produce. La usan:
- la charla con ciudadanos (043), desde el bloque L;
- los diarios y las decisiones de nivel 4 (M6);
- las sesiones clínicas (034), más adelante.

## 2. Alcance
**Incluye:**
- los adaptadores de proveedor: `anthropic`, `openai_compatible` (cualquier API compatible, también un modelo local) y `mock`;
- la configuración de modelo y parámetros **por propósito**;
- el streaming de texto;
- el caché de prompts del proveedor;
- las salidas estructuradas validadas con Zod;
- el registro de respuestas y el replay sin red;
- el presupuesto, los tiempos máximos y los respaldos;
- las métricas de uso, coste y latencia.

**Fuera de alcance:**
- qué dice cada prompt: lo define la spec que lo usa (043, 034; en M6, las de diario y decisión);
- qué sabe la persona: la vista la construye quien llama (025; mientras tanto, la vista mínima de la 043 §3);
- qué se hace con una propuesta de decisión: la valida el motor (040 R-008) y aquí solo se registra.

## 3. Modelo de datos
```ts
type Purpose =
  | 'dialogue'   // expresión de un ciudadano en una charla (043)
  | 'classify'   // tono de un turno (043 R-004)
  | 'verify'     // afirmaciones y adherencia a la postura (043 R-012, R-013)
  | 'summarize'  // resumen de una charla para su recuerdo (043 R-020)
  | 'decision'   // propuestas de acción de nivel 4 (M6)
  | 'diary'      // diario de una persona observada (M6)
  | 'session';   // persona en sesión clínica (034)

interface ModelConfig {
  provider: 'anthropic' | 'openai_compatible' | 'mock';
  model: string;                 // p. ej. 'claude-haiku-4-5-20251001'
  temperature: number;           // [0,1]
  maxOutputTokens: number;
  timeoutMs: number;             // tiempo máximo de la respuesta completa
  baseUrl?: string;              // solo openai_compatible
}

interface GatewayConfig {        // config/llm.json; las claves, solo por variables de entorno
  purposes: Record<Purpose, ModelConfig | null>;   // null = propósito desactivado (usa el respaldo)
  budget: { dailyTokens: number; monthlyCostCents: number };
  repairRetries: number;         // reintentos si una salida estructurada no valida
}

interface PromptPart { text: string; cacheable: boolean }   // las cacheables van primero (R-008)

interface LlmRequest {
  purpose: Purpose;
  citizenId?: EntityId;
  system: PromptPart[];          // instrucciones y vista de la persona
  messages: { role: 'user' | 'assistant'; text: string }[];
  schema?: ZodSchema;            // salida estructurada; sin schema = texto
  stream?: boolean;              // solo texto
}

interface LlmResult {
  text?: string;                 // o bien text (en streaming, al final)…
  data?: unknown;                // …o bien data validada contra schema
  source: 'network' | 'record' | 'mock' | 'fallback';
  fallbackReason?: 'budget' | 'timeout' | 'invalid' | 'disabled' | 'network_error';
  usage: { inputTokens: number; outputTokens: number; cachedTokens: number };
  costMicros: number;            // millonésimas de dólar (entero)
  latencyMs: { firstToken?: number; total: number };
  model: string;
  recordKey: string;             // R-003
}

interface LlmRecord {            // tabla llm_records, fuera del stateHash
  key: string;                   // sha256(provider, model, purpose, parámetros, prompt serializado)
  purpose: Purpose; model: string;
  response: { text?: string; data?: unknown };
  usage: LlmResult['usage']; costMicros: number;
  createdAt: string;             // fecha real (la pasarela no es el motor)
  affectsWorld: boolean;         // lo cita una entrada externa del mundo (R-003)
}
```

**Coste de memoria:**
- en el proceso que la usa (la API): una LRU de `RECORD_LRU` registros en RAM (≈ 2 KB cada uno, ≈ 1 MB), más la configuración;
- en disco: ≈ 2 KB por registro;
- el mundo no gana columnas: 0 bytes por ciudadano.

## 4. Reglas
- **R-001** [M] — **Solo la vista.** El contexto enviado solo contiene la vista de la persona (creencias, recuerdos y estado propio, o la vista mínima de la 043), nunca la verdad del mundo. La construye quien llama; la pasarela la transmite sin añadir datos del estado.
- **R-002** [M] — **Propuestas validadas** (M6). Las decisiones vuelven como JSON validado. Si una propuesta es inválida o imposible, se descarta (`LLM_PROPOSAL_REJECTED`) y decide el motor por reglas (040).
- **R-003** [M] — **Registro y replay.** Toda respuesta se guarda en `llm_records` con la clave `sha256(provider, model, purpose, parámetros, prompt serializado)`. Una petición con una clave ya registrada devuelve el registro (`source: 'record'`) sin llamar a la red. Cuando una respuesta influye en el mundo (por ejemplo, una charla `in_world`), la entrada externa que la aplica cita su clave (023 R-004). Así el replay del mundo la reutiliza y se marca `affectsWorld`. Esos registros nunca se borran.
- **R-004** [M] — **Presupuesto.** Hay un tope diario de tokens y otro mensual de coste. Al agotarse, toda petición devuelve `source: 'fallback'` con `fallbackReason: 'budget'`, sin error, y quien llama usa su respaldo (en la 043, plantillas y reglas léxicas). Una petición en curso puede terminar aunque cruce el tope.
- **R-005** [M] — **El worker no espera.** El worker nunca llama a la pasarela. Lo que el LLM aporta al mundo llega como entrada externa ya resuelta y se aplica en un tick posterior (043 R-019).
- **R-006** [M] — **Configuración por propósito** (decisión del usuario, 2026-09-24 y 2026-09-27: modelo configurable y modelos económicos). Cada propósito tiene su proveedor, modelo y parámetros en `config/llm.json`. Cambiarlos no requiere tocar código. Un propósito con `null` usa directamente su respaldo. Las claves se leen solo de variables de entorno (`ANTHROPIC_API_KEY`, `LLM_API_KEY`, `LLM_BASE_URL`).
- **R-007** [M] — **Streaming.** Las peticiones de texto con `stream: true` devuelven un iterable de fragmentos y, al final, el `LlmResult` completo. Se mide la latencia del primer fragmento y la total. Las salidas estructuradas no van en streaming.
- **R-008** [M] — **Caché de prompts.** Las partes `cacheable` (instrucciones fijas y vista de la persona) se envían primero y, si el proveedor lo permite, marcadas para su caché (en Anthropic, `cache_control`). Así los turnos de una misma charla reutilizan la vista y bajan la latencia y el coste. Los tokens servidos desde el caché se anotan en `usage.cachedTokens`.
- **R-009** [M] — **Tiempo máximo.** Cada propósito tiene su `timeoutMs`. Al superarlo, se corta la petición y se devuelve `fallback` con `timeout`. En streaming, si ya llegó texto, se devuelve lo recibido y se marca `timeout`.
- **R-010** [M] — **Salidas estructuradas.** Se validan con Zod. Si no validan, se reintenta hasta `repairRetries` veces con el error de validación en el mensaje; después, `fallback` con `invalid`.
- **R-011** [M] — **Proveedor `mock`.** Es determinista: su respuesta sale de una función del llamador o de plantillas, a partir del hash de la petición. Tiene una latencia simulada configurable para probar el streaming y los tiempos máximos. Con `mock`, el mundo es determinista (CA-001).
- **R-012** [M] — **Higiene.** Las claves nunca se registran ni se escriben en registros, logs o respuestas de la API. Los textos del mundo son ficción: no hay datos de personas reales.
- **R-013** [M] — **Métricas.** Se agregan tokens, tokens de caché, coste y latencia (p50 y p95), por propósito y por día. La API de solo lectura las expone en `/api/llm/usage` (022).

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `LLM_PROPOSAL_ACCEPTED` | (M6) el motor acepta una propuesta | citizenId, purpose, action, recordKey | la entrada externa que la trae; la validación del motor |
| `LLM_PROPOSAL_REJECTED` | (M6) el motor la rechaza | citizenId, purpose, reason, recordKey | la entrada externa; la precondición que falla |

Las llamadas, los respaldos y el agotamiento del presupuesto no son eventos del mundo: quedan en `llm_records` y en las métricas (R-013). Quien usa la pasarela puede registrarlos en su propio registro (por ejemplo, `CHAT_CITIZEN_REPLIED` con `expression: 'template'` en la 043).

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).
- **INV-003** — En modo replay, el contador de llamadas de red es 0 si todas las claves están registradas.
- **INV-004** — Ninguna clave de API aparece en `llm_records`, en los logs ni en las respuestas de la API.
- **INV-005** — El coste acumulado del mes no supera el tope en más de una petición.

## 7. Criterios de aceptación
- **CA-001** — *Dado* el proveedor `mock`, *entonces* el mundo es determinista.
- **CA-002** — *Dado* un replay de un periodo con llamadas LLM, *entonces* no se realiza ninguna llamada de red y el hash coincide.
- **CA-003** — *Dado* el presupuesto agotado, *entonces* la simulación continúa y las peticiones devuelven `fallback` con `budget`.
- **CA-004** — *Dado* `config/llm.json` con modelos distintos para `dialogue` y `classify`, *entonces* cada petición usa el suyo; y *dado* un cambio del modelo de `dialogue` en la configuración, *entonces* la siguiente petición usa el nuevo sin cambiar código.
- **CA-005** — *Dado* `mock` con 50 ms por fragmento, *cuando* se pide texto en streaming, *entonces* el primer fragmento llega antes del resultado final y `latencyMs.firstToken` < `latencyMs.total`.
- **CA-006** — *Dado* una petición con partes cacheables, *entonces* el adaptador de Anthropic las envía primero y marcadas para caché (prueba del constructor de la petición, sin red).
- **CA-007** — *Dado* un `timeoutMs` de 200 y `mock` con 1 s de latencia, *entonces* la petición devuelve `fallback` con `timeout` antes de 300 ms.
- **CA-008** — *Dado* `mock` que devuelve JSON inválido y luego válido, *entonces* con `repairRetries = 1` el resultado es válido; y *dado* que devuelve inválido siempre, *entonces* `fallback` con `invalid`.
- **CA-009** — *Dado* la misma petición dos veces, *entonces* la segunda sale del registro (`source: 'record'`) sin llamada de red; y *dado* otro modelo, *entonces* hay una llamada nueva.
- **CA-010** — *Dado* una clave de API en el entorno, *entonces* una prueba que recorre `llm_records`, los logs y las respuestas de la API no la encuentra.
- **CA-011** — *Dado* un servidor falso compatible con OpenAI, *entonces* el adaptador `openai_compatible` envía una petición válida y lee su respuesta, también en streaming.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto | Rango | Fuente / justificación |
|---|---|---|---|
| `dialogue` | Anthropic `claude-haiku-4-5-20251001`, temperatura 0,8, 300 tokens de salida, 8 s | configurable | usuario: modelos económicos y baja latencia (043 R-023) |
| `classify` | Anthropic `claude-haiku-4-5-20251001`, temperatura 0, 50 tokens, 800 ms | configurable | 043 R-004 |
| `verify` | Anthropic `claude-haiku-4-5-20251001`, temperatura 0, 400 tokens, 10 s | configurable | asíncrono (043 R-012) |
| `summarize` | Anthropic `claude-haiku-4-5-20251001`, temperatura 0,3, 200 tokens, 10 s | configurable | 043 R-020 |
| `decision`, `diary` | `null` hasta M6 | — | ADR-003 |
| `session` | `null` hasta la capa clínica | — | 034 R-008 |
| `budget.dailyTokens` | 2 000 000 | configurable | [M] pregunta abierta |
| `budget.monthlyCostCents` | 2 000 (20 USD) | configurable | [M] pregunta abierta |
| `repairRetries` | 1 | 0–3 | [M] |
| `RECORD_LRU` | 500 registros | 100–5 000 | presupuesto de RAM (CLAUDE.md, regla 8) |

## 9. Métricas y observabilidad
- tokens (de entrada, de salida y de caché), coste y latencia (p50 y p95) por propósito y por día;
- proporción de respuestas por fuente (`network`, `record`, `mock`, `fallback`) y de respaldos por motivo;
- alertas: presupuesto al 80 %; tasa de `timeout` > 5 %; tasa de `invalid` > 2 %; p95 del primer fragmento de `dialogue` por encima del objetivo de la 043 (1,5 s de p50).

## 10. Preguntas abiertas
- [x] Modelo configurable (usuario, 2026-09-24) y modelos económicos con proveedor configurable (usuario, 2026-09-27): R-006 y §8.
- [x] Enganche de la capa clínica (034): el propósito `session` queda reservado y desactivado hasta entonces.
- [ ] ¿Qué topes de presupuesto? Propuesta: 20 USD al mes y 2 millones de tokens al día para empezar.
- [ ] ¿Qué proveedor alternativo, si alguno? Propuesta: el adaptador `openai_compatible` queda listo para usar otro proveedor o un modelo local, pero por defecto todo va a Anthropic.
- [ ] ¿Se podan los registros de charlas `sandbox` (no afectan al mundo) pasados N días? Propuesta: sí, a los 90 días; los que afectan al mundo nunca se borran.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-24 | 0.1 | Pregunta abierta: sesiones clínicas con modelo configurable (spec 034) |
| 2026-09-27 | 0.2 | Concreción para el bloque L (043): propósitos `dialogue`, `classify`, `verify` y `summarize`; configuración por propósito sin código; adaptadores `anthropic`, `openai_compatible` y `mock`; streaming; caché de prompts; salidas estructuradas con reintento; registro con clave y replay; tiempos máximos y respaldos; métricas; higiene de claves. Se conservan R-001, R-002, R-004 y R-005, y CA-001 a CA-003. `depende_de` cambia la 017 (obsoleta) por la 040 y añade la 023. CA-004 a CA-011 nuevos |
