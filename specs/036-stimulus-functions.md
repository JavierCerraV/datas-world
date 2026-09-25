---
id: 036
nombre: stimulus-functions
estado: borrador
hito: MF (bloque MF2)
depende_de: [009, 035, 021, 023]
version: 0.1
---

# 036 — Estímulos, funciones y aprendizaje directo (capa 2)

## 1. Propósito
Cómo un estímulo adquiere, mantiene, pierde, generaliza y discrimina funciones por experiencia directa (documento rector §4, §11.1, §11.3, §11.4, §11.6). Es la base de la que parten la red relacional (037) y la selección (040).

## 2. Alcance
**Incluye:**
- ontología compartida de estímulos;
- funciones por persona con origen;
- aprendizaje respondiente y operante;
- extinción contextual;
- generalización y discriminación;
- reforzadores primarios, secundarios y generalizados;
- operaciones motivadoras;
- descuento temporal y variabilidad como estados aprendidos;
- registro de contingencias.

**Fuera de alcance:** funciones derivadas y transformadas (037); reglas (038); eventos privados (039).

## 3. Modelo de datos (preliminar)
```ts
interface StimulusClass {           // ontología compartida del mundo (≈ 4 000 clases, 256 KB)
  id: StimulusId;
  kind: 'person_role' | 'person' | 'place_kind' | 'place' | 'object_kind' | 'event_type' | 'body_state'
      | 'emotion' | 'verbal_term' | 'self_description' | 'response' | 'consequence';
  features: Uint8Array;             // rasgos para la generalización (p. ej. rol, familiaridad, tono, tamaño)
  primary?: 1 | -1;                 // reforzador primario apetitivo o aversivo (comida, dolor, contacto físico…)
}
// Por persona: almacén de funciones (StimulusFunction, 035 §4), tope 256, y fuerzas de respuesta:
interface ResponseStrength { response: ResponseClass; context: ContextKey; strength: number; extinctionMemory: number; lastReinforced: WorldMinute; }
// Registro de contingencias por persona (anillo de 32): conducta emitida pendiente de consecuencia.
interface ContingencyRecord { behavior: number; response: ResponseClass; context: ContextKey; at: WorldMinute; window: number; }
// Estados aprendidos que lee la selección (040): hist.discountK, hist.variability (f32).
```

## 4. Reglas
- **R-001** [E] fenómeno / [M] forma — **Respondiente.** Emparejar un estímulo con otro que ya tiene función la transfiere con una actualización tipo Rescorla-Wagner (referencia a verificar):
  - `ΔV = α_s · β · (λ − ΣV)`;
  - `α_s` es la saliencia del estímulo (sociales: multiplicada por `0,5 + tmp.socialSalience`);
  - `β` es la tasa por valencia (multiplicada por `0,5 + tmp.aversiveSensitivity` o `0,5 + tmp.appetitiveSensitivity`, 009 R-004);
  - `λ` es la magnitud de la consecuencia.
- **R-002** [E] — **Operante.** La fuerza de una respuesta en un contexto sube con consecuencias reforzantes y baja con castigo:
  - la actualización es proporcional al error de predicción y se modula por la sensibilidad correspondiente;
  - el reforzamiento negativo (el cese de un estímulo aversivo) refuerza igual que el positivo (base de la evitación, §11.6).
- **R-003** [E] — **Extinción contextual.** La extinción no borra: crea una memoria inhibitoria ligada al contexto de extinción (`extinctionMemory`), que permite:
  - recuperación espontánea con el paso del tiempo;
  - renovación al cambiar de contexto (Bouton; referencia a verificar).
- **R-004** [E] — **Generalización.** Una función se extiende a estímulos de rasgos parecidos con un gradiente decreciente de la distancia de rasgos:
  - `f(d) = exp(−d²/2σ²)`;
  - `σ` inicial global [M] (Guttman y Kalish; referencia a verificar).
- **R-005** [E] — **Discriminación.** El reforzamiento diferencial (una clase reforzada y otra no) estrecha el gradiente y puede desplazar su pico (desplazamiento del pico; referencia a verificar).
- **R-006** [E] — **Habituación.** Presentar un estímulo sin consecuencia reduce su respuesta elicitada, a la velocidad `tmp.habituationRate`.
- **R-007** [E] — **Reforzadores secundarios.** Un estímulo neutro emparejado con un primario adquiere función reforzante secundaria (la voz de la madre; el rostro preocupado antes de los gritos; McHugh, `docs/investigacion/`).
- **R-008** [T] — **Reforzadores generalizados.** Un estímulo emparejado con varios reforzadores distintos se vuelve generalizado y conserva su eficacia con independencia de la operación motivadora presente. Es el caso de la aprobación, la crítica y el dinero (McHugh). No son innatos: los adquiere cada persona en su desarrollo (041).
- **R-009** [E] fenómeno / [M] dinámica — **Descuento hiperbólico.**
  - `V = A / (1 + k·D)` (Mazur; referencia a verificar);
  - `k = hist.discountK` empieza en la escala de `tmp.discount0`;
  - `k` se ajusta despacio con la historia: las demoras largas reforzadas lo bajan y las recompensas prometidas que no llegan lo suben (PA-104).
- **R-010** [T] — **Operaciones motivadoras.** Hambre, fatiga, soledad y dolor (010) alteran la eficacia de los reforzadores relevantes y la probabilidad de las respuestas que históricamente los produjeron. No son objetivos que se suman a la utilidad (Michael; referencia a verificar).
- **R-011** [M] — **Registro de contingencias.**
  - Cada conducta emitida abre un registro con ventana `window` (por defecto 60 min; hasta 1 día en las demoradas).
  - Las consecuencias que llegan como eventos se imputan a la conducta más reciente del registro que las produjo, con peso decreciente con la demora.
  - La imputación queda en las causas del evento de aprendizaje (019).
- **R-012** [E] fenómeno / [M] forma — **Variabilidad operante.**
  - `hist.variability` empieza en `tmp.variability0`;
  - sube si la variación se refuerza (contextos nuevos, fracasos repetidos de la respuesta dominante) y baja con el reforzamiento estable (Neuringer; referencia a verificar; PA-105).

## 4 bis. Estatus epistémico
- [E]: adquisición, extinción, recuperación espontánea, renovación, gradientes, habituación, reforzadores secundarios, descuento hiperbólico, variabilidad operante.
- [T]: reforzadores generalizados como independientes de la operación motivadora; operaciones motivadoras.
- [M]: la forma Rescorla-Wagner como implementación única de lo respondiente; el gaussiano del gradiente; la ventana de imputación; los topes.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas |
|---|---|---|---|
| `FUNCTION_ACQUIRED` (nivel ≥ 3) | una función directa supera 0,3 | citizenId, estímulo, tipo, valencia, fuerza | los eventos del emparejamiento o de la consecuencia |
| `FUNCTION_EXTINGUISHED` (nivel ≥ 3) | una función baja de 0,1 por extinción | citizenId, estímulo | presentaciones sin consecuencia |

## 6. Invariantes
- **INV-001** — Fuerzas en [0,1], sin NaN; `ΣV` acotada.
- **INV-002** — Toda función guarda `origin` y `sourceEvents` no vacío (o el episodio del desarrollo).
- **INV-003** — El almacén no supera sus topes; lo podado se archiva (027) y deja rastro agregado.

## 7. Criterios de aceptación (iniciales)
- **CA-001** — Curva de adquisición negativamente acelerada y extinción gradual (042 V-1).
- **CA-002** — Recuperación espontánea y renovación ABA (042 V-2).
- **CA-003** — Gradiente de generalización y su estrechamiento con entrenamiento discriminativo (042 V-3).
- **CA-004** — 009 CA-E: a igual historia, mayor `tmp.aversiveSensitivity` produce funciones aversivas más fuertes en cada ensayo.
- **CA-005** — La aprobación social se vuelve reforzador generalizado tras emparejarse con ≥ 3 reforzadores distintos y conserva su eficacia sin la operación motivadora de ninguno de ellos.
- **CA-006** — Descuento hiperbólico con inversión de preferencias (042 V-5).

## 8. Parámetros y calibración
| Parámetro | Valor | Estado |
|---|---|---|
| `β` base apetitiva / aversiva | 0,15 / 0,2 | [M], PA-103 |
| `σ` del gradiente | 0,35 en distancia normalizada | [M], PA-106 |
| Ventana de imputación | 60 min (1 día para demoradas) | [M], PA-107 |
| Topes | 256 funciones y 256 fuerzas | [M], PA-130 |

## 10. Preguntas abiertas
PA-001 a PA-005 (§11.1), PA-011 a PA-014 (§11.3), PA-015 a PA-018 (§11.4), PA-023 a PA-026 (§11.6), PA-103 a PA-107.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-25 | 0.1 | Borrador (Fase A, ADR-007) |
