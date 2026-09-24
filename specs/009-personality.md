---
id: 009
nombre: personality
estado: borrador
hito: M1
depende_de: [007]
version: 0.1
---

# 009 — Personalidad y valores

## 1. Propósito
Rasgos estables que hacen que personas distintas reaccionen distinto a lo mismo. Base de diferencias individuales en decisiones, emociones y relaciones.

## 2. Alcance
**Incluye:** rasgos, valores, estilo de afrontamiento, cambio lento de rasgos.
**Fuera de alcance:** diagnósticos clínicos (capa posterior).

## 3. Modelo de datos
```ts
interface Personality {       // [0,1], media 0.5, generados con normal truncada
  openness: number; conscientiousness: number; extraversion: number;
  agreeableness: number; neuroticism: number;
  impulsivity: number; honesty: number; resilience: number;
}
interface Values { family: number; money: number; status: number; security: number;
                   freedom: number; tradition: number; helping: number; pleasure: number; }
type Coping = 'problem_focused'|'avoidant'|'social_support'|'rumination';
```

## 4. Reglas
- **R-001** — Rasgos correlacionados de forma plausible (p. ej. resiliencia ↔ neuroticismo negativo, r≈-0.4).
- **R-002** — Los rasgos modulan parámetros: neuroticismo amplifica el impacto de eventos negativos; responsabilidad reduce la probabilidad de quedarse dormido; honestidad reduce la probabilidad de mentir (025).
- **R-003** — Los rasgos cambian muy lentamente con eventos vitales mayores (máx ±0.05/año).
- **R-004** — Similitud de valores favorece afinidad (012).

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `TRAIT_SHIFT` | cambio acumulado > 0.02 | rasgo, delta | eventos vitales |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* 500 personas generadas, *entonces* cada rasgo tiene media 0.5±0.05 y sd 0.15±0.03.
- **CA-002** — *Dado* dos personas iguales salvo neuroticismo alto/bajo, *cuando* reciben JOB_LOST, *entonces* el estrés sube más en la de neuroticismo alto.
- **CA-003** — *Dado* un año sin eventos mayores, *entonces* ningún rasgo cambia más de 0.02.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto |
|---|---|
| sd rasgos | 0.15 |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] ¿Usar Big Five + extras o HEXACO?

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
