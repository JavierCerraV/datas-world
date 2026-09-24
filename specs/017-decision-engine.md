---
id: 017
nombre: decision-engine
estado: borrador
hito: M2
depende_de: [010, 011, 012, 015]
version: 0.1
---

# 017 — Motor de decisiones

## 1. Propósito
Cómo una persona elige qué hacer: opciones disponibles, utilidad subjetiva según necesidades, valores, personalidad, creencias y contexto; con azar acotado. Toda decisión se convierte en una acción que el motor valida.

## 2. Alcance
**Incluye:** generación de opciones, función de utilidad, selección softmax, acciones y validación.
**Fuera de alcance:** LLM (026).

## 3. Modelo de datos
```ts
interface ActionRequest { actor: EntityId; kind: ActionKind; target?: EntityId; params?: unknown; reason: CauseRef[]; }
interface ActionResult { ok: boolean; rejected?: string; patches: Patch[]; events: WorldEvent[]; }
interface Option { action: ActionRequest; utility: number; explain: { factor: string; contribution: number }[]; }
```

## 4. Reglas
- **R-001** — Opciones = actividad de la rutina + alternativas que satisfacen necesidades urgentes + reacciones a eventos recientes.
- **R-002** — utilidad = Σ (peso_necesidad × mejora esperada) + afinidad de valores + sesgo de personalidad + hábito (018) − costo (dinero, energía, riesgo percibido).
- **R-003** — Selección por softmax con temperatura dependiente de impulsividad; ruido desde el flujo RNG de la persona.
- **R-004** — La persona decide con sus **creencias** (025), no con la verdad.
- **R-005** — Cada acción aplicada guarda `explain` resumido como causa del evento resultante.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `ACTION_REJECTED` | acción inválida (solo debug o nivel ≥3) | motivo |  |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* hambre crítica y comida disponible, *entonces* se elige comer en > 95 % de los casos.
- **CA-002** — *Dado* una persona que cree (falsamente) que un amigo la traicionó, *entonces* reduce la probabilidad de buscarlo aunque la verdad sea otra.
- **CA-003** — *Dado* una acción imposible (sin dinero), *entonces* se rechaza y se elige otra.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto |
|---|---|
| temperatura base | 0.3 (prototipo v=.3) |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] Revisar parámetros con los resultados de la primera validación.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
