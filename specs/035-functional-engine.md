---
id: 035
nombre: functional-engine
estado: implementada
hito: MF (motor funcional)
depende_de: [001, 009, 010, 014, 019, 021, 023, 027]
version: 0.1
---

# 035 — Motor funcional-contextual (spec paraguas)

## 1. Propósito
Define la arquitectura del motor de comportamiento (ADR-007): seis capas, sus contratos, el flujo de un tick y cómo se integra con el resto del motor. Implementa el documento rector (`docs/investigacion/motor-comportamiento-humano.md`) §4–§13:
- la conducta es una propiedad emergente de la historia y del contexto;
- toda conducta se reconstruye con la cadena de §12: qué ocurrió → qué función adquirió → qué relaciones aprendió → qué estímulos tienen hoy esa función → qué repertorios tiene → qué contexto hay → qué consecuencias anticipa → qué emite → qué recibe → cómo cambia su historia.

No contiene reglas de aprendizaje propias; esas están en las subspecs:
- 009: temperamento;
- 036: estímulos y funciones;
- 037: red relacional;
- 038: reglas y valores;
- 039: eventos privados y flexibilidad;
- 040: selección de conducta;
- 041: desarrollo;
- 042: batería de validación.

## 2. Alcance
**Incluye:** mapa de capas, contratos entre capas, registro de mecanismos, flujo del tick, integración con las specs existentes, presupuesto de memoria, estrategia de migración y guardarraíl anticircularidad.
**Fuera de alcance:** intervenciones y capa clínica (034, fuera de esta etapa); LLM (026).

## 3. Mapa de capas y dirección de dependencias
```text
 capa 1  TEMPERAMENTO (009) ──parámetros──▶ mecanismos de 2–5 (y valores iniciales de estados aprendidos)
 capa 2  ESTÍMULOS Y FUNCIONES (036) ◀── consecuencias (eventos del mundo)
 capa 3  RED RELACIONAL (037) ── transforma funciones de 2 (bajo demanda, con caché)
 capa 4  REGLAS, VALORES, AUGMENTALS (038) ── redes de 3 que especifican contingencias
 capa 5  EVENTOS PRIVADOS, PNR, FLEXIBILIDAD (039) ── estímulos privados en la misma red; procesos temporales
 capa 6  SELECCIÓN (040) ── lee 2–5 y estados aprendidos; NUNCA 1 ──▶ acción validada (017 R-006) ──▶ consecuencias
```
- Una capa solo escribe su propio estado. Los cambios se producen como parches del sistema o como acciones validadas (regla de oro 4; 021).
- La capa 6 no lee `tmp.*` ni `pers.*` (009 R-006, prueba de arquitectura).
- Los **estados aprendidos** que usa la capa 6 (`hist.discountK`, `hist.variability`, fuerzas de respuesta, hábitos) los inicializa el temperamento y los actualiza la historia.

## 4. Contratos entre capas (tipos preliminares)
```ts
type StimulusId = number;        // índice en la ontología compartida (036), u16 en almacenamiento
type ContextKey = number;        // clase de contexto (lugar, compañía, hora, estado corporal), u16
type MechanismId = string;       // 'respondent.aversive_update', 'relational.mutual_entailment'… (§5)

// 2 → todos: una función vigente de un estímulo para una persona.
interface StimulusFunction {
  stimulus: StimulusId;
  kind: 'elicit' | 'discriminative' | 'reinforce';   // elicitadora, discriminativa, reforzante
  valence: 1 | -1;                                   // apetitiva o aversiva
  strength: number;                                  // [0,1]
  context: ContextKey | 0;                           // 0 = sin control contextual aprendido
  origin: 'direct' | 'derived' | 'transformed' | 'generalized' | 'discriminated';
  sourceEvents: EntityId[];                          // eventos que la originaron (019), recortado a 3
}

// 3 → 2, 4, 5: consulta de funciones por relaciones (perezosa, con caché por persona).
interface DerivedFunction extends StimulusFunction { path: RelationStep[]; depth: number; }

// 4 → 6: una regla aplicable ahora.
interface ApplicableRule { rule: number; response: ResponseClass; followKind: 'pliance' | 'tracking' | 'augmenting'; specifiedValue: number; history: number; }

// 5 → 6: estado privado presente (pensamientos y emociones activos con su función).
interface PrivateState { active: { stimulus: StimulusId; fn: StimulusFunction }[]; pnrLoop?: { step: number; since: WorldMinute }; hierarchicalFraming: number; }

// 6 → mundo: conducta emitida con su vector de aportes (la base de la explicación, 019 y 020).
interface EmittedBehavior {
  response: ResponseClass; context: ContextKey; at: WorldMinute;
  sources: { source: ControlSource; contribution: number; ref?: EntityId | StimulusId }[];
}
type ControlSource = 'immediate' | 'delayed' | 'rule.pliance' | 'rule.tracking' | 'augmental' | 'value'
                   | 'habit' | 'aversive_present' | 'motivating_op' | 'social_context';
```

## 5. Registro de mecanismos
Cada mecanismo de aprendizaje tiene un id estable. `modula` (009) solo puede citar ids de este registro, y la prueba de arquitectura permite leer `tmp.*` solo en los archivos que implementan esos mecanismos.

| Id | Spec | Qué hace |
|---|---|---|
| `respondent.appetitive_update`, `respondent.aversive_update` | 036 | Actualización tipo Rescorla-Wagner de funciones elicitadoras |
| `respondent.elicitation_gain`, `respondent.habituation`, `respondent.social_salience` | 036 | Magnitud de la respuesta elicitada, habituación, saliencia de EC sociales |
| `operant.reinforcement_update`, `operant.punishment_update` | 036 | Fuerza de respuesta por contexto tras consecuencias |
| `operant.novel_initial_value`, `operant.variability_initial` | 036 | Valor inicial de lo nuevo; variabilidad operante inicial |
| `extinction.context` | 036 | Extinción como aprendizaje nuevo con contexto |
| `generalization.gradient`, `generalization.novel_prior`, `discrimination.differential` | 036 | Generalización por rasgos y discriminación |
| `discounting.initial_k`, `discounting.k_plasticity` | 036 | Descuento hiperbólico como estado aprendido |
| `relational.mutual_entailment`, `relational.combinatorial_entailment`, `relational.transformation` | 037 | Derivación y transformación de funciones |
| `rules.following_update`, `values.hierarchy_transfer` | 038 | Historia de seguimiento; transferencia jerárquica |
| `private.derivation_step`, `private.avoidance_update`, `private.hierarchical_framing` | 039 | Pasos del PNR, alivio y enmarque deíctico |
| `motivation.arousal_baseline` | 036 | Nivel basal de activación (con 010) |

## 6. Flujo de un tick (fases de la 021)
1. **`needs`** (010 adaptada): fisiología (energía, hambre, higiene) y estímulos corporales (hambre, fatiga, dolor) → **operaciones motivadoras** (MO) activas (036 R-010).
2. **`decision`** (040):
   - para cada persona en un punto de decisión, el repertorio disponible en el contexto (respuestas con fuerza en ese contexto, reglas aplicables, rutina como reglas de pliance y tracking de 011) forma las candidatas;
   - cada candidata recibe aportes por fuente;
   - se elige por igualación o softmax con la variabilidad aprendida;
   - se solicita la acción.
3. **`actions`**: el validador aplica (017 R-006, conservado); la movilidad lleva al lugar (016).
4. **`interactions`** (012 reescrita): los encuentros producen estímulos sociales y consecuencias (aprobación, crítica, rechazo) como eventos.
5. **`information`** (025 adaptada): la comunidad verbal transmite relaciones y reglas (037 R-007, 038 R-002).
6. **`memory`**: aprendizaje. Las consecuencias del tick se imputan a la conducta que las produjo (registro de contingencias, 036 R-011):
   - capa 2 actualiza funciones y fuerzas;
   - capa 3 invalida la caché de lo afectado;
   - capa 4 actualiza la historia de seguimiento de reglas;
   - capa 5 avanza los procesos privados (un paso de PNR o de enmarque).
7. **`end_of_day`**: poda por fuerza y archivo (§7), consolidación de memoria (013), `TRAIT_SHIFT` lento (009 R-005), métricas de red (037 R-008).

**Capacidad:**
- Los sistemas de las capas 2–5 se registran con la capacidad `learning`, que ya existe en 001.
- Su dependencia cambia de `memory` a `routines`, porque el aprendizaje directo no necesita la memoria episódica de 013.
- La capa 6 usa `routines`, como la 017.
- El cambio en 001 (`CAPABILITY_DEPS`) se hace en MF2, con su fila de historial.

Niveles (021): nivel 0 → solo `end_of_day` resumido (aprendizaje por lotes de episodios, como el desarrollo 041); nivel 1 → sin capa 5 fina (PNR en pasos gruesos por hora); nivel ≥ 2 → todo.

## 7. Presupuesto de memoria por persona (objetivo)
| Almacén | Tope | Bytes por entrada | KB |
|---|---|---|---|
| Funciones directas (036) | 256 | 12 (estímulo u16, tipo u8, valencia i8, fuerza f32, contexto u16, origen u8, pad) | 3,0 |
| Fuerzas de respuesta por contexto (036) | 256 | 8 | 2,0 |
| Relaciones directas (037) | 512 | 10 (de u16, a u16, marco u8, fuerza u8, Crel u16, origen u8, pad) | 5,0 |
| Caché de derivación (037) | 256 | 12 | 3,0 |
| Reglas (038) | 32 | 48 | 1,5 |
| Eventos privados activos (039) | 16 | 24 | 0,4 |
| Estados aprendidos escalares (`hist.*`, 040) | 8 | 4 | 0,03 |
| **Total** | | | **≈ 15 KB** |

- **Ontología compartida:** ≈ 4 000 clases × 64 B ≈ 256 KB por mundo.
- **Totales:**
  - 500 personas: ≈ 7,5 MB adicionales;
  - 10 000 personas: ≈ 150 MB adicionales, más ≈ 160 MB actuales;
  - dentro de 1 GB.
- **Poda:** al superar un tope, se archiva en SQLite (027) la entrada con menor `fuerza × recencia`. Su efecto se conserva en contadores agregados por clase, como la consolidación de 013.
- **Verificación:** `pnpm bench` en cada bloque MF (métrica nueva: KB por persona del motor funcional).

## 8. Integración con las specs existentes
| Spec | Estado actual | Destino | Qué cambia |
|---|---|---|---|
| 009 | aprobada (v0.3) | **Reescrita** (v1.0, `specs/propuestas/`) | Temperamento; se eliminan extras, afrontamiento y valores escalares |
| 010 | aprobada | **Adaptar** | Las necesidades pasan a ser operaciones motivadoras. Emociones y estrés salen de funciones elicitadas (036), no de rasgos. Se quitan las modulaciones por neuroticismo, extraversión y resiliencia |
| 011 | aprobada | **Adaptar** | La rutina se reinterpreta como reglas de pliance y tracking y contextos discriminativos. Quedarse dormido deja de usar la responsabilidad (lo decide el balance energía/fuerza de levantarse) |
| 012 | borrador | **Reescribir** | Encuentros → consecuencias sociales; la afinidad sale de la historia de reforzamiento mutuo y de funciones compartidas, no de la similitud de valores |
| 013 | borrador | **Adaptar** | Episodios como registro de contingencias; los esquemas se relacionan con las redes de 037 |
| 014 | implementada | **Adaptar** | Eventos nuevos (`RULE_DERIVED`, `FUNCTION_ACQUIRED` en nivel ≥ 3, `PNR_EPISODE`, `BEHAVIOR_EMITTED` en nivel ≥ 3) con causas funcionales |
| 017 | aprobada, implementada en M2 | **Sustituida por 040** | Se conservan el validador (R-006) y el compromiso. La utilidad con rasgos desaparece. Pasa a `obsoleta` cuando termine MF3 |
| 018 | borrador | **Obsoleta** | Su contenido (TD, hábitos, habilidades) se reparte entre 036 (aprendizaje) y 040 (hábitos como fuente) |
| 019 | borrador | **Adaptar** | Las causas incluyen el vector de aportes y la cadena de origen de cada función |
| 020 | borrador | **Adaptar** | Explicación funcional retrospectiva. La "resiliencia" pasa a ser una métrica de trayectoria del perfil emergente |
| 021 | aprobada | **Adaptar** | Qué capas corren en cada nivel (§6) |
| 023 | aprobada | Sin cambios | Flujos nuevos: `gen:temperament`, `gen:development`, `sys:learning`, `sys:selection` |
| 025 | borrador | **Adaptar** | La comunidad verbal transmite relaciones y reglas; mentir emerge de contingencias y reglas (sin honestidad) |
| 031 | implementada | **Adaptar** | Los hábitos de salud se generan hoy con impulsividad, responsabilidad y `val.health`: adaptador en MF1 y desarrollo en MF7 |
| 032 | implementada | **Adaptar** | La ficha de esparcimiento se elige hoy con rasgos y valores del catálogo: adaptador en MF1 y desarrollo en MF7. Su frecuencia en la vida diaria pasa a ser fuerza de respuesta (036) |

## 9. Migración (resumen; detalle en `docs/investigacion/impacto-motor-funcional.md`)
- **Adaptador temporal `@deprecated`** (`packages/engine/src/temperament/legacy.ts` y su gemelo en generadores) que concentra todas las lecturas actuales de rasgos. Es la única vía permitida a `pers.*` fuera del temperamento hasta MF7.
- **Comprobación de caducidad:** la prueba de arquitectura falla si el adaptador existe y el archivo `tasks/MF-motor-funcional.md` tiene marcada la casilla del bloque MF7.
- Cada bloque deja el mundo ejecutándose y con `pnpm check` en verde.

## 10. Invariantes
- **INV-001** — Toda conducta emitida en nivel ≥ 2 tiene un vector de aportes no vacío cuya suma de valores absolutos es > 0.
- **INV-002** — Toda función con origen distinto de `direct` se puede reconstruir hasta funciones directas y relaciones (`path`) o hasta la regla que la produjo.
- **INV-003** — La capa 6 no lee la capa 1 (prueba de arquitectura).
- **INV-004** — Misma semilla y mismas entradas producen el mismo mundo (023).

## 11. Criterios de aceptación
- **CA-001** — *Dado* un mundo de 200 personas × 30 días con el motor funcional, *entonces* para 20 conductas al azar se puede generar la cadena de §12 completa (de la conducta hasta eventos del registro o del desarrollo), sin pasos vacíos.
- **CA-002** — *Dado* el motor completo, *entonces* la batería 042 pasa entera.
- **CA-003** — *Dado* 500 personas × 1 año, *entonces* el motor funcional ocupa ≤ 20 KB por persona (`pnpm bench`) y el año se simula en < 10 min (021 CA-002).
- **CA-004** — *Dado* el código, *entonces* la prueba de arquitectura pasa, y falla con el fixture que viola la dirección de dependencias.

## 4 bis. Estatus epistémico
- La arquitectura en capas es [M]: una organización del software. Cada capa implementa fenómenos [E] o afirmaciones [T] que se etiquetan en su subspec.
- Que las necesidades funcionen como operaciones motivadoras es [T] (concepto de operación motivadora; referencia a verificar).
- El presupuesto y los topes son [M] (PA-130).

## 12. Parámetros y calibración
| Parámetro | Valor | Fuente |
|---|---|---|
| Topes por almacén | tabla §7 | [M], PA-130 |
| Profundidad máxima de derivación | 3 | [M], PA-110 |
| Frecuencia de poda | diaria | [M] |

## 13. Preguntas abiertas
PA-110, PA-130 y todas las de §11 del documento rector (ver `docs/investigacion/preguntas-abiertas.md`).

## 14. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-25 | 0.1 | Borrador de la Fase A de la reorientación funcional-contextual (ADR-007). En revisión por el usuario |
| 2026-09-25 | 0.1 | Estado → aprobada |
| 2026-09-28 | 0.1 | MF8 (cierre): CA-001 se cumple (20 de 20 conductas con la cadena §12 completa, `citizen:explain`), igual que CA-002 (batería 042 completa, `docs/validaciones/bateria-conductual.md`) y CA-004 (arquitectura). CA-003: el motor funcional ocupa 10,4 KB por persona (≤ 20 KB), y un año con 254 personas se simula en 411 s. El mapa no aloja 500 personas, y la vida diaria es un 53 % más lenta que en MF5 por las historias densas (MF8.5, `docs/validaciones/MF8-bench-vida.md`). Sin cambios en CA |
| 2026-09-28 | 0.1 | Estado → implementada |
