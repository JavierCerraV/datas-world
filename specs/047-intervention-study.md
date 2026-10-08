---
id: 047
nombre: intervention-study
estado: aprobada
hito: Capa de investigación (tras M5; antecede a la capa clínica 034)
depende_de: [028, 034, 036, 038, 039, 043, 046]
version: 0.4
---

# 047 — Estudio de intervención: línea base, protocolo breve y seguimiento

## 1. Propósito
Medir si un protocolo psicológico breve cambia las medidas de las personas del mundo y si el cambio se mantiene un año después, con el diseño de un estudio clínico: una muestra pequeña con criterio de entrada, medidas de línea base, un protocolo de pocas semanas con medidas durante el tratamiento, una medida posterior y un seguimiento a los 12 meses.

El primer protocolo es el de **tres sesiones de ACT centrado en desmantelar el pensamiento negativo repetitivo (PNR)**, de Ruiz y colaboradores (2019), en `docs/investigacion/SPANISH 3-session RNT-focused ACT protocol Ruiz et al. 2019.pdf`: tres sesiones semanales, cinco audios y práctica diaria de al menos un mes. Ese PDF se usa **solo en el piloto** y **no está en el repositorio** (se entrega en local, en esa ruta): los estudios reales se harán con el autor de las pruebas y del protocolo, Francisco J. Ruiz, y con el material que él entregue.

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
- **R-001b** [M] — **Fase 1: piloto.** La primera ejecución usa a **las personas del mundo que ya tuvieron episodios de PNR** (hoy 12 de 199; decisión del usuario del 2026-10-08), sin más criterio de entrada, porque el protocolo ataca justo eso y el mundo casi no lo produce (§10). Con tan pocas personas el análisis es **descriptivo**: sin contrastes de hipótesis ni conclusiones sobre el efecto, solo comprobar que el flujo funciona de punta a punta y mirar las transcripciones, las dosis y la dirección del cambio.
- **R-002** [M] — **Criterio de entrada** (fases posteriores). Adultos con algo que mejorar en una medida de cribado (sin LLM, con la respuesta verdadera de 046): por ejemplo depresión leve o más en el DASS-21, AAQ-II ≥ 24 o SWLS ≤ 19. La **línea base** se mide aparte y con el LLM, para no confundir el cribado con la línea base (regresión a la media). Se informa cuántas personas cumplen el criterio.
- **R-003** [T] — **Calendario** (por defecto, en días desde la línea base): medida de línea base día 0; sesiones los días 0, 7 y 14; práctica diaria con los audios hasta el día 42; medidas breves (AAQ-II y DASS-21) cada semana hasta el día 42; medida posterior completa el día 42; seguimiento completo **a los 12 meses de la medida posterior**.
- **R-004** [M] — **El protocolo actúa sobre mecanismos del motor, no sobre el LLM.** Cada ejercicio de las sesiones y de los audios se traduce a ensayos de aprendizaje del mundo (036, 038, 039) con una dosis que decide el motor según el compromiso de la persona en la sesión (R-005):
  - *Enmarque con «Yo» y defusión* («¿quién está observando ese pensamiento?», globos, post-its, ejercicio de la silla): ensayos reforzados de `yo.enmarque` (039 R-006), que pasa a ser una de las salidas del episodio de PNR.
  - *Dejar de empujar* (metáfora del papel, suprimir frente a dejar estar, contar de 3 en 3, contacto visual): contacto con el evento privado sin evitarlo, que extingue las respuestas de evitación `evit.*` (039 R-004) en vez de reforzarlas.
  - *Valores y acción comprometida* («película de la vida», jardín, acciones concretas): refuerzo de los dominios `dominio.*` de la persona (038 R-006) y de 2 a 4 reglas propias del tipo *tracking* hacia acciones valiosas (038 R-002).
  - *Práctica diaria con audios:* cada día, con una probabilidad que decide el motor (R-006), un evento `PRACTICE_DONE` con media dosis de lo anterior.
  Los parámetros son [M] y **no se ajustan para que salga un efecto**: se fijan desde los de aprendizaje ya existentes (036 §8) y se informa un análisis de sensibilidad (R-009).
- **R-005** [M] — **El terapeuta es un agente LLM, no un guion.** Un modelo (configurable por separado de la persona: propósito `therapist`) con el papel de psicólogo formado en terapias de tercera generación (ACT: análisis funcional, defusión, aceptación, valores y acción comprometida). Recibe:
  - el **manual** del protocolo como guía estructurada (objetivos, componentes obligatorios de cada sesión, ejercicios y frases de ejemplo), **no** como texto para leer igual a todos;
  - lo que la persona ha dicho en la conversación;
  - su **formulación del caso**: las notas que él mismo escribe en cada turno (disparadores, estrategias de evitación, valores, barreras), que pasan de una sesión a la siguiente;
  - las respuestas de la persona a las pruebas de la línea base, como en una admisión real (decisión del usuario, 2026-10-08). Son **lo que ella dijo**, nunca la medida verdadera del cribado de R-002, que el terapeuta no puede conocer.

  **No** recibe la verdad del mundo, ni los indicadores, ni la postura que el motor decidió para la persona (026 R-002; CLAUDE.md regla 3): un terapeuta solo sabe lo que el paciente le cuenta.
- **R-005b** [M] — **Diálogo.** Cada sesión es una conversación por turnos: terapeuta (LLM) → persona (pipeline de la 043, con la postura elegida por el motor y expresada por el LLM) → terapeuta… El terapeuta adapta la pregunta, el ritmo y el ejercicio a lo que la persona responde: repite o reformula si no la entiende, dedica más turnos a un componente que lo necesita, sigue una pista que ella da. Cada turno devuelve un objeto estructurado `{ say, component, covered, notes }` validado con Zod; **el motor, no el LLM, lleva la cuenta** de qué componentes obligatorios están cubiertos. La sesión termina cuando se cubrieron o al llegar a `MAX_TURNS_SESSION`. Se guarda la transcripción completa, con la postura de cada turno de la persona y las notas del terapeuta.
- **R-005c** [M] — **Fidelidad.** Se registra qué proporción de los componentes obligatorios se cubrió (`fidelity`) y la dosis de R-004 se multiplica por ella: un terapeuta que se pierde da menos dosis. Así se separa «el protocolo no funciona» de «el protocolo no se aplicó». La persona **no** recibe el nombre de los componentes ni sabe cuántos faltan.
- **R-005d** [M] — **Alianza.** La persona no conoce al terapeuta: su cautela ante un desconocido (043 R-024 a R-027) rige el principio y la confianza crece con los turnos. Por defecto llega a una consulta que aceptó, así que el nivel de revelación inicial es «conocido» y el motor decide lo demás; sin alianza no hay revelación de lo íntimo y por tanto menos apertura y menos dosis (R-004).
- **R-006** [M] — **Adherencia a la práctica.** La probabilidad diaria de practicar es `P_PRACTICE_BASE` modulada por el estrés, la energía y el contacto reciente con sus valores; sin práctica, no hay dosis (se mide la relación dosis-respuesta).
- **R-007** [M] — **Medidas.** Con los cuatro instrumentos de 046 en una sola llamada por persona y momento, con el LLM por defecto (con el rango del DASS-21 ya acotado, 046 v0.3), y con la respuesta verdadera calculada siempre en paralelo. Una opción `--sin-llm` usa la respuesta que decidió el motor.
- **R-008** [M] — **Complacencia clínica.** Tres medidas, porque el GPQ-9 por sí solo no la mide (mide la tendencia general a seguir reglas por aprobación, un rasgo):
  - el **GPQ-9** en cada momento, como medida del rasgo;
  - la **brecha de informe**: cambio dicho menos cambio verdadero en cada instrumento, que solo es posible porque el mundo conoce la verdad;
  - en las sesiones, la **complacencia en la transcripción**: proporción de turnos en que la persona acepta, promete o elogia mientras su postura decidida por el motor es evasiva o de límite (reglas léxicas y, si se pide, un LLM aparte); y la **aceptación de suposiciones**: cuántas veces el terapeuta afirma algo que la vista de la persona no respalda («seguro te sientes culpable») y ella lo acoge como propio, que el verificador de la 043 marca como no respaldado.
- **R-009** [M] — **Análisis.** Contraste pareado protocolo − lista de espera por semilla y persona (028 R-008) en cada momento; efecto mantenido a los 12 meses; relación dosis-respuesta; quién responde mejor según su historia (episodios de PNR, aprobación, flexibilidad); y sensibilidad a los parámetros de R-004 (tres valores de dosis). Exporta CSV, JSON y Excel con los límites en la primera hoja.
- **R-012** [T] — **Lo aprendido se pone a prueba en la vida, no en la sesión.** La sesión solo cambia la fuerza de unas respuestas (R-004). Que la persona las use lo decide el motor cada vez que la vida le presenta el contexto, con las mismas reglas de siempre (039 R-004, R-006, R-007):
  - ante un hecho aversivo (una deuda, un aviso en el trabajo, una discusión) que le dispare un episodio, la persona **evita**, **toma distancia con «Yo»** o **se queda rumiando**, con probabilidades que salen de la fuerza de cada respuesta;
  - evitar se refuerza por el alivio; tomar distancia se refuerza solo si la persona tiene valores a su alcance, y si no, se extingue. Así el efecto **se mantiene o se pierde** por lo que le pasa después, no por un parámetro de «mantenimiento»;
  - lo mismo con las acciones valiosas que se comprometió a hacer: que las haga lo decide la selección de conducta (040), donde su regla nueva compite con sus costumbres, su cansancio y su dinero.
  El estudio registra cada una de esas **pruebas en el mundo**: el hecho que la provocó, qué hizo la persona, cuánto duró el episodio y qué consecuencia tuvo. Es la medida principal del aprendizaje, por encima de los cuestionarios.
- **R-013** [M] — **La persona vuelve a la sesión con lo que le pasó.** Entre una sesión y la siguiente, sus episodios, lo que hizo ante ellos, si practicó y si cumplió sus acciones son hechos de su propia vida y entran en su vista (043 R-003). En el repaso del inicio de las sesiones 2 y 3 los cuenta con sus palabras, y el terapeuta trabaja con esa dificultad concreta. La persona puede también **no volver**: asistir lo decide el motor (R-005), y un abandono se registra con su causa.
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
- **CA-008** — *Dado* el prompt del terapeuta en cualquier turno, *entonces* no contiene el estado del mundo, los indicadores, la verdad de lo que la persona cree ni su postura (prueba como la 043 CA-002).
- **CA-009** — *Dadas* dos personas que responden distinto al mismo punto del manual, *entonces* las sesiones difieren: el terapeuta no repite el mismo guion (prueba con un proveedor `mock` que reacciona a lo que dice la persona).
- **CA-011** — *Dada* una persona tratada que después tiene un episodio de PNR, *entonces* el estudio registra esa prueba en el mundo con su causa, lo que hizo y cómo terminó, y la probabilidad de tomar distancia con «Yo» es mayor que en su brazo de espera (R-012).
- **CA-012** — *Dada* una persona que entre dos sesiones tuvo un episodio y lo cortó evitando, *entonces* ese hecho está en su vista al empezar la sesión siguiente y el prompt del terapeuta no lo trae: solo lo sabrá si ella lo cuenta (R-013, R-005).
- **CA-010** — *Dada* una sesión que termina sin cubrir todos los componentes obligatorios, *entonces* `fidelity` < 1, la dosis baja en proporción y queda anotado qué faltó (R-005c).

## 8. Parámetros y calibración
| Parámetro | Valor por defecto | Rango | Fuente / justificación |
|---|---|---|---|
| `n` | 12 | 8–50 | petición del usuario: «menos personas» en las primeras pruebas |
| Sesiones (días) | 0, 7, 14 | — | [T] protocolo de Ruiz y colaboradores (2019) |
| Práctica diaria hasta | día 42 | 28–60 | [T] «al menos un mes» del protocolo |
| `P_PRACTICE_BASE` | 0,6 | 0–1 | [M] |
| `MAX_TURNS_SESSION` | 40 turnos del terapeuta | 20–80 | [M] equivale a una sesión de 45 a 60 minutos |
| Propósito `therapist` | un modelo configurable, por defecto el mismo de la persona | — | el usuario pidió un modelo con conocimiento de terapias de tercera generación y diálogo (2026-10-08) |
| Modelo del piloto | `claude-haiku-5-5`, esfuerzo `low`, sin `temperature` | — | [T] documentación de Anthropic (2026-10-08): 0,10 y 0,50 USD por millón de tokens hasta 100 000 tokens de prompt (5 veces más por encima), lectura de caché 0,01; el modelo rechaza `temperature` con un error 400 y usa pensamiento adaptativo regulado por `effort`. Exige ampliar el adaptador de la 026 |
| Dosis por ejercicio | la tasa operante de 036 (`operantRate` 0,12) | ×0,5–×2 | [M]; análisis de sensibilidad |
| Seguimiento | 12 meses tras la medida posterior | 3–24 | petición del usuario |

## 9. Métricas y observabilidad
Por brazo y momento: media y desviación de cada instrumento y de cada subescala del DASS-21; episodios de PNR y cómo terminan (bajo, evitación, «yo»); minutos de rumia; asistencia, compromiso y práctica; brecha de informe; coste y llamadas al LLM, separando las del terapeuta, las de la persona, las de verificación y las de medida.

## 10. Preguntas abiertas
- [x] **El mundo casi no produce PNR** (decisión del usuario, 2026-10-08: piloto con las 12 personas; los disparadores del PNR se revisan después, en la revisión del motor conductual). En 1,4 años hubo 32 episodios en 12 de 199 personas, todos disparados por la deuda (`verbal.deuda`). El protocolo apunta a eso: sin PNR no hay mecanismo que mover. Opciones: (a) un piloto solo con las 12 personas con episodios; (b) un mundo más grande; (c) revisar los disparadores del PNR en la 039, algo que el usuario pospuso a la revisión del motor conductual.
- [ ] **Hoy solo la deuda dispara episodios** (32 de 32). Un aviso en el trabajo o una discusión también activan pensamientos, pero no llegan al umbral de un episodio (`pnrEnter` 0,5), así que el ejemplo del conflicto laboral del usuario todavía no ocurre en el mundo. No se toca en el piloto (se observa con la deuda); queda para la revisión del motor conductual.
- [ ] ¿La medida de cribado debe ser la verdadera o una autoinformada? Con la verdadera no hay sesgo de informe, pero un estudio real usaría autoinforme.
- [ ] ¿Se añade un brazo de control de atención (sesiones sin contenido activo)? Separa el efecto de la atención del de los ejercicios; tres brazos.
- [ ] Reproducir las sesiones sin red exige persistir el registro de respuestas del LLM (026 R-003, hoy en memoria).
- [ ] La complacencia en la transcripción por reglas léxicas es burda; ¿un clasificador LLM aparte, o revisión humana de una muestra?

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-10-08 | 0.1 | Borrador a petición del usuario: línea base con AAQ-II, DASS-21, SWLS y GPQ-9; protocolo breve de 3 sesiones de ACT centrado en el PNR (Ruiz y colaboradores, 2019), con sesiones por LLM y transcripciones guardadas; medidas semanales, posterior y a los 12 meses; medida de complacencia clínica. Pendiente de aprobación |
| 2026-10-08 | 0.2 | Decisiones del usuario: la primera ejecución es un piloto con las 12 personas que ya tuvieron episodios de PNR (R-001b); el PDF del protocolo es solo para el piloto y no se versiona (los estudios reales se harán con el autor, F. J. Ruiz); precio del modelo para el cálculo del coste. Aprobada |
| 2026-10-08 | 0.2 | Estado → aprobada |
| 2026-10-08 | 0.3 | A petición del usuario, el terapeuta pasa de ser un guion a ser un **agente LLM con formación en terapias de tercera generación** que dialoga y se adapta a cada persona (R-005 a R-005d: manual como guía, formulación del caso entre sesiones, motor que cuenta los componentes cubiertos, fidelidad que multiplica la dosis, alianza). La complacencia incluye aceptar suposiciones del terapeuta (R-008). CA-008 a CA-010. Pendiente de la confirmación del usuario |
| 2026-10-08 | 0.4 | El usuario aprueba el terapeuta como agente (v0.3) y pide que la intervención se vea en las acciones posteriores de la persona: R-012 (lo aprendido se pone a prueba en la vida, con el mantenimiento y la recaída como resultado de las consecuencias, y registro de cada prueba) y R-013 (la persona vuelve a la sesión con sus dificultades o abandona). El terapeuta recibe lo que la persona dijo en la línea base. Modelo del piloto: `claude-haiku-5-5` con esfuerzo bajo. CA-011 y CA-012 |
