---
modulo: history
ruta: packages/generators/src/history
estado: en-desarrollo
specs: [003, 004, 006, 007, 030, 029]
actualizado: 2026-09-24
---

# Módulo: history

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Genera la historia de Data's World de 1900 al presente (spec 030):
- fundación del municipio y de sus barrios, lugares y organizaciones;
- genealogía de 3 generaciones con antepasados fuera del mundo;
- nacimientos, uniones, muertes y migraciones;
- hechos históricos de Colombia, que actúan como causas.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 030 | CA-001, CA-002 (INV-001 a INV-003), CA-004, CA-005 (agregado de 20 mundos); CA-003 y CA-006 con los datos, y desde la CLI en `apps/cli`; CA-007 con `bench --check` | — |

## 3. API pública
Desde `@datas-world/generators`:

| Símbolo | Descripción |
|---|---|
| `generateHistory(world, territory, places, orgIds, livingIds, priorEvents, catalogs, rng)` → `{ ancestorIds, events }` | Genera toda la historia. Se ejecuta al final de la generación; `priorEvents` son las trayectorias y el empleo ya generados |
| `lineageOf(world)` | `{ childId, motherId?, fatherId? }[]` de toda persona con padres, en orden de id (030 §3) |
| `HISTORY_COLUMNS` | `demo.deathMinute` (i32, 0 = vive) y `demo.generation` (u8, 0 vivo · 1 padres · 2 abuelos · 3 bisabuelos) |

Internos: `params.ts` (`historyParams`, `Clock`, `meanDeathAge`, `historicalEvents`, `activeWith`), `foundation.ts`, `genealogy.ts` y `lives.ts`.

## 4. Diseño interno y decisiones
- **Hacia atrás desde el presente** (030 R-002). La población de 2026 ya existe y sale del perfil. La historia solo añade antepasados y eventos, así que el presente sigue calibrado con el DANE.
- **Orden y flujos:**
  1. `HISTORICAL_CONTEXT` por cada hecho del catálogo, fechado en su inicio o el 1-ene-1900 si empezó antes.
  2. Fundación (`hist:foundation`): el municipio y el barrio fundacional en 1900; los demás barrios en su década de la plantilla, con la migración vigente como causa. Cada lugar se construye tras su barrio. Cada organización se funda tras su lugar y al menos 2 años antes de su primera contratación (INV-003).
  3. Genealogía (`hist:genealogy/<id>`):
     - los padres que viven en el hogar son los reales; el que falta se crea como antepasado y lo comparten los hermanos;
     - la edad de la madre al nacer el hijo sale de `motherAgeAtBirth` y el padre le lleva `fatherAgeGap`;
     - los apellidos siguen la regla colombiana;
     - se crean abuelos siempre y bisabuelos con probabilidad `greatGrandparentP`.
  4. Hechos de vida (`hist:unions`, `hist:migration`, `hist:deaths`):
     - `UNION_FORMED` antes del primer hijo común, cuando uno de los dos es antepasado;
     - `CITIZEN_BORN` desde 1900, con la unión como causa;
     - `MIGRATED` para quien nació fuera y vive en el municipio o tuvo allí un hijo. El año se pondera por los `effects` de migración de los hechos vigentes (La Violencia ×2,5; desplazamiento 1998–2004 ×6), que quedan como causas;
     - `CITIZEN_DIED`: edad ~ N(e0 + 0,45·(80 − e0), 12), con e0 la esperanza de vida del año de nacimiento, y nunca antes de los propios hechos. Si la fecha cae después del presente, el antepasado **vive fuera del mundo** (`deathMinute = 0`). En los periodos con efecto de muerte se atribuye al hecho una fracción de las muertes (`attributableShare`):
       - un efecto violento k (violencia rural, hombres jóvenes) multiplica solo el riesgo de muerte violenta, que es una parte `violentDeathShare` (0,1) del total. La fracción es s·(k − 1)/(1 + s·(k − 1)), ≈ 9 % con k = 2, del orden de los ≈ 200 000 muertos de La Violencia;
       - uno no violento (la pandemia en mayores) multiplica la mortalidad total: 1 − 1/k.
- **Columnas que crecen.** `addAncestor` puede reasignar las columnas (`ensureCapacity`), así que la genealogía las lee en cada acceso, nunca guardando la referencia.
- **Coste medido** (200 vivos, semilla 482917): 1 106 antepasados (252 / 504 / 350 por generación), 93 vivos fuera del mundo, 2 691 eventos (≈ 750 KB en JSON). Todo el mundo se genera en ≈ 0,15 s.

## 5. Invariantes y guardarraíles
- 030 INV-001: 1900 ≤ `at` < 0 en todo evento del pasado.
- 030 INV-002: nadie tiene eventos antes de nacer ni después de morir; madre de 14 a 50 años y padre de 15 a 70 al nacer el hijo; los vivos tienen `deathMinute = 0`.
- 030 INV-003: lugares y organizaciones no aparecen antes de su `foundedAt`.

## 6. Cómo se prueba
`history.test.ts`, con el mundo completo de `testing.ts`:
- CA-001 a CA-004 y CA-006 sobre la semilla 482917;
- CA-005 sobre el agregado de 20 semillas: nacidos en el campo por década (1900–1999) a ±0,1 de 1 − urbanización, y picos de migración en 1946–1958 y 1998–2004;
- R-006 sobre el mismo agregado: las muertes violentas de 1946–1958 son entre el 2 % y el 15 % de las muertes del periodo.

## 7. Paridad con el prototipo
No aplica: el prototipo no tiene historia.

## 8. Pendientes y deuda
- [ ] La base de M1 ocupa 1,75 MB frente al límite de 2 MB (CA-007). Si la historia crece (más hechos, trabajos pasados), habrá que compactar el payload o bajar `greatGrandparentP`.
- [ ] Tablas de mortalidad por edad y sexo y edad de los padres por década (029, `por_confirmar`).
- [ ] Trabajos pasados de los antepasados y estudios según la oferta de su década (R-007).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-24 | m1/h-historia | — | Documento creado desde la plantilla (sin código) |
| 2026-09-24 | m1/h-historia (H1–H4) | 030, 029, 007 | Primera implementación: parámetros, fundación, genealogía, hechos de vida y orquestador `generateHistory`; `lineageOf`. 9 pruebas |
| 2026-09-24 | m1/i-cli | 030, 029 | Corrección de la atribución de muertes: un efecto violento multiplica el riesgo de muerte violenta, no el total. Con la fórmula anterior, en La Violencia la mitad de las muertes de quienes nacieron en el campo se atribuía a violencia, y `world:history` lo hizo evidente. Nuevo parámetro `gen.history.violentDeathShare` y función `attributableShare`. 1 prueba nueva |
