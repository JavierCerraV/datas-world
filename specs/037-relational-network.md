---
id: 037
nombre: relational-network
estado: aprobada
hito: MF (bloque MF4)
depende_de: [035, 036]
version: 0.2
---

# 037 — Red relacional y transformación de funciones (capa 3)

## 1. Propósito
Cómo una persona relaciona estímulos de forma arbitraria (coordinación, distinción, oposición, comparación, jerarquía, deíctico, causal y temporal) y cómo esas relaciones **transforman funciones** sin experiencia directa (McHugh; documento rector §3, §4, §11.2, §11.7). Es lo que hace que el sufrimiento y el gozo humanos sean "verbales".

## 2. Alcance
**Incluye:**
- grafo relacional por persona;
- claves contextuales Crel y Cfunc;
- vinculación mutua y combinatoria bajo demanda;
- transformación de funciones por tipo de relación;
- propiedades medibles de la red;
- origen de las relaciones: la comunidad verbal en los eventos del mundo que ya tienen un hablante (MF4).

**Fuera de alcance:** reglas y valores como redes con significado de contingencia (038, MF5); pensamientos como eventos (039, MF6); conversaciones (025, M3); la consolidación de derivadas frecuentes como aristas (MF5, cuando las reglas las usen); la transformación por marcos deícticos y temporales (se guardan pero no transforman hasta MF5–MF6).

## 3. Modelo de datos
```ts
type RelationType =
  | 'coordination' | 'distinction' | 'opposition'
  | 'more' | 'less'                       // comparación
  | 'contains' | 'part_of'                // jerarquía
  | 'causes' | 'caused_by'                // causal ("si A entonces B")
  | 'before' | 'after'                    // temporal
  | 'deictic';                            // yo–tú, aquí–allí (se guarda; no transforma en MF4)
interface Relation {                      // arista directa: A <tipo> B. Tope 512 por persona
  a: StimulusId; b: StimulusId; t: RelationType;
  s: number;                              // fuerza [0,1]
  crel?: string;                          // clave relacional: solo vale en ese contexto ('' = cualquiera)
  cfunc?: string;                         // clave funcional aprendida: transforma del todo en ese contexto
  o: 'taught' | 'derived_stored' | 'observed';
  src: EntityId[];                        // eventos de origen (019), los 3 últimos
  at: WorldMinute;
}
interface RelationalNetwork { e: Relation[]; pruned: number }   // Citizen.network
interface Derived { to: StimulusId; t: RelationType; s: number; steps: number; path: Relation[] }
interface NetworkMetrics { coherence: number; complexity: number; derivationLevel: number; flexibility: number }
```
`StimulusId` es la clave de una clase de la ontología (036).

## 4. Reglas
- **R-001** [E] — **Vinculación mutua.** De `A t B` se deriva `B inv(t) A`: coordinación, distinción, oposición y deíctico son simétricas; `more ↔ less`, `contains ↔ part_of`, `causes ↔ caused_by`, `before ↔ after` (Hayes, Barnes-Holmes y Roche, 2001, citado en McHugh).
- **R-002** [E] fenómeno / [M] tabla — **Vinculación combinatoria.** De `A x B` y `B y C` se deriva `A (x∘y) C`:
  - coordinación es neutra: `coord ∘ t = t ∘ coord = t`;
  - `opposition ∘ opposition = coordination`;
  - `more ∘ more = more`, `less ∘ less = less`; `contains ∘ contains = contains`, `part_of ∘ part_of = part_of`; `causes ∘ causes = causes`, `caused_by ∘ caused_by = caused_by`; `before ∘ before = before`, `after ∘ after = after`;
  - cualquier otra combinación (incluida la distinción con algo que no sea coordinación, y mezclar marcos) no deriva nada.

  La derivación recorre caminos simples de hasta `MAX_DEPTH = 3` aristas (cada arista, enseñada o invertida por R-001), en orden de id y sin azar. Se calcula bajo demanda, con una memoria por consulta dentro del tick (INV-002).
- **R-003** [T] idea / [M] fórmula — **Transformación de funciones.** Si `X t Y` (enseñada o derivada), `X` recibe la función directa de `Y` transformada:
  - `coordination`: `v`; `opposition`: `−v`; `more`: `v × COMP_FACTOR` (acotada a [−1, 1]); `less`: `v / COMP_FACTOR`;
  - `part_of` (X es parte de Y): hereda `v`; `contains` (X contiene a Y): agrega `v`;
  - `causes` (si X entonces Y): el antecedente adquiere la función de la consecuencia, `v`;
  - `distinction`, `caused_by`, `before`, `after` y `deictic`: no transforman en MF4.

  La función directa de `Y` es su valor neto aprendido (036) o, si no tiene función aprendida y es un reforzador primario, su valor primario (±1). No se encadenan derivadas de derivadas: la composición de R-002 ya cubre los caminos.

  Fuerza de la derivada: `Π s × ATTENUATION^pasos`, donde los pasos de derivación son `(aristas − 1) + aristas invertidas`. Una arista enseñada usada tal cual no se atenúa; la mutua y la combinatoria sí (INV-001).
- **R-004** [T] — **Cfunc.** La transformación vale del todo si el contexto presente es la clave funcional aprendida de la relación que la produce (`cfunc`); si no, se multiplica por `CFUNC_DEFAULT` (PA-008).
- **R-005** [T] — **Crel.** Una relación con `crel` solo participa en la derivación en ese contexto: la misma pareja puede estar en coordinación en un contexto y en distinción en otro.
- **R-006** [T] — **Interacción directa-derivada.** El valor funcional de un estímulo es la derivada más fuerte (por magnitud de `valor transformado × fuerza × Cfunc`) salvo que la directa sea de mayor magnitud; ninguna se borra (PA-005). La usan la elicitación de las emociones (010) y la fuente `aversion` de la selección (040).
- **R-007** [T] fuente / [M] tabla — **Origen de las relaciones en MF4:** la comunidad verbal enseña relaciones en los eventos que ya tienen un hablante, con una tabla `EVENT_TEACHING` [M]:
  - `JOB_WARNING` (la jefa o el jefe): `verbal.llegar_tarde causes verbal.despido` (s = 0,6);
  - `DEBT_TAKEN` con el gota a gota (el prestamista): `verbal.no_pagar causes cuerpo.dolor` (s = 0,7).

  Si la relación ya existe, su fuerza sube `0,3 × (1 − s)`. `JOB_LOST` pasa a incluir `verbal.despido` entre sus estímulos (036), así que quien fue despedido y luego es advertido deriva aversión a llegar tarde. Las conversaciones (025, M3) y la historia sintética (041, MF7) añadirán más fuentes.
- **R-008** [T] idea / [M] definiciones — **Propiedades de la red** (marco MDML de Barnes-Holmes y colaboradores; referencia a verificar):
  - coherencia: fracción de pares (X, Y) derivados sin contradicción (dos caminos que den transformaciones de signo opuesto);
  - complejidad: aristas por nodo;
  - nivel de derivación: 1 − fracción de aristas `derived_stored` (1 en MF4, sin consolidación);
  - flexibilidad: fracción de pares que tienen relaciones de tipo distinto bajo claves `crel` distintas.

## 4 bis. Estatus epistémico
- [E]: vinculación mutua y combinatoria; transformación de funciones como fenómeno (incluida por comparación).
- [T]: Cfunc y Crel como claves separadas; la transformación a través de jerarquía y causal; las propiedades MDML.
- [M]: tabla de composición, atenuación por pasos, profundidad 3, qué marcos transforman en MF4, la tabla de enseñanza y sus fuerzas.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas |
|---|---|---|---|
| `RELATION_TAUGHT` (nivel ≥ 3) | la comunidad verbal enseña una relación | citizenId, a, b, tipo, fuente | el evento donde se enseñó |
| `FUNCTION_TRANSFORMED` (nivel ≥ 3) | una función derivada supera 0,3 por primera vez | citizenId, estímulo, tipo, camino | relaciones del camino y la función de origen |

En nivel 2 no se emiten: la relación guarda su evento de origen (`src`) y la derivada lleva su camino.

## 6. Invariantes
- **INV-001** — Ninguna derivada supera la fuerza mínima de su camino.
- **INV-002** — La memoria de derivaciones es coherente: invalidarla y recalcular da lo mismo (prueba).
- **INV-003** — Las derivaciones son deterministas: orden por id y sin azar.
- **INV-004** — La red no pasa de 512 aristas: se poda la más débil y antigua, y se cuenta lo podado.

## 7. Criterios de aceptación
- **CA-001** — Vinculación mutua y combinatoria correctas para todos los pares de la tabla de R-002; todas las derivadas con fuerza menor que las enseñadas (042 V-7).
- **CA-002** — Transformación por comparación (042 V-8; Dougher et al.; referencia a verificar): A con función aversiva directa −0,5; se enseña B > A y C < A con Cfunc presente; aversiva(B) > aversiva(A) > aversiva(C).
- **CA-003** — Escenario del ajedrez (042 V-11a): "inteligente" con función apetitiva directa; tras enseñar "ajedrez = juego de la inteligencia", la probabilidad de elegir jugar sube; tras enseñar ganar opuesto a perder, inteligente opuesto a tonto y ganar = inteligente, "perder" queda en coordinación derivada con "tonto" y con función aversiva; sin la oposición inteligente–tonto, "tonto" no la tiene.
- **CA-004** — 200 personas con 500 aristas cada una: el valor funcional de un estímulo para todas ellas se calcula en menos de 5 ms (medido con `pnpm bench`).
- **CA-005** — En el mundo generado, una advertencia del trabajo enseña `llegar_tarde causes despido` con su evento de origen, y a quien tenga una función aversiva de "despido" le da aversión derivada a "llegar tarde".

## 8. Parámetros y calibración
| Parámetro | Valor | Estado |
|---|---|---|
| `MAX_DEPTH` | 3 aristas | [M], PA-110 |
| `ATTENUATION` | 0,7 por paso de derivación | [M], PA-006 |
| `COMP_FACTOR` | 1,5 | [M], PA-009 |
| `CFUNC_DEFAULT` | 0,5 | [M], PA-008 |
| Tope de aristas | 512 por persona | [M], PA-130 |

## 10. Preguntas abiertas
PA-005 a PA-010 (§11.2), PA-031 a PA-035 (§11.7), PA-110, PA-111, PA-130.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-25 | 0.1 | Borrador (Fase A, ADR-007) |
| 2026-09-26 | 0.2 | Concreción para MF4: tipos de relación con dirección (comparación, jerarquía, causal y temporal como pares inversos), tabla de composición completa, atenuación por pasos de derivación (una arista enseñada no se atenúa; con la fórmula de la v0.1 la mutua no quedaba por debajo de la enseñada y, junto con Cfunc, V-8 era imposible), la función directa de un reforzador primario, qué marcos transforman en MF4, Cfunc y Crel por relación, enseñanza en eventos con hablante (`JOB_WARNING`, gota a gota), definiciones operativas de las métricas, INV-004 y CA-005. Consolidación de derivadas, deícticos y temporales pasan a MF5–MF6 |
| 2026-09-26 | 0.2 | Estado → aprobada |
| 2026-09-26 | 0.2 | Implementación del bloque MF4. Precisiones: (1) la adyacencia se recorre en orden de inserción de las aristas (determinista) y se guarda en caché por arreglo de aristas; la fuerza se lee al recorrer; (2) para el valor funcional se podan los caminos cuyo tipo no transforma (sin pérdida: un tipo así solo se compone en sí mismo); (3) Cfunc de un camino = 1 solo si todas sus aristas tienen la clave funcional del contexto; (4) la elicitación de las emociones usa como función directa la aprendida del estímulo, sin generalización ni primarios (no tiene la ontología); la selección usa la completa; (5) CA-004: 1,0 ms con 500 estímulos, 3,2 ms con 250 y 18,7 ms con 100 (red muy densa, 5 relaciones por estímulo; coste combinatorio): se cumple con redes de densidad ≤ 2 y queda abierto para las muy densas (PA-110). V-7, V-8 y V-11a verdes a la primera. Sin cambios en CA |
| 2026-09-26 | 0.2 | Ampliación aprobada con la 038 v0.2 (R-007): `opposition ∘ part_of = opposition` en la tabla de composición (lo opuesto a un miembro de una clase es opuesto a la clase; red opuesta de un valor). CA-001 la incluye. Sin más cambios en CA |
