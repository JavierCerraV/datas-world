---
id: 038
nombre: rules-values
estado: borrador
hito: MF (bloque MF5)
depende_de: [035, 036, 037]
version: 0.1
---

# 038 — Reglas, valores y augmentals (capa 4)

## 1. Propósito
- La conducta gobernada por reglas: cómo se adquieren, se siguen, compiten con las contingencias y cambian (documento rector §11.5).
- Los valores como **redes jerárquicas de reforzadores positivos** con su red opuesta (McHugh, Figura 1; documento rector §5).

## 2. Alcance
**Incluye:** reglas como redes; pliance, tracking y augmenting; historia de seguimiento por tipo; insensibilidad a las contingencias; valores (valor → metas → objetivos → acciones), red opuesta derivada; augmentals formativos y motivadores; dominios vitales (`life_domains`) como raíces posibles.
**Fuera de alcance:** cómo se experimentan las funciones aversivas de la red opuesta (039).

## 3. Modelo de datos (preliminar)
```ts
interface Rule {                     // tope 32 por persona
  id: number;
  antecedent: StimulusId | ContextKey;
  response: ResponseClass;
  consequence: StimulusId;           // la consecuencia especificada (puede ser verbal, p. ej. "ser buena hija")
  source: 'speaker' | 'self';        // dicha por otro (comunidad verbal) o autogenerada
  speaker?: EntityId;
  kind: 'pliance' | 'tracking' | 'augmenting';
  strength: number;                  // [0,1] probabilidad base de seguimiento
  history: { followed: number; reinforcedByContingency: number; reinforcedBySpeaker: number };
  network: Relation[];               // la red relacional que la constituye (037)
}
// Valor: subred jerárquica cuya raíz es un dominio vital. No hay escalar por valor.
interface ValueNetwork { root: StimulusId /* dominio de life_domains */; nodes: StimulusId[]; opposite: StimulusId[] /* derivada */; }
```

## 4. Reglas
- **R-001** [E] — **Insensibilidad.** La conducta gobernada por reglas puede mantenerse aunque las contingencias cambien, más que la conducta moldeada (Shimoff, Catania y Matthews; Hayes et al.; referencias a verificar).
- **R-002** [T] — **Adquisición.** Las reglas llegan:
  - de la comunidad verbal (padres, profesores, jefes, pares; 025, 041);
  - o se autoformulan por derivación (037): "si llego tarde, me echan".

  Una regla dicha por alguien que tiene función de reforzador generalizado (aprobación) se adquiere con más fuerza.
- **R-003** [T] — **Tipos por su historia:**
  - **pliance:** seguir se refuerza por las consecuencias mediadas por el hablante (aprobación, evitar la crítica);
  - **tracking:** se refuerza por la correspondencia entre la regla y el mundo;
  - **augmenting:** la regla altera la eficacia de una consecuencia (Zettle y Hayes; referencia a verificar).

  La misma frase puede funcionar como uno u otro según la historia de esa persona.
- **R-004** [M] — **Competencia regla–contingencia:**
  - el aporte de una regla a la selección (040) es `strength × historia del tipo × (1 − contraste)`;
  - `contraste` es la discrepancia acumulada entre lo especificado y lo experimentado;
  - el pliance fuerte descuenta menos el contraste (fuente de la insensibilidad, R-001; PA-020).
- **R-005** [T] — **Cambio de reglas.** Una regla de tracking se debilita con el contraste. Una de pliance se debilita cuando el hablante deja de estar presente o de tener función reforzante (PA-022).
- **R-006** [T] — **Valores:**
  - un valor es una red jerárquica (037, marco de jerarquía) cuya raíz es un dominio vital con función reforzante positiva abstracta;
  - los pensamientos y acciones que "señalan" la red adquieren función apetitiva por transformación jerárquica (Gil et al., 2012; McHugh), lo que puede contrarrestar funciones aversivas presentes (contarle un problema a un amigo).
- **R-007** [T] — **Red opuesta.**
  - La persona deriva por oposición una red de reforzadores negativos ("vida sin significado", "no quieren pasar tiempo conmigo") que es la otra cara de sus valores (Gil-Luciano et al., 2019, citado en McHugh).
  - No se guarda: se deriva bajo demanda (037) cuando un evento la activa.
- **R-008** [T] — **Augmentals.** Una regla con función augmental formativa crea una consecuencia verbal nueva ("esto es de gente inteligente"). La motivadora altera temporalmente la eficacia de una consecuencia existente.
- **R-009** [M] — **Dominios vitales.** Los 12 del prototipo (`life_domains`) son las raíces disponibles. Cada persona empieza sin valores: el desarrollo (041) construye 0 a N redes según sus contingencias.

## 4 bis. Estatus epistémico
- [E]: insensibilidad de la conducta gobernada por reglas.
- [T]: tipos de seguimiento, augmentals, valores como redes jerárquicas y su red opuesta.
- [M]: la fórmula de competencia, el contraste acumulado, los topes y el catálogo de dominios.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas |
|---|---|---|---|
| `RULE_DERIVED` | una regla nueva supera 0,3 | citizenId, antecedente, respuesta, consecuencia, tipo | relaciones o hablante |
| `RULE_ABANDONED` (nivel ≥ 3) | una regla baja de 0,1 | citizenId, regla | contraste acumulado |

## 6. Invariantes
- **INV-001** — Toda regla tiene red no vacía y `kind` según su historia (recalculado en `end_of_day`).
- **INV-002** — Ningún valor se representa como escalar por persona (comprobación de esquema).

## 7. Criterios de aceptación (iniciales)
- **CA-001** — Insensibilidad a las contingencias: con la misma historia de refuerzo, la conducta instruida persiste más tras un cambio de programa que la moldeada (042 V-9).
- **CA-002** — Escenario del rechazo a invitaciones (042 V-11b): tras ≥ 3 rechazos, "no quieren pasar tiempo conmigo" adquiere función aversiva por oposición jerárquica a la red de amistad, y solo si la persona tiene esa red.
- **CA-003** — Una acción que señala un valor recibe un aporte apetitivo en la selección aunque tenga una función aversiva directa, y lo pierde si la red de valor se debilita.

## 8. Parámetros y calibración
| Parámetro | Valor | Estado |
|---|---|---|
| Tope de reglas | 32 | [M], PA-130 |
| Peso del pliance sobre el contraste | 0,3 | [M], PA-020 |

## 10. Preguntas abiertas
PA-019 a PA-022 (§11.5), PA-112 a PA-114.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-25 | 0.1 | Borrador (Fase A, ADR-007) |
