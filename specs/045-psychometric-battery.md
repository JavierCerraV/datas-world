---
id: 045
nombre: psychometric-battery
estado: aprobada
hito: Laboratorio de medición (petición del usuario, 2026-10-05) · antecede a M5
depende_de: [010, 012, 013, 019, 020, 023, 031, 036, 037, 038, 039, 040, 041]
version: 0.2
---

# 045 — Batería psicométrica: las personas responden pruebas desde lo que han vivido

## 1. Propósito
Poder aplicar a las personas del mundo los cuestionarios que usa la psicología clínica y obtener sus puntuaciones, en varios momentos, para ver cómo cambian. Es el primer paso para comparar a las personas simuladas con las poblaciones humanas y, más adelante, para evaluar intervenciones (034).

La pregunta guía del proyecto («¿estas personas parecen haber vivido y podemos explicar por qué terminaron donde terminaron?») pide algo más que puntuaciones: cada respuesta debe poder explicarse con la historia, el aprendizaje y los valores de quien responde (CLAUDE.md, regla 5; documento rector §12). Por eso las respuestas **no** se sortean ni salen de un LLM: salen de una función determinista del estado de la persona, con sus indicadores a la vista.

## 2. Alcance
**Incluye:**
- los seis instrumentos del ClinikLab de la Universidad Konrad Lorenz (R-001);
- los indicadores de la persona que alimentan las respuestas (R-002) y el modelo de respuesta (R-003, R-004);
- la selección de la muestra y las tres tomas (R-005, R-006);
- el informe en Excel y en JSON (R-007).

**Fuera de alcance:**
- la validación psicométrica de este modelo frente a poblaciones humanas (R-009; queda como pregunta abierta PA-155);
- aplicar pruebas a personas reales o con LLM (sería otra spec, 026 y 034);
- cambiar el mundo a partir de lo medido: la medición solo lee (INV-001).

## 3. Modelo de datos
```ts
type InstrumentId = 'AAQ-II' | 'GHQ-12' | 'GPQ-9' | 'GTQ' | 'DASS-21' | 'SWLS';

interface InstrumentItem { n: number; text: string; subscale?: 'depresion' | 'ansiedad' | 'estres' }
interface Instrument {
  id: InstrumentId;
  name: string;
  min: number; max: number;                 // escala de cada ítem: 1–7, 0–3
  items: InstrumentItem[];                  // texto literal de la ficha del ClinikLab
  scoring: 'suma' | 'subescalas';           // «modo de corrección» de la ficha
  cutoffs: { label: string; from: number; to: number; subscale?: string }[]; // «interpretación» de la ficha
  source: string;                           // URL de la ficha y referencias
}

/** Lo que se sabe de la persona en el momento de la toma (R-002), todo en [0,1] salvo `age`. */
interface Indicators {
  mood: number; stress: number; negAffect: number; joy: number;
  energyLack: number; funLack: number; lonely: number; sleepDebt: number;
  moodBase: number; stressBase: number;          // su «habitual»: media de los 30 días anteriores
  avoidance: number; pnrLoad: number; pnrRecent: number; selfFraming: number;
  aversiveBurden: number; approvalValue: number; positiveContact: number;
  pliance: number; tracking: number; sensitivity: number;
  valueImportance: number; valueContact: number; valueGap: number;
  jobStability: number; relationshipStability: number; socialNetwork: number;
  stressorExposure: number; economicTrajectory: number; health: number;
}

interface Administration {                      // una toma de una persona
  citizenId: string; toma: 0 | 1 | 2; at: number;   // minuto del mundo
  indicators: Indicators;
  responses: Record<InstrumentId, number[]>;       // una respuesta por ítem
  scores: Record<InstrumentId, { total: number; subscales?: Record<string, number>; band?: string }>;
}
```
Coste: se calcula al medir y se descarta; no añade estado al mundo (0 bytes por persona).

## 4. Reglas
- **R-001** [T] — **Instrumentos.** Se aplican, con sus ítems, escalas, modo de corrección e interpretación tal como los publica el ClinikLab (https://la.konradlorenz.edu.co/wp-content/uploads/2025/09/…):
  - **AAQ-II** (7 ítems, 1–7; suma 7–49; evitación experiencial; sin problema clínico ≈ 18–23, clínicos > 29);
  - **GHQ-12** (12 ítems, 0–3; suma 0–36; ≥ 12 sugiere trastorno emocional; las respuestas se comparan con «lo habitual»);
  - **GPQ-9** (9 ítems, 1–7; suma 9–63; pliance; no clínicos 20–25, clínicos > 27);
  - **GTQ** (11 ítems, 1–7; suma 11–77; tracking; no clínicos ≈ 58, clínicos ≈ 48);
  - **DASS-21** (21 ítems, 0–3; subescalas depresión [3, 5, 10, 13, 16, 17, 21], ansiedad [2, 4, 7, 9, 15, 19, 20] y estrés [1, 6, 8, 11, 12, 14, 18]; suma cruda por subescala con los cortes de la ficha; «durante la semana pasada»);
  - **SWLS** (5 ítems, 1–7; suma 5–35; cortes 5–9, 10–14, 15–19, 20–24, 25–29 y 30–35).
- **R-002** [M] — **Indicadores.** Cada respuesta se calcula con indicadores de la propia persona, sin leer a otras ni la verdad de lo que ella no sabe (CLAUDE.md, regla 3), y **sin leer el temperamento** (009 R-006): solo lo aprendido y lo vivido. Los de §4 bis salen de:
  - su estado: ánimo, estrés, emociones y necesidades (010; MF6.4), y el sueño perdido;
  - su historia: perfil emergente del informe de vida (020 R-006) y su trayectoria de los 30 días anteriores (020 R-001), que es su «habitual» para el GHQ-12;
  - su aprendizaje: funciones de estímulos (036), fuerza de las respuestas de evitación y del enmarque con «Yo» (039), episodios de PNR de los últimos 60 días (039), reglas con su tipo (038) y estados aprendidos `hist.variability` y `hist.discountK` (040);
  - sus valores: dominios vitales y su red (038 R-006) frente a lo que hace (eventos `LEISURE_DONE`, trabajo, vínculos).
- **R-003** [M] — **Modelo de respuesta.** Para el ítem `i` de un instrumento, `p_i = clamp01(Σ w_ik · ind_k + o_i + ε)`, con los pesos `w_ik` y el sesgo del ítem `o_i` de la tabla de §4 bis, y `ε ~ N(0, EPS_ITEM)` de un flujo con nombre `rng.fork('measure:<instrumento>:<citizenId>:<toma>')` (023). La respuesta es: escala 1–7, `1 + round(6 · p)`; escala 0–3 (DASS-21), `min(3, floor(4 · p))`; GHQ-12, R-004.
- **R-011** [M] — **Lo verdadero y lo que dice.** El modelo de R-003 y R-004 da la respuesta **verdadera** `t_i` (cómo está la persona). Lo que *dice* `r_i` puede diferir, según su historia de aprendizaje. El motor decide por ítem una **disposición** con el flujo `rng.fork('measure:candor:<citizenId>:<toma>:<instrumento>')`, con estas probabilidades [M]:
  - `minimiza` (dice menos malestar del que tiene): crece con la vergüenza, el valor de la aprobación (`approvalValue`), la evitación y el *pliance* (deseabilidad social: aprendió que mostrar malestar se castiga o no se aprueba); más en ítems de ánimo, valía y soledad;
  - `exagera` (dice más): crece con la carga aversiva, la soledad y la historia en que el malestar se refuerza con atención o cuidado (función apetitiva de `verbal.afecto` ligada a haber estado mal); más en ítems de síntomas;
  - `miente` (dice lo contrario o algo muy alejado): una fracción pequeña de las dos anteriores, mayor con baja confianza en quien pregunta (aquí, un extraño: 043 R-024);
  - `impreciso` (no *tacta* bien su estado): crece con la baja flexibilidad (`1 − selfFraming`), la evitación y la alta activación; la respuesta se desplaza al azar ±`IMPRECISION_MAX` puntos;
  - `fiel`: el resto.
  La respuesta que debe expresar es `r_i = t_i + desplazamiento(disposición)`, acotada a la escala. Quedan registradas `t_i`, la disposición y `r_i`.
- **R-012** [M] — **Charla con el LLM.** Cada instrumento se aplica como una **charla**: un evaluador (el sistema) plantea los ítems en orden, de uno en uno, y la persona responde con sus palabras, con su vista (043 R-003) y su estado de confianza en un desconocido (043 R-024 a R-027). La pasarela (026, propósito `dialogue`) recibe: la persona, el ítem y sus opciones, el **rango permitido** `[r_i − 1, r_i + 1]` y la disposición en lenguaje natural («te cuesta admitir cómo estás», «tiendes a dramatizar»). Devuelve por ítem `{ reply, option }`. El motor **valida**: `option` dentro de la escala y del rango permitido; si no, se usa `r_i` y se anota `llm: 'corregida'`. El LLM interpreta y expresa; **no decide** la desviación ni cambia el mundo (026, ADR-003). Una llamada por persona, instrumento y toma (varios ítems por llamada, en orden).
- **R-013** [M] — **Sin LLM.** Si la pasarela no está disponible (sin clave, sin presupuesto, tiempo agotado), la respuesta es `r_i` con una frase de plantilla y se anota `llm: 'plantilla'`. El informe dice cuántos ítems se expresaron con LLM.
- **R-004** [M] — **GHQ-12.** Las opciones se refieren a «lo habitual»: 0 mejor, 1 igual, 2 peor, 3 mucho peor. Para ítems de malestar, `z = CHANGE_GAIN · (negAffect − negAffectBase) + LEVEL_GAIN · (negAffect − NEG_REF) + o_i + ε`; la respuesta es `clamp(0, 3, 1 + round(z))`. Para ítems de bienestar (1, 3, 4, 7, 8, 12), `z` cambia de signo. `negAffectBase` sale de los 30 días anteriores.
- **R-005** [M] — **Muestra.** `N_SAMPLE = 50` personas vivas de 18 años o más, elegidas con una semilla fija (flujo `measure:sample`): estratos por sexo y grupo de edad (18–29, 30–44, 45–59, 60 o más), asignación proporcional al mundo en el momento de la primera toma y elección al azar dentro de cada estrato. Son **las mismas** en las tres tomas; si alguien muere entre tomas se anota, no se reemplaza.
- **R-006** [M] — **Tres tomas.** Toma 0: hoy (el minuto en que está el mundo); toma 1: 30 días después (43 200 min); toma 2: un año después de la toma 1 (525 600 min). Entre tomas el mundo avanza con su vida diaria normal (sin intervenir), sobre una copia de la base: el mundo del usuario no se toca.
- **R-007** [M] — **Informe.** Un libro de Excel (`.xlsx`) y un JSON con: una hoja de método; los participantes (id, nombre, sexo, edad, ocupación, estrato); las puntuaciones por persona, toma e instrumento (total, subescalas y banda de la ficha); las respuestas ítem a ítem; los indicadores de cada toma (la explicación de cada respuesta); los cambios entre tomas; estadísticos por instrumento y toma (media, desviación, mínimo, máximo y porcentaje sobre el corte); y los eventos entre tomas por persona.
- **R-008** [M] — **Determinismo.** Mismo mundo, misma muestra y mismas tomas dan la misma muestra, los mismos indicadores, las mismas `t_i`, disposiciones y `r_i`, byte a byte (023). El texto y la opción final del LLM se registran en `llm_records` (026 R-003): repetir la batería con el registro reproduce el informe sin red; con un proveedor `mock`, también es determinista.
- **R-009** [T] — **Honestidad.** Estas puntuaciones **no** son datos humanos: son salidas de un modelo [M] de cómo el estado de una persona simulada se refleja en una escala. Sirven para comprobar que el mundo produce perfiles coherentes (R-010) y para comparar tomas y personas; no validan el modelo. Cualquier uso externo debe citar esto (PA-155).
- **R-010** [M] — **Chequeo de cordura.** Con la muestra, el informe calcula las correlaciones entre instrumentos y avisa si no tienen el signo esperado: AAQ-II, GHQ-12, DASS-21 (total) y GPQ-9 correlacionan positivamente entre sí; SWLS, negativamente con AAQ-II, GHQ-12 y DASS-21.

## 4 bis. Indicadores y pesos (todos [M]; PA-155)
**Indicadores** (todos en [0,1]):

| Indicador | Cómo se calcula |
|---|---|
| `negAffect` | `0,35·estrés + 0,25·(1 − ánimo) + 0,20·max(tristeza, miedo) + 0,10·vergüenza + 0,10·rabia` |
| `energyLack`, `funLack`, `lonely` | `1 − energía`, `1 − diversión`, `1 − compañía` (necesidades de 010) |
| `moodBase`, `stressBase`, `negAffectBase` | media de la trayectoria de los 30 días anteriores a la toma |
| `avoidance` | media de las fuerzas de `evit.*` (039 R-004) respecto de su partida `AVOIDANCE_W0`, normalizada |
| `pnrLoad`, `pnrRecent` | carga del episodio de PNR abierto; episodios de los últimos 60 días ÷ 6 (tope 1) |
| `selfFraming` | fuerza de la respuesta `yo.enmarque` (flexibilidad aprendida) |
| `aversiveBurden` | media de la magnitud de las funciones **aversivas** de `verbal.abandono, burla, critica, culpa, desprecio, insulto, traicion, despido, deuda, no_pagar, llegar_tarde` |
| `approvalValue` | función de `verbal.aprobacion` ponderada por sus ensayos (cuánto la aprobación es un reforzador generalizado para ella) |
| `positiveContact` | media de las funciones apetitivas de `verbal.afecto, confidencia, dinero, trabajo`, `rol.pareja`, `cuerpo.disfrute` |
| `pliance`, `tracking` | peso (fuerza × contribución) de las reglas de cada tipo (038) sobre el total de reglas |
| `sensitivity` | `hist.variability` aprendida, combinada con el contraste positivo de sus reglas de *tracking* |
| `valueImportance`, `valueContact`, `valueGap` | importancia de sus dominios vitales (funciones `dominio.*`), contacto reciente con ellos (afición, trabajo y vínculos de los últimos 30 días) y `max(0, importancia − contacto)` |
| `jobStability`, `relationshipStability`, `socialNetwork`, `stressorExposure`, `economicTrajectory` | el perfil emergente del informe de vida (020 R-006); `null` se sustituye por 0,5 |
| `health` | `1 −` (enfermedad aguda, condiciones no controladas y deuda de sueño) |

**Constructos y pesos por instrumento** (cada ítem lleva además su sesgo `o_i` en [−0,1; 0,1], fijo en el catálogo del instrumento):
- **AAQ-II:** `inflexibilidad = 0,25·avoidance + 0,20·pnrRecent + 0,15·(1 − selfFraming) + 0,20·negAffect + 0,10·aversiveBurden + 0,10·valueGap`. Ítems 1, 4 (recuerdos dolorosos): `+ aversiveBurden`; 2, 5 (sentimientos): `+ negAffect`; 3, 7 (preocupaciones): `+ pnrRecent + stress`; 6 (los demás viven mejor): `0,5·inflexibilidad + 0,5·(1 − satisfacción)`.
- **GHQ-12:** R-004; ítems de concentración, sueño y decisión (1, 2, 4) pesan más el estrés y el sueño perdido; ítems 9 a 12 (ánimo y autoestima), el ánimo y `aversiveBurden`.
- **GPQ-9:** `pliance = 0,35·pliance + 0,30·approvalValue + 0,15·aversiveBurden + 0,10·(1 − sensitivity) + 0,10·lonely`. Ítems 1–4 y 8 (aprobación): `+ approvalValue`; 5 y 9 (decidir por otros): `+ pliance − tracking`; 6 y 7 (que los vean y reconozcan): `+ approvalValue + pliance`.
- **GTQ:** `trackingTendencia = 0,30·tracking + 0,25·sensitivity + 0,15·selfFraming + 0,15·(1 − pliance) + 0,15·(1 − avoidance)`. Ítems 1, 8, 10 (cambiar cuando no funciona): `+ sensitivity`; 2, 4, 6, 7 (explorar): `+ selfFraming`; 5, 11 (decidir por su experiencia): `+ tracking`; 9 (aprender de las consecuencias): `+ sensitivity`.
- **DASS-21:** `depresión = 0,30·(1 − ánimo) + 0,20·tristeza + 0,15·funLack + 0,15·aversiveBurden + 0,10·energyLack + 0,10·valueGap`; `ansiedad = 0,35·estrés + 0,30·miedo + 0,15·pnrLoad + 0,10·health⁻ + 0,10·vergüenza`; `estrés = 0,40·estrés + 0,20·rabia + 0,15·energyLack + 0,15·pnrRecent + 0,10·negAffect`. Ítem 17 (valer poco): `+ aversiveBurden`; 21 (vida sin sentido): `+ valueGap + (1 − valueContact)`; 10 y 16 (ilusión, entusiasmo): `+ funLack + valueGap`; 3 (sentimiento positivo): `+ (1 − joy) + (1 − ánimo)`; 5 (iniciativa): `+ energyLack`.
- **SWLS:** `satisfacción = 0,25·ánimo + 0,15·(1 − estrés) + 0,15·economicTrajectory + 0,10·jobStability + 0,10·relationshipStability + 0,10·valueContact + 0,05·health + 0,10·positiveContact`. Ítems 1 y 3: la satisfacción; 2 (ha logrado lo importante): `+ valueContact + economicTrajectory`; 4 (repetiría su vida): `+ resilience del perfil − stressorExposure`; 5 (circunstancias): `+ economicTrajectory + health`.

## 5. Eventos
No emite eventos: la medición no cambia el mundo (INV-001). Si más adelante se quiere dejar constancia, sería `MEASUREMENT_TAKEN` (fuera del hash, como la charla).

## 6. Invariantes
- **INV-001** — Medir no cambia el estado del mundo: el `stateHash` antes y después de una toma es el mismo.
- **INV-002** — Las respuestas de una persona solo dependen de su propio estado, de su historia y de su aprendizaje; ni del temperamento (009 R-006) ni de otras personas.
- **INV-003** — Toda respuesta está en el rango de su escala y toda puntuación se calcula con la corrección de la ficha.

## 7. Criterios de aceptación
- **CA-001** — *Dado* un vector de respuestas conocido de cada instrumento, *entonces* la corrección da la suma, las subescalas y la banda de la ficha (prueba de la corrección).
- **CA-002** — *Dado* el mismo mundo, la misma muestra y las mismas tomas, *entonces* el informe es idéntico (prueba de determinismo).
- **CA-003** — *Dado* un mundo generado, *entonces* medir no cambia su `stateHash` y la muestra son 50 personas de 18 años o más, vivas, sin repetir y con los cuatro estratos de edad representados (prueba sobre el mundo).
- **CA-004** — *Dadas* dos personas iguales salvo que una perdió su empleo y acumuló deuda, *entonces* la que sufrió la pérdida puntúa más alto en AAQ-II, GHQ-12 y DASS-21 y más bajo en SWLS (prueba con estados fabricados).
- **CA-005** — *Dadas* dos personas iguales salvo la fuerza de sus reglas *pliance* y su valor de la aprobación, *entonces* la de más pliance puntúa más alto en GPQ-9 y más bajo en GTQ (prueba con estados fabricados).
- **CA-006** — *Dada* una muestra de un mundo generado, *entonces* las correlaciones entre instrumentos tienen el signo de R-010 (chequeo de cordura; si falla, no se publica el informe sin avisarlo).
- **CA-008** — *Dadas* dos personas con el mismo estado, una con mucha vergüenza, valor de la aprobación y evitación y otra sin ellos, *entonces* la primera tiene más probabilidad de `minimiza` en los ítems de ánimo; y la de más carga aversiva y soledad, más de `exagera` (prueba de las probabilidades de R-011 con muchas tomas).
- **CA-009** — *Dado* un proveedor `mock` que devuelve una opción fuera del rango permitido, *entonces* el motor usa `r_i` y anota `corregida`; *dado* un proveedor caído, usa `r_i` con plantilla y anota `plantilla` (R-012, R-013).
- **CA-010** — *Dado* el prompt de un ítem, *entonces* no contiene `t_i` ni la verdad de lo que la persona no sabe: solo su vista, el ítem, el rango permitido y la disposición en palabras (INV-002).
- **CA-007** — *Dado* el informe, *entonces* cada respuesta tiene su toma y sus indicadores (explicación) y el Excel abre con sus hojas (prueba de la estructura del libro).

## 8. Parámetros y calibración
| Parámetro | Valor por defecto | Rango | Fuente / justificación |
|---|---|---|---|
| `N_SAMPLE` | 50 | 10–199 | petición del usuario (2026-10-05) |
| intervalo de las tomas | 30 días y 365 días | — | petición del usuario [M]: «hoy, avanzar un mes, avanzar un año» |
| `IMPRECISION_MAX` | 1 punto (2 en escalas de 7) | 0–3 | [M] error al *tactar* el propio estado (PA-155) |
| `P_BASE_MINIMIZA`, `P_BASE_EXAGERA`, `P_BASE_MIENTE` | 0,08; 0,05; 0,02 | 0–0,3 | [M] frecuencias base de respuesta no fiel; las modulan los indicadores de R-011 (PA-155) |
| `LLM_RANGE` | ±1 punto | 0–2 | [M] margen de interpretación del LLM alrededor de `r_i` |
| `EPS_ITEM` | 0,05 | 0–0,2 | [M] variabilidad de respuesta de un ítem a otro (PA-155) |
| `CHANGE_GAIN`, `LEVEL_GAIN`, `NEG_REF` (GHQ-12) | 4; 2,5; 0,30 | — | [M] cambio y nivel de malestar frente a «lo habitual» (PA-155) |
| `PNR_WINDOW_DAYS` | 60 | 7–365 | [M] ventana de los episodios recientes |
| `HABITUAL_DAYS` | 30 | 7–90 | [M] ventana del «habitual» del GHQ-12 |
| pesos de §4 bis | los de la tabla | — | [M] (PA-155; revisión con expertos) |

## 9. Métricas y observabilidad
Por instrumento y toma: media, desviación, mínimo, máximo y porcentaje sobre el corte; correlaciones entre instrumentos (R-010); y cuántas personas cambian de banda entre tomas.

## 10. Preguntas abiertas
- [ ] **PA-155** — ¿Qué pesos relacionan el estado de una persona con sus respuestas en cada ítem? Todo §4 bis es [M]. Qué resolvería la duda: datos de poblaciones colombianas con las seis pruebas y estudios sobre su estructura factorial (Ruiz y colaboradores; referencia a verificar).
- [ ] La toma 2 es un año después de la toma 1 (13 meses desde hoy). Si se prefiere «un año desde hoy», cambia solo el intervalo.
- [ ] ¿Se guardan las tomas en la base (como datos del laboratorio, fuera del hash) para repetirlas en el visor? Propuesta: no en esta entrega.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-10-05 | 0.1 | Borrador a petición del usuario: aplicar AAQ-II, GHQ-12, GPQ-9, GTQ, DASS-21 y SWLS a 50 personas adultas en tres tomas y entregar un Excel. Pendiente de aprobación |
| 2026-10-05 | 0.2 | El usuario aprueba y pide que las personas respondan **con el LLM, en estilo de charla**, y que algunas puedan mentir, exagerar o no *tactar* bien según su historia de aprendizaje. Se añaden R-011 (verdadero frente a dicho, disposición), R-012 (charla con el LLM validada por el motor), R-013 (sin LLM), CA-008 a CA-010 y sus parámetros; R-008 y INV-002 se ajustan. Informe: se guardan `t_i`, disposición, `r_i`, texto y opción |
| 2026-10-06 | 0.2 | Estado → aprobada |
| 2026-10-06 | 0.3 | Lo que reveló la implementación sobre un mundo real: (1) las emociones son transitorias y las funciones de aprobación saturan en 1, así que ánimo y estrés son los de la última semana de la trayectoria, las emociones se completan desde ellos y lo aversivo y la aprobación pesan por exposición (ensayos); (2) GHQ-12: las opciones de la ficha ya van de mejor a peor en todos los ítems, no hay cambio de signo en los positivos (corrige R-004); (3) «origen de la escala» fijo para GPQ-9, GTQ y AAQ-II (sin él salían en zona clínica para todos); (4) cada ítem usa `0,75·constructo + extras + sesgo + origen + ruido` (los «+ indicador» de §4 bis son extras de 0,05–0,2); (5) `lieFracStranger` 0,25; (6) límite nuevo: las reglas de *pliance*/*tracking* casi no varían entre personas (solo hay reglas de rutina) |
