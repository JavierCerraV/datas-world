---
modulo: country
ruta: packages/generators/src/country
estado: en-desarrollo
specs: [029]
actualizado: 2026-09-24
---

# Módulo: country

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Perfil de país (spec 029): carga y valida los perfiles (`CO-2026.09` y `prototipo`) y calcula los festivos de Colombia. La consulta del valor vigente (`profileValue`) vive en el motor, porque la simulación la usa.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 029 | CA-001, CA-002, CA-003 (la lista en `world:info` se prueba en `apps/cli`), CA-004 | — |

## 3. API pública
Desde `@datas-world/generators`:

| Símbolo | Descripción |
|---|---|
| `loadProfile(id?, dir?)` | Lee `packages/generators/profiles/<id>.json`, lo valida y lo devuelve en orden canónico. Por defecto `DEFAULT_PROFILE = 'CO-2026.09'`; también existe `PROTOTYPE_PROFILE = 'prototipo'`. Rechaza ids con rutas |
| `parseProfile(data, label?)` | Zod (forma) + `checkProfile` del motor (INV-001, INV-002) + orden (clave, alcance, vigencia) |
| `pendingEntries(p)` | Entradas `por_confirmar`, para los informes |
| `colombianHolidays(year)` → `Holiday[]` | Festivos del año (`{ date, key, name }`), desde 1984 |
| `holidayDates(from, to)` | Fechas únicas y ordenadas para `WorldConfig.holidays` |
| `easterSunday(year)` | Domingo de Pascua en días desde 1970-01-01 |
| `FIRST_SUPPORTED_YEAR` | 1984 |
| `seriesAt(series, year)` | Valor de una serie `{ "AAAA": n }` en un año: interpolación lineal entre puntos y extremos planos (029, 030) |

## 4. Diseño interno y decisiones
- **Festivos:**
  - Pascua con el algoritmo anónimo gregoriano (Meeus/Jones/Butcher), en aritmética entera;
  - traslado al lunes (Ley 51 de 1983) con el día de la semana de `daysFromCivil`;
  - Ascensión, Corpus Christi y Sagrado Corazón en Pascua +43, +64 y +71, comprobado con el calendario oficial de 2026;
  - la Virgen de Chiquinquirá (Ley 2578 de 2026) solo desde 2026.
  - **Hallazgo:** varias listas de 2027 publicadas en internet tienen errores, como el Sagrado Corazón en viernes 11 de junio. La prueba usa 2026 completo (varias fuentes coinciden) y, de 2027, los días contrastados.
- **Perfiles en JSON** (`packages/generators/profiles/`). Cada entrada lleva fuente, vigencia, estado y, si hace falta, alcance territorial. Las claves `gen.*` son parámetros de generación, comunes a los dos perfiles, para que el generador no distinga entre "Colombia" y "prototipo".
- **Orden canónico** al cargar: el perfil entra en el `WorldConfig` y, por tanto, en el hash.

## 5. Invariantes y guardarraíles
INV-001 e INV-002 de la 029, comprobados con `checkProfile` del motor. Un perfil que no los cumple no carga.

## 6. Cómo se prueba
`src/country/country.test.ts` (12 pruebas):
- **CA-001:** 2026 completo (19 festivos), 2027 (19, con los días contrastados), Pascuas conocidas de 1900, 2000, 2024, 2025, 2026, 2038 y 2285, sin Chiquinquirá antes de 2026, error antes de 1984;
- **CA-002:** 44 h el 14-jul-2026, 42 h el 15-jul y 48 h en 1990;
- **CA-003:** fuentes y vigencias; lista de pendientes;
- alcance territorial, salario mínimo, recargo dominical y edad de pensión por fecha;
- orden canónico y rechazo de perfiles inválidos;
- **CA-004:** el perfil prototipo reproduce las constantes del prototipo; en ambos perfiles los pesos de plantilla suman 1.

## 7. Paridad con el prototipo
El perfil `prototipo` reproduce los parámetros de paridad (029 R-004): pesos de plantilla de `genPopulation`, empleo 0,86 y jefe × 1,6 de `genJobs`/`hire`, rasgos (sd 0,17 y 22 % extremos) de `newAgent`, y 60 personas. No tiene informalidad ni carros.

## 8. Pendientes y deuda
- [ ] Series históricas por década (`demo.*.byDecade`) y reparto por estratos: siguen `por_confirmar`.
- [ ] Si la Corte Constitucional tumba la Ley 2578 de 2026, añadir su fecha de fin.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-24 | m1/a-catalogos | — | Documento creado desde la plantilla (sin código) |
| 2026-09-24 | m1/a-catalogos (A3, A4) | 029 | Perfiles `CO-2026.09` (46 entradas con fuente) y `prototipo`; carga con Zod y `checkProfile`; festivos de Colombia desde 1984 con la Ley 2578 de 2026. Dependencia nueva: `zod` 4 (ADR-001). 12 pruebas |
| 2026-09-24 | m1/d-organizaciones | 029 | Nueva entrada `gen.jobs.bossWageFactor` = 1,6 en `CO-2026.09` (estimado, del prototipo): ya son 47 entradas |
| 2026-09-24 | m1/f-poblacion | 007, 008, 029 | Parámetros de población en ambos perfiles: edades y número de hijos por plantilla (`gen.household.*`), modelo de edad de los hijos, ahorro (`gen.savings.*`) y educación por estrato (`gen.education.*`). En `CO-2026.09` están calibrados por simulación con el DANE 2026 (estimado); en `prototipo` son los de `genPopulation`/`newAgent`, más `pension.age` 65 y `pension.coverage` 1. Quedan 73 y 35 entradas |
| 2026-09-24 | m1/g-empleo-objetos | 006, 029 | Parámetros de empleo `gen.labor.*` en ambos perfiles (79 y 41 entradas). Las mediciones de la GEIH de julio de 2026 pasan a regir desde el 2026-01-01 (medición de referencia del año); las leyes conservan su fecha |
| 2026-09-24 | m1/h-historia | 029, 030 | `series.ts` (`seriesAt`, con pruebas). Series oficiales `demo.lifeExpectancy.byYear` y `demo.urbanization.byYear` (sustituyen a las `byDecade` por confirmar) y parámetros estimados `gen.history.*` en ambos perfiles |
| 2026-09-24 | m1/i-cli | 029, 030 | Nueva entrada estimada `gen.history.violentDeathShare` = 0,1 en ambos perfiles (proporción de muertes violentas sobre la que actúan los efectos de violencia) |
| 2026-09-24 | m1/j-dotacion | 029, 033 | Nuevas entradas de `CO-2026.09`: `gen.map.template` = `datas-world-v1` (decisión del usuario) y las estimadas `amenity.nightlifeClose` = 1560 (02:00), `amenity.travel.minutes` = 60 y `amenity.travel.cost` = 12 000 COP. `prototipo` gana `gen.map.template` = `prototipo-64x40` |
| 2026-09-25 | m1/j-salud | 029, 031 | Entradas de salud en `CO-2026.09`: oficiales (afiliación, ENSIN 2015, ENCSPA 2019, CNPV 2018 y Cuenta de Alto Costo 2024) y estimadas (`gen.health.*`: prevalencia por edad de las 8 condiciones y parámetros de hábitos, discapacidad y afiliación). `prototipo` no las tiene: sin ficha de salud |
