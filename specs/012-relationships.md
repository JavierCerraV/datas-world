---
id: 012
nombre: relationships
estado: borrador
hito: M3
depende_de: [007, 009, 013]
version: 0.1
---

# 012 — Relaciones asimétricas

## 1. Propósito
Vínculos entre personas, distintos desde cada lado: lo que A siente por B no es lo que B siente por A. Amistades, parejas, familia, colegas, conflictos.

## 2. Alcance
**Incluye:** dimensiones del vínculo, formación por encuentros, evolución, rupturas, tipo de relación.
**Fuera de alcance:** propagación de información (025).

## 3. Modelo de datos
```ts
interface Relationship {        // dirigida: from → to
  from: EntityId; to: EntityId;
  familiarity: number; affection: number; trust: number; respect: number;
  attraction: number; resentment: number; dependence: number;   // [0,1]
  labels: ('family'|'friend'|'partner'|'ex'|'colleague'|'boss'|'neighbor'|'acquaintance')[];
  lastInteraction: WorldMinute; interactions: number;
  keyMemoryIds: EntityId[];      // memorias que sostienen el vínculo
}
```

## 4. Reglas
- **R-001** — Encuentros en lugares compartidos generan interacciones con probabilidad según extraversión, ocupación y familiaridad.
- **R-002** — El resultado de una interacción (positiva/neutral/negativa) depende de ánimo, compatibilidad de valores y amabilidad de ambos; cada lado actualiza su vista por separado.
- **R-003** — Sin contacto, afecto y familiaridad decaen lentamente; el resentimiento decae más lento.
- **R-004** — Transiciones de etiqueta (conocido → amigo → pareja; pareja → ex) tienen umbrales con histéresis y producen eventos.
- **R-005** — Máximo 1 conflicto registrado por par cada 2 días (calibración del prototipo) para evitar spam.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `MET` | primer encuentro | a,b,lugar | presencia compartida |
| `FRIENDSHIP_FORMED` |  | a,b | interacciones positivas |
| `ARGUMENT` | discusión | a,b,tema | estrés, resentimiento |
| `RELATIONSHIP_STARTED` | pareja | a,b |  |
| `BREAKUP` | ruptura | a,b,iniciador | conflictos, desequilibrio |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* A con afecto 0.8 hacia B, *entonces* es posible y frecuente que B tenga afecto < 0.5 hacia A.
- **CA-002** — *Dado* 100 personas × 1 año, *entonces* cada persona tiene en promedio 3–15 relaciones con familiaridad > 0.3.
- **CA-003** — *Dado* un BREAKUP, *entonces* sus causas incluyen al menos 2 eventos previos entre ambos.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto |
|---|---|
| ganancia por encuentro | 0.016 (prototipo) |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] ¿Modelo de apego (seguro/ansioso/evitativo) desde M3?

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
