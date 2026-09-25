---
modulo: decision
ruta: packages/engine/src/decision
estado: en-desarrollo
specs: [017, 032, 010, 011, 016, 021, 035]
actualizado: 2026-09-25
---

# Módulo: decision

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Motor de decisiones (spec 017): en los bloques flexibles, cada persona compara opciones (rutina, comer, descansar, su esparcimiento), elige con azar acotado, y la acción elegida se valida y se aplica con su explicación como causa.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 017 | CA-001, CA-003, CA-004, CA-005; R-001 a R-006; INV-001 a INV-003 | CA-002 (M3, con creencias); `ACTION_REJECTED` (depuración o nivel ≥ 3) |
| 032 | CA-006; R-006 | R-007 (compañía, M3) |

## 3. API pública
Desde `@datas-world/engine`:

| Símbolo | Descripción |
|---|---|
| `createDecisionSystem(table)` | Sistema de la fase `decision` (orden 1, después de la rutina; capacidad `routines`; nivel ≥ 2): decide en los bloques flexibles y devuelve la acción elegida |
| `createActionValidator(table)`, `ACTION_KINDS` | Validador de las acciones de M2 (`follow_routine`, `eat`, `rest`, `leisure`); se inyecta en el bucle como `loop.validate` (021) |
| `LeisureActivity`, `LeisureTable`, `activityOf` | Actividades de esparcimiento como las usa el motor; la tabla la construye `leisureTable` de los generadores desde el catálogo y el perfil |
| `buildOptions(ctx, rng)`, `freeUntil`, `explainCauses`, tipos `Option`, `Factor`, `ActionParams`, `DecisionCtx` | Opciones con su utilidad y su explicación |
| `softmax`, `temperatureOf`, `choose` | Selección (R-003) con rechazo y nueva elección (R-006) |
| `DECISION_COLUMNS`, `defineDecisionColumns` | Columnas `act.choice` (u8), `act.place` e `act.until` (i32) |

Uso: `new Runner(world, rng, {}, { systems: createRegistry([...NEEDS_SYSTEMS, routinesSystem, createDecisionSystem(table), mobilitySystem]), loop: { validate: createActionValidator(table) } })`.

## 4. Diseño interno y decisiones
- **Cuándo decide:** despierta, sana, sin viaje en curso, en un bloque con flexibilidad ≥ 0,5 (tiempo libre, búsqueda de empleo, oficios, tareas, diligencias, siesta) y sin una decisión en curso. Con hambre crítica (< 0,1) se replantea lo que estuviera haciendo.
- **Compromiso:** lo elegido dura hasta `act.until`, acotado por el primer cuarto de hora de trabajo, colegio o sueño (`freeUntil`, prototipo `cap`). Mientras dura, el sistema mantiene la actividad elegida sobre la de la rutina. La movilidad lleva a `act.place` y no mira más allá hasta que termina. La enfermedad lo cancela, y también un lugar cerrado o lleno al llegar.
- **Opciones y utilidad (R-001, R-002), porta `decide`:**
  - seguir la rutina: en tiempo libre es descansar en casa (`idle`, 0,3 + 0,2 × cansancio); en bloques flexibles con obligación, 0,35–0,45 más responsabilidad; la siesta infantil, 2;
  - comer: 1,5 × hambre, más 4 si el hambre es crítica;
  - dormir un rato, si la energía baja de 0,3;
  - cada afición de la ficha en el lugar abierto más cercano de sus tipos (o en casa), si da tiempo a ir, hacer al menos la mitad y volver. Su utilidad suma diversión, afinidad, compañía (si no es solitaria) y costumbre, y resta coste (con el viaje), tiempo de viaje y cansancio si es física.
- **Costumbre:** 3 × (min(2, tiempo desde `lastDone` / intervalo) − 1), con intervalo = 30 días / `perMonth`. Resta mucho si se hizo hace poco, cero cuando "toca" y suma si se ha pasado. Así la frecuencia sale de la ficha: en una semana del mundo generado, ≈ 1,3 veces lo esperado por `perMonth`.
- **Selección (R-003):** softmax con temperatura 0,3 × (0,6 + 0,8 × impulsividad), con el azar de `sys:decision/<id>`. Si el validador rechaza la elegida, se quita y se vuelve a elegir (R-006). El dinero no filtra las opciones: lo comprueba el validador.
- **Validación y aplicación:**
  - rechaza si la persona está en tránsito o enferma, si la afición no es de su ficha, si no alcanza el dinero (actividad más viaje) o si el lugar está lleno;
  - aplica la actividad, el lugar, el compromiso, el coste de la actividad (el viaje lo cobra la movilidad) y `lastDone`;
  - la afición emite `LEISURE_DONE` con los 3 factores de mayor peso como causas (`decision.<factor>`, R-005).
- Las aficiones se registran como `exercise` (deporte físico), `socialize` (con otros) o `leisure`; las tres suben la diversión (010).

## 5. Invariantes y guardarraíles
INV-001 (softmax finita que suma 1), INV-002 (el estado cambia por la acción validada o por los parches de continuidad del sistema) e INV-003 (determinismo, con la vista congelada).

## 6. Cómo se prueba
`decision.test.ts`: un pueblo pequeño con bar y La Capital, y personas sin empleo con fichas a medida.

| Criterio | Prueba |
|---|---|
| INV-001 | 200 conjuntos de utilidades al azar |
| CA-001 | Hambre 0,05 en tiempo libre: come en > 95 % de 300 semillas |
| CA-003 | Sin dinero para el cine: la opción existe, el validador la rechaza y se elige otra en 100 semillas |
| CA-004 y 032 CA-006 | Diversión 0,1 con el bar abierto: > 50 % elige su ficha y la rumba (afinidad 0,9) gana a las series (0,3) |
| CA-005 y 032 CA-006 | Con el validador en el bucle: `LEISURE_DONE` con causas `decision.*`, va al bar y la diversión sube |
| INV-003 | Tres días con la vista congelada: mismo hash; tras una semana, todos duermen en casa |

En `generators/src/leisure/vida.test.ts`: una semana del mundo generado (frecuencia entre 0,7 y 2 veces la de la ficha, diversión media entre 0,3 y 0,95).

## 7. Paridad con el prototipo
Porta `decide`: opciones de tiempo libre con puntuación y ruido y duración acotada por la próxima obligación y la hora de dormir. Diferencias: softmax en vez de máximo con ruido; las opciones de ocio salen de la ficha de esparcimiento (032) y no de una lista fija; comer fuera, socializar con otros y comprar llegan en M3 y con la economía (bloque F).

## 8. Pendientes y deuda
- [ ] Calibrar pesos y frecuencia con la ENUT en el bloque H (hoy ≈ 1,3 veces la frecuencia de la ficha).
- [ ] Comer fuera (restaurante, café) y comprar, con la economía (bloque F).
- [ ] Reacciones a eventos recientes (R-001) y compañía (032 R-007): M3.
- [ ] `ACTION_REJECTED` en nivel ≥ 3.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-25 | m2/e-decisiones | — | Documento creado desde la plantilla (sin código) |
| 2026-09-25 | m2/e-decisiones (E1–E4) | 017, 032, 010, 016, 021 | `columns.ts`, `options.ts`, `validate.ts`, `system.ts` e `index.ts`. 7 pruebas |
| 2026-09-25 | mf/1-temperamento (MF1.4) | 035, 009 v1.0 | La responsabilidad (utilidad de las obligaciones) y la impulsividad (temperatura) se leen por el adaptador @deprecated (`temperament/legacy.ts`); la impulsividad sale ahora de `tmp.discount0`. Caducan en MF3.4 (040). ESLint y la prueba de arquitectura prohíben importar el temperamento desde este módulo |
