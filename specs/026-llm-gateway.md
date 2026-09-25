---
id: 026
nombre: llm-gateway
estado: borrador
hito: M6
depende_de: [017, 025, 021]
version: 0.1
---

# 026 — Pasarela LLM

## 1. Propósito
Uso opcional de un LLM (Claude API) para expresión natural y decisiones complejas de personas en nivel 4, sin romper determinismo ni presupuesto. Ver ADR-003.

## 2. Alcance
**Incluye:** proveedores, prompts, caché, presupuesto, validación, registro.
**Fuera de alcance:** decisiones de niveles 0–3.

## 3. Modelo de datos
```ts
interface LlmProvider { complete(req: LlmRequest): Promise<LlmResponse>; }  // 'anthropic' | 'mock'
interface LlmRequest { citizenId: EntityId; purpose: 'dialogue'|'diary'|'decision'; context: PersonView; schema?: ZodSchema; }
interface PersonView { beliefs: Belief[]; memories: Memory[]; state: CitizenState; personality: Personality; situation: string; }
```

## 4. Reglas
- **R-001** — El contexto enviado solo contiene la vista de la persona (creencias, memorias), nunca la verdad del mundo.
- **R-002** — Las decisiones vuelven como JSON validado; si es inválido o imposible se descarta (LLM_PROPOSAL_REJECTED) y decide el motor por reglas.
- **R-003** — Toda respuesta se registra como entrada externa; el replay la reutiliza sin llamar al modelo.
- **R-004** — Presupuesto diario en tokens/€; al agotarse, fallback a reglas sin error.
- **R-005** — El worker nunca se bloquea esperando al LLM: la petición es asíncrona y su resultado se aplica en un tick futuro programado.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `LLM_PROPOSAL_ACCEPTED` |  |  |  |
| `LLM_PROPOSAL_REJECTED` |  | motivo |  |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* el proveedor mock, *entonces* el mundo es determinista.
- **CA-002** — *Dado* un replay de un periodo con llamadas LLM, *entonces* no se realiza ninguna llamada de red y el hash coincide.
- **CA-003** — *Dado* presupuesto agotado, *entonces* la simulación continúa por reglas.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto |
|---|---|
| presupuesto diario | configurable (€) |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] ¿Qué modelo y qué límites de coste mensual?
- [ ] Enganche de la capa clínica (034 R-002, R-003, R-008):
  - un `purpose: 'session'` con el rol "persona en sesión";
  - modelo y proveedor configurables por propósito;
  - el texto de la sesión se guarda fuera del hash y se reutiliza en el replay.

  Decisión del usuario (2026-09-24): el modelo debe ser configurable.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-24 | 0.1 | Pregunta abierta: sesiones clínicas con modelo configurable (spec 034) |
