---
id: 045
nombre: instruments
estado: borrador
hito: Capa de investigación (después del rediseño del visor; antes de la capa clínica 034)
depende_de: [010, 011, 013, 019, 020, 022, 023, 025, 026, 027, 028, 034, 039, 040, 043]
version: 0.1
---

# 045 — Instrumentos psicológicos: encuestas a la población

## 1. Propósito
Aplicar instrumentos psicológicos (escalas y cuestionarios) a la población simulada, guardar sus respuestas y estudiar cómo varían los resultados según la historia de vida. Encontrar a quienes cumplen criterios (por ejemplo, depresión moderada o grave en un cribado) y reclutarlos como muestra para un estudio o una terapia (034).

Es la puerta de entrada de la capa de investigación: el menú «Investigación» del visor (024 R-020) pasa de bloqueado a útil. Propuesta del usuario del 2026-09-30: «subir un PDF que se procese con Haiku 4.5 para convertirlo en una encuesta, aplicarla a todas las personas mayores de edad y almacenar sus resultados para probar cómo varían según la historia de vida».

Pregunta guía aplicada: si el mundo es creíble, un instrumento válido en humanos debería producir aquí **variabilidad**, **fiabilidad** razonable y **validez convergente** con la historia de cada persona. Si no la produce, es una señal sobre el motor, no sobre la persona.

## 2. Alcance
**Incluye:**
- subir un instrumento en PDF y convertirlo en una encuesta estructurada con un LLM (Haiku 4.5, a través de la pasarela 026);
- la revisión humana obligatoria del instrumento y de la correspondencia de cada ítem con el estado del motor;
- la aplicación a todas las personas vivas mayores de edad, o a una cohorte;
- el almacenamiento de las respuestas y las puntuaciones;
- el análisis:
  - distribución y categorías;
  - diferencias según la historia de vida;
  - fiabilidad interna y test-retest;
  - validez convergente;
- la selección de cohortes por criterios, que se guardan como muestras para 028 y 034.

**Fuera de alcance:**
- el diagnóstico clínico real;
- la aplicación a personas humanas;
- la estadística inferencial avanzada, que se exporta (019);
- las sesiones de terapia (034) y los experimentos con brazos (028), que consumen las muestras de esta spec.

## 3. Modelo de datos
```ts
/** Instrumento extraído de un PDF y revisado por una persona del equipo. */
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
  source: { file: string; sha256: string; pages: number; license: string };            // licencia declarada por quien lo sube
  extraction: { model: string; recordId: string; at: string };                          // registro de la pasarela (026)
  status: 'extraido' | 'revisado' | 'retirado';
  reviewedBy: string | null;
}
interface InstrumentItem {
  n: number;
  text: string;
  options: { label: string; value: number }[];
  reversed: boolean;
  /** Indicadores del motor que responden este ítem, con su peso y su signo (R-004). La propone el LLM y la confirma una persona. */
  mapping: { indicator: IndicatorKey; weight: number }[];
  page: number;                  // página del PDF de donde sale (cita)
}
/** Catálogo cerrado de indicadores que el motor sabe calcular en una ventana de días (R-004). */
type IndicatorKey = string;      // p. ej. 'animo_bajo', 'anhedonia', 'sueno_alterado', 'energia_baja', 'apetito', 'culpa', 'concentracion', 'rumiacion', 'aislamiento', 'estres'

interface Administration {
  id: string;                    // ADM-0001
  instrument: string;
  at: WorldMinute;
  cohort: string | 'adultos';
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
interface Sample {               // muestra guardada para 028 o 034
  id: string; name: string; criteria: string; administration: string; citizens: EntityId[]; createdAt: string;
}
```
Coste: ≈ 50 B por respuesta a un ítem. 180 adultos × 9 ítems × 12 aplicaciones al año ≈ 1 MB al año por instrumento, en SQLite (027); nada en la memoria del worker.

## 4. Reglas
- **R-001** [M] — **Ingesta desde PDF.**
  - El investigador sube un PDF en «Investigación › Instrumentos».
  - La API lo envía a la pasarela LLM (026) con el modelo `claude-haiku-4-5`, como bloque `document` en base64, y pide una salida estructurada (`output_config.format`) con el esquema `Instrument` sin `mapping`.
  - Cada ítem cita la página de donde sale.
  - La respuesta se valida con Zod en el borde (CLAUDE.md §3). Si no valida, se reintenta una vez y, si sigue sin validar, se muestra el error sin guardar nada.
  - Se guarda el registro de la pasarela: coste, tokens y hash del PDF, para no volver a pagar el mismo archivo.
- **R-002** [M] — **Correspondencia con el motor.**
  - En una segunda llamada, Haiku propone para cada ítem los indicadores del catálogo cerrado (R-004) que lo responden, con peso y signo, y una justificación de una línea.
  - Un ítem sin indicador razonable queda marcado «sin base en el motor» y no puntúa, pero se informa.
  - El LLM nunca inventa indicadores fuera del catálogo: el esquema lo impide.
- **R-003** [M] — **Revisión humana obligatoria.**
  - Un instrumento solo se puede aplicar en estado `revisado`.
  - En la revisión se leen, junto al PDF: los ítems, las opciones, los puntos de corte, la ventana temporal y la correspondencia.
  - Se puede corregir cualquier campo.
  - Quién lo revisó queda registrado.
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
- **R-005** [M] — **Respuesta de la persona.** Para cada ítem, la intensidad latente es la suma ponderada de sus indicadores. La opción elegida es la de valor más cercano a la intensidad escalada al rango del ítem, tras aplicar:
  - el estilo de respuesta de la persona (R-006);
  - un ruido pequeño del flujo RNG `sys:instrument/<adm>/<cit>` (023).

  Misma semilla y mismo mundo dan las mismas respuestas (CLAUDE.md, regla 2). Cada respuesta guarda los indicadores y valores que la produjeron: así el «¿por qué respondió 2?» se puede explicar (019).
- **R-006** [T] — **Estilo de respuesta.** Aquiescencia, deseabilidad social y precisión salen del temperamento (009) y de la historia de la persona, no del azar. Por ejemplo, una persona con historia de castigo por quejarse infraestima sus síntomas. Esto produce la diferencia entre el estado del motor y la puntuación, que es lo que hace útil al instrumento.
- **R-007** [M] — **Aplicación.** Una aplicación sobre «adultos» incluye a todas las personas vivas con edad ≥ `minAge` en el minuto de la aplicación. Se puede repetir (test-retest) y programar (por ejemplo, cada 30 días) desde el visor o la CLI (`pnpm cli instrument:apply INS-0001 --cohort adultos`).
- **R-008** [M] — **Modo de aplicación.**
  - `observacion` (por defecto): el mundo no se entera. No hay evento en la vida de la persona ni recuerdo, como un sensor.
  - `en_el_mundo`: la persona «responde a una encuesta». Se emite `INSTRUMENT_ANSWERED` con sus causas y, si la historia lo hace saliente, deja un recuerdo (013). Sirve para estudiar la reactividad a la medición.
- **R-009** [M] — **Análisis.** Para cada aplicación, el visor muestra:
  - la distribución de puntuaciones y el porcentaje por categoría;
  - las puntuaciones según variables de la historia de vida: eventos de la infancia (030), duelo, desempleo, deudas, apego (012), estrato, barrio, sexo y edad;
  - la fiabilidad interna (alfa de Cronbach) y la correlación test-retest si hay dos aplicaciones;
  - la validez convergente: correlación con el ánimo medio del motor y con otros instrumentos aplicados.

  Todo se exporta en CSV con los metadatos de la aplicación (semilla, versión del motor e instrumento).
- **R-010** [M] — **Criterios y reclutamiento.** Una muestra se define con criterios sobre las puntuaciones (por ejemplo, «PHQ-9 ≥ 10» o «categoría moderada o más») y, si se quiere, sobre la historia de vida. Se guarda como `Sample` con la lista congelada de personas. Las muestras las usan 034 (sesiones y terapia) y 028 (brazos de un experimento). El visor marca en el expediente de cada persona los instrumentos que respondió y las muestras en que está.
- **R-011** [T] — **Lenguaje y ética.**
  - En toda la interfaz se dice «cribado simulado» y «cumple criterios del instrumento», nunca «diagnóstico».
  - Quien sube un instrumento declara su licencia; el visor avisa de que algunos instrumentos tienen derechos de autor.
  - Los resultados son de personas simuladas y no se interpretan como evidencia sobre personas reales.
- **R-012** [M] — **Costes.** La ingesta de un instrumento son dos llamadas a Haiku 4.5 (unos pocos céntimos de dólar), guardadas en caché por el hash del PDF. Aplicar un instrumento no llama al LLM (R-005): cuesta cero y es determinista.

## 4 bis. Estatus epistémico
- R-005 y R-006 son supuestos de modelado ([M], [T]): la teoría de la respuesta al ítem y los sesgos de respuesta están bien descritos en la literatura (referencias a verificar). Su parametrización para personas simuladas es propia y debe validarse con las métricas de §9.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `INSTRUMENT_ANSWERED` | Solo en modo `en_el_mundo` (R-008) | `{ citizenId, administration, instrument, score, category }` | la aplicación (entrada externa), los indicadores de mayor peso |

Los modos `observacion` no emiten eventos del mundo: sus resultados viven en las tablas de la capa de investigación (027).

## 6. Invariantes
- **INV-001** — Aplicar en modo `observacion` no cambia el `stateHash` del mundo.
- **INV-002** — Toda respuesta se reproduce exactamente a partir de su aplicación (semilla, instante, versión del motor e instrumento).
- **INV-003** — Ningún ítem puntúa con un indicador fuera del catálogo, y ningún instrumento sin revisar se aplica.

## 7. Criterios de aceptación
- **CA-001** — *Dado* un PDF de ejemplo y la pasarela en modo `mock`, *entonces* el instrumento extraído valida el esquema, cita páginas y queda en estado `extraido`.
- **CA-002** — *Dado* un instrumento `extraido`, *entonces* no se puede aplicar hasta que alguien lo revise.
- **CA-003** — *Dado* un mundo y un instrumento revisado, *cuando* se aplica dos veces con la misma semilla en el mismo minuto, *entonces* las respuestas son idénticas; en modo `observacion`, el `stateHash` no cambia.
- **CA-004** — *Dado* el mundo de ejemplo tras 60 días, *entonces* las puntuaciones de un cribado de depresión tienen varianza (no todos en la misma categoría) y al menos una persona en la categoría moderada o superior. Si no, es una alerta sobre el motor (§9).
- **CA-005** — *Dado* el mundo de ejemplo, *entonces* la puntuación correlaciona positivamente con `1 − ánimo` medio de la ventana (validez convergente), y el alfa de Cronbach se informa.
- **CA-006** — *Dado* un criterio «puntuación ≥ 10», *entonces* la muestra guardada contiene exactamente a las personas que lo cumplen y queda disponible para 034.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto | Rango | Fuente / justificación |
|---|---|---|---|
| Modelo de ingesta | `claude-haiku-4-5` | — | decisión del usuario (2026-09-30) |
| `minAge` | 18 | 14–18 | mayoría de edad en Colombia |
| Ruido de respuesta | 0,05 | 0–0,2 | [M], por calibrar con el test-retest |
| Aplicación periódica | cada 30 días | — | [M] |

## 9. Métricas y observabilidad
- Distribución de puntuaciones por aplicación; alerta si más del 90 % cae en una sola categoría.
- Alfa de Cronbach por instrumento; alerta si es < 0,6 (el mundo o la correspondencia no sostienen el constructo).
- Correlación test-retest a 30 días.
- Coste acumulado de la ingesta (026).

## 10. Preguntas abiertas
- [ ] ¿Solo el modo determinista (R-005), o también un modo «entrevista» en el que el LLM responde en la voz de la persona con su vista subjetiva (043)? Es más natural, pero cuesta dinero, no es determinista y hay que validarlo contra R-005.
- [ ] ¿Qué indicadores faltan en el motor para los instrumentos prioritarios (depresión, ansiedad, estrés percibido, flexibilidad psicológica como el AAQ-II)? Por ejemplo, el apetito como síntoma, la ideación suicida y la preocupación.
- [ ] ¿Qué instrumentos se usarán primero y con qué licencias? El PHQ-9 y el GAD-7 son de libre uso; el BDI-II no.
- [ ] ¿El modo `en_el_mundo` debe afectar a la persona (reactividad a la medición) o solo dejar un recuerdo?
- [ ] ¿Las muestras se congelan (lista fija) o se recalculan con cada aplicación?

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-30 | 0.1 | Borrador inicial a partir de la propuesta del usuario (encuestas desde PDF con Haiku 4.5, aplicación a los adultos, análisis por historia de vida y reclutamiento para terapia). Pendiente de desarrollar después del rediseño del visor |
