---
modulo: catalogs
ruta: packages/generators/src/catalogs
estado: en-desarrollo
specs: [003, 004, 005, 006, 007, 008, 009, 030]
actualizado: 2026-09-24
---

# Módulo: catalogs

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Carga y valida los **catálogos de datos** del ADR-006: tipos de lugar, de objeto, sectores, ocupaciones, niveles educativos, niveles territoriales, oficios informales y hechos históricos. Cada tipo nuevo del mundo se añade aquí como una fila, no como código. No genera nada: solo ofrece los catálogos ya validados y su hash.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 003, 004, 005, 006, 007, 030 | Soporte de datos del ADR-006: catálogos validados con hash. Además, 004 R-007 (turnos ≤ 42 h) sobre los datos | Los criterios de cada spec se prueban en su generador (bloques B a H) |

## 3. API pública
Desde `@datas-world/generators`:

| Símbolo | Descripción |
|---|---|
| `CATALOG_NAMES`, tipo `CatalogName` | Los 15 catálogos de M1, en orden canónico |
| `loadCatalog(name, dir?)`, `loadCatalogs(dir?)` → `Catalogs` | Lee `packages/generators/catalogs/<nombre>.json` y lo valida. Lanza con todos los problemas |
| `parseCatalog(data, label?)` | Valida un catálogo ya leído (Zod + orden de claves) |
| `catalogRef(c)`, `catalogRefs(cs)` | `{ version, hash }` para `WorldConfig.catalogs` (ADR-006 §4). El hash es el `hashString` del motor sobre el JSON canónico |
| `catalogEntry(c, key)` | Entrada por clave. Lanza si no existe: un tipo desconocido es un error |
| `entriesSince(c, 'M1')` | Entradas instanciables en un hito. Compara dentro de la misma letra: `M` con `M` y `P` con `P` |
| tipos `Catalog`, `CatalogEntry` | `{ name, version, source, entries: { key, name, code?, since, requires?, attrs? }[] }` |

## 4. Diseño interno y decisiones
- **Formato.** JSON en `packages/generators/catalogs/`, fuera de `src/`, porque son datos. Zod valida en el borde (ADR-001): clave jerárquica `^[a-z0-9_]+(\.[a-z0-9_]+)*$`, `since` = `M0–M9` o `P0–P9`, campos desconocidos rechazados (`strict`), versión `AAAA.MM.n`.
- **Orden obligatorio.** Las entradas van en orden estricto de clave. Así el catálogo ya es canónico y un duplicado se detecta al validar.
- **`attrs` libre** (`Record<string, unknown>`). Cada generador valida los atributos que usa. En M1:
  - lugares: `defaultName`, `open`, `openDays`, `slots`, `payProtoDaily`, `shiftProto`, `shiftCO`, `wageMultiple`, `occupations` (`{ boss, staff[] }`), `factor`, `unitsPerBuilding`, `capacity`;
  - objetos: `price`, `priceStatus`, `sentimental`, `ownedBy`, `gen` (reglas por edad), `condition`;
  - educación: `column`;
  - territorio: `parent`, `placeKind`;
  - oficios: `occupation`, `kind`;
  - hechos históricos: `start`, `end`, `effects`;
  - rasgos: `column`, `proto`, `invert`, `correlations`; valores: `column`, `proto`.
- **Turnos colombianos** (`shiftCO`). Cumplen 42 h semanales sin almuerzo, por la Ley 2101. Por ejemplo, la oficina trabaja de lunes a viernes de 07:00 a 16:24 con 60 min de almuerzo: 8 h 24 min × 5 = 42 h. `shiftProto` conserva el turno del prototipo para la paridad.
- **Códigos CIIU y CIUO.** Se escribieron desde la clasificación publicada, con nombres abreviados. Queda pendiente verificarlos uno a uno contra la tabla oficial del DANE (lo dice el `source` de cada catálogo).

## 5. Invariantes y guardarraíles
Claves únicas, jerárquicas y en orden; `since` válido; el hash cubre el contenido canónico. Un cambio en cualquier fila cambia el hash y, por tanto, el mundo generado (ADR-006 §4).

## 6. Cómo se prueba
`src/catalogs/catalogs.test.ts` (8 pruebas):
- carga y nombre de todos los catálogos;
- hash estable y sensible al contenido;
- lo esencial de M1 en `place_kinds` y el `since` de las entradas futuras;
- turnos ≤ 42 h;
- formato de los códigos CIIU, CIUO y CINE;
- coherencia entre lugares y sectores;
- fechas de los hechos históricos;
- rechazo de claves duplicadas, fuera de orden o mal formadas y de campos desconocidos.

## 7. Paridad con el prototipo
Las entradas de M1 de `place_kinds` llevan `proto` (el tipo del prototipo), `defaultName`, `open`, `slots`, `payProtoDaily`, `shiftProto` y `factor` de `PDEF` y `FACTOR`. Las de `object_kinds` llevan precios de `PRICE`. Diferencia deliberada: el café se llama "Café Data" (antes "Café Cordillera"), por el nombre del mundo.

## 8. Pendientes y deuda
- [ ] Verificar los códigos CIIU y CIUO contra las tablas oficiales del DANE.
- [ ] Calibrar los `effects` de `historical_events` (bloque H).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-24 | m1/a-catalogos | — | Documento creado desde la plantilla (sin código) |
| 2026-09-24 | m1/a-catalogos (A1, A2) | ADR-006, 004, 005, 006, 007, 030 | Esquema Zod, cargador con hash y los 8 catálogos iniciales (lugares con entradas hasta P4, objetos, sectores CIIU, ocupaciones CIUO, niveles CINE, territorio, oficios informales, hechos históricos). 8 pruebas |
| 2026-09-24 | m1/d-organizaciones | 006 | `place_kinds` 2026.09.2: atributo `occupations` (`{ boss, staff[] }`, códigos CIUO) en los 8 lugares de trabajo de M1 |
| 2026-09-24 | m1/e-personalidad | 009 | Catálogos nuevos `personality_traits` (10 rasgos: Big Five + 5 extras, con columna, rasgo del prototipo y correlaciones) y `personal_values` (12 valores del prototipo). `CATALOG_NAMES` pasa a 10 |
| 2026-09-24 | m1/f-poblacion | 007, 008 | Catálogos nuevos de población: `given_names` (48, con sexo), `family_names` (24), `birthplaces` (10, con código DIVIPOLA real), `childhood_events` (7) y `appearance` (piel, peinados con límites de edad, colores de pelo, gafas y barba). `CATALOG_NAMES` pasa a 15 |
| 2026-09-24 | m1/g-empleo-objetos | 005 | `object_kinds` 2026.09.2: reglas de generación por edad (`gen`) y rango de estado (`condition`) de teléfono, bicicleta, herencia y carro |
| 2026-09-24 | m1/h-historia | 007, 030 | `birthplaces` 2026.09.2: atributo `rural` (`co.boyaca_rural`) y entrada nueva `rural.campo` ("el campo"), para el origen rural según la urbanización del año |
| 2026-09-24 | m1/j-dotacion | 033, 006 | `place_kinds` 2026.09.3: regla `amenity` de la 033 en cada tipo dotable; 12 tipos nuevos (biblioteca, casa de la cultura, museo, cine, centro comercial, parque de diversiones, polideportivo, coliseo, escuela, corresponsal, discoteca, plaza); pasan a M1 bar, banco, alcaldía, policía, droguería y panadería, con horarios, puestos (CIUO) y turnos legales; `names`, `nightlife`, `noResidentialStratum`, `orgWith` y `orgName`. `occupations` 2026.09.2 (+10 CIUO) y `org_sectors` 2026.09.2 (+8 CIIU; casa de la cultura = 8553, enseñanza cultural) |
| 2026-09-25 | m1/j-salud | 031 | Catálogo nuevo `health_conditions` (8 condiciones crónicas con CIE-10, edad mínima, multiplicadores de riesgo y efecto sobre la salud física). `CATALOG_NAMES` pasa a 16 |
| 2026-09-25 | m1/j-ocio | 032 | Catálogo nuevo `leisure_activities`: 22 actividades con lugar, coste, compañía, edad, esfuerzo, frecuencia, horas, curva de edad, sexo, y pesos de rasgos y valores. `CATALOG_NAMES` pasa a 17 |
| 2026-09-25 | mf/1-temperamento (MF1.2) | 009 v1.0 | `personality_traits` 2026.10.1 (solo Big Five); `temperament_params` 2026.10.1 (nuevo, 8 parámetros con `modula`); `life_domains` 2026.10.1 sustituye a `personal_values` (borrado). `CATALOG_NAMES` actualizado |
| 2026-09-25 | mf/2-funciones (MF2.1) | 036 | Catálogo nuevo `stimulus_classes` 2026.09.1: 12 clases del motor y 24 familias de rasgos para lugares y actividades (6 dimensiones [M]). `CATALOG_NAMES` pasa a 19 |
