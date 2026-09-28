---
id: 013
nombre: memory
estado: borrador
hito: M3
depende_de: [012, 014, 019, 021, 023, 027, 036, 037, 039, 041, 043]
version: 0.3
---

# 013 — Memoria autobiográfica sobre el motor funcional

## 1. Propósito
Lo que cada persona recuerda de lo vivido: subjetivo, con valencia e intensidad, que se olvida y se reconstruye. Distinto de la historia objetiva (020) y del registro de eventos (014): el registro guarda lo que pasó; la memoria, lo que la persona conserva de ello y cómo.

Reescritura según la 035 §8 (ADR-007). El recuerdo no es una copia del hecho ni un rasgo de «buena memoria»:
- un episodio es un **registro de contingencias** (036 R-011): en qué contexto, con quién, qué hizo la persona y qué recibió;
- lo que lo hace memorable es la **función que tiene para esa persona** lo que ocurrió (036), no una importancia fija del tipo de evento: perder el empleo no pesa igual para todos;
- recordar es volver a entrar en contacto con esos estímulos, y cada vez el recuerdo se **reconstruye** con la función que tienen hoy (Bartlett; reconsolidación): si hoy A detesta a B, recuerda peor lo vivido con B;
- lo que se repite se generaliza en **relaciones aprendidas** (037): «con Laura suelo discutir» es una relación `cit.Laura → verbal.critica` consolidada por la experiencia, no una estructura aparte;
- la vida se divide en **capítulos** subjetivos, con el tono que la persona les da.

Así se puede responder a la pregunta guía desde dentro: *¿qué recuerda esta persona de cómo llegó aquí, y en qué se equivoca?*

## 2. Alcance
**Incluye:**
- la codificación de episodios desde los eventos en que participa, desde las charlas (043) y desde su desarrollo (041);
- el decaimiento, el olvido y el tope en memoria;
- la recuperación puntuada y determinista (`recall`), con el sesgo del ánimo;
- la reconstrucción (distorsión) al recordar, y el repaso por el pensamiento repetitivo (039);
- la consolidación de episodios repetidos en relaciones de la red (037);
- los capítulos autobiográficos, incluidos los del pasado desde la historia (030, 041).

**Fuera de alcance:**
- lo que la persona cree sobre hechos y los rumores (025);
- la historia objetiva y la comparación verdad/recuerdo (020);
- la narración con LLM (026): aquí solo se decide qué recuerda; la charla (043) lo recibe como contexto.

## 3. Modelo de datos
```ts
/** Episodio (capa 1): registro de contingencias de un hecho vivido, contado u ocurrido en sesión. */
interface Memory {
  id: string;            // MEM-… por persona (orden de creación)
  event?: EntityId;      // evento que lo originó (el registro guarda la verdad, 014)
  at: WorldMinute;
  source: 'lived' | 'told' | 'session';    // 034 R-003: vivido, contado por otro, en sesión clínica
  kind: string;          // tipo de evento o clave del episodio de desarrollo (para el texto)
  stims: string[];       // lo presente: personas (`cit.…`), lugar, actividad, términos verbales (≤ 6)
  response?: string;     // lo que hizo (actividad, postura…)
  valence: number;       // [-1,1]: cómo lo recuerda HOY (se reconstruye al recordar)
  valence0: number;      // [-1,1]: cómo lo vivió al codificarlo (para medir la distorsión)
  intensity: number;     // [0,1]: decae; el repaso la sube
  rehearsals: number;
  chapter?: string;      // capítulo al que pertenece
}
// distorsión = |valence − valence0| (derivada, no se guarda)

/** Capítulo autobiográfico (capa 3): un periodo de la vida como lo cuenta la persona. */
interface Chapter {
  id: string;            // CHP-… por persona
  from: WorldMinute; to?: WorldMinute;     // abierto = capítulo actual
  theme: string;         // clave de catálogo: 'infancia', 'estudios', 'primer_empleo', 'desempleo', 'pareja', 'duelo', 'migracion'…
  tone: number;          // [-1,1]: media de la valencia de sus episodios, reconstruida
  openedBy?: EntityId;   // evento que lo abrió
  anchors: string[];     // hasta 3 episodios que lo definen (no se olvidan mientras exista)
}

/** En la persona (componente disperso, persistido con la entidad como `functions`). */
interface MemoryStore { episodes: Memory[]; chapters: Chapter[]; forgotten: number; next: number }
```
Los esquemas (capa 2 de la v0.2) son **relaciones de la red de la 037** con origen `experiencia` y la lista de episodios que las formaron: no hay estructura aparte.

Coste: `MAX_EPISODES` = 60 episodios × ≈ 100 B + 12 capítulos × ≈ 80 B ≈ 7 KB por persona (la 035 §7 no lo contaba). Ver P4.

## 4. Reglas

### 4.1 Codificación
- **R-001** [T] idea / [M] forma — **Qué se recuerda.** Un evento en que la persona participa se codifica si su **saliencia** supera `ENCODE_MIN`: `saliencia = |valor| × (0,5 + 0,5 × importancia del evento)`, donde `valor` es la suma de la función, **para esa persona**, de los estímulos del evento (los mismos que usa el aprendizaje, `EVENT_LEARNING` de la 036) más la consecuencia que recibió. La intensidad inicial es la saliencia; la valencia, el signo y tamaño de `valor` acotados a [−1,1]. Un café trivial con un desconocido no llega; un despido llega casi siempre, con más fuerza en quien había aprendido a valorar el trabajo.
- **R-002** [M] — **Fuentes.**
  - los eventos en que participa (vividos, `lived`);
  - lo que oyó en una charla sobre otros (044) y las charlas mismas (`CONVERSATION_HELD`): `told` y `lived` respectivamente;
  - su desarrollo (041): al generar el mundo, los episodios más salientes de cada año desde los 4 años (amnesia infantil) hasta `DEV_PER_YEAR` por año, con su texto del catálogo. Así un adulto llega al día 0 con recuerdos de su infancia;
  - la sesión clínica (034), más adelante: `session`.
- **R-003** [M] — **Sin evento por recuerdo.** Codificar no emite evento (sería uno por hecho). El episodio guarda su evento de origen, y la cadena causal (019) llega a él por ahí.

### 4.2 Olvido y tope
- **R-004** [E] fenómeno / [M] forma — **Decaimiento.** La intensidad decae con vida media `HALF_LIFE_DAYS × (1 + |valencia|)`: lo intenso y lo muy negativo o positivo dura más. Un episodio con intensidad < `FORGET` se olvida.
- **R-005** [M] — **Tope.** Como mucho `MAX_EPISODES` episodios por persona; al superarlo se olvida el de menor `intensidad × recencia` que no sea ancla de un capítulo. Olvidar lo saca de la persona (cuenta en `forgotten`); el hecho sigue en el registro (CLAUDE.md regla 6: la historia no se borra, la memoria sí).

### 4.3 Recuperación y reconstrucción
- **R-006** [M] — **`recall(persona, contexto, k)`.** Devuelve los k episodios con mayor `intensidad × recencia × (1 + solape con el contexto) × sesgo del ánimo`, donde el solape cuenta estímulos compartidos (personas, lugar, términos) y el sesgo favorece la valencia congruente con el ánimo actual (`1 + MOOD_BIAS × valencia × (ánimo − 0,5)`). Empates por id. Función pura y determinista (CA-008).
- **R-007** [E] fenómeno / [M] forma — **Reconstrucción.** Recordar un episodio (repasarlo) sube su intensidad `REHEARSAL_GAIN × (1 − intensidad)` y mueve su valencia hacia la función que tienen **hoy** sus estímulos: `valencia += RECONSTRUCT × (función actual − valencia)`. Si la persona aprendió a detestar a B, lo vivido con B se recuerda peor (Bartlett, reconsolidación; referencias a verificar, PA-146).
- **R-008** [T] — **Quién repasa.**
  - el pensamiento repetitivo (039): cada paso de un episodio de PNR sobre un estímulo repasa los recuerdos que lo contienen, así rumiar mantiene vivo y ennegrece el recuerdo;
  - la charla (043): los recuerdos que se le dan al LLM como contexto cuentan como repaso (P5);
  - los encuentros (012) con alguien repasan el recuerdo más intenso con esa persona.

### 4.4 Consolidación (capacidad `consolidation`)
- **R-009** [T] idea / [M] forma — **Generalización en la red.** En `end_of_day`, si ≥ `SCHEMA_MIN` episodios activos comparten un estímulo principal (persona o lugar) y una consecuencia del mismo signo, se enseña o refuerza en la red de la 037 la relación `estímulo → consecuencia` (marco `causes`, origen experiencia) con fuerza `SCHEMA_GAIN` por episodio nuevo; uno de signo contrario la debilita a la mitad de ese ritmo. La relación guarda sus episodios de origen. Como es de la red, la derivación, las reglas y la selección ya la usan: el «esquema» sigue influyendo cuando los episodios se olvidaron (CA-005).
- **R-010** [M] — **Capítulos.** Se cierra el capítulo abierto y se abre otro cuando la persona codifica con intensidad ≥ `CHAPTER_OPEN` un evento que cambia su rol, lugar o vínculo principal (lista en §8). Al generar el mundo, los capítulos del pasado salen de la historia (030) y del desarrollo (041): infancia, estudios, migración, primer empleo, pareja, hijos, duelos. El tono de un capítulo es la media de la valencia actual de sus episodios; sus anclas no se olvidan mientras el capítulo exista (tope `MAX_CHAPTERS`, se archiva el más antiguo cerrado en la base, 027).

## 4 bis. Estatus epistémico
- [E]: el olvido con el tiempo, el efecto de la intensidad emocional, el recuerdo congruente con el ánimo, la reconstrucción al recordar, la amnesia infantil.
- [T]: la saliencia como función aprendida; la generalización de episodios en relaciones; el repaso por la rumiación.
- [M]: la fórmula de saliencia, las vidas medias, los topes, los pesos de la recuperación. Calibración en PA-146 a PA-148.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `SCHEMA_FORMED` | R-009: se enseña una relación nueva por experiencia | `citizenId, a, b, strength` | Los episodios (sus eventos) que la formaron |
| `SCHEMA_REVISED` | R-009: la relación cambia de signo o cruza 0,5 | `citizenId, a, b, before, after` | El episodio que la contradice o refuerza |
| `CHAPTER_OPENED` | R-010 | `citizenId, theme, tone` | El evento que lo abre |
| `CHAPTER_CLOSED` | R-010 | `citizenId, theme, tone` | El evento que abre el siguiente |

No hay evento por recuerdo formado u olvidado (R-003, R-005).

## 6. Invariantes
- **INV-001** — Valencias en [−1,1] e intensidades en [0,1], sin NaN.
- **INV-002** — Episodios ≤ `MAX_EPISODES` y capítulos en la persona ≤ `MAX_CHAPTERS`.
- **INV-003** — Como mucho un capítulo abierto; los capítulos no se solapan.
- **INV-004** — La memoria nunca lee la verdad del mundo para reconstruir (CLAUDE.md regla 3): lo recordado sale de lo codificado y de las funciones de la persona.
- **INV-005** — Todo capítulo tiene al menos un ancla existente.

## 7. Criterios de aceptación
- **CA-001** — *Dado* un `JOB_LOST`, *entonces* la persona tiene un episodio con valencia < −0,3 que sigue activo tras 1 año, y su intensidad es mayor en quien valoraba más el trabajo (función de `dominio.trabajo`).
- **CA-002** — *Dado* un encuentro trivial (sin choque) con un desconocido, *entonces* no deja episodio, o no persiste tras 30 días.
- **CA-003** — *Dado* un episodio con B repasado 10 veces después de que la función de B bajó, *entonces* su valencia actual es menor que la original (distorsión > 0, en el sentido de la función actual).
- **CA-004** — *Dadas* 5 discusiones con la misma persona en 60 días, *entonces* existe en su red una relación `cit.<persona> → consecuencia negativa` con fuerza ≥ 0,5 y los episodios como origen.
- **CA-005** — *Dado* el caso de CA-004, *cuando* pasan 2 años y los episodios se olvidaron, *entonces* la relación sigue y cambia la selección (acercarse a esa persona es menos probable que sin ella).
- **CA-006** — *Dado* un `JOB_LOST` saliente, *entonces* se cierra el capítulo actual y se abre uno con tema `desempleo` y tono < 0, con el `JOB_LOST` como causa.
- **CA-007** — *Dadas* 100 personas × 1 año, *entonces* la memoria ocupa < 8 KB por persona de media, sin superar los topes, y un adulto del día 0 tiene capítulos del pasado y recuerdos de su infancia.
- **CA-008** — *Dado* el mismo estado y contexto, *entonces* `recall` devuelve la misma lista en el mismo orden.
- **CA-009** — *Dado* un ánimo bajo frente a uno alto, con el mismo almacén, *entonces* `recall` sin contexto devuelve una proporción mayor de episodios negativos.

## 8. Parámetros y calibración
| Parámetro | Valor | Estado |
|---|---|---|
| `ENCODE_MIN` | 0,15 | [M], PA-146 |
| `HALF_LIFE_DAYS` | 30 (× (1 + \|valencia\|)) | [M], PA-146 |
| `FORGET` | 0,05 | [M] |
| `MAX_EPISODES`, `MAX_CHAPTERS` | 60 · 12 | [M], P4 |
| `DEV_PER_YEAR` | 2 episodios por año desde los 4 años | [M], PA-147 |
| `MOOD_BIAS` | 1 | [M], PA-148 |
| `REHEARSAL_GAIN`, `RECONSTRUCT` | 0,2 · 0,1 | [M], PA-148 |
| `SCHEMA_MIN`, `SCHEMA_GAIN` | 3 · 0,15 | [M] |
| `CHAPTER_OPEN` | 0,6 | [M] |
| Eventos que abren capítulo | `JOB_HIRED` (el primero y tras desempleo), `JOB_LOST`, `RETIRED`, `RELATIONSHIP_STARTED`, `BREAKUP`, `CITIZEN_BORN` (hijo), `CITIZEN_DIED` (familiar), `MIGRATED`, `STUDIES_COMPLETED` | [M] |

## 9. Métricas y observabilidad
- Episodios y capítulos por persona; proporción de negativos; distorsión media y su relación con la rumiación (039).
- KB de memoria por persona (`pnpm bench`, frente al total de 40 KB).
- Alertas de degeneración: nadie recuerda nada, todo se recuerda, valencias saturadas, capítulos que no se cierran.
- Visor: sección **Recuerdos** y capítulos en la pestaña **Vida** (lo que recuerda frente a lo que pasó).

## 10. Preguntas abiertas (para el usuario)
- **P1 — Episodio y distorsión.** El episodio es un registro de contingencias cuya saliencia sale de las funciones de la persona (R-001), y al recordarlo se reconstruye hacia la función actual de sus estímulos (R-007). *Propuesta:* sí.
- **P2 — Esquemas como relaciones de la red.** Los esquemas de la v0.2 pasan a ser relaciones de la 037 aprendidas por experiencia (R-009), y la consolidación entra en M3 (no en M5), porque el motor ya lo permite. *Propuesta:* sí.
- **P3 — Capítulos y pasado.** Capítulos en la 013 (no en la 020), y los adultos del día 0 llegan con capítulos del pasado y recuerdos de su infancia desde la historia y el desarrollo (R-002, R-010), visibles en la pestaña **Vida**. *Propuesta:* sí.
- **P4 — Presupuesto y olvido.** Tope de 60 episodios (≈ 7 KB por persona); lo olvidado sale de la persona sin evento (el registro conserva el hecho) y solo se archivan en la base los capítulos. La v0.2 pedía 200 episodios y archivarlo todo; hoy estamos en 54 KB por persona frente a 40. *Propuesta:* 60 y sin archivo de episodios.
- **P5 — Usos del recuerdo.** (a) La charla (043) recibe lo que la persona recuerda (con su distorsión) en lugar de la lista de eventos en que participó; (b) la rumiación (039) repasa y ennegrece los recuerdos; (c) el ánimo sesga qué se recuerda. *Propuesta:* las tres; la (a) es la de más valor para la capa clínica.

## Adaptación al motor funcional (MF8.1, 2026-09-28)
Según la 035 §8:
- Los episodios se guardan como registro de contingencias: estímulo, respuesta, consecuencia y contexto, con el evento que los produjo (036 R-011).
- Los esquemas son subredes de la 037: relaciones consolidadas por uso, no categorías aparte.
- El recuerdo de una charla (`CONVERSATION_HELD`, 043) y los años de desarrollo (`DEVELOPMENT_YEAR`, 041) son las primeras fuentes de episodios.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-23 | 0.2 | Memoria en tres capas (ADR-005, idea B): esquemas, capítulos autobiográficos, consolidación nocturna, recuperación puntuada determinista, límites de RAM y CA-004 a CA-008 |
| 2026-09-24 | 0.2 | Pregunta abierta: enganche de la capa clínica (spec 034), recuerdos con origen `session` |
| 2026-09-28 | — | MF8.1: sección «Adaptación al motor funcional» con lo que cambió en los bloques MF1 a MF7 (o debe cambiar, si la spec sigue en borrador), según la 035 §8. Sin cambios en CA |
| 2026-09-28 | 0.3 | Reescritura sobre el motor funcional (bloque M de M3): episodio como registro de contingencias con saliencia desde las funciones de la persona; reconstrucción hacia la función actual al recordar; esquemas como relaciones de la 037; capítulos con el pasado desde la historia y el desarrollo; repaso por la rumiación (039); topes según el presupuesto de memoria. `source` para la capa clínica (034). Preguntas P1 a P5 para el usuario |
