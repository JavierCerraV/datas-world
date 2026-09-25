---
id: 034
nombre: clinical-sessions
estado: borrador
hito: Después (capa clínica, tras M7; ver docs/roadmap.md) · enganches en M3–M6 (ver §2)
depende_de: [010, 012, 013, 017, 019, 020, 023, 025, 026, 028, 031]
version: 0.1
---

# 034 — Sesiones e intervenciones

## 1. Propósito
Permitir que un terapeuta (humano) **entre al mundo**, elija a una persona que ya lleva una vida propia, tenga **sesiones** con ella y **pruebe intervenciones**, viendo cómo cambia su vida después.

Implementa la visión §58 (capa clínica: terapeuta → selección → agenda → sesión → interacción → aprendizaje → el mundo sigue), §59 (evaluación: evolución, adherencia, recaídas, cambios sociales y laborales, calidad de vida) y §60 (selección por características emergentes).

Principio (visión, final): el terapeuta no habla con "una IA que interpreta a un paciente", sino con **una persona artificial que llevaba viviendo su propia vida antes de que el terapeuta apareciera**.

**Esta spec no condiciona el núcleo** (CLAUDE.md §1). Se escribe ahora para que las specs del núcleo dejen preparados sus enganches (§2), y se implementa al final.

## 2. Alcance
**Incluye:**
- selección de la persona por características emergentes, nunca creadas a medida;
- agenda y sesiones (presenciales en un lugar del mundo o fuera de él);
- la interpretación de la persona por un LLM configurable, con la vista subjetiva;
- la memoria de las sesiones;
- el plan de tratamiento, las tareas y la **adherencia como variable del motor**;
- escenarios configurables (punto de partida y disposición);
- ramas contrafactuales para comparar intervenciones;
- la evaluación longitudinal.

**Enganches que deben existir antes (en sus specs):**
- **013:** los recuerdos con origen `session` y los compromisos ("quedé en…");
- **025:** la `PersonView`, lo que la persona sabe y cree, que es la única entrada del LLM;
- **026:** los roles y el contexto de sesión, el registro de respuestas para el replay y los modelos configurables;
- **028:** las ramas por intervención desde una instantánea;
- **019/020:** poder explicar por qué cambió (o no) la persona tras la intervención.

**Fuera de alcance:**
- diagnósticos clínicos validados;
- cualquier uso con pacientes reales;
- la salud mental como diagnóstico dentro de la ficha de salud (031 la excluye): aquí aparece solo como formulación del terapeuta.

## 3. Modelo de datos
```ts
interface Therapist { id: string; name: string }                     // externo al mundo (no es un CIT)
interface Case {
  id: string;                        // CASE-0001
  citizenId: EntityId;               // persona existente del mundo
  therapistId: string;
  openedAt: WorldMinute;
  scenario: ScenarioConfig;          // §4 R-006
  plan: TreatmentPlan;
  status: 'open' | 'paused' | 'closed';
}
interface Session {
  id: string; caseId: string; at: WorldMinute; placeId?: EntityId; durationMin: number;
  transcript: { speaker: 'therapist' | 'person'; text: string }[];   // se guarda fuera del hash (R-003)
  summary: string;                   // lo que la persona recordará (va a su memoria, 013)
  agreements: Task[];                // tareas o compromisos acordados
  alliance: number;                  // [0,1] alianza terapéutica percibida por la persona
}
interface Task { key: string; description: string; due: WorldMinute; effort: number; cost: number }
interface TreatmentPlan { goals: string[]; interventions: string[]; frequencyDays: number }
```

Columnas nuevas por persona (solo para quien tiene un caso; ≈ 12 B): `clinical.alliance` (f32), `clinical.readiness` (f32, disposición al cambio), `clinical.adherence` (f32, media móvil).

## 4. Reglas
- **R-001 (la persona existe antes).** Solo se puede abrir un caso con un `CIT` vivo del mundo. La selección filtra por características emergentes del estado y la historia (visión §60). Nunca se crea una persona para un caso.
- **R-002 (el LLM es la voz, no la mente).** En una sesión, el LLM recibe **solo** la `PersonView` (025):
  - personalidad y valores;
  - estado (ánimo, estrés, salud);
  - recuerdos relevantes, incluidas las sesiones anteriores;
  - creencias sobre sí misma, los demás y el tratamiento;
  - la alianza con el terapeuta.

  Nunca recibe la verdad del mundo. Lo que la persona afirma de su vida debe salir de su vista; si el LLM inventa un hecho, ese hecho no pasa al mundo (026 R-002).
- **R-003 (memoria de sesión).** Al terminar, la sesión produce:
  - un recuerdo episódico con origen `session` (013), con su intensidad y valencia;
  - las creencias nuevas o cambiadas (025);
  - los compromisos como `Task`;
  - el evento `SESSION_HELD`.

  El texto completo se guarda aparte, fuera del `stateHash`, como las respuestas del LLM (026 R-003). Así el replay reproduce la sesión sin llamar al modelo.
- **R-004 (el mundo sigue).** Entre sesiones la persona vive su vida normal (rutinas, trabajo, relaciones). Lo que pasa entre sesiones llega a la siguiente como recuerdos y estado.
- **R-005 (adherencia del motor, no del LLM).** Si la persona cumple una tarea lo decide el motor (017), con reglas y parámetros:

  `P(cumplir) = f(responsabilidad, disposición, alianza, creencias sobre el tratamiento, esfuerzo y coste de la tarea, tiempo libre y dinero reales, estrés, apoyo social)`

  El resultado es un evento (`TASK_DONE` o `TASK_SKIPPED`) con causas. El LLM solo lo expresa ("no pude, tuve turno doble"), y lo que expresa es verdad en el mundo.
- **R-006 (escenarios configurables).** Un caso puede fijar su punto de partida, con valores que el motor usa como parámetros, no como guion:
  - disposición al cambio;
  - experiencias previas con terapia;
  - tipo de resistencia (evitación, desconfianza, ambivalencia);
  - creencias sobre el tratamiento.

  Se registran como entrada externa (023), así que el mundo sigue siendo reproducible.
- **R-007 (intervenciones comparables).** Una intervención se prueba con ramas (028):
  1. se toma la instantánea del momento;
  2. cada brazo aplica un plan distinto (incluido "sin intervención");
  3. se avanza el mismo tiempo;
  4. se comparan los indicadores de §9.

  Mismo mundo, misma persona y mismas semillas: la diferencia se debe a la intervención.
- **R-008 (modelo configurable).** El modelo y el proveedor del LLM se eligen por configuración (026): proveedor, modelo, temperatura, presupuesto y rol ("persona en sesión"). Sin LLM o sin presupuesto, la persona responde por plantillas del motor y el mundo no se detiene.
- **R-009 (límites).** Los resultados son hipótesis de simulación, no evidencia clínica. Toda exportación de un caso lo indica.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `CASE_OPENED` | el terapeuta abre un caso | caseId, citizenId | entrada externa (terapeuta) |
| `SESSION_HELD` | termina una sesión | caseId, sessionId, alliance | agenda, caso |
| `TASK_AGREED` | compromiso en sesión | caseId, task | sesión |
| `TASK_DONE` / `TASK_SKIPPED` | vence una tarea | caseId, task, reason | adherencia (R-005): personalidad, tiempo, dinero, estrés |
| `SESSION_MISSED` | no asiste | caseId, reason | trabajo, transporte, ánimo, alianza baja |
| `CASE_CLOSED` | alta, abandono o derivación | caseId, reason | evolución, alianza |

## 6. Invariantes
- **INV-001** — Todo caso es de una persona viva del mundo, que existía antes de abrirlo.
- **INV-002** — Ningún dato de la verdad del mundo que la persona no crea aparece en el contexto del LLM (se comprueba comparando la `PersonView` con el estado).
- **INV-003** — Toda tarea termina en `TASK_DONE` o `TASK_SKIPPED` con causas; el LLM no puede marcarla.

## 7. Criterios de aceptación
- **CA-001** — *Dado* una persona con un secreto que no conoce (p. ej., el despido de su pareja), *cuando* se prepara el contexto de sesión, *entonces* el secreto no aparece en él.
- **CA-002** — *Dado* dos sesiones separadas por 7 días, *entonces* la segunda recibe el recuerdo de la primera y los hechos vividos entre ambas.
- **CA-003** — *Dado* una tarea de coste alto para una persona sin dinero ni tiempo libre, *entonces* la probabilidad de `TASK_SKIPPED` es mayor que para una persona con recursos, y la causa lo refleja.
- **CA-004** — *Dado* un caso con dos brazos (intervención y sin intervención) desde la misma instantánea, *entonces* el replay de cada brazo es idéntico entre ejecuciones y las diferencias entre brazos se explican por eventos con causas.
- **CA-005** — *Dado* el proveedor `mock` o sin presupuesto, *entonces* la sesión se completa por plantillas y el mundo sigue siendo determinista.

## 8. Parámetros y calibración
| Parámetro | Valor inicial | Fuente / justificación | Estado |
|---|---|---|---|
| pesos de la adherencia (R-005) | por factor | estimado; a revisar con expertos en psicología clínica y literatura de adherencia | estimado |
| efecto de la alianza en la adherencia y el abandono | — | literatura de alianza terapéutica | por_confirmar |
| duración y frecuencia por defecto | 50 min, cada 7 días | práctica habitual | estimado |

## 9. Métricas y observabilidad
Por caso y por brazo (visión §59):
- evolución del ánimo y del estrés;
- adherencia y asistencia;
- recaídas;
- cambios en el trabajo, las relaciones y la economía;
- calidad de vida;
- objetivos cumplidos.

Nunca se evalúa si "el terapeuta dijo la respuesta correcta".

## 10. Preguntas abiertas
- [ ] ¿El terapeuta es una entidad del mundo (con un lugar de consulta, citas que cuestan dinero y tiempo de viaje) o un observador externo? Propuesta: la consulta es un lugar del mundo (033) y la sesión cuesta tiempo y dinero a la persona, porque eso cambia la adherencia.
- [ ] ¿Qué proveedor y modelo LLM por defecto, y con qué presupuesto? Se decide en la 026 (M6).
- [ ] ¿Cómo se revisa y valida la tabla de adherencia? Propuesta: junto con la tabla de rasgos de expertos de la 009.
- [ ] ¿Varios terapeutas sobre la misma persona o el mismo mundo (formación en grupo)? Propuesta: sí, en ramas separadas (R-007).

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-24 | 0.1 | Borrador inicial a petición del usuario: sesiones e intervenciones con una persona del mundo interpretada por un LLM configurable, con memoria de sesión, adherencia y resistencia decididas por el motor, escenarios configurables y ramas contrafactuales. Deja escritos los enganches que necesitan la 013, la 025, la 026 y la 028 |
