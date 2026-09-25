---
modulo: amenities
ruta: packages/generators/src/amenities
estado: en-desarrollo
specs: [033, 003, 004, 029]
actualizado: 2026-09-24
---

# Módulo: amenities

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Dotación urbana (spec 033): decide qué lugares tiene el municipio y cuántos, según su población y la ley. Reparte los lugares comerciales en las parcelas libres de la plantilla y crea la ciudad de referencia, con los lugares regionales fuera del mapa. No crea organizaciones ni personas.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 033 | CA-001, CA-002 (con 150 000 habitantes, v0.3), CA-003 (INV-001 a INV-003 y `PLACE_BUILT`), CA-004, CA-005, CA-006 (`viajes.test.ts`, con la movilidad del motor); R-001 a R-006 | R-007 y R-008 (M2 y peldaño 4) |

## 3. API pública
Desde `@datas-world/generators`:

| Símbolo | Descripción |
|---|---|
| `amenityPlan(placeKinds, population)` → `AmenityPlan` | `{ population, local: { kind, count, placement }[], regional: kind[] }` a partir del atributo `amenity` de cada tipo (R-001). Un tipo regional que llega a su `minPopulation` pasa a local |
| `resolvePlots(template, plan, placeKinds)` → `{ plots, unplaced }` | Sustituye las parcelas `@com` de la plantilla por los tipos `com` del plan (R-003). Falla si un tipo `template` no tiene sitio (INV-003) |
| `generateRegional(world, territory, plan, placeKinds)` → `{ cityId, placeIds }` | Crea la ciudad de referencia (`REFERENCE_CITY` = "La Capital", hija del departamento) y sus lugares regionales, con horario, capacidad y `travel` del perfil (`amenity.travel.*`) |
| tipos `AmenityRule`, `AmenityPlan`, `ResolvedPlots`, `RegionalResult` | — |

`generateWorld` la usa cuando la plantilla del perfil (`gen.map.template`) tiene parcelas `@com`; el resultado queda en `GeneratedWorld.amenities`.

## 4. Diseño interno y decisiones
- **Reglas en el catálogo.** `place_kinds` 2026.09.3 lleva en cada tipo dotable:

  `amenity: { scope, minPopulation, perInhabitants?, max?, law?, placement, spread? }`

  Instancias = `max(1, ⌊población / perInhabitants⌋)`, hasta `max`.
- **Dos clases de sitio.**
  - `template`: el lugar tiene su parcela fija en la plantilla, p. ej. los institucionales alrededor de la plaza;
  - `com`: el lugar llena una parcela comercial libre.

  Las parcelas comerciales sobrantes pasan a vivienda.
- **Orden del reparto, sin azar:**
  1. primero los tipos `spread` (tiendas de barrio), rotando entre barrios;
  2. después el resto, en el orden del catálogo.

  Los tipos con `noResidentialStratum` (bares, discotecas) no van a una manzana con viviendas de esos estratos.
- **Con 200 habitantes:**
  - lugares: 3 tiendas (una por barrio), bar, restaurante, café, panadería, droguería y corresponsal bancario, más los institucionales de la plantilla;
  - regionales en La Capital: cine, centro comercial, museo, coliseo, banco y parque de diversiones, a 60 min y $12 000 por trayecto.
- **La escuela** (sede de primaria) no crea organización propia: `orgWith: 'educacion.colegio'` la une a la institución educativa (en `organizations`).

## 5. Invariantes y guardarraíles
- 033 INV-001: todo tipo instanciado existe en `place_kinds`.
- 033 INV-002: los lugares locales tienen rectángulo y puerta sobre la calle; los regionales no tienen `rect`, sí `travel`, y su padre es la ciudad de referencia.
- 033 INV-003: los obligatorios por ley existen siempre. `resolvePlots` falla si la plantilla no los tiene.

## 6. Cómo se prueba
`amenities.test.ts` (8 pruebas):
- 033 CA-001, CA-003 y CA-005 sobre el mundo de 200 personas;
- la institución educativa con dos sedes;
- CA-002 y el plan de 200 habitantes;
- R-003: bares fuera del estrato 4, e informe de lo que no cabe;
- CA-004: el perfil prototipo sin dotación.

## 7. Paridad con el prototipo
No aplica: el perfil `prototipo` usa la plantilla del prototipo sin dotación (033 CA-004).

## 8. Pendientes y deuda
- [ ] Plantillas más grandes o expansión del territorio para poblaciones que no caben (`unplaced`, R-008).
- [ ] El viaje a la ciudad de referencia (R-007) llega con la movilidad (016) en M2.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-24 | m1/j-dotacion | — | Documento creado desde la plantilla (sin código) |
| 2026-09-24 | m1/j-dotacion (J1–J3) | 033, 004, 029 | `plan.ts` (`amenityPlan`, `resolvePlots`) y `regional.ts` (`generateRegional`, `REFERENCE_CITY`). 8 pruebas |
| 2026-09-25 | m2/d-movilidad | 033, 016 | Prueba nueva `viajes.test.ts`: el paradero de la plaza, 033 CA-006 (ida y vuelta al cine en bus) y una semana de vida del mundo generado con necesidades, rutina y movilidad |
