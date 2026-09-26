---
id: 017
nombre: decision-engine
estado: aprobada
hito: M2 (decisión con estado propio e información pública) · M3 (con creencias, 025)
depende_de: [009, 010, 011, 015, 016, 021, 032]
version: 0.2
---

# 017 — Motor de decisiones

## 1. Propósito
Cómo una persona elige qué hacer en cada momento. Compara opciones (seguir la rutina, comer, descansar, salir con amigos, ir a La Capital, buscar trabajo) según:
- sus necesidades y sus valores;
- su personalidad;
- su dinero y su energía;
- el contexto.

Elige con azar acotado. Toda decisión se convierte en una **acción** que el motor valida (CLAUDE.md regla 4). Cada decisión guarda **por qué** se tomó (`explain`), y eso responde, por ejemplo, "¿por qué no fue a la sesión?" en la capa clínica (034).

## 2. Alcance
**Incluye:** generación de opciones, función de utilidad, selección, acciones, validación y explicación.
**Fuera de alcance:** LLM (026); creencias sobre otros (025, M3).

## 3. Modelo de datos
```ts
interface ActionRequest { actor: EntityId; kind: ActionKind; target?: EntityId; params?: unknown; reason: CauseRef[]; }
interface ActionResult { ok: boolean; rejected?: string; patches: Patch[]; events: WorldEvent[]; }
interface Option { action: ActionRequest; utility: number; explain: { factor: string; contribution: number }[]; }
type ActionKind = 'follow_routine' | 'eat' | 'sleep' | 'rest' | 'wash' | 'go_to' | 'work' | 'study'
                | 'leisure' | 'socialize' | 'shop' | 'job_search' | 'seek_care' | 'borrow';
```
Las opciones se calculan y se descartan en el tick; solo se guarda la elegida, como causa del evento resultante. Coste en RAM: transitorio.

## 4. Reglas
- **R-001 (opciones)** — Opciones = la actividad de la rutina (011) + alternativas que satisfacen necesidades urgentes (010) + reacciones a eventos recientes + en bloques libres, las actividades de la ficha de esparcimiento (032 R-006) posibles a esa hora (lugar abierto, 004; dinero, 015; tiempo de viaje, 016).
- **R-002 (utilidad)** — utilidad =
  - Σ (peso de la necesidad × mejora esperada);
  - \+ afinidad de la actividad (032) y de los valores (009);
  - \+ sesgo de personalidad;
  - \+ hábito (018, desde M5);
  - − coste en dinero, energía, tiempo y riesgo percibido.
- **R-003 (selección)** — Softmax con temperatura base 0,3 (prototipo), mayor con más impulsividad. El azar sale del flujo de la persona (`sys:decision/<id>`, 021 R-008).
- **R-004 (información)** — **En M2**, la persona decide con su propio estado y con información pública (horarios, precios, lugares), sin saber lo que otros ocultan. **Desde M3**, decide con sus creencias (025), no con la verdad.
- **R-005 (explicación)** — La acción aplicada guarda un `explain` resumido (los 3 factores de mayor contribución) como causa del evento que produce. El informe de vida (020) y la capa clínica (034) lo leen.
- **R-006 (validación)** — Una acción imposible (sin dinero, lugar cerrado, sin fuerzas) se rechaza y se elige la siguiente opción. El rechazo solo se registra como evento en depuración o en nivel ≥ 3.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `ACTION_REJECTED` | acción inválida (depuración o nivel ≥ 3) | actor, acción, motivo | precondición incumplida |

Las demás acciones producen los eventos de su spec (`LEISURE_DONE`, 032; `ARRIVED_LATE`, 016; `DEBT_TAKEN`, 015…), con el `explain` como causa.

## 6. Invariantes
- **INV-001** — Utilidades finitas; probabilidades de la softmax en [0,1] que suman 1.
- **INV-002** — Ningún cambio de estado fuera de la validación de acciones.
- **INV-003** — Mismo estado + misma semilla = misma decisión (023).

## 7. Criterios de aceptación
- **CA-001 (M2)** — *Dado* hambre crítica y comida disponible, *entonces* se elige comer en > 95 % de los casos.
- **CA-002 (M3)** — *Dado* una persona que cree (falsamente) que un amigo la traicionó, *entonces* baja la probabilidad de buscarlo, aunque la verdad sea otra (con la 025).
- **CA-003 (M2)** — *Dado* una acción imposible (sin dinero), *entonces* se rechaza y se elige otra.
- **CA-004 (M2)** — *Dado* un bloque libre con `fun` baja, dinero y un bar abierto, *entonces* la persona elige una actividad de su ficha (032 CA-006), y la de mayor afinidad es la más frecuente.
- **CA-005 (M2)** — *Dado* cualquier acción aplicada, *entonces* su evento tiene entre las causas el `explain` de la decisión.

## 8. Parámetros y calibración
| Parámetro | Valor inicial | Fuente | Estado |
|---|---|---|---|
| temperatura base | 0,3; ruido 0,12 | prototipo | estimado |
| peso de las necesidades | por necesidad, del prototipo | prototipo | estimado |

## 9. Métricas
Distribución de actividades por hora y por situación (comparable con la ENUT), rechazos por motivo, factores más frecuentes en `explain`.

## 10. Preguntas abiertas
- [x] ¿Creencias en M2? → No: estado propio e información pública; creencias en M3 (usuario, 2026-09-25).
- [x] ¿Ocio desde la ficha de esparcimiento? → Sí (usuario, 2026-09-25).

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-25 | 0.2 | Revisión de M2 con las decisiones del usuario: en M2 decide con su estado e información pública, y con creencias desde M3 (CA-002 pasa a M3); opciones de esparcimiento desde la ficha 032; `explain` como causa (enganche de la capa clínica, 034); tipos de acción de M2; CA-004 y CA-005 nuevos |
| 2026-09-25 | 0.2 | Estado → aprobada |
| 2026-09-25 | 0.2 | Implementación del bloque E de M2 (módulo `decision` del motor). Precisiones: se decide en los bloques con flexibilidad ≥ 0,5 y lo elegido se mantiene hasta `act.until`, acotado por el trabajo, el colegio o el sueño (prototipo `cap`); tipos de acción de M2: `follow_routine`, `eat`, `rest` y `leisure` (los demás llegan con sus specs); seguir la rutina en tiempo libre es descansar en casa (`idle`); la frecuencia de cada afición sale de la ficha con `lastDone` (término "costumbre"); temperatura 0,3 × (0,6 + 0,8 × impulsividad); el dinero no filtra opciones, lo rechaza el validador (R-006); la tabla de actividades se inyecta al crear el sistema (sin E/S en el motor); el `explain` son los 3 factores de mayor peso como causas `decision.<factor>`. Sin cambios en CA |
| 2026-09-25 | 0.2 | Bloque MF1 (ADR-007, 035 §9): la temperatura (impulsividad) y la utilidad de las obligaciones (responsabilidad) se leen por el adaptador @deprecated de la 009 v1.0; la impulsividad sale ahora de `tmp.discount0`. Esta spec pasa a `obsoleta` en MF3.4, sustituida por la 040. Sin cambios en CA |
| 2026-09-25 | 0.2 | Bloque G de M2: el tiempo libre termina `mobility.habits.lookahead` (30 min) antes de la próxima obligación, para que la movilidad salga a tiempo. Sin cambios en CA |
| 2026-09-25 | 0.2 | Bloque H de M2: `runCoarse` del motor de decisiones para el nivel 1 (021 R-011): mantiene lo elegido cada tick y decide algo nuevo solo en punto cada hora. Sin cambios en CA |
