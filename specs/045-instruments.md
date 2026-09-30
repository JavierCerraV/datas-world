---
id: 045
nombre: instruments
estado: borrador
hito: Capa de investigación (en paralelo al rediseño del visor; antes de la capa clínica 034)
depende_de: [010, 011, 013, 019, 020, 022, 023, 024, 025, 026, 027, 028, 034, 039, 040, 043]
version: 0.2
---

# 045 — Instrumentos psicológicos: encuestas a la población y selección de muestras

## 1. Propósito
Aplicar instrumentos psicológicos (escalas y cuestionarios) a la población simulada, guardar sus respuestas y estudiar cómo varían los resultados según la historia de vida. Encontrar a quienes cumplen criterios (por ejemplo, depresión moderada o grave en un cribado) y agregarlos a una muestra a la que luego se le aplica una terapia (034) o un experimento (028).

Es la puerta de entrada de la capa de investigación: la sección «Investigación» del visor (024 R-020) pasa de bloqueada a útil, con tres pasos (decisión del usuario, 2026-09-30):
- **a. Instrumento:** subir uno nuevo en PDF o elegir uno ya procesado de la biblioteca.
- **b. Aplicación:** elegir a quién se aplica: a todos, al azar, a los seleccionados o a una persona.
- **c. Resultados y muestra:** estadística de la aplicación, agrupación y selección de personas para agregarlas a una muestra.

Pregunta guía aplicada: si el mundo es creíble, un instrumento válido en humanos debería producir aquí **variabilidad**, **fiabilidad** razonable y **validez convergente** con la historia de cada persona. Si no la produce, es una señal sobre el motor, no sobre la persona.

## 2. Alcance
**Incluye:**
- subir un instrumento en PDF y convertirlo en una encuesta estructurada con un LLM, **con el modelo que se elija** (Haiku 4.5 por defecto), a través de la pasarela 026;
- la biblioteca de instrumentos ya procesados, reutilizables en cualquier mundo;
- la revisión humana obligatoria del instrumento y de la correspondencia de cada ítem con el estado del motor;
- la aplicación con cuatro formas de elegir a las personas (todos, al azar, seleccionados, individual);
- el almacenamiento de las respuestas y las puntuaciones;
- el análisis:
  - estadística descriptiva, distribución y categorías;
  - agrupación por variables de la persona y de su historia de vida;
  - fiabilidad interna y test-retest;
  - validez convergente;
- la selección de personas por criterios o a mano y su incorporación a muestras para 028 y 034.

**Fuera de alcance:**
- el diagnóstico clínico real;
- la aplicación a personas humanas;
- la estadística inferencial avanzada, que se exporta (019);
- las sesiones de terapia (034) y los experimentos con brazos (028), que consumen las muestras de esta spec.

## 3. Modelo de datos
```ts
/** Instrumento extraído de un PDF (o de la biblioteca) y revisado por una persona del equipo. */
interface Instrument {
  id: string;                    // INS-0001
  name: string;                  // «Cuestionario sobre la Salud del Paciente»
  acronym: string;               // «PHQ-9»
  construct: string;             // «síntomas depresivos»
  instructions: string;          // texto que se lee a la persona
  recallDays: number | null;     // ventana temporal («las últimas 2 semanas» → 14)
  items: InstrumentItem[];
  scoring: { method: 'sum' | 'mean'; subscales?: { name: string; items: number[] }[] };
  cutoffs: { min: number; max: number; label: string; severity: 0 | 1 | 2 | 3 | 4 }[]; // «moderada» 10–14
  minAge: number;                // 18 por defecto
  origin: 'pdf' | 'biblioteca';  // R-013
  source: { file: string; sha256: string; pages: number; license: string } | null;     // licencia declarada por quien lo sube
  extraction: { provider: string; model: string; recordIds: string[]; costMicroUsd: number; at: string } | null; // registro de la pasarela (026)
  status: 'extraido' | 'revisado' | 'retirado';
  reviewedBy: string | null;
  version: number;               // sube con cada corrección tras la revisión
}
interface InstrumentItem {
  n: number;
  text: string;
  options: { label: string; value: number }[];
  reversed: boolean;
  /** Indicadores del motor que responden este ítem, con su peso y su signo (R-004). La propone el LLM y la confirma una persona. */
  mapping: { indicator: IndicatorKey; weight: number }[];
  page: number | null;           // página del PDF de donde sale (cita)
}
/** Catálogo cerrado de indicadores que el motor sabe calcular en una ventana de días (R-004). */
type IndicatorKey = string;      // p. ej. 'animo_bajo', 'anhedonia', 'sueno_alterado', 'energia_baja', 'culpa', 'rumiacion', 'aislamiento', 'estres'

/** A quién se aplica (R-007). */
type Selection =
  | { kind: 'todos' }                                        // todas las personas vivas con edad ≥ minAge
  | { kind: 'azar'; n: number; strata?: GroupVar[] }         // muestra aleatoria simple o estratificada, con semilla
  | { kind: 'seleccionados'; citizens: EntityId[]; from?: string } // lista a mano, de un filtro o de una muestra (SMP-…)
  | { kind: 'individual'; citizen: EntityId };

interface Administration {
  id: string;                    // ADM-0001
  instrument: string;            // INS-0001
  instrumentVersion: number;
  at: WorldMinute;
  selection: Selection;
  resolved: EntityId[];          // personas que la aplicación incluyó, en orden de id
  excluded: { citizen: EntityId; reason: 'menor' | 'fallecido' | 'no_existe' }[];
  mode: 'observacion' | 'en_el_mundo'; // R-008
  seed: number;
  engineVersion: string;
}
interface Response {
  administration: string;
  citizen: EntityId;
  answers: { n: number; value: number; basis: { indicator: IndicatorKey; value: number }[] }[];
  score: number;
  subscores?: Record<string, number>;
  category: string;              // etiqueta del punto de corte
  style: { acquiescence: number; desirability: number; noise: number }; // R-006
}
/** Variables por las que se agrupan los resultados (R-009). */
type GroupVar = 'sexo' | 'edad' | 'barrio' | 'estrato' | 'ocupacion' | 'hogar_tamano' | 'categoria'
  | `evento:${string}`;          // «tuvo alguna vez» un tipo de evento: evento:JOB_LOST, evento:BEREAVEMENT…

/** Muestra para 028 o 034 (R-010). */
interface Sample {
  id: string;                    // SMP-0001
  name: string;
  purpose: string;               // «Terapia ACT para depresión moderada»
  members: {
    citizen: EntityId;
    addedAt: string;             // fecha real de la investigadora
    via: { administration: string | null; rule: string }; // «PHQ-9 ≥ 10 y evento:JOB_LOST» o «a mano»
    removed?: { at: string; reason: string };
  }[];
  createdAt: string;
}
```
Coste: ≈ 50 B por respuesta a un ítem. 180 adultos × 9 ítems × 12 aplicaciones al año ≈ 1 MB al año por instrumento, en SQLite (027); nada en la memoria del worker.

## 4. Reglas
### a. Instrumento
- **R-001** [M] — **Ingesta desde PDF con el modelo elegido.**
  - El investigador sube un PDF en «Investigación › Instrumentos» y elige el modelo en una lista.
  - La lista sale de la configuración de la pasarela: el propósito nuevo `instrument` de `config/llm.json` (026 R-006) da el modelo por defecto (`claude-haiku-4-5`) y `instrumentModels` enumera los permitidos (proveedor y modelo). Cambiar la lista no requiere tocar código.
  - La API envía el PDF por la pasarela como bloque `document` en base64 a los proveedores que lo admiten (Anthropic). Para los demás (`openai_compatible`), envía el texto extraído del PDF, página a página, para no perder la cita (ver §10).
  - Pide una salida estructurada con el esquema `Instrument` sin `mapping`. Cada ítem cita su página.
  - La respuesta se valida con Zod en el borde (CLAUDE.md §3). Si no valida, se reintenta una vez; si sigue sin validar, se muestra el error sin guardar nada.
  - Se guarda el registro de la pasarela (proveedor, modelo, tokens, coste y hash del PDF). La clave incluye el modelo: el mismo PDF con el mismo modelo no se vuelve a pagar, y con otro modelo sí se puede volver a procesar para comparar.
- **R-002** [M] — **Correspondencia con el motor.**
  - En una segunda llamada, con el mismo modelo, el LLM propone para cada ítem los indicadores del catálogo cerrado (R-004) que lo responden, con peso y signo, y una justificación de una línea.
  - Un ítem sin indicador razonable queda marcado «sin base en el motor» y no puntúa, pero se informa.
  - El LLM nunca inventa indicadores fuera del catálogo: el esquema lo impide.
- **R-003** [M] — **Revisión humana obligatoria.**
  - Un instrumento solo se puede aplicar en estado `revisado`.
  - En la revisión se leen, junto al PDF: los ítems, las opciones, los puntos de corte, la ventana temporal y la correspondencia.
  - Se puede corregir cualquier campo; cada corrección tras la revisión sube `version`, y las aplicaciones guardan la versión que usaron.
  - Quién lo revisó queda registrado.
- **R-013** [M] — **Biblioteca.**
  - Todo instrumento revisado queda en la biblioteca y se puede elegir en cualquier mundo sin volver a procesar el PDF.
  - La biblioteca se guarda fuera del mundo (`data/instruments.db`), porque un instrumento no pertenece a un mundo; las aplicaciones y respuestas sí (027).
  - El repositorio trae ya procesados y revisados los instrumentos de libre uso que el usuario apruebe (§10), en `catalogs/instruments/` con su licencia y su fuente.
  - Un instrumento se puede retirar (`retirado`): deja de ofrecerse, pero sus aplicaciones pasadas siguen legibles.
- **R-004** [M] — **Indicadores.** Catálogo versionado (`catalogs/indicators.json`). Cada indicador es una función pura sobre el estado y el historial de una persona en una ventana de `recallDays` días, con valor en [0,1]. Ejemplos:
  - ánimo bajo: media de `1 − state.mood` en la trayectoria;
  - anhedonia: caída de la tasa de actividades reforzantes frente a su línea base (036);
  - sueño alterado: `OVERSLEPT` y la deuda de sueño;
  - energía baja: `need.energy`;
  - culpa o vergüenza: `emo.shame`;
  - rumiación: episodios `PNR_EPISODE` (039);
  - aislamiento: encuentros y trato de sus vínculos (012);
  - estrés: `state.stress`.

  Lo que el motor no modela todavía (por ejemplo, el apetito como síntoma o la ideación suicida) no se aproxima: queda «sin base» y se registra en `docs/investigacion/preguntas-abiertas.md`.

### b. Aplicación
- **R-005** [M] — **Respuesta de la persona.** Para cada ítem, la intensidad latente es la suma ponderada de sus indicadores. La opción elegida es la de valor más cercano a la intensidad escalada al rango del ítem, tras aplicar:
  - el estilo de respuesta de la persona (R-006);
  - un ruido pequeño del flujo RNG `sys:instrument/<adm>/<cit>` (023).

  Misma semilla y mismo mundo dan las mismas respuestas (CLAUDE.md, regla 2). Cada respuesta guarda los indicadores y valores que la produjeron: así el «¿por qué respondió 2?» se puede explicar (019).
- **R-006** [T] — **Estilo de respuesta.** Aquiescencia, deseabilidad social y precisión salen del temperamento (009) y de la historia de la persona, no del azar. Por ejemplo, una persona con historia de castigo por quejarse infraestima sus síntomas. Esto produce la diferencia entre el estado del motor y la puntuación, que es lo que hace útil al instrumento.
- **R-007** [M] — **A quién se aplica.** El investigador elige una de cuatro formas:
  - **Todos:** todas las personas vivas con edad ≥ `minAge` en el minuto de la aplicación.
  - **Al azar:** `n` personas elegibles por muestreo aleatorio simple o estratificado (por sexo, grupo de edad, barrio…), con el flujo RNG `sys:instrument/<adm>/muestreo`. La semilla se guarda y se muestra; la misma semilla da la misma muestra.
  - **Seleccionados:** una lista de personas elegida a mano en la población, sacada de un filtro sobre la población o tomada de una muestra existente (`SMP-…`), por ejemplo para medir el antes y el después de una terapia.
  - **Individual:** una persona, también desde su expediente («Aplicar instrumento»).

  En todos los casos se excluye y se informa a quien no cumple `minAge` o ha fallecido. La aplicación guarda la selección pedida y la lista resuelta. Se puede repetir (test-retest) y programar (por ejemplo, cada 30 días) desde el visor o la CLI (`pnpm cli instrument:apply INS-0001 --todos`, `--azar 50 --estratos sexo,edad`, `--muestra SMP-0001`, `--persona CIT-000019`).
- **R-008** [M] — **Modo de aplicación.**
  - `observacion` (por defecto): el mundo no se entera. No hay evento en la vida de la persona ni recuerdo, como un sensor.
  - `en_el_mundo`: la persona «responde a una encuesta». Se emite `INSTRUMENT_ANSWERED` con sus causas y, si la historia lo hace saliente, deja un recuerdo (013). Sirve para estudiar la reactividad a la medición.

### c. Resultados y muestra
- **R-009** [M] — **Estadística y agrupación.** Para cada aplicación, el visor muestra:
  - **Descriptiva:** n aplicado y excluidos; media, desviación típica, mediana, cuartiles, mínimo y máximo; distribución de puntuaciones con los puntos de corte; número y porcentaje por categoría. Igual por ítem y por subescala.
  - **Agrupación:** las mismas cifras por una o dos variables (`GroupVar`): sexo, grupo de edad, barrio, estrato, ocupación, tamaño del hogar, categoría, y «tuvo alguna vez» un evento de su historia (infancia 030, duelo, desempleo, deudas, migración…). Por grupo: n, media, DT y porcentaje que cumple el criterio, con la diferencia de medias y la *d* de Cohen como tamaño del efecto, sin pruebas de significación (fuera de alcance).
  - **Calidad:** alfa de Cronbach, correlación ítem-total, correlación test-retest si la misma persona tiene dos aplicaciones, y validez convergente (correlación con el ánimo medio del motor y con otros instrumentos aplicados).
  - **Tabla de personas:** puntuación, categoría y variables de agrupación, ordenable y filtrable, con enlace al expediente y al «¿por qué respondió así?» (R-005).

  Todo se exporta en CSV con los metadatos de la aplicación (semilla, versión del motor, instrumento y su versión, y modelo de la ingesta).
- **R-010** [M] — **Selección y muestra.**
  - Se seleccionan personas con reglas sobre la puntuación, la categoría y las variables de agrupación (por ejemplo, «PHQ-9 ≥ 10 y evento:JOB_LOST»), haciendo clic en un grupo o en una barra de la distribución, o a mano en la tabla. El visor muestra cuántas personas cumplen antes de confirmar.
  - «Agregar a la muestra» las incorpora a una muestra nueva o existente. Cada miembro guarda de qué aplicación y con qué regla entró, y cuándo.
  - Una muestra se puede ampliar desde otras aplicaciones y se pueden retirar miembros con un motivo; nunca se borra un miembro, se marca retirado (regla 6).
  - La lista de miembros no se recalcula sola: es lo que el investigador decidió (ver §10).
  - Las muestras las usan 034 (terapia) y 028 (brazos de un experimento). El visor marca en el expediente de cada persona los instrumentos que respondió y las muestras en que está.
- **R-011** [T] — **Lenguaje y ética.**
  - En toda la interfaz se dice «cribado simulado» y «cumple criterios del instrumento», nunca «diagnóstico».
  - Quien sube un instrumento declara su licencia; el visor avisa de que algunos instrumentos tienen derechos de autor.
  - Los resultados son de personas simuladas y no se interpretan como evidencia sobre personas reales.
- **R-012** [M] — **Costes.** La ingesta de un instrumento son dos llamadas al modelo elegido, guardadas en caché por el hash del PDF y el modelo. El visor muestra el coste estimado antes de procesar y el real después (026 R-004, presupuesto). Aplicar un instrumento no llama al LLM (R-005): cuesta cero y es determinista.

## 4 bis. Estatus epistémico
- R-005 y R-006 son supuestos de modelado ([M], [T]): la teoría de la respuesta al ítem y los sesgos de respuesta están bien descritos en la literatura (referencias a verificar). Su parametrización para personas simuladas es propia y debe validarse con las métricas de §9.
- La calidad de la extracción depende del modelo elegido; por eso la revisión humana (R-003) es obligatoria con cualquier modelo.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `INSTRUMENT_ANSWERED` | Solo en modo `en_el_mundo` (R-008) | `{ citizenId, administration, instrument, score, category }` | la aplicación (entrada externa), los indicadores de mayor peso |

El modo `observacion` no emite eventos del mundo: sus resultados viven en las tablas de la capa de investigación (027). Tampoco los emite agregar a una muestra: la muestra es una decisión del investigador, no algo que le pase a la persona.

## 6. Invariantes
- **INV-001** — Aplicar en modo `observacion` no cambia el `stateHash` del mundo.
- **INV-002** — Toda respuesta se reproduce exactamente a partir de su aplicación (semilla, instante, versión del motor, instrumento y su versión). Lo mismo la lista resuelta de una aplicación al azar.
- **INV-003** — Ningún ítem puntúa con un indicador fuera del catálogo, y ningún instrumento sin revisar se aplica.
- **INV-004** — Ningún miembro de una muestra se borra; solo se marca retirado con su motivo.

## 7. Criterios de aceptación
- **CA-001** — *Dado* un PDF de ejemplo y la pasarela en modo `mock`, *entonces* el instrumento extraído valida el esquema, cita páginas, guarda el proveedor y el modelo usados y queda en estado `extraido`.
- **CA-002** — *Dado* un instrumento `extraido`, *entonces* no se puede aplicar hasta que alguien lo revise.
- **CA-003** — *Dado* un mundo y un instrumento revisado, *cuando* se aplica dos veces con la misma semilla en el mismo minuto, *entonces* las respuestas son idénticas; en modo `observacion`, el `stateHash` no cambia.
- **CA-004** — *Dado* el mundo de ejemplo tras 60 días, *entonces* las puntuaciones de un cribado de depresión tienen varianza (no todos en la misma categoría) y al menos una persona en la categoría moderada o superior. Si no, es una alerta sobre el motor (§9).
- **CA-005** — *Dado* el mundo de ejemplo, *entonces* la puntuación correlaciona positivamente con `1 − ánimo` medio de la ventana (validez convergente), y el alfa de Cronbach se informa.
- **CA-006** — *Dado* un criterio «puntuación ≥ 10», *entonces* agregar a la muestra incorpora exactamente a las personas que lo cumplen, cada una con su aplicación y su regla, y la muestra queda disponible para 034.
- **CA-007** — *Dado* un mismo PDF, *cuando* se procesa con dos modelos distintos de la lista, *entonces* hay dos extracciones con su modelo registrado; y *cuando* se repite con el mismo modelo, *entonces* sale del registro sin llamada nueva.
- **CA-008** — *Dadas* las cuatro formas de selección, *entonces*: «todos» resuelve a todos los vivos con edad ≥ `minAge`; «al azar» con `n` y la misma semilla da la misma lista de `n` personas, y con estratos respeta las proporciones de la población (±1 por estrato); «seleccionados» desde una muestra resuelve a sus miembros no retirados; «individual» resuelve a una persona. Los menores y fallecidos quedan en `excluded` con su motivo.
- **CA-009** — *Dada* una aplicación, *entonces* la estadística descriptiva coincide con un cálculo de referencia, y la agrupación por sexo y por `evento:JOB_LOST` da n, medias y *d* correctos; los grupos suman el total.
- **CA-010** — *Dado* un instrumento de la biblioteca, *entonces* se puede aplicar en otro mundo sin llamar al LLM.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto | Rango | Fuente / justificación |
|---|---|---|---|
| Modelo de ingesta (propósito `instrument`) | Anthropic `claude-haiku-4-5` | cualquiera de `instrumentModels` | decisión del usuario (2026-09-30): Haiku por defecto, cualquier modelo configurable |
| `minAge` | 18 | 14–18 | mayoría de edad en Colombia |
| Ruido de respuesta | 0,05 | 0–0,2 | [M], por calibrar con el test-retest |
| Aplicación periódica | cada 30 días | — | [M] |
| Tolerancia de estratos (CA-008) | ±1 persona por estrato | — | redondeo de la asignación proporcional |

## 9. Métricas y observabilidad
- Distribución de puntuaciones por aplicación; alerta si más del 90 % cae en una sola categoría.
- Alfa de Cronbach por instrumento; alerta si es < 0,6 (el mundo o la correspondencia no sostienen el constructo).
- Correlación test-retest a 30 días.
- Coste acumulado de la ingesta por modelo (026), y comparación de extracciones del mismo PDF con modelos distintos.

## 10. Preguntas abiertas
- [x] ~~¿Qué modelo procesa el PDF?~~ Cualquiera de la lista configurable; Haiku 4.5 por defecto (usuario, 2026-09-30).
- [x] ~~¿Las muestras se congelan o se recalculan con cada aplicación?~~ Se congelan: son las personas que el investigador agrega, con su procedencia, y se pueden ampliar o retirar a mano (usuario, 2026-09-30: «agrupar para seleccionar y agregar a la muestra»).
- [ ] ¿Qué instrumentos se procesan primero y se incluyen en la biblioteca del repositorio? Propuesta: PHQ-9 (depresión) y GAD-7 (ansiedad), de libre uso. El BDI-II y otros con derechos de autor, solo si quien los sube declara la licencia, y no se incluyen en el repositorio.
- [ ] Para proveedores que no aceptan PDF, ¿extraer el texto en local? Requiere una dependencia de lectura de PDF (por ejemplo `unpdf`, ≈ 1 MB, solo en la API). Alternativa: ofrecer solo modelos que acepten PDF.
- [ ] ¿Solo el modo determinista (R-005), o también un modo «entrevista» en el que el LLM responde en la voz de la persona con su vista subjetiva (043)? Es más natural, pero cuesta dinero, no es determinista y hay que validarlo contra R-005.
- [ ] ¿Qué indicadores faltan en el motor para los instrumentos prioritarios (depresión, ansiedad, estrés percibido, flexibilidad psicológica como el AAQ-II)? Por ejemplo, el apetito como síntoma, la ideación suicida y la preocupación.
- [ ] ¿El modo `en_el_mundo` debe afectar a la persona (reactividad a la medición) o solo dejar un recuerdo?

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-30 | 0.1 | Borrador inicial a partir de la propuesta del usuario (encuestas desde PDF con Haiku 4.5, aplicación a los adultos, análisis por historia de vida y reclutamiento para terapia). Pendiente de desarrollar después del rediseño del visor |
| 2026-09-30 | 0.2 | Precisiones del usuario:<br>- el modelo de la ingesta es configurable (propósito `instrument` y lista `instrumentModels` de la pasarela; Haiku 4.5 por defecto; R-001, CA-007);<br>- biblioteca de instrumentos ya procesados (R-013, CA-010);<br>- cuatro formas de aplicar: todos, al azar (simple o estratificado), seleccionados e individual (R-007, CA-008);<br>- estadística descriptiva y agrupación por variables e historia de vida, con tamaño del efecto (R-009, CA-009);<br>- selección por reglas o a mano y «Agregar a la muestra» con procedencia de cada miembro (R-010, INV-004).<br>Se desarrolla en paralelo a la elección del rediseño; la pantalla adoptará el estilo elegido |
