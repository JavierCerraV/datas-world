---
id: 030
nombre: generated-history
estado: borrador
hito: M1
depende_de: [001, 003, 004, 006, 007, 008, 014, 023, 029]
version: 0.1
---

# 030 — Historia generada (1900 → presente)

## 1. Propósito
Que el mundo **exista desde 1900** y tenga una historia consultable:
- cómo se fundó Villa Cordillera y cómo crecieron sus barrios;
- de dónde viene cada familia, con 3 o 4 generaciones;
- quién migró del campo y por qué;
- qué vivió cada persona de los grandes hechos de Colombia.

La vida detallada, minuto a minuto, empieza en el **presente del mundo (2026-01-01)**. Lo anterior no se simula: se **genera** de forma coherente y determinista en `world:new`. Es la decisión del usuario del 2026-09-24.

Responde a la pregunta guía de la visión: *¿estas personas parecen haber vivido, y podemos explicar por qué terminaron donde terminaron?*

## 2. Alcance
**Incluye:**
- fundación del municipio;
- crecimiento de barrios, lugares y organizaciones por décadas;
- genealogía hacia atrás desde los hogares del presente, con antepasados ya fallecidos;
- nacimientos, uniones, migraciones, trabajos y muertes anteriores al presente;
- el contexto histórico nacional, como eventos que dejan huella en las trayectorias.

**Fuera de alcance:**
- simular el pasado (ni año a año ni minuto a minuto);
- las relaciones afectivas del pasado (012);
- las memorias episódicas (013). Desde M3 se podrán sembrar desde estos eventos.

## 3. Modelo de datos
- **Presente del mundo:** `WorldConfig.epoch = '2026-01-01T00:00'` (minuto 0). Todo lo anterior tiene `at < 0`. El 1-ene-1900 es el minuto −66 268 800, que cabe en `i32`. Comprobado con el calendario del motor: fechas y días de la semana correctos antes del epoch.
- **Antepasados:** son ciudadanos `CIT` con `status: 'inactive'` y el motivo `deceased`. No se reutilizan ni se borran (spec 001 R-001, R-003). Tienen las columnas de 007 y dos nuevas:

| Columna | Tipo | Qué es |
|---|---|---|
| `demo.deathMinute` | `i32` | minuto de la muerte (0 = vive) |
| `demo.generation` | `u8` | 0 = vive en el presente · 1 = padres de algún vivo · 2 = abuelos · 3 = bisabuelos |

- **Parentesco a través de generaciones:** `lineage: { childId, motherId?, fatherId? }[]`, en orden por `childId`. Complementa el parentesco de los hogares del presente (008).
- **Fechas de fundación:** los lugares (004) y las organizaciones (006) ganan `foundedAt: WorldMinute`.
- **Contexto histórico:** es un catálogo `historical_events` (ADR-006). Cada entrada tiene:
  - clave y nombre;
  - fechas de inicio y fin;
  - fuente;
  - `effects`: multiplicadores sobre las probabilidades de la generación en su periodo (migración campo → ciudad, muerte violenta, desplazamiento, emigración, desempleo).

Coste en memoria: ≈ 3 antepasados por persona viva de media, con ramas compartidas. Para 200 vivos, unos 600 antepasados: unos 250 KB en columnas y objetos, y ≈ 10 000 eventos históricos.

## 4. Reglas
- **R-001** — Orden de generación, cada paso con su flujo `rng.fork('hist:<paso>')`:
  1. territorio y fundación (003);
  2. crecimiento urbano por décadas;
  3. hogares y personas del presente (007, 008);
  4. genealogía hacia atrás;
  5. trayectorias de los antepasados y de los vivos;
  6. lugares y organizaciones con su fecha de fundación.
- **R-002 (anclaje en el presente)** — La historia se genera **hacia atrás desde el presente**. Los hogares y personas de 2026 salen del perfil de país (029), y el pasado se construye para que sea coherente con ellos. Así el presente siempre coincide con el DANE, aunque la historia sea aproximada.
- **R-003 (fundación)** — Villa Cordillera se funda en `FOUNDING_YEAR`. Primero existe el barrio fundacional, alrededor de la plaza y la iglesia. Los demás aparecen por décadas: `DISTRICT_FOUNDING_DECADES`. En 2026 son los tres del mapa (003).
- **R-004 (genealogía)** — Para cada persona viva se generan hacia atrás hasta 3 generaciones:
  - la edad de los padres al nacer el hijo sale de `PARENT_AGE_AT_BIRTH` por década;
  - la muerte, de las tablas de mortalidad por década `LIFE_TABLE` (029);
  - hermanos de un mismo hogar comparten padres, y primos y parejas pueden compartir ramas;
  - un antepasado nacido antes de 1900 existe solo como referencia, con su año de nacimiento y sin eventos anteriores a 1900.
- **R-005 (migración)** — La probabilidad de que una rama familiar llegue desde el campo o desde otra ciudad sigue `URBANIZATION_BY_DECADE` (029), multiplicada por los `effects` de los hechos históricos vigentes. Por ejemplo, La Violencia en los años 50 y el desplazamiento de 1998 a 2004 aumentan la migración.
- **R-006 (hechos históricos)** — Un hecho del catálogo solo afecta a quien vivía en su periodo. Si cambia una trayectoria (una migración, una muerte, un desplazamiento), el evento resultante lleva como causa el evento del hecho histórico (spec 014: siempre con causas).
- **R-007 (vivos)** — La trayectoria previa de los vivos (007 R-006) se ubica en su tiempo real: estudios con la oferta educativa de su década, trabajos con las organizaciones que existían entonces, y hechos históricos vividos.
- **R-008 (consulta)** — La historia es consultable desde la CLI:
  - `world:history [--from AAAA] [--to AAAA] [--place PLC] [--citizen CIT] [--type TIPO]`;
  - `citizen:report CIT`, que muestra el árbol genealógico y la línea de vida.

  Todo sale del registro de eventos y del estado persistido, nunca de invenciones al consultar (CLAUDE.md §8).

## 5. Eventos
Todos con `at < 0` y, salvo los de contexto, con causas: `{ state: 'history' }` o eventos previos.

| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `TOWN_FOUNDED` | fundación del municipio | placeId, year | — (origen de la historia) |
| `DISTRICT_FOUNDED` | nace un barrio | placeId | crecimiento urbano, migración |
| `PLACE_BUILT` | se construye un lugar | placeId, kind | barrio, organización |
| `ORG_FOUNDED` | nace una organización | orgId | crecimiento económico |
| `CITIZEN_BORN` | nacimiento | citizenId, motherId?, fatherId?, placeName | unión de los padres |
| `UNION_FORMED` | unión o matrimonio | a, b | encuentro |
| `MIGRATED` | llegada desde el campo u otra ciudad | citizenId, from, to | hecho histórico, trabajo, familia |
| `CITIZEN_DIED` | muerte | citizenId, cause | edad, hecho histórico |
| `HISTORICAL_CONTEXT` | hecho nacional (catálogo) | key, name | — (externo, fuente citada) |

La spec 007 R-007 sigue vigente: los nacimientos y muertes **en el presente simulado** llegan con el peldaño 4 (`lifecourse`). Esta spec solo genera los del pasado.

## 6. Invariantes
- **INV-001** — Todo evento histórico tiene `at < 0` y `at ≥ minuto(1900-01-01)`.
- **INV-002** — Coherencia vital: nadie tiene eventos antes de nacer ni después de morir; una madre tiene entre 14 y 50 años al nacer su hijo y un padre entre 15 y 70; un vivo tiene `deathMinute = 0`.
- **INV-003** — Un lugar u organización no aparece en un evento anterior a su `foundedAt`.

## 7. Criterios de aceptación
- **CA-001 (M1)** — *Dado* la misma semilla, *entonces* la historia completa (eventos y antepasados) y el `stateHash` son idénticos.
- **CA-002 (M1)** — *Dado* un mundo generado, *entonces* se cumplen INV-001, INV-002 e INV-003 para todas las personas, lugares y organizaciones.
- **CA-003 (M1)** — *Dado* cualquier persona viva, *entonces* `citizen:report` muestra sus padres y abuelos (o los marca como "desconocido" cuando la genealogía los omite), con fechas de nacimiento y, si murieron, de muerte.
- **CA-004 (M1)** — *Dado* un mundo generado, *entonces* la población presente sigue cumpliendo los criterios de 007 y 008 con el perfil colombiano (anclaje R-002).
- **CA-005 (M1)** — *Dado* un mundo generado, *entonces* la proporción de ramas familiares llegadas del campo por década está dentro de ±0,1 de `URBANIZATION_BY_DECADE`, y los picos coinciden con los hechos del catálogo con `effects` de migración.
- **CA-006 (M1)** — *Dado* `world:history --from 1948 --to 1958`, *entonces* aparecen los eventos de ese periodo, y toda migración causada por La Violencia enlaza su `HISTORICAL_CONTEXT`.
- **CA-007 (M1)** — *Dado* 200 personas vivas, *entonces* `world:new` termina en < 5 s y la historia añade < 2 MB a la base.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto | Fuente / justificación | Estado |
|---|---|---|---|
| `FOUNDING_YEAR` | 1900 | decisión del usuario | oficial (del mundo) |
| `DISTRICT_FOUNDING_DECADES` | Centro 1900 · La Esperanza 1950 · San Martín 1970 | provisional: el centro es fundacional; los barrios populares crecen con la migración de mediados de siglo | estimado |
| `PARENT_AGE_AT_BIRTH` por década | — | DANE, estadísticas vitales (series históricas) | por_confirmar |
| `LIFE_TABLE` por década y sexo | — | DANE y CEPAL, esperanza de vida histórica | por_confirmar |
| `URBANIZATION_BY_DECADE` | — | DANE, censos 1938 a 2018 (población en cabeceras) | por_confirmar |

**Catálogo inicial `historical_events`.** Las fechas son hechos históricos conocidos. Los `effects` son `estimado` hasta calibrarlos.

| Clave | Periodo | Efecto principal en la generación |
|---|---|---|
| `co.guerra_mil_dias` (final) | 1899–1902 | más muertes de hombres jóvenes y desplazamiento en los primeros años |
| `co.bogotazo` | 1948-04-09 | inicio del periodo de mayor violencia |
| `co.la_violencia` | 1946–1958 | más migración campo → ciudad y más muerte violenta en el campo |
| `co.frente_nacional` | 1958–1974 | estabilización y crecimiento urbano |
| `co.tragedia_armero` y `co.palacio_justicia` | 1985-11 | hechos de contexto, sin efecto demográfico general |
| `co.constitucion_1991` | 1991-07-04 | hecho de contexto (derechos, descentralización) |
| `co.terremoto_eje_cafetero` | 1999-01-25 | hecho de contexto, con efecto regional |
| `co.crisis_upac` | 1998–1999 | más desempleo y pérdida de vivienda |
| `co.desplazamiento_pico` | 1998–2004 | más migración forzada campo → ciudad |
| `co.acuerdo_paz` | 2016-11-24 | hecho de contexto |
| `co.migracion_venezolana` | 2015–2023 | llegada de hogares migrantes |
| `co.pandemia_covid` | 2020-03-25 → 2021 | más desempleo y muertes de personas mayores |

## 9. Métricas y observabilidad
El informe de historia (`world:report --history`) muestra:
- población viva y fallecida por década;
- migraciones por década y por causa;
- edad media al morir por década;
- barrios y organizaciones fundados por década.

Alerta si alguna invariante vital se incumple o si una década queda vacía.

## 10. Preguntas abiertas
- [ ] Series históricas oficiales (DANE, censos 1938–2018, estadísticas vitales) para `PARENT_AGE_AT_BIRTH`, `LIFE_TABLE` y `URBANIZATION_BY_DECADE`. Mientras falten, se usan valores `estimado` con la fuente de la aproximación.
- [ ] ¿Incluir la región de origen de las migraciones (departamentos reales) o solo "campo" y "otra ciudad"? Propuesta: departamentos reales del catálogo DIVIPOLA para el origen; Villa Cordillera sigue siendo ficticia.
- [ ] ¿Se siembran memorias (013) desde los eventos históricos vividos cuando llegue M3? Propuesta: sí, con la importancia del evento.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-24 | 0.1 | Borrador inicial: el mundo existe desde 1900 con historia generada y consultable; la vida detallada empieza el 2026-01-01 (decisiones del usuario) |
