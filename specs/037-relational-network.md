---
id: 037
nombre: relational-network
estado: borrador
hito: MF (bloque MF4)
depende_de: [035, 036]
version: 0.1
---

# 037 — Red relacional y transformación de funciones (capa 3)

## 1. Propósito
Cómo una persona relaciona estímulos de forma arbitraria (coordinación, distinción, oposición, comparación, jerarquía, deíctico, causal y temporal) y cómo esas relaciones **transforman funciones** sin experiencia directa (McHugh; documento rector §3, §4, §11.2, §11.7). Es lo que hace que el sufrimiento y el gozo humanos sean "verbales".

## 2. Alcance
**Incluye:**
- grafo relacional por persona;
- claves contextuales Crel y Cfunc;
- vinculación mutua y combinatoria bajo demanda;
- transformación de funciones por tipo de marco;
- propiedades medibles de la red;
- origen de las relaciones (comunidad verbal y derivación propia).

**Fuera de alcance:** reglas y valores como redes con significado de contingencia (038); pensamientos como eventos (039).

## 3. Modelo de datos (preliminar)
```ts
type Frame = 'coordination' | 'distinction' | 'opposition' | 'comparison' | 'hierarchy' | 'deictic' | 'causal' | 'temporal';
interface Relation {                // arista directa (aprendida o dicha), tope 512 por persona
  from: StimulusId; to: StimulusId; frame: Frame;
  dir?: 'more' | 'less' | 'contains' | 'part_of' | 'before' | 'after' | 'if_then' | 'I' | 'you' | 'here' | 'there' | 'now' | 'then';
  strength: number;                 // [0,1]; se cuantiza a u8 en almacenamiento
  crel: ContextKey | 0;             // clave contextual que controla el enmarque
  origin: 'taught' | 'derived_stored' | 'observed';
  sourceEvents: EntityId[];
}
interface DerivedRelation { from: StimulusId; to: StimulusId; frame: Frame; dir?: string; strength: number; path: Relation[]; depth: number; }
interface NetworkMetrics { coherence: number; complexity: number; derivationLevel: number; flexibility: number; }
```

## 4. Reglas
- **R-001** [E] — **Vinculación mutua.** Si A se relaciona con B, se deriva la relación inversa B–A según el marco: coordinación → coordinación; comparación "más que" → "menos que"; jerarquía "contiene" → "parte de" (Hayes, Barnes-Holmes y Roche, 2001, citado en McHugh).
- **R-002** [E] — **Vinculación combinatoria.** De A–B y B–C se deriva A–C con la tabla de composición de marcos (p. ej. oposición ∘ oposición = coordinación; más ∘ más = más).
  - La derivación es perezosa, con profundidad máxima `MAX_DEPTH = 3` [M] y una caché por persona que se invalida al cambiar una arista del camino.
- **R-003** [T] idea / [M] fórmula — **Transformación de funciones** (propiedad principal de los marcos; McHugh; Gil et al., 2012 para la jerárquica):
  - coordinación: transfiere la función con su signo;
  - oposición: la invierte (apetitiva ↔ aversiva);
  - comparación: la escala (`× COMP_FACTOR` o `÷`);
  - jerarquía: el miembro hereda del todo lo que el todo tiene (y el todo agrega de sus miembros);
  - distinción: no transfiere.

  La fuerza derivada es `Π strengths × ATTENUATION^(depth−1)`.
- **R-004** [T] — **Cfunc.** La transformación solo ocurre si el contexto presente contiene la clave funcional aprendida para esa función (por ejemplo, "en el colegio", "cuando juego"). Sin Cfunc aprendida, transfiere con `CFUNC_DEFAULT` [M] (PA-008).
- **R-005** [T] — **Crel.** El marco que se aplica depende de la clave relacional presente: la misma pareja de estímulos puede relacionarse en coordinación en un contexto y en distinción en otro.
- **R-006** [T] — **Interacción directa-derivada.** Cuando una función directa y una derivada del mismo estímulo discrepan, gana la de mayor `fuerza × control contextual`; la otra no se borra (PA-005).
- **R-007** [T] — **Origen de las relaciones:**
  - la comunidad verbal (familia, colegio, pares; 025 y 041) transmite relaciones en conversaciones (`taught`);
  - la persona deriva y, si una derivada se usa a menudo, se consolida como arista (`derived_stored`, lo que baja el nivel de derivación, R-008).
- **R-008** [T] — **Propiedades de la red** (marco MDML de Barnes-Holmes y colaboradores; referencia a verificar):
  - coherencia (fracción de derivaciones sin contradicción);
  - complejidad (aristas por nodo en la subred activa);
  - nivel de derivación (1 − fracción de derivadas consolidadas: más consolidadas = más fluidez y automaticidad);
  - flexibilidad (facilidad para que otra Crel controle la subred, medida por el cambio de marco aplicado ante claves nuevas).

## 4 bis. Estatus epistémico
- [E]: vinculación mutua y combinatoria; transformación de funciones como fenómeno.
- [T]: Cfunc y Crel como claves separadas; la dinámica de las propiedades MDML; la transformación a través de jerarquía.
- [M]: tabla de composición completa, atenuación exponencial, profundidad 3, cuantización de fuerzas.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas |
|---|---|---|---|
| `RELATION_TAUGHT` (nivel ≥ 3) | la comunidad verbal enseña una relación | citizenId, de, a, marco, fuente | conversación (025) o episodio (041) |
| `FUNCTION_TRANSFORMED` (nivel ≥ 3) | una función derivada supera 0,3 por primera vez | citizenId, estímulo, marco, camino | relaciones del camino y la función de origen |

## 6. Invariantes
- **INV-001** — Ninguna derivada supera la fuerza mínima de su camino.
- **INV-002** — La caché es coherente: invalidarla y recalcular da lo mismo (prueba).
- **INV-003** — Las derivaciones son deterministas: orden por id y sin azar.

## 7. Criterios de aceptación (iniciales)
- **CA-001** — Vinculación mutua y combinatoria correctas para todos los pares de marcos de la tabla (042 V-7).
- **CA-002** — Transformación por comparación: si B es "más que" A y A tiene una función aversiva, B deriva una función aversiva mayor (042 V-8; Dougher et al.; referencia a verificar).
- **CA-003** — Escenario del ajedrez (042 V-11a).
- **CA-004** — La derivación de 200 personas con 500 aristas cada una cabe en 5 ms por tick en nivel 2 (medido).

## 8. Parámetros y calibración
| Parámetro | Valor | Estado |
|---|---|---|
| `MAX_DEPTH` | 3 | [M], PA-110 |
| `ATTENUATION` | 0,7 por paso | [M], PA-006 |
| `COMP_FACTOR` | 1,5 | [M], PA-009 |
| `CFUNC_DEFAULT` | 0,5 | [M], PA-008 |

## 10. Preguntas abiertas
PA-006 a PA-010 (§11.2), PA-031 a PA-035 (§11.7), PA-110, PA-111.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-25 | 0.1 | Borrador (Fase A, ADR-007) |
