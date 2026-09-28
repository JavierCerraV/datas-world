---
id: 020
nombre: history
estado: borrador
hito: M3
depende_de: [014, 019, 013]
version: 0.2
---

# 020 — Historia e informe de vida

## 1. Propósito
Separar estado actual, eventos, historia y memoria. La historia es el relato objetivo de la vida de una persona; el informe de vida lo presenta de forma explicable y lo compara con cómo la persona se cuenta su vida (capítulos autobiográficos de la spec 013).

## 2. Alcance
**Incluye:** capítulos de vida objetivos, hitos, informe de vida, comparación historia vs memoria, perfil emergente.
**Fuera de alcance:** narración con LLM (026, opcional).

## 3. Modelo de datos
```ts
// Capítulo OBJETIVO: se deriva de eventos. No confundir con AutobiographicalChapter (013), que es subjetivo.
interface LifeChapter { citizenId: EntityId; from: WorldMinute; to?: WorldMinute; title: string; keyEventIds: EntityId[]; }

interface LifeReport {
  citizenId: EntityId; generatedAt: WorldMinute; summary: string;
  chapters: LifeChapter[];
  turningPoints: { eventId: EntityId; why: CausalNode }[];
  remembered: {                              // lo que la persona cree de su vida (013)
    chapters: AutobiographicalChapter[];
    topSchemas: MemorySchema[];              // hasta 5, por confidence
  };
  divergences: { lifeChapter: number; autoChapter?: EntityId; kind: 'tone' | 'missing' | 'boundary'; note: string }[];
  emergentProfile: EmergentProfile;
}

// Perfil emergente (visión §39): calculado desde la historia, nunca un parámetro inicial.
interface EmergentProfile {
  jobStability: number; relationshipStability: number; socialNetwork: number;
  resilience: number; stressorExposure: number; economicTrajectory: number; // todos [0,1]
  basis: Record<string, EntityId[]>;         // eventos que sustentan cada valor
}
```

## 4. Reglas
- **R-001** — Puntos de inflexión = eventos con importancia alta o con gran cambio en ánimo/dinero/relaciones en los 30 días siguientes.
- **R-002** — El informe se genera por plantillas a partir de eventos y causas; nunca inventa hechos.
- **R-003** — El informe muestra al lado lo que la persona recuerda (013) para evidenciar distorsiones.
- **R-004** — **Capítulos objetivos.** Se abre un `LifeChapter` en cada evento de la lista de apertura de la spec 013 §8, usando el evento real y no lo codificado por la persona. Así los capítulos objetivos y los autobiográficos se pueden comparar uno a uno.
- **R-005** — **Divergencias.** Para cada capítulo objetivo se busca el autobiográfico con mayor solapamiento temporal y se marca: `tone` si el tono recordado y el cambio real de ánimo tienen signo opuesto; `missing` si no hay capítulo autobiográfico; `boundary` si las fechas difieren más de 30 días.
- **R-006** — **Perfil emergente.** Cada dimensión es una función determinista de eventos (p. ej. `jobStability` = 1 − despidos y cambios de empleo por año, normalizado) y guarda en `basis` los eventos usados. Las fórmulas se fijan en la revisión de M3.
- **R-007** — El informe se calcula bajo demanda desde el registro de eventos y la memoria persistida; no se guarda en el estado del mundo (no ocupa RAM del worker).

## 5. Eventos
No define tipos propios (usa los de otras specs).

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).
- **INV-003** — Generar un informe no cambia el `stateHash` del mundo.

## 7. Criterios de aceptación
- **CA-001** — *Dado* una persona tras 1 año, *entonces* su informe tiene ≥ 3 puntos de inflexión con explicación causal.
- **CA-002** — *Dado* cualquier frase del informe, *entonces* referencia al menos un evento real.
- **CA-003** — *Dado* un JOB_LOST, *entonces* hay un capítulo objetivo y uno autobiográfico que empiezan en él, y el informe los muestra lado a lado.
- **CA-004** — *Dado* una persona con alta distorsión en sus memorias de un periodo, *entonces* el informe marca al menos una divergencia `tone` o `boundary` en ese periodo.
- **CA-005** — *Dado* cualquier valor del perfil emergente, *entonces* `basis` contiene los eventos que lo explican.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto |
|---|---|
| ventana de efecto para puntos de inflexión | 30 días |
| tolerancia de fechas entre capítulos | 30 días |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite). Además: capítulos por persona y año y proporción de capítulos con divergencia.

## 10. Preguntas abiertas
- [ ] Revisar parámetros con los resultados de la primera validación.
- [ ] Fórmulas exactas de cada dimensión del perfil emergente (revisión de M3).


## Adaptación al motor funcional (MF8.1, 2026-09-28)
Según la 035 §8:
- La explicación retrospectiva es funcional: qué funciones, relaciones, reglas y repertorios llevaron a dónde está la persona (035 §1), con `citizen:explain` y la pestaña **Vida** como primeras vistas.
- La «resiliencia» deja de ser un rasgo: es una métrica de trayectoria del perfil emergente (cuánto se recupera el ánimo tras hechos aversivos), calculada desde la historia.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-23 | 0.2 | Capítulos objetivos alineados con los autobiográficos de 013, divergencias historia/memoria, perfil emergente con base causal, informe bajo demanda (ADR-005, idea B) |
| 2026-09-28 | — | MF8.1: sección «Adaptación al motor funcional» con lo que cambió en los bloques MF1 a MF7 (o debe cambiar, si la spec sigue en borrador), según la 035 §8. Sin cambios en CA |
