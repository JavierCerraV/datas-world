---
id: 011
nombre: routines
estado: borrador
hito: M2
depende_de: [010, 006, 004, 002]
version: 0.1
---

# 011 — Rutinas

## 1. Propósito
Patrones diarios y semanales que estructuran la vida (trabajo, estudio, comidas, ocio) y que pueden romperse por eventos o decisiones.

## 2. Alcance
**Incluye:** plantillas de rutina por rol, agenda diaria, desviaciones.
**Fuera de alcance:** decisión detallada (017).

## 3. Modelo de datos
```ts
interface RoutineBlock { start: number; end: number; activity: ActivityKind; placeRef: 'home'|'work'|'school'|EntityId; flexibility: number; }
interface Routine { weekday: RoutineBlock[]; weekend: RoutineBlock[]; }
type ActivityKind = 'sleep'|'eat'|'work'|'study'|'commute'|'leisure'|'socialize'|'chores'|'shop'|'exercise'|'care';
```

## 4. Reglas
- **R-001** — Cada persona recibe una rutina base según rol (trabajador por turnos, estudiante, jubilado, desempleado) con ruido personal.
- **R-002** — La rutina propone la actividad por defecto; el motor de decisiones (017) puede sustituirla si otra opción tiene utilidad mayor (p. ej. necesidad urgente).
- **R-003** — Los hábitos (018) ajustan la rutina con el tiempo.
- **R-004** — Romper la rutina de trabajo sin causa válida genera consecuencias (006).

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `ROUTINE_BROKEN` | desvío relevante | bloque, alternativa | necesidad, evento |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* un trabajador de 8–17, *en* un día normal sin eventos, *entonces* está en su trabajo ≥ 90 % de ese horario.
- **CA-002** — *Dado* hambre < 0.1, *entonces* la persona interrumpe cualquier actividad flexible para comer.
- **CA-003** — *Dado* un desempleado, *entonces* su rutina incluye búsqueda de empleo.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto |
|---|---|
| flexibilidad trabajo | 0.1 |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] Revisar parámetros con los resultados de la primera validación.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
