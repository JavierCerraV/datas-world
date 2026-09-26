---
modulo: stimuli
ruta: packages/generators/src/stimuli
estado: en-desarrollo
specs: [036, 029]
actualizado: 2026-09-25
---

# Módulo: stimuli

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Construye la ontología compartida de estímulos del mundo (spec 036 R-004) a partir del catálogo `stimulus_classes` y de los catálogos de lugares y actividades. No aprende nada: el aprendizaje está en `engine/src/functions`.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 036 | Ontología compartida (MF2.1): todas las clases que usan las reglas del motor, más una por tipo de lugar y por actividad de ocio | Términos verbales y roles de M3 (vida social) y de la capa verbal (037, MF4) |
| 029 | Catálogo jerárquico con fuente y versión | — |

## 3. API pública
| Símbolo | Descripción |
|---|---|
| `buildOntology(catalogs)` → `Ontology` | Clases explícitas del catálogo, más `lugar.<clave>` por cada entrada de `place_kinds` y `actividad.<clave>` por cada una de `leisure_activities`, con los rasgos de su familia (`familia.lugar.<categoría>`, `familia.actividad.<categoría>`). Lanza si falta una familia o una clase que usan las reglas del motor (`WORLD_STIMULI`) |

## 4. Diseño interno y decisiones
- Seis dimensiones de rasgos [M]: social, cuerpo, dinero, trabajo, ocio y hogar. La distancia entre clases es la raíz del error cuadrático medio (036 R-004), así que dos clases que difieren en una sola dimensión generalizan a la mitad con σ = 0,35.
- Los lugares y las actividades heredan los rasgos de su familia: dentro de una familia (p. ej. `ocio.bar` y `ocio.cafe`) la generalización es completa. Es una simplificación conocida; se afinará con rasgos propios cuando la conducta lo pida (PA-131).
- Las entradas `familia.*` no son clases: solo dan rasgos.

## 5. Invariantes y guardarraíles
- Todas las clases tienen la misma dimensión de rasgos (lo comprueba `createOntology`).
- Toda clase de `WORLD_STIMULI` existe en la ontología.

## 6. Cómo se prueba
`stimuli.test.ts`: la ontología del catálogo real incluye las clases del motor, una por tipo de lugar y por actividad, y la generalización entre clases de la misma familia es mayor que entre familias distintas.

## 7. Paridad con el prototipo
No aplica: el prototipo no tiene aprendizaje.

## 8. Pendientes y deuda
- [ ] Rasgos propios por tipo de lugar y actividad (PA-131).
- [ ] Clases de M3 (personas y relaciones) y de la capa verbal (MF4).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-25 | mf/2-funciones | 036 | Módulo creado: catálogo `stimulus_classes` y `buildOntology` (MF2.1) |
