---
id: 011
nombre: routines
estado: aprobada
hito: M2 · M5 (hábitos que la ajustan, 018)
depende_de: [002, 004, 006, 010, 021, 029, 032]
version: 0.2
---

# 011 — Rutinas

## 1. Propósito
Los patrones diarios y semanales que estructuran la vida: dormir, trabajar o estudiar, comer, hacer oficios, esparcimiento. Siguen los horarios reales de Colombia y se pueden romper por eventos o decisiones (017).

## 2. Alcance
**Incluye:** plantillas de rutina por situación, agenda del día, días hábiles, fines de semana y festivos (029), y desviaciones.
**Fuera de alcance:**
- la decisión en cada momento (017);
- los hábitos que cambian la rutina con el tiempo (018, M5; decisión del usuario).

## 3. Modelo de datos
```ts
type ActivityKind = 'sleep' | 'eat' | 'work' | 'study' | 'commute' | 'leisure' | 'socialize'
                  | 'chores' | 'shop' | 'exercise' | 'care' | 'job_search' | 'errands';
interface RoutineBlock {
  start: number; end: number;                  // minutos del día (end puede pasar de 1440 si cruza medianoche)
  activity: ActivityKind;
  placeRef: 'home' | 'work' | 'school' | 'leisure' | EntityId;
  flexibility: number;                         // [0,1]: 0 = obligatorio (turno), 1 = libre
}
interface Routine { workday: RoutineBlock[]; saturday: RoutineBlock[]; sunday: RoutineBlock[]; }
```
La rutina es **derivada**: se calcula de la situación de la persona (ocupación, turno, colegio, edad, hogar) y no se persiste. El hash solo depende del estado (001 R-010). Coste: 0 B persistidos; ≈ 1 KB por persona en caché del día.

## 4. Reglas
- **R-001 (plantillas por situación)** — Cada persona recibe una rutina según su situación, con ruido personal (flujo `sys:routines/<id>`):
  - **empleado formal:** el turno de su puesto (006; ya legal: 44 h/semana en 2026-01-01, 42 h desde el 2026-07-15), con almuerzo;
  - **informal o independiente:** jornada larga y variable de su oficio, 6 días;
  - **estudiante:** el horario del colegio o la escuela (calendario A, jornada de mañana, 6:30–12:30), con tareas en la tarde;
  - **desempleado:** búsqueda de empleo (`job_search`) en bloques de mañana;
  - **oficios del hogar y cuidado:** cuidado de menores (008) y oficios;
  - **pensionado:** mañana libre, misa o diligencias;
  - **niño pequeño:** sueño largo y cuidado.
- **R-002 (comidas colombianas)** — Desayuno 6:00–8:00, **almuerzo como comida principal entre 12:00 y 14:00**, comida 18:30–20:30. Quien trabaja come en la hora de almuerzo de su turno.
- **R-003 (calendario)** — Días hábiles de lunes a viernes, sábado parcial para los turnos de 6 días. Domingo y festivos (029, Ley Emiliani) sin trabajo para quien no tiene turno ese día. Vacaciones escolares de calendario A: diciembre y enero, más Semana Santa y receso de mitad de año.
- **R-004 (esparcimiento)** — Los bloques libres (`leisure`, `socialize`) se llenan en la decisión (017) con las actividades de la ficha de esparcimiento (032 R-006), según afinidad, horario del lugar, dinero y compañía.
- **R-005 (romper la rutina)** — La rutina propone la actividad por defecto. El motor de decisiones (017) puede sustituirla si otra opción tiene mayor utilidad (una necesidad urgente, una invitación, una enfermedad). Romper un bloque de `flexibility` < 0,2 sin causa válida genera consecuencias (006: retardos, advertencias) y el evento `ROUTINE_BROKEN`.
- **R-006 (hábitos)** — Los hábitos (018) ajustarán la rutina desde M5.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `ROUTINE_BROKEN` | desvío de un bloque poco flexible | citizenId, bloque, alternativa | necesidad urgente, enfermedad, invitación, `OVERSLEPT` |

## 6. Invariantes
- **INV-001** — Los bloques de un día no se solapan y cubren las 24 horas.
- **INV-002** — Ningún bloque de trabajo supera el turno legal del puesto (006, 029).
- **INV-003** — La rutina es función pura del estado y del día (reproducible, 023).

## 7. Criterios de aceptación
- **CA-001 (M2)** — *Dado* un empleado formal, *en* un día hábil normal sin eventos, *entonces* está en su trabajo ≥ 90 % de su turno.
- **CA-002 (M2)** — *Dado* hambre < 0,1, *entonces* la persona interrumpe cualquier bloque flexible para comer.
- **CA-003 (M2)** — *Dado* un desempleado, *entonces* su rutina de días hábiles incluye bloques de búsqueda de empleo.
- **CA-004 (M2)** — *Dado* un festivo, *entonces* los estudiantes no van al colegio y los empleados sin turno ese día no van a trabajar.
- **CA-005 (M2)** — *Dado* 100 personas × 1 semana, *entonces* el almuerzo de quienes trabajan cae entre las 12:00 y las 14:00 en ≥ 90 % de los días hábiles.

## 8. Parámetros y calibración
| Parámetro | Valor inicial | Fuente | Estado |
|---|---|---|---|
| jornada escolar | 6:30–12:30, lunes a viernes | calendario A, jornada de mañana (MEN) | estimado |
| vacaciones escolares | 1-dic a fin de enero; Semana Santa; 2 semanas a mitad de año | calendario A | estimado |
| flexibilidad del trabajo | 0,1 | prototipo | estimado |
| horario de comidas | desayuno 6–8, almuerzo 12–14, comida 18:30–20:30 | costumbre colombiana | estimado |

## 9. Métricas
Tiempo en cada actividad por situación (comparable con la ENUT del DANE: trabajo, cuidado, esparcimiento), rutinas rotas por mes y sus causas.

## 10. Preguntas abiertas
- [x] ¿Horarios colombianos? → Sí: turnos legales, calendario A, almuerzo 12–14, domingos y festivos (usuario, 2026-09-25).
- [x] ¿Búsqueda de empleo? → Sí, en bloques (usuario, 2026-09-25).
- [x] ¿Hábitos? → M5 (usuario, 2026-09-25).
- [ ] ¿Jornada única escolar? Propuesta: jornada de mañana en M2; la jornada única se añade como opción del catálogo del colegio.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-25 | 0.2 | Revisión de M2 con las decisiones del usuario: horarios colombianos (turnos legales, calendario A, almuerzo como comida principal, domingos y festivos), búsqueda de empleo, esparcimiento de la 032 en los bloques libres, hábitos en M5; rutina derivada y no persistida; CA-004 y CA-005 nuevos |
| 2026-09-25 | 0.2 | Estado → aprobada |
