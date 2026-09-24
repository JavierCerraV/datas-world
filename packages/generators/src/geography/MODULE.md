---
modulo: geography
ruta: packages/generators/src/geography
estado: en-desarrollo
specs: [003, 029]
actualizado: 2026-09-24
---

# Módulo: geography

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Genera el mapa (tiles, calles, manzanas) y la jerarquía territorial colombiana (departamento → municipio → comuna → barrios con estrato) de un mundo nuevo, desde una plantilla. No crea edificios ni lugares de uso: eso es del bloque C (spec 004), que usa las parcelas de la plantilla.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 003 | CA-001, CA-002, CA-003, CA-004, CA-005; R-003 (los barrios parten el mapa); INV-002 (una sola generación) | — |

## 3. API pública
Desde `@datas-world/generators`:

| Símbolo | Descripción |
|---|---|
| `generateGeography(world, { template?, departmentName?, placeKinds? })` → `Territory` | Pone `world.geo` (calles y pasto) y crea con `addPlace` el departamento, el municipio (se llama como el mundo, `config.name`), la comuna 1 y los barrios. Con `placeKinds` comprueba que los tipos existan en el catálogo. Lanza si el mundo ya tiene mapa |
| `Territory` | `{ template, departmentId, municipalityId, comunaId, districtIds }` |
| `districtAt(world, territory, y)` | Barrio de una fila del mapa |
| `PROTOTYPE_64X40`, `MAP_TEMPLATES`, tipos `MapTemplate`/`DistrictTemplate`/`PlotTemplate` | Plantillas de mapa |
| `plots(template)` | Parcelas (23 en la plantilla del prototipo): tipo de lugar, rectángulo y puerta, en orden de fila, columna e índice |
| `isRoadTile(template, x, y)` | Regla de calles de la plantilla |
| `SAFETY_BY_STRATUM`, `DEFAULT_DEPARTMENT` | Parámetros por defecto |

## 4. Diseño interno y decisiones
- **La plantilla es el prototipo:** 64 × 40 tiles de 8 m; calles de 2 tiles en `x ∈ {5, 17, 29, 41, 53}` e `y ∈ {4, 14, 24, 34}`; manzanas en `COLS`/`ROWS`; parcelas y puertas como `buildPlaces`. La única diferencia es la iglesia, que ocupa la primera casa de la tercera manzana de San Martín (004 R-001).
- **Sin azar:** la plantilla es fija, así que no se consume el flujo `gen:geography`. Queda reservado para plantillas procedurales (por ejemplo, el mapa del concepto visual B, con avenida de ladrillo y plaza).
- **Barrios por filas** que parten el mapa sin huecos: La Esperanza `y 0–14`, estrato 3; Centro `y 15–24`, estrato 4; San Martín `y 25–39`, estrato 2. Las puertas de cada fila de manzanas caen en su barrio. La plantilla lleva la década de fundación de cada barrio para la historia (030).
- **Códigos DIVIPOLA ficticios** con prefijo `00`, que ningún departamento real usa: departamento `00`, municipio `00001`, comuna `00001-C01`, barrios `00001-C01-B01…`. Los códigos de comuna y barrio no son oficiales del DANE; siguen su jerarquía.
- **Nombres:** el municipio se llama como el mundo (`world:new --name`), porque Data's World simula cualquier municipio. El departamento es un parámetro.
- **Coste:** mapa de 2 560 B en RAM; 6 lugares territoriales.

## 5. Invariantes y guardarraíles
- El mapa no cambia después de generarse (003 INV-002): `generateGeography` falla si ya existe.
- Cada barrio tiene la cadena territorial completa.
- Las filas de los barrios se comprueban al generar.

## 6. Cómo se prueba
`src/geography/geography.test.ts` (7 pruebas):
- **CA-004:** los 2 560 tiles contra la regla literal del prototipo, más manzanas y parcelas;
- **CA-001:** mismo hash y mismos lugares;
- **CA-002 y CA-003:** las 23 puertas están en la calle; la matriz de distancias es simétrica, ≥ Manhattan y sin inalcanzables;
- **CA-005:** jerarquía y códigos;
- **R-003:** partición en barrios;
- **INV-002:** una sola generación; plantilla desconocida;
- los tipos de la plantilla existen en el catálogo y son de M1.

## 7. Paridad con el prototipo
Porta `isRoad`, `ROAD_X`, `ROAD_Y`, `COLS`, `ROWS`, `LAYOUT`, `BARRIOS` y el cálculo de rectángulos y puertas de `buildPlaces`. Diferencia deliberada: la iglesia.

## 8. Pendientes y deuda
- [ ] Plantilla procedural "pueblo soleado" (concepto visual B): avenida, plaza y fuente. Opcional, para cuando llegue el visor (M4).
- [ ] Zona rural (corregimientos y veredas) en el peldaño 4.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-24 | m1/b-geografia | — | Documento creado desde la plantilla (sin código) |
| 2026-09-24 | m1/b-geografia (B1–B3) | 003 | Plantilla `prototipo-64x40` con parcelas y puertas; `generateGeography` (mapa y jerarquía territorial con estrato y DIVIPOLA ficticio); `districtAt`. 7 pruebas: 003 CA-001 a CA-005 |
