---
id: 013
nombre: memory
estado: borrador
hito: M3 (episódica) · M5 (consolidación)
depende_de: [014, 010, 021]
version: 0.2
---

# 013 — Memoria autobiográfica

## 1. Propósito
Lo que cada persona recuerda de lo vivido: subjetivo, con intensidad y valencia, que se olvida y se distorsiona. Diferente de la historia objetiva (020).

La memoria se organiza en **tres capas** (ADR-005, idea B) para que se vuelva más rica con los años sin ocupar más en RAM:

1. **Episódica:** recuerdos concretos ("discutí con Laura el martes").
2. **Esquemas:** generalizaciones aprendidas de varios episodios ("con Laura suelo discutir por dinero").
3. **Capítulos autobiográficos:** cómo la persona divide y cuenta su propia vida ("la época en que perdí el trabajo").

## 2. Alcance
**Incluye:** codificación, decaimiento, recuperación, distorsión, límite de memorias, consolidación en esquemas y capítulos.
**Fuera de alcance:** creencias sobre hechos (025), historia objetiva (020), narración con LLM (026).

## 3. Modelo de datos
```ts
interface Memory {                         // capa 1: episódica
  id: EntityId;              // MEM-…
  ownerId: EntityId; eventId?: EntityId;   // evento que la originó (si existe)
  at: WorldMinute; summary: string;        // plantilla + parámetros
  valence: number;           // [-1,1]
  intensity: number;         // [0,1], decae
  vividness: number;         // [0,1]
  distortion: number;        // [0,1] cuánto difiere del evento real
  participants: EntityId[]; placeId?: EntityId; tags: string[]; // tags: 'work', 'money', 'conflict'…
  rehearsals: number;
  status: 'active' | 'consolidated' | 'forgotten';
  schemaIds: EntityId[];     // esquemas a los que aportó
}

interface MemorySchema {                   // capa 2: esquema (memoria semántica)
  id: EntityId;              // SCH-…
  ownerId: EntityId;
  key: { about?: EntityId; placeId?: EntityId; tag: string }; // de qué trata
  statement: string;         // plantilla: "con {about} suelo {tag}"
  valence: number;           // [-1,1] media ponderada de sus episodios
  confidence: number;        // [0,1] crece con la evidencia, decae sin ella
  support: number;           // nº de episodios que lo apoyan (acumulado)
  anchorMemoryIds: EntityId[];  // hasta 3 episodios representativos
  updatedAt: WorldMinute;
}

interface AutobiographicalChapter {        // capa 3: capítulo subjetivo
  id: EntityId;              // CHP-…
  ownerId: EntityId;
  from: WorldMinute; to?: WorldMinute;     // abierto = capítulo actual
  theme: string;             // plantilla: 'job_loss', 'new_relationship', 'moving'…
  tone: number;              // [-1,1] cómo lo vive/recuerda la persona
  anchorMemoryIds: EntityId[]; // episodios que lo definen
  openedBy?: EntityId;       // evento que abrió el capítulo
}

// Columna nueva en components (spec 001 §3.1): ninguna. La memoria es un componente disperso:
// Map<citizenId, { episodes: Memory[]; schemas: MemorySchema[]; chapters: AutobiographicalChapter[] }>
```

EntityKind añade `SCH` y `CHP` (spec 001).

## 4. Reglas

### 4.1 Episódica
- **R-001** — Solo se codifica un evento si su importancia subjetiva (importancia × emoción × relevancia personal) supera umbral.
- **R-002** — La intensidad decae exponencialmente; memorias negativas intensas decaen más lento; cada recuerdo (rehearsal) refuerza y aumenta la distorsión.
- **R-003** — Cada persona conserva máximo `MAX_MEMORIES` episodios activos; las débiles se olvidan (status forgotten, no se borran de la base).
- **R-004** — La distorsión puede cambiar el rol percibido de otros (p. ej. atribuir culpa) y alimenta resentimiento (012).
- **R-005** — El estado de ánimo sesga la recuperación (ánimo bajo → recuerdos negativos).

### 4.2 Consolidación (capacidad `consolidation`)
- **R-006** — La consolidación es un sistema de fase `end_of_day` y cadencia `day` (spec 021). Corre para personas con nivel ≥ 1; en nivel 0 corre una vez por semana.
- **R-007** — **Esquemas.** Los episodios activos se agrupan por `key` = (participante principal o lugar, etiqueta). Si un grupo reúne ≥ `SCHEMA_MIN_EPISODES` episodios con valencia del mismo signo, se crea o refuerza un esquema: `confidence += SCHEMA_GAIN × (1 − confidence)` por episodio nuevo, y `valence` se actualiza con media ponderada por intensidad. Los episodios que contradicen el esquema (valencia de signo opuesto) reducen su `confidence` a la mitad de ese ritmo.
- **R-008** — **Olvido tras consolidar.** Un episodio que aportó a un esquema pasa a `consolidated` cuando su intensidad baja de `FORGET_THRESHOLD`: sale de la RAM y queda en la base (027), pero su efecto sigue en el esquema. Los episodios ancla (`anchorMemoryIds`) no se olvidan mientras su esquema o capítulo esté activo.
- **R-009** — **Capítulos.** Se abre un capítulo nuevo (y se cierra el actual) cuando ocurre un evento que la persona codifica con intensidad ≥ `CHAPTER_OPEN_INTENSITY` y que cambia su rol, lugar o relación principal (tipos de evento en §8). El tono del capítulo es la media de valencias de sus episodios, sesgada por el ánimo al cerrarlo.
- **R-010** — **Límites.** Como máximo `MAX_SCHEMAS` esquemas y `MAX_CHAPTERS` capítulos en RAM por persona. Si se supera, pasa a la base el de menor `confidence × recencia` (esquemas) o el más antiguo cerrado (capítulos). Nada se borra (CLAUDE.md regla 6).
- **R-011** — Esquemas y capítulos se ven afectados por la distorsión: `statement` y `tone` se derivan de lo recordado, no de la verdad (020 muestra la diferencia).

### 4.3 Recuperación
- **R-012** — `recall(owner, context, k)` devuelve los k elementos más relevantes de las tres capas con puntuación
  `score = recencia^a × importancia^b × relevancia(context)^c × sesgoÁnimo`, donde relevancia = coincidencia de participantes, lugar y etiquetas. Empates por id ascendente. Es una función pura y determinista.
- **R-013** — Toda recuperación usada en una decisión (017), una interacción (012) o como contexto para el LLM (026) cuenta como rehearsal (R-002).
- **R-014** — Los esquemas entran en la utilidad de decisión como expectativa: un esquema negativo sobre una persona reduce la utilidad de buscarla (017 R-002), aunque los episodios que lo formaron estén olvidados.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `MEMORY_FORMED` | interna, no se emite al log salvo nivel ≥3 |  | evento origen |
| `MEMORY_FORGOTTEN` | episodio pasa a forgotten/consolidated | memoria, estado | decaimiento, consolidación |
| `SCHEMA_FORMED` | se crea un esquema | clave, valencia | episodios de apoyo |
| `SCHEMA_REVISED` | cambia de signo o `confidence` cruza 0.5 | antes, después | episodio que contradice o refuerza |
| `CHAPTER_OPENED` | la persona empieza un capítulo | tema, tono inicial | evento que lo abre |
| `CHAPTER_CLOSED` | termina un capítulo | tema, tono final | evento que abre el siguiente |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).
- **INV-003** — En RAM, por persona: episodios activos ≤ `MAX_MEMORIES`, esquemas ≤ `MAX_SCHEMAS`, capítulos ≤ `MAX_CHAPTERS`.
- **INV-004** — Como mucho un capítulo abierto por persona; los capítulos no se solapan.
- **INV-005** — Todo esquema y capítulo tiene al menos un episodio ancla que existe (activo o en la base).

## 7. Criterios de aceptación
- **CA-001** — *Dado* un JOB_LOST, *entonces* la persona tiene una memoria con valencia < -0.5 que sigue activa tras 1 año.
- **CA-002** — *Dado* un café trivial, *entonces* no persiste tras 30 días.
- **CA-003** — *Dado* una memoria recordada 10 veces, *entonces* distortion > 0.
- **CA-004** — *Dado* 5 discusiones con la misma persona en 60 días, *entonces* existe un esquema sobre ella con valencia < 0 y `confidence` ≥ 0.5.
- **CA-005** — *Dado* el esquema de CA-004, *cuando* pasan 2 años y los episodios originales están `consolidated`, *entonces* el esquema sigue influyendo en la decisión de buscar a esa persona (017).
- **CA-006** — *Dado* un JOB_LOST, *entonces* se cierra el capítulo actual y se abre uno con tema `job_loss` y tono < 0, con el JOB_LOST como causa.
- **CA-007** — *Dado* 100 personas × 10 años con `consolidation` activa, *entonces* la memoria en RAM por persona se mantiene < 40 KB (medido con `pnpm bench`) y ningún límite de INV-003 se supera.
- **CA-008** — *Dado* el mismo estado y contexto, *entonces* `recall` devuelve la misma lista en el mismo orden.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto |
|---|---|
| MAX_MEMORIES | 200 |
| vida media trivial | 7 días |
| MAX_SCHEMAS | 30 |
| MAX_CHAPTERS | 12 |
| SCHEMA_MIN_EPISODES | 3 |
| SCHEMA_GAIN | 0.15 |
| FORGET_THRESHOLD | 0.05 |
| CHAPTER_OPEN_INTENSITY | 0.7 |
| Eventos que pueden abrir capítulo | JOB_STARTED, JOB_LOST, RELATIONSHIP_STARTED, RELATIONSHIP_ENDED, HOUSE_CHANGED, CHILD_BORN, muerte de un familiar |
| Exponentes de recuperación (a, b, c) | 1, 1, 2 |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite). Además: esquemas por persona, capítulos por persona y año, proporción de esquemas negativos, bytes de memoria en RAM por persona.

## 10. Preguntas abiertas
- [ ] Revisar parámetros con los resultados de la primera validación.
- [ ] ¿La consolidación entra en M3 junto con la episódica o en M5 con el aprendizaje? (Propuesta: episódica y recuperación en M3; esquemas y capítulos en M5, peldaño 3.)
- [ ] ¿Los esquemas deben alimentar también las creencias (025)? (Propuesta: no directamente; un esquema es una expectativa, no un hecho. Revisar en M5.)
- [ ] ¿Separar la consolidación en una spec propia si crece? (Propuesta: sí, si esta spec supera ~250 líneas.)

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-23 | 0.2 | Memoria en tres capas (ADR-005, idea B): esquemas, capítulos autobiográficos, consolidación nocturna, recuperación puntuada determinista, límites de RAM y CA-004 a CA-008 |
