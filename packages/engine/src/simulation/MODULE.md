---
modulo: simulation
ruta: packages/engine/src/simulation
estado: en-desarrollo
specs: [021, 001, 002, 023]
actualizado: 2026-09-25
---

# Módulo: simulation

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
El bucle de simulación de la spec 021: registro de sistemas enchufables, fases del tick, vista de solo lectura, parches, flujos de azar por sistema, capacidades y niveles de detalle. No contiene ningún sistema concreto: cada uno (needs, routines…) vive en su módulo y se registra aquí.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 021 | CA-004, CA-005, CA-006; R-001, R-005 a R-008, R-011; INV-003 | CA-001, CA-002 (bloque H); CA-003 y R-010 (observación, M4); CA-007 (M7); R-002, R-009 (niveles 3 y 4, M3–M4) |

## 3. API pública
Desde `@datas-world/engine`:

| Símbolo | Archivo | Descripción |
|---|---|---|
| `System`, `SystemOutput`, `SystemEvent`, `TickCtx`, `Patch`, `Phase`, `Cadence`, `SimLevel`, `WorldView`, `DeepReadonly`, `ActionRequest`, `ActionOutcome`, `ActionValidator`, `PHASES` | `system.ts` | Tipos de la spec 021 §3 |
| `createRegistry(systems)`, `activeSystems(registry, capabilities)`, `EMPTY_REGISTRY`, tipo `SystemRegistry` | `registry.ts` | Registro validado (ids únicos, fase, capacidad, cadencia) y ordenado por fase, `order` e `id` |
| `runSystems(world, rng, registry, { guard?, validate? })` | `loop.ts` | Corre los sistemas activos del minuto actual. Lo llama `tick` después del scheduler |
| `levelOf(world, row)` | `loop.ts` | Nivel de una persona; en M2, siempre 2 (R-011) |
| `applyPatches(world, patches, source)` | `patches.ts` | La única vía de cambio para un sistema: celdas de columnas (`set`, `add`) y campos de entidades (`entity`) |
| `viewOf(world, guard)` | `view.ts` | Vista de solo lectura; con `guard`, un Proxy que lanza ante cualquier escritura |

`SystemEvent` es un `NewEvent` con `recordAs?: { column, row }`: el bucle anota el número del id asignado en esa columna i32 de la persona, para que otro sistema lo cite después como causa (`{ event }`). Lo usa la rutina con `OVERSLEPT` y lo cita `ARRIVED_LATE`.

`tick(world, rng, handlers?, systems?, loop?)` y `new Runner(world, rng, handlers?, { systems?, loop? })` aceptan el registro y las opciones. Por defecto se usa el registro vacío: los mundos de M0 y M1 no cambian.

## 4. Diseño interno y decisiones
- **Fases** (R-001): needs → decision → actions → interactions → economy → information → memory → end_of_day. El scheduler lo atiende `tick` antes de los sistemas, como en M0.
- **Parches al final de cada fase** (R-007). Todos los sistemas de una fase leen el mundo tal como quedó al terminar la anterior. Los parches, eventos y acciones se aplican al final de la fase, en orden de sistema y de emisión.
- **Eventos como `NewEvent`.** Los sistemas no crean eventos con id: devuelven su descripción y el bucle les asigna id y minuto al aplicar. Así la numeración es determinista y ningún sistema toca los contadores.
- **Azar** (R-008): `rng.fork('sys:' + id).fork(now)`; cada tick recibe un flujo nuevo del sistema, y `runCoarse`, `.fork('coarse')`. El sistema deriva por persona con `fork(citizenId)`.
- **Vista congelada** (CA-005): un Proxy recursivo (con caché) bloquea escrituras, borrados y métodos mutadores (`set`, `delete`, `fill`…) de mapas y arreglos tipados. Solo con `loop.guard` (en pruebas), por coste.
- **Niveles** (R-011): todas las personas activas en nivel 2; `runCoarse` recibe a las de nivel menor que `minLevel`. La columna de nivel, la promoción, la observación (R-010) y el presupuesto (R-009) llegan con los niveles 3 y 4.
- **Acciones:** se validan con el validador que se inyecta (017, bloque E). Sin él, devolver acciones es un error. Una acción rechazada no cambia nada.
- **Capacidades** (R-005, CA-006): solo corren los sistemas cuya capacidad está activa. Una capacidad activada por entrada externa en el minuto t corre desde el tick siguiente. El motor de decisiones usa la capacidad `routines` (no hay capacidad `decision`).

## 5. Invariantes y guardarraíles
- 021 INV-003: el orden es función pura de (registro, capacidades); probado con el registro en otro orden.
- Un parche inválido (columna o entidad inexistente, fila fuera de rango, valor no finito, entero con decimales) lanza.
- Un parche no cambia `id` ni `status` de una entidad.

## 6. Cómo se prueba
`simulation.test.ts` (8 pruebas):
- CA-004: azar independiente al registrar un sistema intermedio;
- CA-005: cuatro intentos de escritura bloqueados;
- CA-006: capacidad activada en el tick siguiente;
- R-007: parches por fase;
- cadencias (288 ticks, 24 horas, 1 día), `runCoarse` y eventos de sistema;
- R-005: validación del registro e INV-003;
- mismo hash sin sistemas;
- acción sin validador.

## 7. Paridad con el prototipo
Porta el orden de `tick` del prototipo (necesidades → decisiones → acciones → interacciones → procesos diarios) como fases. Los sistemas concretos llegan en los bloques B a G.

## 8. Pendientes y deuda
- [ ] Niveles 3 y 4, observación sin efecto (R-010, CA-003) y presupuesto (R-009): M3–M4.
- [ ] Medir el coste por sistema en `pnpm bench` (§9 de la 021) cuando haya sistemas.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-25 | m2/a-bucle | — | Documento creado desde la plantilla (sin código) |
| 2026-09-25 | m2/a-bucle (A1–A4) | 021, 001, 023 | `system.ts`, `registry.ts`, `loop.ts`, `patches.ts` y `view.ts`; `tick` y `Runner` recorren el registro. 8 pruebas |
| 2026-09-25 | m2/b-necesidades | 021 | Parche `setMany` (muchas filas de una columna en un solo parche), la forma rápida para sistemas por persona. La vista congelada devuelve tal cual lo que ya está congelado (la configuración del mundo), como exige el invariante de Proxy |
| 2026-09-25 | m2/d-movilidad | 021, 014 | `SystemEvent` con `recordAs`: el bucle anota el id asignado a un evento en una columna de la persona, para citarlo como causa desde otro sistema (016 CA-002). Sin cambios para los sistemas que no lo usan |
| 2026-09-25 | m2/f-economia | 021, 015 | Parche `transfer` (`from`, `to`, `amount`) entre cuentas (`Account`: persona, hogar, organización o resto del país) y `balanceOf`: mueve dinero en un paso, así que la suma se conserva por construcción (015 R-006); rechaza montos no enteros o no positivos y saldos de persona fuera de i32 |
