---
id: 047
nombre: intervention-study
estado: borrador
hito: Capa de investigación (tras M5; antecede a la capa clínica 034)
depende_de: [028, 034, 036, 038, 039, 043, 046]
version: 0.1
---

# 047 — Estudio de intervención: línea base, protocolo breve y seguimiento

## 1. Propósito
Medir si un protocolo psicológico breve cambia las medidas de las personas del mundo y si el cambio se mantiene un año después, con el diseño de un estudio clínico: una muestra pequeña con criterio de entrada, medidas de línea base, un protocolo de pocas semanas con medidas durante el tratamiento, una medida posterior y un seguimiento a los 12 meses.

El primer protocolo es el de **tres sesiones de ACT centrado en desmantelar el pensamiento negativo repetitivo (PNR)**, de Ruiz y colaboradores (2019), en `docs/investigacion/SPANISH 3-session RNT-focused ACT protocol Ruiz et al. 2019.pdf`: tres sesiones semanales, cinco audios y práctica diaria de al menos un mes.

Dos usos futuros guían el diseño: el mismo flujo servirá para que **terapeutas reales** hablen con las personas del mundo (034), por eso cada sesión se hace con el LLM y se guarda su transcripción; y el estudio debe poder medir la **complacencia clínica** de la persona simulada, el problema que describen quienes han trabajado con pacientes simulados.

## 2. Alcance
**Incluye:** la definición del estudio, la selección por criterio de entrada, un brazo con protocolo y un brazo de lista de espera sobre las mismas personas y el mismo azar (028), las sesiones con el LLM y sus transcripciones, la práctica diaria entre sesiones, las medidas con cuatro instrumentos (046), la medida de complacencia y el informe.

**Fuera de alcance:** sesiones con un terapeuta humano (034); otros protocolos (se añadirán como definiciones, no como código nuevo); el diagnóstico clínico; cualquier afirmación sobre humanos reales (R-011).

## 3. Modelo de datos
```ts
interface Study {
  id: string;
  base: { db: string; branchAt: number };                // 028
  entry: EntryCriteria;                                  // R-002
  n: number;                                             // personas del estudio
  seeds: number[];                                       // azar común (028 R-005)
  protocol: ProtocolId;                                  // 'act-pnr-3' (R-004)
  instruments: ['AAQ-II', 'DASS-21', 'SWLS', 'GPQ-9'];   // 046
  schedule: { sessionDays: number[]; practiceUntilDay: number; weeklyUntilDay: number; postDay: number; followUpDays: number };
  llm: { sessions: boolean; measures: boolean };         // R-007
}
interface EntryCriteria { minAge: 18; anyOf: Criterion[]; requirePnr?: boolean }   // p. ej. DASS-21 depresión ≥ 5, AAQ-II ≥ 24, SWLS ≤ 19
interface SessionRecord { arm: string; seed: number; citizenId: EntityId; session: 1 | 2 | 3; at: WorldMinute; attended: boolean; engagement: number; transcript: Turn[]; dose: Dose }
interface Turn { speaker: 'terapeuta' | 'persona'; text: string; stance?: string; section: string }
```
Las transcripciones se guardan fuera del estado del mundo (034 R-003); no añaden estado por persona.

## 4. Reglas
- **R-001** [T] — **Diseño.** Estudio pareado de dos brazos, **protocolo** y **lista de espera**, sobre las mismas personas y el mismo azar de cada semilla (028 R-005): la diferencia entre brazos es el efecto del protocolo. Primera versión con N pequeño (12 a 20) y 1 a 3 semillas.
- **R-002** [M] — **Criterio de entrada.** Adultos con algo que mejorar en una medida de cribado (sin LLM, con la respuesta verdadera de 046): por ejemplo depresión leve o más en el DASS-21, AAQ-II ≥ 24 o SWLS ≤ 19. La **línea base** se mide aparte y con el LLM, para no confundir el cribado con la línea base (regresión a la media). Se informa cuántas personas cumplen el criterio.
- **R-003** [T] — **Calendario** (por defecto, en días desde la línea base): medida de línea base día 0; sesiones los días 0, 7 y 14; práctica diaria con los audios hasta el día 42; medidas breves (AAQ-II y DASS-21) cada semana hasta el día 42; medida posterior completa el día 42; seguimiento completo **a los 12 meses de la medida posterior**.
- **R-004** [M] — **El protocolo actúa sobre mecanismos del motor, no sobre el LLM.** Cada ejercicio de las sesiones y de los audios se traduce a ensayos de aprendizaje del mundo (036, 038, 039) con una dosis que decide el motor según el compromiso de la persona en la sesión (R-005):
  - *Enmarque con «Yo» y defusión* («¿quién está observando ese pensamiento?», globos, post-its, ejercicio de la silla): ensayos reforzados de `yo.enmarque` (039 R-006), que pasa a ser una de las salidas del episodio de PNR.
  - *Dejar de empujar* (metáfora del papel, suprimir frente a dejar estar, contar de 3 en 3, contacto visual): contacto con el evento privado sin evitarlo, que extingue las respuestas de evitación `evit.*` (039 R-004) en vez de reforzarlas.
  - *Valores y acción comprometida* («película de la vida», jardín, acciones concretas): refuerzo de los dominios `dominio.*` de la persona (038 R-006) y de 2 a 4 reglas propias del tipo *tracking* hacia acciones valiosas (038 R-002).
  - *Práctica diaria con audios:* cada día, con una probabilidad que decide el motor (R-006), un evento `PRACTICE_DONE` con media dosis de lo anterior.
  Los parámetros son [M] y **no se ajustan para que salga un efecto**: se fijan desde los de aprendizaje ya existentes (036 §8) y se informa un análisis de sensibilidad (R-009).
- **R-005** [M] — **Sesión con el LLM.** El terapeuta es el guion del protocolo, sección por sección; la persona responde con el pipeline de la charla (043) en modo prueba (tono fijado por el guion: sin clasificador ni verificador, una llamada por turno). La **postura** de cada respuesta la elige el motor (043); el LLM solo la expresa. El compromiso `engagement` de la sesión es la proporción de turnos con postura de apertura; la dosis de R-004 es proporcional. Asistir a una sesión también lo decide el motor (034 R-005). Se guarda la transcripción completa, con la postura de cada turno.
- **R-006** [M] — **Adherencia a la práctica.** La probabilidad diaria de practicar es `P_PRACTICE_BASE` modulada por el estrés, la energía y el contacto reciente con sus valores; sin práctica, no hay dosis (se mide la relación dosis-respuesta).
- **R-007** [M] — **Medidas.** Con los cuatro instrumentos de 046 en una sola llamada por persona y momento, con el LLM por defecto (con el rango del DASS-21 ya acotado, 046 v0.3), y con la respuesta verdadera calculada siempre en paralelo. Una opción `--sin-llm` usa la respuesta que decidió el motor.
- **R-008** [M] — **Complacencia clínica.** Tres medidas, porque el GPQ-9 por sí solo no la mide (mide la tendencia general a seguir reglas por aprobación, un rasgo):
  - el **GPQ-9** en cada momento, como medida del rasgo;
  - la **brecha de informe**: cambio dicho menos cambio verdadero en cada instrumento, que solo es posible porque el mundo conoce la verdad;
  - en las sesiones, la **complacencia en la transcripción**: proporción de turnos en que la persona acepta, promete o elogia mientras su postura decidida por el motor es evasiva o de límite (clasificada por reglas léxicas y, si se pide, por un LLM aparte).
- **R-009** [M] — **Análisis.** Contraste pareado protocolo − lista de espera por semilla y persona (028 R-008) en cada momento; efecto mantenido a los 12 meses; relación dosis-respuesta; quién responde mejor según su historia (episodios de PNR, aprobación, flexibilidad); y sensibilidad a los parámetros de R-004 (tres valores de dosis). Exporta CSV, JSON y Excel con los límites en la primera hoja.
- **R-010** [T] — **El mundo sigue** entre sesiones y durante el año de seguimiento: nada se detiene ni se inyecta salvo lo de R-004 (034 R-004).
- **R-011** [T] — **Honestidad.** El efecto sale de supuestos [M] sobre cómo aprende una persona simulada, no de datos de personas reales. El estudio muestra si el mundo responde en la dirección esperada, si el efecto se sostiene y quién responde, **no** si el protocolo funciona en humanos. Cada exportación lo dice (034 R-009).

## 5. Eventos
`PROTOCOL_SESSION` (persona, sesión, asistencia, compromiso y dosis), `PRACTICE_DONE` (persona, día, dosis) y `PROTOCOL_ENDED` (persona, día, motivo). Todos con causas (el guion y la postura que los explican) y como entradas externas registradas (023 R-004), con los eventos entregados a los sistemas (`feedKinds`, 028 R-003).

## 6. Invariantes
- **INV-001** — Ninguna transcripción ni respuesta del LLM cambia el mundo por sí misma: solo la dosis que decide el motor.
- **INV-002** — Los dos brazos arrancan con el mismo hash (028 INV-004) y la persona del brazo de espera nunca recibe una sesión.
- **INV-003** — El estudio no escribe en la base de origen ni toma el cerrojo de escritor (028 INV-003).

## 7. Criterios de aceptación
- **CA-001** — *Dado* un mundo de ejemplo, *entonces* el cribado selecciona solo adultos que cumplen el criterio, informa cuántos cumplen, y es el mismo con la misma semilla.
- **CA-002** — *Dado* un brazo con protocolo y otro de espera con la misma semilla, *entonces* arrancan con el mismo hash y, sin protocolo, son idénticos.
- **CA-003** — *Dada* una persona con episodios de PNR, *entonces* tras las tres sesiones su respuesta `yo.enmarque` es más fuerte y sus respuestas de evitación más débiles que en el brazo de espera, en proporción a su compromiso; y una persona que no asiste a ninguna sesión no cambia.
- **CA-004** — *Dado* un compromiso nulo en una sesión (todas las posturas evasivas), *entonces* la dosis es cero aunque el texto del LLM sea de acuerdo (INV-001).
- **CA-005** — *Dada* una sesión, *entonces* se guarda su transcripción con la postura de cada turno, el guion y la sección, fuera del hash.
- **CA-006** — *Dado* el estudio completo, *entonces* el informe trae las cuatro medidas en cada momento, el contraste pareado, la brecha de informe, la complacencia en las transcripciones y la relación dosis-respuesta, con los límites en la primera hoja.
- **CA-007** — *Dado* el mismo estudio con el proveedor `mock`, *entonces* el informe es idéntico byte a byte.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto | Rango | Fuente / justificación |
|---|---|---|---|
| `n` | 12 | 8–50 | petición del usuario: «menos personas» en las primeras pruebas |
| Sesiones (días) | 0, 7, 14 | — | [T] protocolo de Ruiz y colaboradores (2019) |
| Práctica diaria hasta | día 42 | 28–60 | [T] «al menos un mes» del protocolo |
| `P_PRACTICE_BASE` | 0,6 | 0–1 | [M] |
| Dosis por ejercicio | la tasa operante de 036 (`operantRate` 0,12) | ×0,5–×2 | [M]; análisis de sensibilidad |
| Seguimiento | 12 meses tras la medida posterior | 3–24 | petición del usuario |

## 9. Métricas y observabilidad
Por brazo y momento: media y desviación de cada instrumento y de cada subescala del DASS-21; episodios de PNR y cómo terminan (bajo, evitación, «yo»); minutos de rumia; asistencia, compromiso y práctica; brecha de informe; coste y llamadas al LLM.

## 10. Preguntas abiertas
- [ ] **El mundo casi no produce PNR.** En 1,4 años hubo 32 episodios en 12 de 199 personas, todos disparados por la deuda (`verbal.deuda`). El protocolo apunta a eso: sin PNR no hay mecanismo que mover. Opciones: (a) un piloto solo con las 12 personas con episodios; (b) un mundo más grande; (c) revisar los disparadores del PNR en la 039, algo que el usuario pospuso a la revisión del motor conductual.
- [ ] ¿La medida de cribado debe ser la verdadera o una autoinformada? Con la verdadera no hay sesgo de informe, pero un estudio real usaría autoinforme.
- [ ] ¿Se añade un brazo de control de atención (sesiones sin contenido activo)? Separa el efecto de la atención del de los ejercicios; tres brazos.
- [ ] Reproducir las sesiones sin red exige persistir el registro de respuestas del LLM (026 R-003, hoy en memoria).
- [ ] La complacencia en la transcripción por reglas léxicas es burda; ¿un clasificador LLM aparte, o revisión humana de una muestra?

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-10-08 | 0.1 | Borrador a petición del usuario: línea base con AAQ-II, DASS-21, SWLS y GPQ-9; protocolo breve de 3 sesiones de ACT centrado en el PNR (Ruiz y colaboradores, 2019), con sesiones por LLM y transcripciones guardadas; medidas semanales, posterior y a los 12 meses; medida de complacencia clínica. Pendiente de aprobación |
