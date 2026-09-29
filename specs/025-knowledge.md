---
id: 025
nombre: knowledge
estado: aprobada
hito: M3
depende_de: [012, 013, 014, 019, 036, 037, 043, 044]
version: 0.2
---

# 025 — Conocimiento, creencias y rumores

## 1. Propósito
Separar la verdad del mundo de lo que cada persona sabe o cree (CLAUDE.md regla 3). Cada persona sabe lo que presenció o le contaron, y puede creer cosas falsas. Los rumores corren, se deforman y se corrigen. Lo que una persona hace con los demás sale de lo que cree de ellos, no de lo que es.

Reescritura según la 035 §8 (ADR-007), sobre lo que ya existe:
- la 044 tiene la creencia mínima (`Citizen.beliefs`: de quién, qué, fuente, credibilidad, evento), la evaluación de lo que se oye (`assessClaim`: credibilidad por la confianza y la función de quien lo dice; preocupación por el valor de lo dicho para quien lo oye) y las intenciones que salen de ella (llamar, preguntar, confrontar, rumiar);
- pero solo para lo que un visitante le dice a una persona sobre su familia. Entre ciudadanos nadie se cuenta nada, y nadie sabe nada de otros salvo por la charla.

Esta spec lo lleva a la vida diaria con el mismo mecanismo:
- lo que pasa en la vida de alguien se vuelve un tema del que se puede hablar;
- en los encuentros (012) se cuentan cosas de terceros;
- quien lo oye lo evalúa como en la charla, y puede creerlo, contarlo o actuar.

Sin rasgos: contar, callar u ocultar son conductas aprendidas (040), reforzadas o castigadas por cómo reaccionan los demás.

## 2. Alcance
**Incluye:**
- los temas: hechos de la vida de las personas convertidos en afirmaciones (catálogo) y las afirmaciones de la charla (044);
- saber por presenciar (participar o convivir) y por que te lo cuenten;
- contar en los encuentros, como conducta aprendida; la credibilidad que se pierde al pasar de boca en boca y la deformación;
- ocultar lo propio que duele;
- las creencias falsas: las que quedan viejas cuando la verdad cambia, las deformadas y las que planta un visitante;
- la corrección entre personas;
- lo que sabe o cree de otros en la vista de la charla (la `PersonView` de la 034 R-002).

**Fuera de alcance:**
- la mentira activa (afirmar algo falso a sabiendas), que queda para la capa clínica con LLM (034);
- la reputación como agregado (capacidad `reputation`, más adelante);
- los rumores entre personas que no se encuentran (025 con la 012 P5, más adelante).

## 3. Modelo de datos
```ts
// Amplía la creencia de la 044 (Citizen.beliefs). La verdad NO se guarda: se calcula solo para el análisis.
interface Belief {
  about: string;            // CIT-… (o EXT-… en la 044)
  predicate: string;        // clave de `chat_claims` (044) o de `rumor_topics` (nuevo)
  source: string;           // quien se lo dijo (CIT-… o EXT-…), o 'visto' si lo presenció
  credibility: number;      // [0,1]
  at: WorldMinute;
  cause: EntityId;          // evento que la creó
  hops?: number;            // bocas por las que pasó hasta llegar (0 = lo vio)
  told?: string[];          // a quién ya se lo contó (para no repetirlo), los últimos 5
}

// Catálogo nuevo `rumor_topics`: de qué hechos se habla y qué se dice de ellos.
// { key: 'perdio_el_empleo', event: 'JOB_LOST', stimulus: 'verbal.despido', prior: -0.6, escalatesTo?: 'lo_echaron_por_algo', ... }
// Coste: ≈ 10 creencias por persona × 60 B ≈ 0,6 KB (tope `MAX_BELIEFS`).
```

## 4. Reglas
- **R-001** [M] — **Temas.** El catálogo `rumor_topics` define de qué hechos se habla (perdió el empleo, consiguió trabajo, tiene pareja nueva, terminó con su pareja, está enfermo, se endeudó con el gota a gota, discutió con alguien…). Cada tema tiene su estímulo y su valor previo, como una afirmación de la 044, y se evalúa igual. Las afirmaciones de la charla (044) también se pueden contar.
- **R-002** [M] — **Saber por presenciar.** Un hecho de un tema crea la creencia verdadera en quienes participan en él y en quienes conviven con la persona (su hogar se entera), con fuente `visto`, credibilidad 1 y `hops` 0. La verdad no se vuelve a leer: si el hecho cambia después (consigue otro trabajo), la creencia queda vieja hasta que alguien la corrija (R-006).
- **R-003** [T] idea / [M] forma — **Contar.** En un encuentro (012), quien se abre (postura `abrirse`) puede contarle al otro una creencia sobre un tercero que el otro conoce (tiene vínculo con él).
  - La probabilidad es `P_TELL ×` la fuerza aprendida de contar (`social.contar`, 036).
  - Se elige la creencia de más preocupación, que no le haya contado ya a esa persona y con credibilidad ≥ `TELL_MIN`.
  - Quien oye la evalúa con `assessClaim` (044): la fuente es quien cuenta, con la función que tiene para el oyente, y la plausibilidad sale de lo que el oyente aprendió.
  - Si la cree, queda con `hops + 1` y la credibilidad de ese cálculo, que ya incluye la confianza en quien la cuenta: la información se degrada al pasar.
  - Contar se refuerza si el otro se interesa (se abre o aplaca) y se castiga si corta (calla, pone un límite); así el chisme es una historia, no un rasgo.
- **R-004** [M] — **Deformación.** Al contarla, con probabilidad `DISTORT`, una creencia pasa al tema al que escala (`escalatesTo`: «perdió el empleo» → «lo echaron por algo»). Lo deformado es falso.
- **R-005** [T] — **Ocultar lo propio.** Lo que le pasó a una persona y le duele (tema con valor negativo para ella) no lo cuenta ella misma si la fuerza de ocultar (`conv.evadir` frente a `conv.abrirse`) es mayor. Lo sabe quien lo presenció; los demás siguen con lo viejo.
- **R-006** [M] — **Corrección.** Si en un encuentro alguien que cree una versión de un tema (la vio, o tiene mayor credibilidad) habla con quien cree la contraria o una deformada, se la cuenta. El oyente baja la credibilidad de la suya en proporción a su confianza en quien corrige, y si queda por debajo de `FORGET_MIN` la descarta (`BELIEF_CORRECTED`).
- **R-007** [T] — **Actuar por lo que cree.** Las creencias sobre alguien cercano que preocupan forman las intenciones de la 044 (preguntar, confrontar, rumiar), igual que en la charla: un rumor puede terminar en una discusión. El afecto por el tercero se empareja con lo que se oyó (036), como hace la charla.
- **R-008** [M] — **La verdad solo para analizar.** `isTrue(creencia)` se calcula al consultar, comparando con el registro y el estado, en el análisis (API, informe, pruebas); ningún sistema de la persona lo lee (CA-003).
- **R-009** [M] — **Lo que sabe en la charla.** La vista de la charla (043) incluye lo que la persona cree de otros, con de quién lo sabe («te lo contó Marta», «lo viste»), y nada que no crea. Es la `PersonView` de la 034 R-002.

## 4 bis. Estatus epistémico
- [T]: la creencia como conducta verbal bajo control de la fuente (quién lo dice y qué función tiene); contar y ocultar como operantes; la verdad separada de lo creído.
- [M]: los temas, sus valores, las probabilidades, la deformación y los umbrales. Calibración en PA-150 a PA-152.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `RUMOR_TOLD` | R-003: alguien cuenta algo de un tercero y el otro lo cree | `from, to, about, predicate, credibility, hops` | El encuentro; la creencia de quien cuenta (su evento) |
| `RUMOR_DISTORTED` | R-004 | `from, to, about, before, after` | El `RUMOR_TOLD` |
| `BELIEF_CORRECTED` | R-006 | `citizenId, about, predicate, by, credibility` | El encuentro; la creencia de quien corrige |

`LIE_TOLD` y `LIE_DISCOVERED` de la v0.1 quedan para la mentira activa (fuera de alcance).

## 6. Invariantes
- **INV-001** — Credibilidades en [0,1], sin NaN; como mucho `MAX_BELIEFS` creencias por persona.
- **INV-002** — Ninguna creencia se crea ni cambia fuera de los sistemas de conocimiento, la charla (044) y las acciones validadas.
- **INV-003** — Ningún sistema de la persona lee la verdad de un tercero para decidir lo que sabe (CLAUDE.md regla 3).

## 7. Criterios de aceptación
- **CA-001** — *Dado* un `JOB_LOST` que la persona oculta, *entonces* tras 30 días ≥ 1 persona que la conoce la sigue creyendo empleada (no sabe nada nuevo) y ≥ 1 persona lo sabe solo porque se lo contaron.
- **CA-002** — *Dado* 1 año con 100 personas, *entonces* existe al menos una creencia falsa compartida por ≥ 3 personas (rumor) y al menos una corrección.
- **CA-003** — *Dado* un cambio en la verdad de un tercero sin cambiar lo que la persona cree, *entonces* lo que la persona cuenta, cree y decide no cambia (prueba de comportamiento).
- **CA-004** — *Dadas* dos personas con historias distintas (una a la que contar le fue bien, otra a la que la cortaban), *entonces* la primera cuenta más.
- **CA-005** — *Dado* un rumor contado de boca en boca, *entonces* su credibilidad no sube al pasar sin razón (baja en promedio con `hops`) y su cadena causal llega hasta el hecho o la charla que lo originó (019).

## 8. Parámetros y calibración
| Parámetro | Valor | Estado |
|---|---|---|
| `P_TELL` | 0,3 por encuentro en que se abre | [M], PA-150 |
| `TELL_MIN`, `FORGET_MIN` | 0,3 · 0,15 | [M] |
| `DISTORT` | 0,1 por boca | [M], PA-151 |
| `MAX_BELIEFS` | 12 por persona | [M] |
| Fuerza de partida de contar (`social.contar`) | 0,4 | [M], PA-152 |

## 9. Métricas
- Creencias por persona; proporción de falsas (por vieja, por deformación, por la charla); longitud de las cadenas de rumores.
- Rumores, deformaciones y correcciones por año; discusiones que empiezan en un rumor.
- Alertas: todos saben todo, nadie cuenta nada, creencias que no se corrigen nunca.

## 9 bis. Decisiones del usuario (2026-09-29)
Aprobadas las cinco propuestas de §10 (P1 a P5) tal como están.

## 10. Preguntas abiertas (resueltas en §9 bis)
- **P1 — Temas y mecanismo único.** Los hechos de la vida (perder el empleo, pareja nueva, ruptura, enfermedad, deuda con el gota a gota, discusiones…) se vuelven temas de un catálogo (`rumor_topics`) y se evalúan con el mismo mecanismo que lo que dice el visitante (044). *Propuesta:* sí.
- **P2 — Quién se entera sin que se lo cuenten.** Quienes participan en el hecho y quienes conviven con la persona (el hogar se entera). Nadie más: los vecinos no ven nada si nadie se lo cuenta. *Propuesta:* sí.
- **P3 — Contar como conducta aprendida.** Contar en los encuentros depende de la fuerza aprendida de contar, que sube si el otro se interesa y baja si lo cortan. El rumor pierde credibilidad al pasar, y a veces se deforma a una versión peor (del catálogo). *Propuesta:* sí.
- **P4 — Ocultar sí, mentir no (todavía).** En M3, las personas ocultan lo suyo que les duele (no lo cuentan) según su historia de abrirse o evadir, y las creencias viejas quedan falsas. La mentira activa (decir algo falso a sabiendas) queda para la capa clínica con LLM. *Propuesta:* sí.
- **P5 — La charla sabe lo que la persona cree de otros.** La vista del LLM incluye lo que la persona cree de los demás y de quién lo sabe; la verdad solo se ve en el análisis (visor, API, informe), marcada como «verdadero» o «falso» para el observador. *Propuesta:* sí.

## Adaptación al motor funcional (MF8.1, 2026-09-28)
Según la 035 §8:
- La comunidad verbal transmite relaciones y reglas (037 R-007, 038): lo que una persona sabe de otra es una creencia con fuente (la forma mínima ya existe en la 044).
- Mentir emerge de contingencias y reglas (evitar un castigo, conseguir aprobación), sin un rasgo de honestidad.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-24 | 0.1 | Pregunta abierta: `PersonView` como única entrada del LLM (spec 034) |
| 2026-09-28 | — | MF8.1: sección «Adaptación al motor funcional» con lo que cambió en los bloques MF1 a MF7 (o debe cambiar, si la spec sigue en borrador), según la 035 §8. Sin cambios en CA |
| 2026-09-29 | 0.2 | Reescritura sobre el motor funcional y la 044 (bloque K de M3): temas de la vida como afirmaciones (`rumor_topics`), saber por presenciar o convivir, contar en los encuentros como conducta aprendida con la evaluación de la 044, deformación, ocultar lo propio, corrección, verdad solo para el análisis y lo que sabe en la vista de la charla. La mentira activa sale del alcance. CA-004 y CA-005 nuevos. Preguntas P1 a P5 para el usuario |
| 2026-09-29 | 0.2 | Decisiones del usuario (§9 bis): P1 a P5 aprobadas |
| 2026-09-29 | 0.2 | Estado → aprobada |
| 2026-09-29 | 0.2 | Implementación (bloque K de M3). Precisiones:
- el tercero del que se habla no es participante del `RUMOR_TOLD` (no se entera de que hablan de él; INV-003);
- el encuentro solo emite el evento, y la creencia del oyente, sus intenciones y su pensamiento los aplica el sistema de conocimiento al final del tick, para citar el evento como causa (la intención cita el `RUMOR_TOLD`);
- lo que oye el oyente también empareja su afecto por el tercero (036);
- la corrección hace entrar la versión de quien corrige con su confianza × credibilidad;
- el catálogo `rumor_topics` tiene 16 temas con grupo, estado y nivel.

Resultados en 100 personas × 1 año: 2 632 relatos, 32 deformaciones, 18 correcciones, una creencia falsa compartida por 7 personas, credibilidad media 1 → 0,55 → 0,40 → 0,32 por boca; ver `docs/validaciones/M3-creencias.md`. Sin cambios en CA |
