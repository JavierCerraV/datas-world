---
id: 025
nombre: knowledge
estado: borrador
hito: M3
depende_de: [012, 013, 014]
version: 0.1
---

# 025 — Conocimiento, creencias y rumores

## 1. Propósito
Separar WORLD_TRUTH de PERSON_KNOWLEDGE: cada persona sabe solo lo que presenció, le contaron o dedujo; puede creer cosas falsas, mentir y difundir rumores.

## 2. Alcance
**Incluye:** creencias, fuentes, confianza, propagación, mentiras, corrección.
**Fuera de alcance:** LLM.

## 3. Modelo de datos
```ts
interface Belief {
  id: EntityId;              // BEL-…
  holderId: EntityId;
  about: { subject: EntityId; predicate: string; value: unknown }; // ej. {CIT-12, 'lost_job', true}
  confidence: number;        // [0,1]
  source: { kind: 'witnessed'|'told'|'inferred'|'self_story'; from?: EntityId; eventId?: EntityId };
  acquiredAt: WorldMinute;
  isTrue: boolean;           // calculado para análisis, NUNCA leído por la persona
}
```

## 4. Reglas
- **R-001** — Presenciar un evento crea creencia con confianza alta; que te lo cuenten crea creencia con confianza = confianza en la fuente × plausibilidad.
- **R-002** — En interacciones, las personas comparten creencias según extraversión, relevancia y cercanía; la información se degrada al pasar (posible cambio de valor).
- **R-003** — Mentir: probabilidad según honestidad baja, vergüenza y beneficio; la mentira crea `self_story` en quien miente y creencia falsa en el oyente.
- **R-004** — Descubrir una mentira reduce confianza (012) y genera evento.
- **R-005** — El motor de decisiones (017) solo consulta creencias.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `RUMOR_SPREAD` |  | de, a, creencia | interacción |
| `LIE_TOLD` |  | mentiroso, oyente, tema | vergüenza, beneficio |
| `LIE_DISCOVERED` |  |  | contradicción con presenciado |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* un JOB_LOST que la persona oculta, *entonces* tras 30 días ≥ 1 persona tiene una creencia falsa sobre su empleo.
- **CA-002** — *Dado* 1 año, *entonces* existe al menos una creencia falsa ampliamente compartida (rumor) y al menos una corrección.
- **CA-003** — *Dado* el código de decisión, *entonces* una prueba verifica que no accede a `WorldState` para hechos sobre otros.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto |
|---|---|
| degradación por salto | 0.1 |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] Revisar parámetros con los resultados de la primera validación.
- [ ] Enganche de la capa clínica (034 R-002): la `PersonView` (lo que la persona sabe y cree) debe poder construirse para cualquier persona y momento, y es la única entrada del LLM. Propuesta: definirla aquí y reutilizarla en la 026 y la 034.


## Adaptación al motor funcional (MF8.1, 2026-09-28)
Según la 035 §8:
- La comunidad verbal transmite relaciones y reglas (037 R-007, 038): lo que una persona sabe de otra es una creencia con fuente (la forma mínima ya existe en la 044).
- Mentir emerge de contingencias y reglas (evitar un castigo, conseguir aprobación), sin un rasgo de honestidad.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-24 | 0.1 | Pregunta abierta: `PersonView` como única entrada del LLM (spec 034) |
| 2026-09-28 | — | MF8.1: sección «Adaptación al motor funcional» con lo que cambió en los bloques MF1 a MF7 (o debe cambiar, si la spec sigue en borrador), según la 035 §8. Sin cambios en CA |
