---
modulo: places
ruta: packages/generators/src/places
estado: en-desarrollo
specs: [004, 029]
actualizado: 2026-09-24
---

# Módulo: places

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Crea los lugares de uso del mundo (viviendas, trabajos, colegio, hospital, comercios, ocio, parque, iglesia) sobre las parcelas de la plantilla de mapa, con los atributos del catálogo `place_kinds`, y pinta sus tiles en el mapa. No crea organizaciones (bloque D, spec 006).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 004 | CA-001, CA-002, CA-003, CA-006; R-001, R-002; R-007 sobre el catálogo; INV-002 | CA-004, CA-005, R-003 a R-005: los cubre el módulo `mobility` del motor (M2); R-006: M3 |

## 3. API pública
Desde `@datas-world/generators`:

| Símbolo | Descripción |
|---|---|
| `generatePlaces(world, territory, placeKinds, plotList?)` → `PlacesResult` | Un lugar por parcela: por defecto, las de la plantilla; con dotación (033), las resueltas por `resolvePlots`. Nombre, horario y capacidad salen del catálogo; el barrio, de la fila del mapa (`districtAt`). Las instancias repetidas de un tipo toman `names[n]` del catálogo (o "Nombre 2"…), y la primera, el nombre propio de la plantilla si lo tiene. Los lugares `nightlife` cierran como tarde a `amenity.nightlifeClose` del perfil. Pinta `building`, `park` o `plaza` en el mapa. Divide cada edificio residencial en viviendas según `unitsPerBuilding[estrato]`. En la plaza crea el paradero intermunicipal (016), si el catálogo lo tiene en M1. Lanza si el mundo no tiene mapa, si un tipo no está en el catálogo o no es de M1, o si falta el número de viviendas de un estrato |
| `PlacesResult` | `{ plots: { plot, placeId, dwellingIds }[], dwellingIds, workplaceIds }`. `workplaceIds` son los lugares con `slots`, para el generador de organizaciones |
| `DWELLING_CAPACITY` | 6 residentes por vivienda: cabe el hogar más grande de las plantillas de la spec 008 |

## 4. Diseño interno y decisiones
- **Sin azar.** Los atributos salen del catálogo y los nombres del orden de las parcelas: "Edificio 01" y "Vivienda 01-A", "01-B"… (004 R-002).
- **Horario.** Sale de `open` y `openDays` del catálogo. `[0, 1440]` pasa a `'24h'` (hospital) y las viviendas quedan `null` (privadas).
- **Viviendas:** 7 por edificio en estrato 2, 6 en estrato 3 y 4 en estrato 4. Con la plantilla salen 13 edificios y 82 viviendas. Cada vivienda comparte la puerta de su edificio y cuelga de él (`parentId`).
- **Atmósfera** (`ambience` de la 004: ruido, aglomeración, comodidad). No se genera en M1: la usa la R-006 (M3) y hoy no hay valores con fuente. Se añadirá al catálogo cuando llegue.
- **Capacidad** de los lugares de uso. Solo la iglesia la tiene (60, del catálogo); la del café y los demás llega con la R-004 (M2).

## 5. Invariantes y guardarraíles
004 INV-002: toda vivienda tiene como padre un edificio residencial del mismo barrio (probado). Las puertas siguen sobre la calle después de pintar los edificios.

## 6. Cómo se prueba
`src/places/places.test.ts` (8 pruebas):
- **CA-001:** tipos esenciales;
- **CA-002:** nombres, horarios y rectángulos contra la tabla literal de `PDEF`/`LAYOUT` del prototipo;
- **CA-003:** 82 viviendas, suficientes para la población objetivo con los perfiles colombiano y prototipo;
- **INV-002;**
- **CA-006:** tipos del catálogo y de M1;
- tiles pintados, puertas en la calle y barrio por fila;
- determinismo;
- **R-007:** turnos ≤ jornada máxima vigente del perfil.

## 7. Paridad con el prototipo
Porta `buildPlaces`, `PDEF` y `LAYOUT`. Diferencias deliberadas:
- la iglesia en lugar de una casa de San Martín;
- "Café Data" en lugar de "Café Cordillera";
- edificios de apartamentos con viviendas en lugar de casas compartidas por hasta dos hogares.

## 8. Pendientes y deuda
- [ ] Atmósfera de los lugares (M3) y capacidad de los lugares de uso (M2).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-24 | m1/c-lugares | — | Documento creado desde la plantilla (sin código) |
| 2026-09-24 | m1/c-lugares (C1, C2) | 004 | `generatePlaces`: 23 lugares de la plantilla, 13 edificios con 82 viviendas, horario y capacidad del catálogo, tiles pintados. 8 pruebas: 004 CA-001, CA-002, CA-003, CA-006, INV-002, R-007 |
| 2026-09-24 | m1/j-dotacion | 004, 033 | Lista de parcelas opcional (dotación), barrio por fila del mapa, nombres por instancia y por plantilla, cierre nocturno limitado por el perfil y tile `plaza`. Con `datas-world-v1` y 200 habitantes: 23 lugares de uso, 15 edificios y 92 viviendas. Las pruebas del prototipo no cambian |
| 2026-09-25 | m2/d-movilidad | 016, 004 | Paradero intermunicipal (`transporte.paradero`, catálogo `place_kinds` 2026.09.4, pasa a M1) dentro de la plaza, con la puerta sobre la calle al este de la entrada |
