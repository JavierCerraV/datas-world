---
id: 009
nombre: personality
estado: obsoleta
hito: M1 (generación) · M2–M3 (efectos y cambio lento)
depende_de: [001, 023]
version: 0.3
---

# 009 — Personalidad y valores

## 1. Propósito
Rasgos estables que hacen que personas distintas reaccionen distinto a lo mismo. Son la base de las diferencias individuales en decisiones, emociones y relaciones.

## 2. Alcance
**Incluye:** rasgos, valores, estilo de afrontamiento y cambio lento de rasgos.
**Fuera de alcance:** diagnósticos clínicos (capa posterior).

**Decisión (v0.2):** modelo **Big Five más rasgos extra**. Es una versión inicial. Más adelante un grupo de expertos en psicología elaborará una tabla de rasgos a incorporar y se decidirá cómo implementarlos. Por eso los rasgos y valores se declaran en una **lista configurable** (`TRAITS`, `VALUES`) y no fijos en el código.

## 3. Modelo de datos
Columnas `f32` en `[0,1]` (spec 001 §3.1), una por rasgo y otra por valor:

| Columna | Rasgo | Equivalente en el prototipo |
|---|---|---|
| `pers.openness` | apertura | apertura |
| `pers.conscientiousness` | responsabilidad | responsabilidad |
| `pers.extraversion` | extraversión | extraversion |
| `pers.agreeableness` | amabilidad | amabilidad |
| `pers.neuroticism` | neuroticismo | 1 − estabilidad |
| `pers.impulsivity` | impulsividad (extra) | impulsividad |
| `pers.socialSensitivity` | sensibilidad social (extra) | sensibilidad |
| `pers.approvalNeed` | necesidad de aprobación (extra) | aprobacion |
| `pers.honesty` | honestidad (extra; la usa 025) | — |
| `pers.resilience` | resiliencia (extra) | — |

- **Valores** (`val.*`, 12 columnas `f32` en `[0,1]`): `family`, `security`, `freedom`, `success`, `money`, `prestige`, `belonging`, `knowledge`, `creativity`, `autonomy`, `altruism`, `health`, como la lista `VALUES` del prototipo. Los "tres valores principales" son los tres más altos, con desempate por orden de la lista.
- **Afrontamiento**: `pers.coping`, `u8` con 0 = centrado en el problema, 1 = evitativo, 2 = apoyo social, 3 = rumiación.

Coste en memoria: 23 columnas → 89 B por persona.

## 4. Reglas
- **R-001 (M1)** — Los rasgos se generan con `rng.fork('gen:personality').fork(citizenId)`:
  1. Cada rasgo sale de una normal `N(0,5, TRAIT_SD)` recortada a `[0,03, 0,97]`.
  2. Con probabilidad `EXTREME_P`, un rasgo al azar se vuelve extremo: `U(0,03, 0,12)` o `U(0,88, 0,97)`.
  3. Las correlaciones de `TRAIT_CORRELATIONS` se aplican antes del recorte, por mezcla lineal con normales compartidas que conserva la varianza. Por defecto: resiliencia ↔ neuroticismo con r = −0,4.
- **R-002 (M1)** — Los valores se generan como `U(0,1)` independientes. Sus tres más altos son una permutación uniforme, igual que en el prototipo.
- **R-003 (M1)** — El afrontamiento se deriva de los rasgos, sin azar, en este orden de prioridad:
  1. neuroticismo > 0,65 → rumiación;
  2. responsabilidad < 0,35 → evitativo;
  3. extraversión > 0,6 → apoyo social;
  4. en otro caso → centrado en el problema.
- **R-004 (M2)** — Los rasgos modulan parámetros de otras specs:
  - el neuroticismo amplifica el impacto de los eventos negativos (010);
  - la responsabilidad reduce la probabilidad de quedarse dormido (011);
  - la honestidad reduce la probabilidad de mentir (025).
- **R-005 (M3)** — Los rasgos cambian muy despacio con eventos vitales mayores, como mucho ±0,05 al año.
- **R-006 (M3)** — La similitud de valores favorece la afinidad (012).

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `TRAIT_SHIFT` (M3) | cambio acumulado > 0,02 | rasgo, delta | eventos vitales |

## 6. Invariantes
- **INV-001** — Todos los rasgos y valores están en `[0,1]` y sin NaN.
- **INV-002** — Nombres, orden y número de rasgos y valores salen de la configuración del mundo: cambiarlos crea un mundo distinto y, por tanto, otro hash.

## 7. Criterios de aceptación
- **CA-001 (M1)** — *Dado* 500 personas generadas, *entonces* cada rasgo tiene media 0,5 ± 0,05 y desviación típica 0,17 ± 0,03 (≈ 0,178 esperada con `TRAIT_SD` y `EXTREME_P` por defecto), y entre el 15 % y el 30 % de las personas tiene algún rasgo extremo.
- **CA-002 (M1)** — *Dado* 500 personas generadas, *entonces* la correlación resiliencia ↔ neuroticismo está en [−0,5, −0,3] y las demás parejas en [−0,15, 0,15].
- **CA-003 (M1)** — *Dado* un `citizenId`, *entonces* su personalidad no cambia si se generan más personas después: flujo propio por persona.
- **CA-004 (M2)** — *Dado* dos personas iguales salvo por neuroticismo alto o bajo, *cuando* reciben `JOB_LOST`, *entonces* el estrés sube más en la de neuroticismo alto.
- **CA-005 (M3)** — *Dado* un año sin eventos mayores, *entonces* ningún rasgo cambia más de 0,02.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto | Rango | Fuente / justificación |
|---|---|---|---|
| `TRAIT_SD` | 0,17 | 0,1–0,25 | prototipo (`newAgent`) |
| `EXTREME_P` | 0,22 | 0–0,5 | prototipo |
| `TRAIT_CORRELATIONS` | resiliencia ↔ neuroticismo −0,4 | [−1, 1] | provisional, hasta la tabla de expertos |
| `TRAITS`, `VALUES` | tablas de la §3 | — | Big Five + extras y valores del prototipo, hasta la tabla de expertos |

## 9. Métricas y observabilidad
Media, desviación típica y porcentaje de extremos por rasgo; matriz de correlaciones; distribución del afrontamiento. Alerta si algún rasgo tiene una varianza cercana a 0.

## 10. Preguntas abiertas
- [x] ¿Big Five + extras o HEXACO? → Big Five + extras para esta versión (usuario, 2026-09-24).
- [ ] Tabla de rasgos elaborada con expertos en psicología: qué rasgos incorporar, sus correlaciones y sus efectos. Cuando exista, esta spec pasa a una versión nueva.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-24 | 0.2 | Revisión de M1 aprobada por el usuario: Big Five + extras (con los extras del prototipo, más honestidad y resiliencia), en listas configurables a la espera de la tabla de expertos; rasgos y valores como columnas (ADR-005); 12 valores del prototipo; generación portada de `newAgent` con flujo por persona; afrontamiento derivado de los rasgos; sin dependencia de 007; criterios marcados por hito |
| 2026-09-24 | 0.2 | Estado → aprobada |
| 2026-09-24 | 0.3 | Implementación del bloque E: rasgos y valores en los catálogos `personality_traits` y `personal_values` (ADR-006), con las correlaciones como atributo del rasgo (deben apuntar a un rasgo anterior); en CA-001, "tener un rasgo extremo" significa que se aplicó el paso 2 de R-001 (se cuenta en la generación), no que un valor caiga en la banda extrema por azar; el afrontamiento se calcula con los rasgos ya guardados en f32. Sin cambios en los umbrales |
| 2026-09-25 | 0.3 | Estado → obsoleta. Sustituida por la 009 v1.0 "Temperamento y predisposiciones" (`specs/009-temperament.md`, ADR-007), aprobada por el usuario el 2026-09-25. Se conserva aquí como registro histórico |
