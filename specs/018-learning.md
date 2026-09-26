---
id: 018
nombre: learning
estado: obsoleta
hito: M5
depende_de: [017, 013]
version: 0.1
---

# 018 — Aprendizaje y hábitos

## 1. Propósito
Las personas aprenden de las consecuencias: refuerzan conductas que funcionaron, forman hábitos, adquieren habilidades y cambian expectativas.

## 2. Alcance
**Incluye:** refuerzo simple, hábitos, habilidades, expectativas.
**Fuera de alcance:** aprendizaje con LLM.

## 3. Modelo de datos
```ts
interface Habit { citizenId: EntityId; action: ActionKind; context: string; strength: number; }  // [0,1]
interface Skill { name: string; level: number; }  // [0,1]
```

## 4. Reglas
- **R-001** — Tras cada acción se calcula la recompensa (cambio en necesidades/emociones) y se actualiza el valor esperado de esa acción en ese contexto (TD simple).
- **R-002** — La repetición en el mismo contexto aumenta la fuerza del hábito; hábitos fuertes reducen el costo de decisión y aparecen como sesgo en la utilidad.
- **R-003** — Habilidades suben con la práctica y bajan sin uso; influyen en desempeño laboral (006).

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `HABIT_FORMED` |  | acción, contexto | repeticiones |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* alguien que hace ejercicio 3 veces/semana durante 2 meses, *entonces* el hábito supera 0.5.
- **CA-002** — *Dado* una conducta castigada repetidamente, *entonces* su frecuencia baja.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto |
|---|---|
| tasa aprendizaje | 0.05 |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] Revisar parámetros con los resultados de la primera validación.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-26 | 0.1 | Estado → obsoleta |
