---
id: 029
nombre: country-profile
estado: aprobada
hito: M1 (demografía, territorio, festivos, salario base) · M2 (reglas laborales y de economía)
depende_de: [001, 002]
version: 0.3
---

# 029 — Perfil de país: Colombia

## 1. Propósito
Reunir en un solo lugar, con fuente y fecha de vigencia, cómo es Colombia:
- sus indicadores (demografía, hogares, empleo, informalidad, educación, estratos);
- sus leyes (salario mínimo, jornada, recargos, pensión, festivos, estratificación);
- su organización territorial.

Las demás specs no escriben cifras propias: leen `profile.<clave>`. Así el mundo se parece a Colombia y se puede actualizar cuando cambien las leyes o los datos. Es una decisión del usuario (2026-09-24) y aplica el ADR-006.

## 2. Alcance
**Incluye:** parámetros con fuente y vigencia, festivos, perfiles alternativos ("prototipo", para paridad) y la regla de qué valor rige en cada fecha del mundo.
**Fuera de alcance:** simular el proceso legislativo; otros países (la estructura los admite).

## 3. Modelo de datos
```ts
interface CountryProfile {
  id: string;                        // 'CO-2026.09'
  country: 'CO';
  currency: { code: 'COP'; minorUnit: 1 };
  entries: ProfileEntry[];           // orden por clave y luego por vigencia
}
interface ProfileEntry {
  key: string;                       // 'labor.minimumWageMonthly'
  value: number | string | number[] | Record<string, number>;
  validFrom: string;                 // 'AAAA-MM-DD' (fecha del mundo desde la que rige)
  source: string;                    // norma o publicación y fecha
  status: 'oficial' | 'estimado' | 'por_confirmar';
  scope?: 'nacional' | '13ciudades' | 'cabecera' | 'rural' | 'rural_disperso'; // alcance territorial
}
```
- **Variaciones de la vida en Colombia (v0.2).** Una misma clave puede tener entradas con distinto `scope`. `profileValue(key, date, scope)` busca primero el alcance del lugar (por ejemplo, `cabecera` para un barrio urbano) y, si no existe, usa `nacional`. Así el campo, las grandes ciudades y las ciudades intermedias se diferencian con cifras oficiales, sin ramas en el código.
- El perfil se copia en `WorldConfig` al crear el mundo (versión y hash), como los catálogos del ADR-006.
- `profileValue(key, worldDate)` devuelve la entrada vigente más reciente con `validFrom ≤ worldDate`. Es una función pura y determinista.

## 4. Reglas
- **R-001** — Toda cifra de comportamiento colombiano en otra spec se lee del perfil. Una cifra sin fuente se registra como `estimado` o `por_confirmar`, **nunca se inventa en silencio**.
- **R-002** — Las normas con fecha de entrada escalonada se registran como varias entradas con su `validFrom`. Por ejemplo, la jornada de 42 h rige desde el 2026-07-15.
- **R-003** — Los valores anuales que aún no existen se prolongan con el último vigente, marcado `estimado`. Por ejemplo, el salario mínimo de 2027 en un mundo que empieza en 2027.
- **R-004** — El perfil **"prototipo"** reproduce los valores del prototipo para la paridad estadística (docs/prototipo-referencia.md). El perfil por defecto de los mundos nuevos es el colombiano.
- **R-005 (M1)** — **Festivos.** `world:new` calcula los festivos de Colombia de los años del mundo (Ley 51 de 1983, "Ley Emiliani") y los guarda en `WorldConfig.holidays` (spec 002 R-001):
  - fijos: 1 de enero, 1 de mayo, 20 de julio, 7 de agosto, 8 de diciembre y 25 de diciembre;
  - trasladables al lunes siguiente: 6 de enero, 19 de marzo, 29 de junio, 9 de julio (Virgen de Chiquinquirá, Ley 2578 del 1 de junio de 2026, desde 2026), 15 de agosto, 12 de octubre, 1 de noviembre y 11 de noviembre;
  - según la Pascua: Jueves y Viernes Santo, y Ascensión, Corpus Christi y Sagrado Corazón, trasladados a lunes.

  La Pascua se calcula con aritmética entera, sin `Date`. Los festivos solo se calculan desde 1984 (primer año con la Ley Emiliani vigente): la historia anterior (spec 030) no los necesita. La Ley 2578 de 2026 tiene una demanda de inconstitucionalidad en curso; si la Corte la tumba, se añade una entrada con su fecha.
- **R-006 (M1)** — **Territorio.** La jerarquía y los niveles siguen el ADR-006 §3. El estrato va de 1 a 6 (Ley 142 de 1994, arts. 101–102).

## 5. Eventos
No define tipos propios. Un cambio de perfil en un mundo vivo sería una entrada externa (023), y su diseño queda para cuando haga falta.

## 6. Invariantes
- **INV-001** — Cada entrada tiene `source` no vacío y `validFrom` válido.
- **INV-002** — Para cada clave hay como mucho una entrada por `validFrom`.

## 7. Criterios de aceptación
- **CA-001 (M1)** — *Dado* los años 2026 y 2027, *entonces* los festivos calculados coinciden con el calendario oficial: 19 cada año desde 2026 (18 en 2025).
- **CA-002 (M1)** — *Dado* `worldDate = 2026-07-14` y `2026-07-15`, *entonces* `labor.maxWeeklyHours` vale 44 y 42.
- **CA-003 (M1)** — *Dado* el perfil por defecto, *entonces* todas sus entradas cumplen INV-001 e INV-002, y las `por_confirmar` aparecen listadas en `world:info`.
- **CA-004 (M1)** — *Dado* el perfil "prototipo", *entonces* reproduce exactamente los parámetros de paridad de las specs 004 a 009.

## 8. Parámetros (perfil `CO-2026.09`)

**Demografía y hogares**
| Clave | Valor | Vigencia | Fuente | Estado |
|---|---|---|---|---|
| `demo.share.age0to11` | 0,171 | 2026 | DANE, proyecciones de población 2026 (vía UNFPA/ICBF) | oficial |
| `demo.share.age12to17` | 0,094 | 2026 | ídem | oficial |
| `demo.share.age60plus` | 0,153 | 2026 | ídem | oficial |
| `household.meanSize` | 2,82 (cabecera) · 2,99 (rural) | 2025 | DANE, ECV 2025 | oficial |
| `household.share.unipersonal` | 0,202 | 2025 | DANE, ECV 2025 | oficial |
| `household.share.biparental` | 0,516 | 2024 | DANE, ECV 2024 | oficial |
| `household.share.monoparental` | 0,243 | 2024 | DANE, ECV 2024 | oficial |
| `household.share.otros` | 0,043 | 2024 | DANE, ECV 2024 (no familiar y familiar sin núcleo) | oficial |
| `household.share.extensa` | — | — | ECV (el hogar extenso se reparte dentro de las tipologías de arriba) | por_confirmar |

**Mercado laboral**
| Clave | Valor | Vigencia | Fuente | Estado |
|---|---|---|---|---|
| `labor.employmentRate` (ocupados / población ≥ 15) | 0,595 | 2026-07 | DANE, GEIH julio 2026 | oficial |
| `labor.participationRate` | 0,648 | 2026-07 | DANE, GEIH julio 2026 | oficial |
| `labor.unemploymentRate` | 0,081 | 2026-07 | DANE, GEIH julio 2026 | oficial |
| `labor.informality.national` | 0,545 | 2026-07 | DANE, GEIH julio 2026 | oficial |
| `labor.informality.13cities` | 0,405 | 2026-07 | DANE, GEIH julio 2026 | oficial |
| `labor.informality.ruralDisperso` | 0,825 | 2026-07 | DANE, GEIH julio 2026 | oficial |
| `labor.informality.world` | 0,45 | — | Data's World es una ciudad intermedia: entre 13 ciudades (0,405) y el total nacional (0,545) | estimado |

**Leyes laborales y pensión**
| Clave | Valor | Vigencia | Fuente | Estado |
|---|---|---|---|---|
| `labor.minimumWageMonthly` | 1 750 905 | 2026-01-01 | Decreto 1469 de 2025, suspendido; transitorio Decreto 0159 de 2026 (19-feb-2026), mientras falla el Consejo de Estado | oficial (transitorio) |
| `labor.transportAllowance` | 249 095 | 2026-01-01 | Decreto 1470 de 2025 (hasta 2 SMMLV) | oficial |
| `labor.maxWeeklyHours` | 46 · 44 · 42 | 2024-07-15 · 2025-07-15 · 2026-07-15 | Ley 2101 de 2021 | oficial |
| `labor.nightStartsAt` | 19:00 (1 140 min) | 2025-12-25 | Ley 2466 de 2025 | oficial |
| `labor.nightSurcharge` | 0,35 | — | Código Sustantivo del Trabajo, Ley 2466 de 2025 | oficial |
| `labor.sundaySurcharge` | 0,80 · 0,90 · 1,00 | 2025-07-01 · 2026-07-01 · 2027-07-01 | Ley 2466 de 2025 | oficial |
| `pension.age` | mujeres 57, hombres 62 | — | Ley 100 de 1993; se mantiene en la Ley 2381 de 2024, que rige desde el 2027-04-01 según la Corte Constitucional | oficial |
| `pension.coverage` (mayores en edad de pensión que reciben pensión contributiva) | 0,24 | 2025 | fuentes secundarias (entre 0,23 y 0,25; unos 2,16 millones de pensionados, el 82,7 % en Colpensiones). Pendiente de cifra oficial de Colpensiones o la Superfinanciera | estimado |
| `pension.solidarityPillar` | unos 3 millones de adultos mayores vulnerables reciben el pago solidario | 2025 | fuentes secundarias sobre la Ley 2381 de 2024 | estimado |

**Educación y estratos**
| Clave | Valor | Vigencia | Fuente | Estado |
|---|---|---|---|---|
| `education.levels` | CINE 2011 A.C.: ninguno, primaria, básica secundaria, media, técnica profesional, tecnológica, universitaria, especialización, maestría, doctorado | — | DANE | oficial |
| `education.attainment.workforce` | ninguno 0,108 · primaria 0,179 · básica secundaria 0,047 · media 0,367 · técnica o tecnológica 0,121 · universitaria ≈ 0,127 (resto hasta 1) · posgrado 0,051 | 2024 | DANE, GEIH 2024, citado en fuentes secundarias. Es la fuerza laboral, no toda la población; universitaria sale por diferencia | estimado |
| `stratum.share` | estratos 1–3 ≈ 0,80 de la población; estrato 1 ≈ 0,159; estrato 6 ≈ 0,027 | 2018 | DANE, CNPV 2018 (citado en fuentes secundarias). Falta el reparto completo del 2 al 5 | por_confirmar |
| `demo.lifeTable.byDecade` | esperanza de vida y mortalidad por edad, sexo y década, de 1900 a 2026 | — | DANE y CEPAL (series históricas) | por_confirmar |
| `demo.urbanization.byDecade` | proporción de población en cabeceras por década | — | DANE, censos de 1938 a 2018 | por_confirmar |
| `demo.parentAgeAtBirth.byDecade` | edad de la madre y del padre al nacer un hijo, por década | — | DANE, estadísticas vitales | por_confirmar |
| `stratum.utilitySubsidy` | estrato 1 hasta 0,60 · estrato 2 hasta 0,50 · estrato 3 hasta 0,15 del costo de la energía, en el consumo de subsistencia | 2026 | Ley 142 de 1994; regulación CREG (vía fuentes secundarias) | estimado |

## 9. Métricas y observabilidad
`world:report` compara cada indicador generado con su valor del perfil y marca las desviaciones fuera de tolerancia. `world:info` lista las entradas `por_confirmar`.

## 10. Preguntas abiertas
- [ ] Completar con fuente oficial: la distribución por estrato (por_confirmar), y confirmar la cobertura pensional y el nivel educativo (hoy `estimado`, de fuentes secundarias).
- [x] ¿El mundo empieza en 2027 o en 2026? → El presente del mundo es el 2026-01-01, y el mundo existe desde 1900 con historia generada (spec 030). Decisión del usuario, 2026-09-24.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-24 | 0.1 | Borrador inicial a partir de la petición del usuario de ajustar el proyecto a los indicadores, las leyes y la organización de Colombia (ADR-006) |
| 2026-09-24 | 0.1 | Estado → aprobada |
| 2026-09-24 | 0.2 | "Lo más real posible" (usuario): alcance territorial por entrada (`scope`) para las variaciones urbano, rural y 13 ciudades; informalidad del rural disperso (0,825) y tamaño del hogar rural (2,99); cobertura pensional (0,24) y nivel educativo de la fuerza laboral (GEIH 2024) como `estimado`; subsidios por estrato | Series históricas por década (`demo.*.byDecade`) para la spec 030; presente del mundo el 2026-01-01.
| 2026-09-24 | 0.2 | Nombre (usuario): el mundo y su municipio se llaman **Data's World**, en lugar de Villa Cordillera. Inspirado en el androide Data: ciudadanos autónomos, curiosos y capaces de aprender. Solo cambia el nombre; la información sigue siendo de Colombia |
| 2026-09-24 | 0.3 | Implementación del bloque A: festivo de la Virgen de Chiquinquirá (Ley 2578 del 1 de junio de 2026, trasladable, desde 2026); los festivos se calculan desde 1984; CA-001 con 19 festivos por año desde 2026 |
