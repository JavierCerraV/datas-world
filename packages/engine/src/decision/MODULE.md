---
modulo: decision
ruta: packages/engine/src/decision
estado: en-desarrollo
specs: [040, 036, 037, 038, 039, 032, 010, 011, 016, 021, 035]
actualizado: 2026-10-05
---

# Módulo: decision

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Selección de conducta (spec 040, capa 6 del motor funcional): en los bloques flexibles, cada persona compara sus candidatas (rutina, comer, descansar, su esparcimiento) por la suma de aportes de sus fuentes de control, elige con una softmax cuya temperatura sale de la variabilidad aprendida, y la acción elegida se valida y se aplica con su vector de aportes como causa. No lee el temperamento (040 INV-002). Sustituye a la función de utilidad de la 017 (obsoleta), de la que conserva el validador, el compromiso y la integración con la movilidad.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 040 | CA-001 y CA-002 (en `lab/`), CA-003, CA-004 (prueba de arquitectura), CA-005, CA-006; R-001 a R-008, R-010; INV-001 a INV-003 | Reglas y valores (038, MF5), estado privado (039, MF6), contexto social (M3); `BEHAVIOR_EMITTED` en nivel ≥ 3 |
| 032 | CA-006; R-006 | R-007 (compañía, M3) |

## 3. API pública
Desde `@datas-world/engine`:

| Símbolo | Descripción |
|---|---|
| `createDecisionSystem(table, onto?)` | Sistema de la fase `decision` (orden 1, después de la rutina; capacidad `routines`; nivel ≥ 2, `runCoarse` en el 1). Con la ontología (036), las funciones aversivas presentes aportan |
| `createActionValidator(table)`, `ACTION_KINDS` | Validador de las acciones (`follow_routine`, `eat`, `rest`, `leisure`); se inyecta en el bucle como `loop.validate` (021) |
| `LeisureActivity`, `LeisureTable`, `activityOf` | Actividades de esparcimiento como las usa el motor; la tabla la construye `leisureTable` de los generadores |
| `buildOptions(ctx, rng)`, `freeUntil`, `explainCauses`, `OBLIGATION_DELAY_DAYS`, tipos `Option`, `SourceContribution`, `ControlSource`, `ActionParams`, `DecisionCtx` | Candidatas con sus aportes por fuente y su explicación |
| `softmax`, `temperatureOf(variability)`, `strengthContribution(w)`, `pickIndex`, `STRENGTH_SCALE`, `STRENGTH_REF` | Núcleo puro de la selección (`select.ts`), compartido con el laboratorio |
| `choose(view, options, T, rng, validate)` → `{ pick, rejected }` | Elección con rechazo y nueva elección (R-008) |
| `MINOR_SUPERVISED_AGE`, `ADULT_AGE`, `MINOR_CURFEW`, `MINOR_OUTING_MAX_H`, `ageOf`, `bandOf`, `guardianAt`, `teenStayLimit`, `isStranded` (`supervision.ts`) | Supervisión de menores (011 v0.3, R-007): un menor de 12 años solo elige tiempo libre fuera de casa donde ya esté un adulto de su hogar y, si está fuera sin él, vuelve a casa aunque tenga algo comprometido (fuente `regla`, `rutina.menor_en_casa`; el sistema de decisión suelta lo comprometido de un niño en esa situación); de 12 a 17 sale de día, hasta las 20:00 y como mucho 2 h seguidas |
| `DECISION_COLUMNS`, `defineDecisionColumns` | Columnas `act.choice` (u8), `act.place` e `act.until` (i32) |

## 4. Diseño interno y decisiones
- **Cuándo decide (R-001):** despierta, sana, sin viaje en curso, en un bloque con flexibilidad ≥ 0,5 y sin una decisión en curso. Con hambre crítica (< 0,1) se replantea lo que estuviera haciendo.
- **Compromiso:** lo elegido dura hasta `act.until`, acotado por el primer cuarto de hora de trabajo, colegio o sueño menos el margen de la movilidad (`lookahead`). La enfermedad lo cancela, y también un lugar cerrado o lleno al llegar.
- **Aportes por fuente (R-003), magnitudes portadas de la 017 sin rasgos:**
  - `reforzador` (magnitud × operación motivadora, R-007): comer, 1,5 × (1 − hambre) + 4 × hambre crítica; dormir un rato, 0,3 + 2 × (0,3 − energía); descansar en casa, 0,3 + 0,2 × cansancio; esparcimiento, 0,8 × aburrimiento, 0,4 × soledad (si no es solitaria) y la saciedad específica: 3 × (min(2, tiempo desde la última vez / intervalo) − 1), con el intervalo de la frecuencia de la ficha;
  - `fuerza` (036 R-002): `1,5 × ln(max(0,02, w) / 0,46)`, con `w` la fuerza de `ocio.<clave>` en `Citizen.functions.r` (sin almacén, la de partida: 0,2 + 0,4 × afinidad). Escala 1,5: la igualación de V-4 da 0,72 (con 1, 0,69; por encima se satura). Referencia 0,46: el mundo generado hace el mismo volumen de ocio que con la 017 (a menos del 2 %);
  - `demorado` (036 R-009): obligaciones de la rutina (buscar empleo, tareas, cuidar, estudiar), `0,4 / (1 + k · 5 días)`, con `k = hist.discountK`. Con k = 0,2 (mediana) aporta 0,2, lo que daba la responsabilidad media;
  - `regla`: el aporte de las reglas de la persona para esa obligación (038 R-004: `s × (1 − contraste × d)`); empiezan en 0,45 (0,35 estudiar), el número fijo de antes, que se usa si la persona no tiene reglas. La siesta infantil sigue fija (2);
  - `valor` (038 R-006): lo que la actividad señala de un valor, la función de la raíz `dominio.*` transformada por el camino jerárquico;
  - `aversion`: `0,5 × min(0, vf(actividad) + vf(lugar))` con la ontología, donde `vf` es el valor funcional (037 R-006): el aprendido (036) o el derivado por la red relacional, si es mayor;
  - `coste`: dinero, viaje y esfuerzo, como en la 017.
- **Selección (R-004):** softmax con `T = 0,15 + 0,4 × hist.variability` (antes 0,3 × (0,6 + 0,8 × impulsividad)). Si el validador rechaza la elegida, se quita y se vuelve a elegir; cada rechazo sube la variabilidad 0,05 × (1 − v) (R-009).
- **Vector de aportes (R-006):** `LEISURE_DONE` lleva como causas los 3 aportes de mayor magnitud (`fuente.<fuente>:<ref>`, con valor y peso) y hasta 3 eventos de origen de la fuerza o de la función aversiva implicadas.
- **Validación y aplicación:** como en la 017 (dinero, lleno, ficha; transferencia del gasto; `lastDone`).

## 5. Invariantes y guardarraíles
INV-001 (softmax finita que suma 1), INV-002 (no lee `tmp.*` ni `pers.*`: ni el adaptador ni el temperamento; lo comprueban ESLint y la prueba de arquitectura) e INV-003 (toda acción lleva sus aportes). Determinismo con la vista congelada.

## 6. Cómo se prueba
`decision.test.ts`: un pueblo pequeño con bar y La Capital, y personas sin empleo con fichas a medida. `supervision.test.ts` (011 CA-006): una casa con un menor y un adulto, y un parque.

| Criterio | Prueba |
|---|---|
| INV-001 | 200 conjuntos de valores al azar |
| 040 CA-003 (017 CA-001) | Hambre 0,05 en tiempo libre: come en > 95 % de 300 semillas |
| 040 R-008 (017 CA-003) | Sin dinero para el cine: la opción existe, el validador la rechaza y se elige otra en 100 semillas |
| 032 CA-006 | Diversión 0,1 con el bar abierto: > 50 % elige su ficha y la rumba (afinidad 0,9) gana a las series (0,3) |
| 040 CA-006 | Desempleada a las 11:00: con k = 0,02 sigue la búsqueda de empleo más que con k = 2 |
| 040 CA-005 y 032 CA-006 | Con el validador en el bucle: `LEISURE_DONE` con causas `fuente.*`, va al bar y la diversión sube |
| INV-003 | Tres días con la vista congelada: mismo hash; tras una semana, todos duermen en casa |

En `lab/choice.test.ts`: 040 CA-001 (V-4) y CA-002 (V-5). En `generators/src/stimuli/stimuli.test.ts`: en el mundo generado, las salidas de ocio citan sus fuentes y los eventos de origen de la fuerza. En `generators/src/leisure/vida.test.ts`: frecuencia de la ficha y diversión. En `generators/src/life.test.ts`: 021 CA-001.

## 7. Paridad con el prototipo
Porta `decide`: opciones de tiempo libre con puntuación y ruido y duración acotada por la próxima obligación y la hora de dormir. Diferencias: softmax en vez de máximo con ruido; aportes por fuente de control en vez de utilidad con rasgos; las opciones de ocio salen de la ficha de esparcimiento (032). La paridad de MF3 está en `docs/validaciones/MF3-paridad-prototipo.md`.

## 8. Pendientes y deuda
- [ ] Reglas y valores como fuentes (038, MF5); evento privado aversivo como punto de decisión (039, MF6).
- [ ] Fuerzas de respuesta para comer, dormir y la rutina (historia sintética, MF7) y por contexto.
- [ ] Comer fuera y comprar; compañía (032 R-007): M3.
- [ ] `ACTION_REJECTED` y `BEHAVIOR_EMITTED` en nivel ≥ 3.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-25 | m2/e-decisiones | — | Documento creado desde la plantilla (sin código) |
| 2026-09-25 | m2/e-decisiones (E1–E4) | 017, 032, 010, 016, 021 | `columns.ts`, `options.ts`, `validate.ts`, `system.ts` e `index.ts`. 7 pruebas |
| 2026-09-25 | mf/1-temperamento (MF1.4) | 035, 009 v1.0 | La responsabilidad (utilidad de las obligaciones) y la impulsividad (temperatura) se leen por el adaptador @deprecated (`temperament/legacy.ts`); la impulsividad sale ahora de `tmp.discount0`. Caducan en MF3.4 (040). ESLint y la prueba de arquitectura prohíben importar el temperamento desde este módulo |
| 2026-09-25 | m2/f-economia | 015 | El gasto del esparcimiento es una transferencia (021) a la organización del lugar (sus ventas, 015 R-007) o al resto del país; en mundos sin cuentas del sistema, se descuenta como antes |
| 2026-09-25 | m2/g-trabajo-objetos | 017, 016 | El tiempo libre termina `mobility.habits.lookahead` (30 min) antes de la próxima obligación: lo elegido duraba hasta la hora de entrada y la movilidad, que no mira adelante mientras dura, hacía salir tarde (≈ 960 retrasos de 2–5 min en 30 días en el mundo generado; ahora 2, por quedarse dormido) |
| 2026-09-25 | m2/h-cierre | 017, 021 | `runCoarse` para el nivel 1 (021 R-011): mantiene lo elegido cada tick y solo decide algo nuevo en punto cada hora (o con hambre crítica). Con él, 30 días en nivel 1 dan un ánimo y un gasto a < 5 % del nivel 2 (021 CA-001); sin él, en nivel 1 no había esparcimiento y el gasto difería un 13 % |
| 2026-09-26 | mf/3-seleccion (MF3.2–MF3.4) | 040, 036 | Pasa de la 017 a la 040: `select.ts` (softmax, temperatura desde `hist.variability`, aporte logarítmico de la fuerza), aportes por fuente en `options.ts` (`SourceContribution` sustituye a `Factor`; `Option.value` a `utility`), causas `fuente.*` con eventos de origen, `choose` devuelve los rechazos y sube la variabilidad. Sin el adaptador de temperamento. Referencia de la fuerza calibrada al volumen de ocio de la 017 |
| 2026-09-26 | mf/4-red | 037, 040 | La fuente `aversion` usa el valor funcional (037 R-006) de la actividad y del lugar: el aprendido (con `directValue`: generalización y primarios) o el derivado por la red relacional, si es mayor; sus orígenes incluyen los eventos de las relaciones del camino |
| 2026-09-26 | mf/5-reglas-valores | 038, 040 | La fuente `regla` de las obligaciones sale de las reglas de la persona (038 R-004; sin reglas, el número fijo de antes). Fuente nueva `valor` para el ocio que señala un valor (038 R-006). La aversión se calcula sin las raíces de valor. Elegir buscar empleo acumula el contraste de su regla (desaliento, 038 R-005). Prueba 038 CA-004 |
| 2026-09-28 | mf/6-privados (MF6.2) | 039, 040 | Fuente nueva `alivio` (039 R-004): con un episodio de PNR abierto, dormir un rato y cada afición valen `2 × carga × fuerza de la evitación` (`evit.dormir`, `evit.distraccion`). Dormir se ofrece también sin agotamiento si hay episodio |
| 2026-10-05 | claude/busy-mayer-fj6x13 (011 v0.3) | 011, 040 | Supervisión de menores (`supervision.ts`, 011 R-007 y R-008): las candidatas de tiempo libre de un menor de 12 años excluyen los lugares sin un adulto de su hogar; un niño solo fuera de casa tiene la opción de volver (fuente `regla`, peso 6); de 12 a 17 años la salida se acota por el toque de queda y las 2 h. Pruebas nuevas en `supervision.test.ts` |
| 2026-10-05 | claude/busy-mayer-fj6x13 (011 v0.3, ajuste) | 011 | `isStranded`: el sistema de decisión (`system.ts`) suelta lo comprometido de un niño que se queda sin adulto fuera de casa para que vuelva (antes terminaba el episodio entero: en 7 días de un mundo generado había niños hasta 11 ticks solos; ahora, como mucho uno). Prueba sobre el mundo en `generators/src/minors.test.ts` |
