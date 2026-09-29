---
id: 020
nombre: history
estado: aprobada
hito: M3
depende_de: [013, 014, 019, 027, 035]
version: 0.3
---

# 020 — Historia e informe de vida

## 1. Propósito
Separar estado actual, eventos, historia y memoria (visión §50). La **historia** es el relato objetivo de la vida de una persona. El **informe de vida** la presenta explicada, junto a cómo la persona se la cuenta (013), para responder a la pregunta guía: *¿por qué terminó donde terminó, y en qué se equivoca al recordarlo?*

Reescritura según la 035 §8 (ADR-007). Lo que ya hay:
- los hechos (014) con sus causas hasta el origen (019);
- los capítulos y recuerdos subjetivos (013);
- una instantánea completa del mundo cada día (027 R-004).

Lo que falta es la trayectoria: el ánimo, el estrés y el dinero solo existen como valor actual, así que no se puede medir cuánto se recupera una persona tras un golpe (la resiliencia como métrica de trayectoria, 035 §8) ni qué hechos cambiaron su vida.

## 2. Alcance
**Incluye:**
- la trayectoria diaria de cada persona, fuera del estado del mundo;
- los capítulos objetivos, alineados con los subjetivos de la 013;
- los puntos de inflexión con su explicación causal (019);
- las divergencias entre historia y memoria;
- el perfil emergente con los eventos que lo sustentan;
- el informe en la CLI, la API y la pestaña **Vida**.

**Fuera de alcance:**
- la narración con LLM (026), que podrá usar el informe como materia;
- la compactación del registro (M4), que respetará la trayectoria.

## 3. Modelo de datos
```ts
/** Trayectoria (R-001): una fila por persona y día, escrita con la instantánea diaria. Fuera del stateHash. */
interface DayPoint { citizenId: EntityId; day: number; mood: number; stress: number; money: number; sleepDebt: number }
// SQLite: tabla `trajectory (citizen_id, day, mood, stress, money, sleep_debt)`; ≈ 20 B por fila.

/** Capítulo OBJETIVO (R-004): se deriva de los hechos. No confundir con el `Chapter` subjetivo de la 013. */
interface LifeChapter { from: WorldMinute; to?: WorldMinute; theme: string; openedBy?: EntityId; tone: number; events: EntityId[] }

interface TurningPoint { event: EntityId; consequences: number; moodDelta?: number; moneyDelta?: number; why: WhyNode }

interface LifeReport {
  citizenId: EntityId;
  chapters: LifeChapter[];                     // lo que pasó
  remembered: Chapter[];                       // cómo lo cuenta (013)
  divergences: { chapter: number; kind: 'tone' | 'missing' | 'boundary'; note: string }[];
  turningPoints: TurningPoint[];
  profile: EmergentProfile;
  trajectory: DayPoint[];                      // para la gráfica
}

/** Perfil emergente (visión §39): calculado desde la historia, nunca un parámetro inicial. Todo en [0,1]. */
interface EmergentProfile {
  jobStability: number; relationshipStability: number; socialNetwork: number;
  stressorExposure: number; economicTrajectory: number; resilience: number;
  basis: Record<string, EntityId[]>;           // eventos que sustentan cada valor
}
```

## 4. Reglas
- **R-001** [M] — **Trayectoria.** Al guardar la instantánea diaria (027 R-004), la sesión de escritura guarda también una fila por persona viva con ánimo, estrés, dinero y deuda de sueño. Está fuera del estado del mundo y del `stateHash`: se deriva del estado, como la instantánea. Coste: ≈ 250 personas × 365 días × 20 B ≈ 2 MB por año (con la sobrecarga de SQLite, unos 5 MB).
- **R-002** [T] — **Puntos de inflexión.** Los hechos de la persona con más consecuencias en su vida: descendientes en el grafo causal (019) en los 90 días siguientes, más el cambio de ánimo y de dinero en los 30 días siguientes según su trayectoria. Se muestran los 5 primeros, cada uno con su árbol `why`.
- **R-003** [M] — **El informe no inventa.** Se genera con plantillas desde los hechos, sus causas, la memoria persistida y la trayectoria; toda frase cita al menos un evento (CA-002). Se calcula bajo demanda y no se guarda en el mundo (no cambia el `stateHash`).
- **R-004** [M] — **Capítulos objetivos.**
  - Se abren con los mismos hechos que los capítulos de la 013 (su lista de §8), pero con el hecho real y no con lo que la persona codificó; también los del pasado (030, 041) y las etapas por edad.
  - Así se comparan uno a uno con los subjetivos.
  - Su tono es objetivo: la media del valor de sus hechos según su tipo (la λ de la 013 `MEMORY_KINDS`, sin la reconstrucción de la persona) y, donde hay trayectoria, el cambio real de ánimo en el tramo.
- **R-005** [M] — **Divergencias.** Para cada capítulo objetivo se busca el subjetivo con más solapamiento y se marca:
  - `tone` si los tonos tienen signo opuesto o difieren más de 0,4;
  - `missing` si la persona no tiene ese capítulo;
  - `boundary` si las fechas difieren más de 30 días.
- **R-006** [M] — **Perfil emergente.** Cada dimensión es una función determinista de sus hechos y su trayectoria, y guarda en `basis` los eventos usados:
  - `jobStability` = 1 − (despidos + cambios de empleo) / (años de vida laboral × 0,5), acotado;
  - `relationshipStability` = amistades y parejas vigentes frente a rupturas, olvidos de amigos y discusiones;
  - `socialNetwork` = vínculos con trato > 0,3, sobre 10;
  - `stressorExposure` = suma de las λ negativas de sus hechos del último año, sobre 5;
  - `economicTrajectory` = 0,5 + cambio de dinero en la trayectoria sobre su gasto mensual, menos deudas e impagos;
  - `resilience` = tras cada hecho aversivo (λ ≤ −0,4), días hasta volver a su ánimo de antes, convertido en `1 − días / 60` y promediado. Sin hechos aversivos con trayectoria, queda indefinida (no 0,5).
- **R-007** [M] — **Dónde se consulta.**
  - la CLI: `citizen:life CIT-…`;
  - la API: `GET /api/citizens/:id/report`;
  - el visor: sección **Informe** de la pestaña **Vida**, con capítulos objetivos y subjetivos lado a lado, puntos de inflexión con su «¿por qué?», el perfil y una gráfica del ánimo y el estrés.

## 4 bis. Estatus epistémico
- [T]: la historia explicada por sus consecuencias y su causalidad; la resiliencia como trayectoria, no como rasgo.
- [M]: las fórmulas del perfil, las ventanas (30 y 90 días) y los umbrales de divergencia.

## 5. Eventos
No define tipos propios.

## 6. Invariantes
- **INV-001** — Valores del perfil en [0,1] o indefinidos, sin NaN.
- **INV-002** — Generar un informe no cambia el `stateHash` ni el registro.
- **INV-003** — La trayectoria no entra en el estado del mundo; borrarla no cambia la simulación.

## 7. Criterios de aceptación
- **CA-001** — *Dada* una persona tras 1 año, *entonces* su informe tiene ≥ 3 puntos de inflexión con explicación causal (o todos sus hechos, si tiene menos).
- **CA-002** — *Dada* cualquier frase del informe, *entonces* cita al menos un evento real.
- **CA-003** — *Dado* un `JOB_LOST`, *entonces* hay un capítulo objetivo y uno subjetivo que empiezan en él, y el informe los muestra lado a lado.
- **CA-004** — *Dada* una persona que recuerda un periodo con un tono muy distinto del que tuvo, *entonces* el informe marca una divergencia `tone` en ese periodo.
- **CA-005** — *Dado* cualquier valor definido del perfil, *entonces* `basis` contiene los eventos que lo explican.
- **CA-006** — *Dados* 100 personas × 1 año, *entonces* la trayectoria ocupa < 10 MB y la resiliencia varía entre personas (desviación típica > 0,05 entre quienes tienen hechos aversivos).

## 8. Parámetros y calibración
| Parámetro | Valor | Estado |
|---|---|---|
| Ventana de consecuencias / de cambio | 90 / 30 días | [M] |
| Puntos de inflexión mostrados | 5 | [M] |
| Umbral de divergencia de tono · de fechas | 0,4 · 30 días | [M] |
| Recuperación máxima para la resiliencia | 60 días | [M], PA-149 |

## 9. Métricas
Capítulos objetivos por persona y año; proporción con divergencia; distribución de cada dimensión del perfil; tamaño de la trayectoria.

## 9 bis. Decisiones del usuario (2026-09-29)
Aprobadas las cinco propuestas de §10 (P1 a P5) tal como están.

## 10. Preguntas abiertas (resueltas en §9 bis)
- **P1 — Trayectoria diaria.** Guardar, junto a la instantánea diaria, ánimo, estrés, dinero y deuda de sueño de cada persona (≈ 5 MB por año con 250 personas, fuera del estado del mundo). Permite medir la resiliencia, detectar qué hechos cambiaron su vida y dibujar la gráfica. Sin ella, la resiliencia no se puede calcular. *Propuesta:* sí.
- **P2 — Puntos de inflexión por consecuencias.** Los hechos que más consecuencias tuvieron en su vida (grafo causal y cambio de ánimo y dinero), cada uno con su «¿por qué?». *Propuesta:* sí.
- **P3 — Perfil emergente de seis dimensiones** con las fórmulas de R-006, cada una con sus hechos de base, y la resiliencia indefinida si no hubo golpes. *Propuesta:* sí; son [M] y se calibran después.
- **P4 — Capítulos objetivos desde el pasado**, alineados con los subjetivos (mismos hechos, tono objetivo frente a tono recordado), para ver las divergencias desde el día 0. *Propuesta:* sí.
- **P5 — Dónde verlo.** `citizen:life` en la CLI, la API y una sección **Informe** en la pestaña **Vida** (capítulos lado a lado, puntos de inflexión, perfil y gráfica). *Propuesta:* sí.

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
| 2026-09-29 | 0.3 | Reescritura sobre lo construido en M3 (bloque H): trayectoria diaria junto a la instantánea (R-001), puntos de inflexión por consecuencias en el grafo causal (019), capítulos objetivos desde el pasado alineados con los de la 013, fórmulas del perfil emergente con la resiliencia como trayectoria, informe en CLI, API y pestaña Vida. CA-006 nuevo. Preguntas P1 a P5 para el usuario |
| 2026-09-29 | 0.3 | Decisiones del usuario (§9 bis): P1 a P5 aprobadas |
| 2026-09-29 | 0.3 | Estado → aprobada |
| 2026-09-29 | 0.3 | Implementación (bloque H de M3). Calibración de R-005 en 100 personas × 1 año: con 0,4 salían 3,3 divergencias de tono por persona, porque la memoria es en conjunto más amable que lo vivido; el tono se compara en el patrón de cada persona (cada tono menos la media de su lado), el sesgo general se dice una vez y una etapa recordada al revés (ambos tonos > 0,3) se marca siempre; umbral 0,5. Las etapas por edad citan el nacimiento (CA-002). El rumbo económico usa `tanh` (saturaba). Tono objetivo de los episodios de desarrollo: valencia × 0,6. Hallazgo: la estabilidad laboral sale casi siempre alta porque la historia generada (030) apenas registra cambios de empleo. Resultados en `docs/validaciones/M3-historia.md`. Sin cambios en CA |
