---
modulo: routines
ruta: packages/engine/src/routines
estado: en-desarrollo
specs: [011, 010, 006, 021, 029]
actualizado: 2026-09-25
---

# Módulo: routines

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Rutinas diarias y semanales (spec 011): qué hace cada persona según su situación, el día y la hora; sueño y despertar, incluido quedarse dormido (010 R-004).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 011 | CA-001, CA-002, CA-003, CA-004, CA-005 | — (el esparcimiento de la 032 en los bloques libres llega con el motor de decisiones, bloque E) |
| 010 | CA-001 (`OVERSLEPT`) | — |

## 3. API pública
Desde `@datas-world/engine`:

| Símbolo | Descripción |
|---|---|
| `routinesSystem` | Sistema de la fase `decision` (orden 0, capacidad `routines`, cada tick): escribe `act.kind` con la actividad por defecto y emite `OVERSLEPT` |
| `initRoutines(world, rng)`, `defineRoutineColumns(world)`, `ROUTINE_COLUMNS` | Horarios de cada persona (flujo `init:routines/<fila>`); lo llama `generateWorld` después del empleo y la ficha de salud |
| `planAt(view, row, day, minute)`, tipo `Planned` | Actividad planificada en un minuto y su flexibilidad en [0,1] |
| `dayInfo(view, now)`, tipo `DayInfo` | Tipo de día: día de la semana, descanso (domingo o festivo), sábado y si hay colegio (calendario A y Semana Santa) |
| `routineParams(view)` | Jornada escolar, vacaciones y comidas del perfil (`routine.school`, `routine.meals`), memorizadas |
| `isEarlyDay`, `worksShiftToday`, `shiftOf` | Ayudas: si hoy toca madrugar, si hoy hay turno, turno formal de una persona |

## 4. Diseño interno y decisiones
- **Columnas (i32):** `routine.wakeW` y `routine.wakeE` (minuto del día de levantarse en día con obligación y en día libre), `routine.bed` (acostarse), `routine.wakeAt` (minuto del mundo del próximo despertar real) y `routine.plannedWake` (el previsto) y `routine.oversleptEvt` (número del último `OVERSLEPT`, anotado por el bucle con `recordAs`, para que la llegada tarde lo cite como causa). La rutina se deriva de estas columnas y del día; no se guarda un horario (011 v0.2).
- **Plan por capas (`plan.ts`):** sueño → aseo → desayuno → almuerzo (el del turno a las 12:00; estudiantes al salir; resto 12:30) → comida de la noche → obligación (turno formal; colegio 6:30–12:30 y tareas 14–16; informal e independiente 7–17 de lunes a sábado; búsqueda de empleo 8–12 días hábiles; oficios del hogar 8–12; diligencias de pensionados 9–11) → cuidado 14–17 si cuida → siesta de menores de 5 → libre.
- **Despertar (prototipo `sleepUntil`):** en el tick de acostarse se fija el despertar: la hora del día siguiente (madrugar u hora libre) más un retraso si la energía proyectada al despertar queda por debajo de 0,72 (menos si es responsable), más el 10 % de la deuda de sueño y un ruido de −5 a +8 min (`rng.fork(id)`). Hasta ese minuto la persona duerme. Si el retraso llega a 10 min, al llegar la hora prevista se emite `OVERSLEPT` con causas (deuda de sueño, energía, responsabilidad).
- **Hambre (CA-002):** en un bloque con flexibilidad ≥ 0,2, hambre < 0,1 cambia la actividad a `eat`. Comer sacia en el sistema de necesidades (`eatRate`).
- **Enfermo:** con enfermedad aguda la actividad es `sick` (descansa).
- **Primer día:** `initRoutines` da por dormida completa la noche anterior al mundo (`state.sleptToday`), porque el cierre de sueño corre en el primer tick.
- La compañía, el lugar y el trayecto llegan con la movilidad (016, bloque D); el motor de decisiones (017, bloque E) podrá sustituir la actividad propuesta.

## 5. Invariantes y guardarraíles
011 INV-001 a INV-003. El sistema solo devuelve parches `setMany` y eventos; se prueba con la vista congelada.

## 6. Cómo se prueba
`routines.test.ts`: mundos pequeños construidos a mano (empleados con turno, desempleados, estudiantes, informales) con los sistemas de necesidades, sueño y rutina, y una sonda que guarda la actividad de cada tick.

| Criterio | Prueba |
|---|---|
| 011 CA-001 | Dos turnos (lunes a viernes y lunes a sábado): ≥ 90 % del turno trabajando o almorzando |
| 011 CA-002 | Hambre 0,05 a las 15:00: el desempleado come y el empleado sigue en su turno |
| 011 CA-003 | Cinco desempleados: búsqueda de empleo cada día hábil y ninguna el fin de semana |
| 011 CA-004 | Miércoles festivo sin colegio ni trabajo; Semana Santa y vacaciones sin colegio |
| 011 CA-005 | 60 formales y 40 informales × 1 semana: almuerzo entre 12 y 14 en ≥ 90 % de los días hábiles |
| 010 CA-001 | 40 personas sin dormir 2 noches: más del 50 % con `OVERSLEPT`, más que el grupo descansado |
| Determinismo | Misma semilla, mismo hash, con la vista congelada |

## 7. Paridad con el prototipo
Porta `setRoutine` (horarios), `wakeFor` e `inSleep` (tipo de día, madrugar) y `sleepUntil` (quedarse dormido por energía y responsabilidad). Diferencias: calendario colombiano (festivos, calendario escolar A), almuerzo como comida principal, búsqueda de empleo y deuda de sueño de la 010.

## 8. Pendientes y deuda
- [ ] Esparcimiento de la 032 en los bloques libres (bloque E).
- [ ] Turnos nocturnos (hoy los turnos van dentro del día, 006).
- [ ] Los desempleados se levantan a su hora libre también los días hábiles.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-25 | m2/c-rutinas | — | Documento creado desde la plantilla (sin código) |
| 2026-09-25 | m2/c-rutinas (C1–C3) | 011, 010, 021, 029 | `columns.ts`, `day.ts`, `plan.ts`, `system.ts` e `index.ts`; evento `OVERSLEPT`. 7 pruebas |
| 2026-09-25 | m2/d-movilidad | 011, 016 | Columna `routine.oversleptEvt`: `OVERSLEPT` se emite con `recordAs` para que `ARRIVED_LATE` (movilidad) lo cite como causa |
