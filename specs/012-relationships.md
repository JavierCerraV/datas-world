---
id: 012
nombre: relationships
estado: borrador
hito: M3
depende_de: [007, 008, 014, 016, 021, 023, 036, 037, 038, 040, 041, 043, 044]
version: 0.2
---

# 012 — Relaciones asimétricas sobre el motor funcional

## 1. Propósito
Vínculos entre personas, distintos desde cada lado: lo que A siente por B no es lo que B siente por A. Amistades, parejas, familia, compañeros, conflictos y rupturas.

Reescritura según la 035 §8 (ADR-007). La afinidad no sale de la similitud de valores ni de la extraversión, sino de la **historia de reforzamiento mutuo**:
- cada persona es, para la otra, un estímulo con función (036), como el visitante en la charla (043 R-018);
- lo que A recibe cuando está con B (aprobación, burla, compañía, conflicto) forma la función de B para A;
- el vínculo desde el lado de B lo forma lo que B recibe de A, que puede ser otra cosa.

Así la pregunta guía se puede responder también en lo social: *¿por qué A evita a B?* La respuesta es la cadena de encuentros que la llevó a eso.

## 2. Alcance
**Incluye:**
- la persona como estímulo (`cit.<CIT>`) en el almacén de funciones de cada quien;
- los encuentros cotidianos en lugares compartidos y su intercambio, con las posturas de la charla (043) sin LLM;
- la familiaridad, la tensión y la confianza de cada vínculo (absorbe el `Bond` mínimo de la 044 R-007);
- las etiquetas (conocido, amigo, pareja, ex, compañero, familia) con umbrales e histéresis;
- las discusiones, las amistades, las parejas y las rupturas como eventos con causas;
- el punto de partida de cada vínculo familiar desde la historia de desarrollo (041).

**Fuera de alcance:**
- lo que una persona sabe o cree de otra y los rumores (025);
- el recuerdo episódico de cada encuentro (013): aquí el encuentro es un evento y deja su huella en la función;
- el ciclo de vida de la pareja (convivencia, hijos, divorcio legal): capacidad `lifecourse`, más adelante.

## 3. Modelo de datos
```ts
/** Estímulo de una persona en el almacén de otra (036): su función es el afecto aprendido, en [−1, 1]. */
const personStimulus = (id: EntityId) => `cit.${id}`;

/** Vínculo dirigido (`Citizen.bonds`, amplía el `Bond` de la 044). Solo los vínculos que existen. */
interface Bond {
  with: EntityId;
  familiarity: number;   // [0,1]: cuánto se conocen; sube con cada encuentro y decae sin contacto
  tension: number;       // [0,1]: conflicto vivo; decae por día (044 R-007)
  trust: number;         // [0,1]: confianza (044), baja con la traición percibida y sube con la ayuda
  labels: ('familia' | 'amigo' | 'pareja' | 'ex' | 'companero' | 'conocido')[];
  encounters: number;
  lastEncounter: WorldMinute;
  at: WorldMinute;
}
// El afecto NO se guarda aquí: es la función de `cit.<with>` en el almacén de la persona (una sola fuente de verdad).
```
Coste: hasta `MAX_BONDS` = 40 vínculos por persona × ≈ 80 B, más una función por vínculo en el almacén (036). ≈ 5 KB por persona como máximo.

## 4. Reglas
- **R-001** [M] — **Encuentros.** En cada lugar con varias personas despiertas (016, `loc.place`), cada par puede tener un encuentro con probabilidad por tick `P_ENCOUNTER × (0,3 + familiaridad) × acercarse`. «Acercarse» es la fuerza aprendida de la respuesta `social.acercarse` en ese contexto (036 R-002). Tope de encuentros por persona y hora (`MAX_ENCOUNTERS_HOUR`). Azar: `sys:relationships/<lugar>`.
- **R-002** [T] idea / [M] forma — **El intercambio.** En un encuentro, cada uno elige una postura con la selección de la 040 y el catálogo `chat_stances` (043 R-008), sin LLM. El «tono» con que llega el otro es su postura:
  - abrirse, aplacar o responder breve se reciben como aprobación o neutralidad;
  - contraatacar, poner un límite o callar, como crítica, conflicto o frialdad;
  - lo que cada uno recibe empareja la función de `cit.<otro>` (036 R-001) y refuerza o castiga la postura elegida (036 R-002).

  La misma escena deja vínculos distintos en cada lado (CA-001).
- **R-003** [M] — **Familiaridad, tensión y confianza.** Cada encuentro sube la familiaridad `FAMILIARITY_GAIN × (1 − familiaridad)`, que decae `FAMILIARITY_DECAY_DAY` sin contacto. Una discusión sube la tensión (tope `MAX_TENSION_DELTA` de la 044); la tensión decae por día. La confianza sube cuando la otra persona le ayuda o se abre, y baja con la traición percibida (044).
- **R-004** [M] — **Etiquetas con histéresis.**
  - `conocido` desde el primer encuentro;
  - `amigo` con familiaridad ≥ `FRIEND_FAM` y función de la otra persona ≥ `FRIEND_FN`, y se pierde bajo umbrales más bajos;
  - `pareja` desde la historia (hogar, 008) o, en adultos sin pareja, con función ≥ `PARTNER_FN` en ambos lados y atracción compatible (P3);
  - `ex` tras una ruptura;
  - `companero` si comparten organización (006);
  - `familia` por parentesco (008, 030).

  Cada cambio produce su evento.
- **R-005** [M] — **Discusiones.** Un encuentro en el que alguno contraataca o pone un límite con tensión previa > `ARGUMENT_TENSION` es una discusión (`ARGUMENT`). Como mucho una por par cada `ARGUMENT_COOLDOWN_DAYS` = 2 (calibración del prototipo).
- **R-006** [T] — **Rupturas.** Una pareja se rompe (`BREAKUP`) cuando, en un lado, la función de la otra persona queda por debajo de `BREAKUP_FN` y la tensión por encima de `BREAKUP_TENSION` durante `BREAKUP_DAYS`. El que rompe es ese lado; sus causas son las discusiones y los encuentros que llevaron ahí (CA-003).
- **R-007** [M] — **Punto de partida (041).** Al generar el mundo, cada vínculo familiar parte de la historia de desarrollo: la función de `cit.<pariente>` es la de su rol en los episodios en que intervino (madre, padre, pareja…), y la familiaridad depende de la convivencia. Un compañero o un vecino parten de cero.
- **R-008** [M] — **Olvido y tope.** Sin contacto, los vínculos de `conocido` con familiaridad < `FORGET_FAM` se olvidan (su función queda en el almacén hasta la poda de la 036). Si hay más de `MAX_BONDS`, se olvida el más débil que no sea familia.
- **R-009** [T] — **Cadena causal.** Todo vínculo y todo cambio de etiqueta tienen en sus causas los encuentros que los formaron (019), y la cadena de la 035 §12 llega hasta ellos.

## 4 bis. Estatus epistémico
- [T]: la afinidad como función aprendida por reforzamiento mutuo; la asimetría; la ruptura como resultado de una historia.
- [M]: probabilidades de encuentro, ganancias, umbrales, topes y la traducción postura → consecuencia. Calibración en PA-142 a PA-145.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `MET` | Primer encuentro de un par | `a, b, placeId` | Presencia compartida (lugar y actividad) |
| `ENCOUNTER` (nivel ≥ 3) | Cada encuentro | `a, b, stanceA, stanceB` | Presencia; fuentes de cada postura |
| `FRIENDSHIP_FORMED` | Un lado pasa a `amigo` | `a, b` | Los encuentros que subieron la función |
| `ARGUMENT` | R-005 | `a, b, stanceA, stanceB, tension` | Tensión previa; las posturas |
| `RELATIONSHIP_STARTED` | Pareja nueva | `a, b` | Encuentros de ambos |
| `BREAKUP` | R-006 | `a, b, initiator` | ≥ 2 discusiones o encuentros negativos previos |
| `BOND_FORGOTTEN` | R-008 | `a, b` | Tiempo sin contacto |

## 6. Invariantes
- **INV-001** — Familiaridad, tensión y confianza en [0,1] y sin NaN; la función de una persona, en [−1,1].
- **INV-002** — Ningún vínculo cambia fuera del sistema de relaciones o de las acciones validadas (CLAUDE.md regla 4).
- **INV-003** — El afecto de A por B se lee solo del almacén de A (una sola fuente de verdad).

## 7. Criterios de aceptación
- **CA-001** — *Dado* A con función de B ≥ 0,6, *entonces* es posible y frecuente que la función de A para B sea < 0,3 (asimetría), en 100 personas × 1 año.
- **CA-002** — *Dado* 100 personas × 1 año, *entonces* cada persona tiene de media entre 3 y 15 vínculos con familiaridad > 0,3 (el prototipo se pasa: 16).
- **CA-003** — *Dado* un `BREAKUP`, *entonces* sus causas incluyen al menos 2 eventos previos entre ambos.
- **CA-004** — *Dadas* dos personas con historias distintas en el mismo lugar, *entonces* la que reforzó abrirse (041) forma más amistades que la que reforzó callar o evadir.
- **CA-005** — La cadena de `citizen:explain` de una discusión llega hasta los encuentros que subieron la tensión.

## 8. Parámetros y calibración
| Parámetro | Valor | Estado |
|---|---|---|
| `P_ENCOUNTER` | 0,02 por tick | [M], PA-142 |
| `MAX_ENCOUNTERS_HOUR` | 3 | [M] |
| `FAMILIARITY_GAIN`, `FAMILIARITY_DECAY_DAY` | 0,05 · 0,005 | [M], PA-143 |
| `FRIEND_FAM`, `FRIEND_FN` (salida 0,3 y 0,2) | 0,4 · 0,35 | [M], PA-144 |
| `PARTNER_FN` | 0,6 | [M] |
| `ARGUMENT_TENSION`, `ARGUMENT_COOLDOWN_DAYS` | 0,3 · 2 | [M] (prototipo) |
| `BREAKUP_FN`, `BREAKUP_TENSION`, `BREAKUP_DAYS` | −0,2 · 0,6 · 30 | [M], PA-145 |
| `FORGET_FAM`, `MAX_BONDS` | 0,05 · 40 | [M] |

## 9. Métricas y observabilidad
- Vínculos por persona y su distribución de familiaridad y función; asimetría media por par.
- Amistades, discusiones, parejas y rupturas por año, frente al prototipo (docs/prototipo-referencia.md: 334 amistades, 50 discusiones, 2 parejas nuevas, ~0 rupturas por mundo y año).
- Alertas de degeneración: todos amigos de todos, ninguna discusión, funciones saturadas.

## 10. Preguntas abiertas
- [ ] **P1.** Los encuentros cotidianos usan las posturas de la charla (043) sin LLM. ¿De acuerdo, o prefieres un intercambio más simple (positivo, neutro o negativo)? Propuesta: las posturas, para que la charla y la vida diaria sean el mismo mecanismo.
- [ ] **P2.** ¿Tope de 40 vínculos por persona, y se olvidan primero los conocidos sin contacto? Propuesta: sí.
- [ ] **P3.** Parejas nuevas y rupturas en M3: propuesta, sí, con tasas bajas como el prototipo (2 parejas nuevas por año, rupturas > 0). La atracción: ¿solo entre adultos sin pareja, sin considerar orientación sexual por ahora, o con un dato de orientación en la persona (con fuente del DANE si existe)?
- [ ] **P4.** El apego (seguro, ansioso, evitativo): propuesta, no como rasgo sino como métrica calculada desde la historia (función de los cuidadores en el desarrollo y fuerza de abrirse o evadir), útil para la capa clínica.
- [ ] **P5.** Los vecinos (misma manzana o edificio) como fuente de encuentros aunque no coincidan en un lugar: propuesta, más adelante (con la 025).

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-28 | 0.2 | Reescritura sobre el motor funcional (035 §8, bloque B de M3): la persona como estímulo con función (036), encuentros con las posturas de la charla (043), familiaridad, tensión y confianza (absorbe la 044 R-007), etiquetas con histéresis, rupturas por historia, punto de partida desde el desarrollo (041). Se quitan la extraversión y la compatibilidad de valores |
