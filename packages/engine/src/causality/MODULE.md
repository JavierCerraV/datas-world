---
modulo: causality
ruta: packages/engine/src/causality
estado: estable
specs: [019, 014, 035, 040]
actualizado: 2026-09-29
---

# Módulo: causality

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Causalidad hasta el origen (spec 019 v0.2): el origen de los estados que se citan como causa y la consulta `why`, que devuelve el árbol de causas de un evento en español. La validación de que una causa es anterior (R-002) está en `makeEvent` (`events.ts`).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 019 | CA-001, CA-005, R-005, R-006 (unidad); CA-002 (unidad y 1 año); CA-003 y CA-004 (1 año, `packages/generators`) | — |

## 3. API pública
- `createOriginsSystem()`: fase `end_of_day`, orden 5, capacidad `needs`, cada tick. Apunta en `Citizen.origins` el último hecho de cada clave (`desempleo`, `dinero`, `enfermedad`, `malestar`, `conflicto`, `sueno`) y borra las que se resuelven.
- `originCause(view, row, keys, now, weight)`: la causa de evento que acompaña a un estado citado (el hecho más reciente de esas claves dentro de su ventana).
- `sleepCauses(view, row, now, debt, weight)`: la deuda de sueño con lo que le quitó el sueño o, si no hubo nada, `horario_de_sueno`.
- `why(get, id, opts)`, `walk`, `whyLines`, `WHY_DEFAULTS`; tipos `WhyNode`, `WhyOptions`, `StateOrigins`, `OriginKey`; `ORIGIN_RULES`, `STRESS_KEYS`.

## 4. Diseño interno y decisiones
- **Orígenes (R-005).** Tabla `ORIGIN_RULES` por tipo de evento. El sueño es aparte: una actividad elegida, una rumiación o un conflicto dentro del horario de dormir de la persona (`routine.bed` a `routine.wakeW`). Si el hecho es de un hogar, cuenta para su jefe o jefa. Ventanas [M]: desempleo 365 días, dinero 90, enfermedad 30, malestar y conflicto 14, sueño 3.
- **Quién cita.** `FELL_ILL` (estrés y sueño), `STRESS_PEAK` (estresores), `OVERSLEPT` (sueño), `DEBT_TAKEN` y `PAYMENT_MISSED`/`RENT_LATE` (dinero y desempleo). La causa de evento va con el peso del estado, junto a él.
- **`why` por niveles (R-004).** Recorre las causas nivel a nivel para que el tope de nodos corte por lo lejano. Normaliza los pesos entre hermanos (R-003), siempre conserva la causa principal y no repite eventos. Las fuentes de control (`fuente.<fuente>:<ref>`) se expanden en los `src` actuales de la función o la respuesta de la persona (R-006), avisándolo en el texto.
- **Poda y medición.** El árbol por defecto poda las ramas de menos del 10 %, para leerlo. La medición de CA-004 usa `minWeight: 0`, porque pregunta si se llega a algún hecho. En el ocio, el aporte principal suele ser la saciedad, un estado, y la costumbre con su origen queda por debajo del 10 %.
- **R-002 por id.** Los ids de evento crecen con cada evento creado, también en la generación, donde se crean fuera del orden de fechas. «Anterior» es «creado antes»: la comprobación es de orden de creación, barata y sin buscar en el registro.

## 5. Invariantes y guardarraíles
- 019 INV-001: `makeEvent` rechaza una causa con id no anterior.
- 019 INV-003: `why` solo lee el registro (por `get`) y, para las fuentes, el estado persistido.

## 6. Cómo se prueba
- `causality.test.ts` (6 pruebas): R-002, CA-001 (despido ← advertencia ← llegada tarde ← dormirse ← noche de series), CA-005, R-006, orígenes (apuntar, borrar, horario de sueño, ventanas).
- `packages/generators/src/relationships-world.test.ts`: 1 año, CA-002 a CA-004.
- `apps/cli/src/explain.test.ts`, `apps/api/src/api.test.ts`, `apps/web/src/why.test.ts`: las tres puertas de consulta.

## 7. Paridad con el prototipo
El prototipo no guarda causas; sin equivalente.

## 8. Pendientes y deuda
- [ ] La saciedad del ocio (`fuente.reforzador:saciedad.*`) no cita la vez anterior que hizo la actividad: podría ser un origen más.
- [ ] En la población actual nadie trasnocha por actividades: la deuda de sueño sale del horario. Cuando la decisión pueda quitar horas de sueño, el origen `sueno` ya lo recoge.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-29 | m3/causalidad (C1) | 019 | Documento creado desde la plantilla (sin código) |
| 2026-09-29 | m3/causalidad (C1–C4) | 019 | Módulo implementado: orígenes de los estados, `why` con fuentes hasta su origen, y R-002 en `makeEvent`. 6 pruebas |
