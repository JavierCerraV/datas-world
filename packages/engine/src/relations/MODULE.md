---
modulo: relations
ruta: packages/engine/src/relations
estado: en-desarrollo
specs: [037, 036, 035]
actualizado: 2026-09-26
---

# Módulo: relations

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Capa 3 del motor funcional (spec 037): la red relacional de cada persona (relaciones arbitrarias entre estímulos), la derivación de relaciones no enseñadas (vinculación mutua y combinatoria) y la transformación de funciones a través de ellas. No aprende funciones directas (036, `functions/`) ni tiene reglas ni valores (038).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 037 | CA-001 a CA-005; R-001 a R-008; INV-001 a INV-004. CA-001 a CA-003 en `lab/relational.test.ts` (V-7, V-8, V-11a); CA-004 medido con `pnpm cli bench:relations` | CA-004 con redes muy densas (100 estímulos, 5 relaciones por estímulo: 18,7 ms); consolidación de derivadas, deícticos y temporales (MF5–MF6); `RELATION_TAUGHT` y `FUNCTION_TRANSFORMED` en nivel ≥ 3 |

## 3. API pública
Desde `@datas-world/engine`:

| Símbolo | Descripción |
|---|---|
| `RelationType`, `Relation`, `RelationalNetwork`, `emptyNetwork()` | Red de una persona (`Citizen.network`): aristas `A <tipo> B` con fuerza, claves `crel`/`cfunc`, origen y eventos fuente |
| `INVERSE`, `compose(x, y)`, `transformFactor(t)` | Vinculación mutua (R-001), tabla de composición (R-002) y factor de transformación por tipo (R-003) |
| `derive(net, from, ctx?, transformingOnly?)` → `Derived[]` | Relaciones de `from` con los demás, por caminos de hasta 3 aristas, con fuerza, pasos y camino |
| `functionalValue(net, directOf, stim, ctx?, memo?)` → `{ value, source, derived? }` | R-006: la derivada más fuerte o la directa, si es mayor. `directOf` da la función directa (036) |
| `teach(net, teaching)` | R-007: enseña o refuerza una relación; poda por encima de 512 (INV-004) |
| `networkMetrics(net)` | R-008: coherencia, complejidad, nivel de derivación y flexibilidad |
| `EVENT_TEACHING`, `relationsSystem`, `relationalNetworkOf(view, row)` | Tabla de enseñanza de los eventos con hablante y sistema de la fase `memory` (orden 2, capacidad `learning`) |
| `MAX_DEPTH`, `ATTENUATION`, `COMP_FACTOR`, `CFUNC_DEFAULT`, `MAX_RELATIONS` | Parámetros de la 037 §8 |

## 4. Diseño interno y decisiones
- **Derivación:** búsqueda en profundidad por caminos simples de hasta 3 aristas; cada arista se puede recorrer directa o invertida (R-001). El tipo del camino se compone paso a paso (R-002); si no se compone, el camino se corta. Fuerza `Π s × 0,7^pasos`, con pasos = (aristas − 1) + aristas invertidas: una arista enseñada usada tal cual no se atenúa. Para cada (destino, tipo) queda la más fuerte.
- **Transformación (R-003, R-006):** el estímulo recibe la función directa del destino por el factor del tipo (coordinación 1, oposición −1, más 1,5, menos 1/1,5, jerarquía y causal 1; el resto 0), acotada a [−1, 1], por la fuerza y por Cfunc (1 si todas las aristas del camino tienen la clave funcional del contexto; si no, 0,5). No se encadenan derivadas de derivadas.
- **Orden y caché:** la adyacencia se recorre en orden de inserción de las aristas (determinista, INV-003) y se guarda en una caché por arreglo de aristas y contexto. Es válida mientras el arreglo tenga la misma longitud: `teach` solo añade al final o sustituye el arreglo al podar, y los extremos, el tipo y las claves de una arista no cambian después de creada; la fuerza se lee al recorrer (INV-002). Para el valor funcional se podan los caminos cuyo tipo no transforma, porque un tipo así solo se compone en sí mismo.
- **Velocidad (CA-004):** 200 personas × 500 relaciones: 1,0 ms con 500 estímulos, 3,2 ms con 250, 18,7 ms con 100 (red muy densa: unos 1 000 caminos por persona). Antes de las optimizaciones, 27–48 ms.
- **Enseñanza en el mundo (R-007):** `JOB_WARNING` enseña `verbal.llegar_tarde causes verbal.despido` (0,6); `DEBT_TAKEN` con el gota a gota, `verbal.no_pagar causes cuerpo.dolor` (0,7). Aprende el participante con el rol indicado (`empleado`, `deudor`). La red se escribe entera como parche `entity` (copia por JSON) y se persiste con la entidad.
- **Consumidores:** la elicitación de las emociones (`functions/elicit.ts`, con la función aprendida del estímulo sin ontología) y la fuente `aversion` de la selección (`decision/options.ts`, con `directValue`: generalización y primarios).

## 5. Invariantes y guardarraíles
037 INV-001 (ninguna derivada supera la fuerza mínima de su camino), INV-002 (con y sin memoria da lo mismo), INV-003 (sin azar, orden fijo) e INV-004 (tope de 512 aristas). No lee el temperamento.

## 6. Cómo se prueba
- `relations.test.ts` (9 pruebas): mutua para todos los tipos, tabla de composición completa (12 × 12 pares, en la tabla y en la red), INV-001 a INV-004, Crel, Cfunc, interacción directa-derivada, métricas y CA-005 (la advertencia enseña la relación con su evento de origen).
- `lab/relational.test.ts`: V-7, V-8 y V-11a.
- `pnpm cli bench:relations`: CA-004 (`docs/validaciones/MF4-bench-relaciones.md`).

## 7. Paridad con el prototipo
No aplica (ADR-007 §7): la referencia es la batería 042.

## 8. Pendientes y deuda
- [ ] Consolidar derivadas frecuentes como aristas `derived_stored` (MF5, con las reglas).
- [ ] Transformación por marcos deícticos y temporales (MF5–MF6).
- [ ] Más fuentes de enseñanza: conversaciones (025, M3) e historia sintética (041, MF7).
- [ ] Redes densas: medir la densidad realista y, si hace falta, limitar la ramificación (PA-110).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-26 | mf/4-red | — | Documento creado desde la plantilla (sin código) |
| 2026-09-26 | mf/4-red (MF4.1–MF4.4) | 037, 036 | Primera implementación: tipos, derivación y transformación (`derive.ts`), enseñanza, poda y métricas (`network.ts`), tabla de enseñanza y sistema `relations` (`system.ts`). Optimizaciones de CA-004 sin cambiar el resultado |
