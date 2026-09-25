---
id: 033
nombre: urban-amenities
estado: aprobada
hito: M1 (dotación inicial y nueva plantilla de mapa) · M2 (uso: horarios, capacidad, viajes a la ciudad) · peldaño 4+ (crecimiento)
depende_de: [003, 004, 006, 016, 023, 029, 030]
version: 0.3
---

# 033 — Dotación urbana

## 1. Propósito
Decidir **qué lugares tiene Data's World y por qué**, con reglas en lugar de una lista fija, para que el mundo pueda crecer en orden (ADR-006). El usuario pidió estos lugares:
- cines;
- centros comerciales;
- bares;
- museos;
- bibliotecas;
- restaurantes;
- parques de diversiones;
- coliseos deportivos;
- escuelas;
- bancos;
- tiendas de barrio;
- estaciones de policía.

**El problema de la escala.** Un municipio colombiano real de unos cientos de habitantes en su cabecera tiene tiendas de barrio, escuela, iglesia, estación de policía, biblioteca pública, polideportivo, bares, restaurantes y quizá un corresponsal bancario. **No** tiene cine, centro comercial, museo ni parque de diversiones: para eso, la gente viaja a la ciudad. Esta spec reproduce esa realidad, que además explica decisiones de las personas: ir a cine es un plan de todo el día y cuesta el bus.

Implementa la visión §20 (Lugares: categorías; cada lugar con capacidad, horarios, reglas, trabajadores, visitantes, nivel socioeconómico y función).

## 2. Alcance
**Incluye:**
- las entradas nuevas del catálogo `place_kinds`;
- la regla de **dotación**: qué lugares y cuántos corresponden a un municipio según su población y su categoría;
- los **lugares regionales**, en la ciudad de referencia, fuera del mapa;
- una **plantilla de mapa nueva** para Data's World, con parcelas para la dotación (el mapa del prototipo no tiene sitio);
- horarios, capacidades y puestos de trabajo de cada tipo nuevo (con 006).

**Fuera de alcance:**
- el viaje en sí (016, movilidad): aquí solo se fijan el tiempo y el coste de referencia;
- la economía de cada negocio (015);
- el esparcimiento que ocurre en estos lugares (032).

## 3. Modelo de datos
**Entradas nuevas de `place_kinds`**, con su código CIIU y los atributos de dotación:

| Clave | Nombre | CIIU (actividad) | Ámbito |
|---|---|---|---|
| `cultura.biblioteca` | Biblioteca pública | 9101 | local (una por municipio) |
| `cultura.casa_cultura` | Casa de la cultura | 8553 (enseñanza cultural) | local |
| `cultura.museo` | Museo | 9102 | regional (local desde `minPopulation`) |
| `ocio.cine` | Cine | 5914 | regional |
| `comercio.centro_comercial` | Centro comercial | 6810 (administración) | regional |
| `ocio.parque_diversiones` | Parque de diversiones | 9321 | regional |
| `deporte.polideportivo` | Polideportivo | 9311 | local |
| `deporte.coliseo` | Coliseo deportivo | 9311 | local desde `minPopulation`; si no, regional |
| `educacion.escuela` | Escuela (sede de primaria) | 8512 | local |
| `finanzas.corresponsal` | Corresponsal bancario | 6419 | local (en una tienda o droguería) |
| `ocio.discoteca` | Discoteca | 5630 | local desde `minPopulation` |

Ya existen en el catálogo y pasan a instanciarse: `ocio.bar`, `ocio.restaurante`, `finanzas.banco`, `comercio.tienda_barrio` y `gobierno.estacion_policia`.

**Atributos de dotación** (en cada entrada de `place_kinds`):
```ts
interface AmenityRule {
  scope: 'local' | 'regional';     // regional = en la ciudad de referencia, fuera del mapa
  minPopulation: number;            // población desde la que existe en el municipio (0 = siempre)
  perInhabitants?: number;          // una instancia más cada N habitantes (tiendas, bares…)
  max?: number;                     // tope de instancias
  law?: string;                     // norma que lo exige, si la hay
}
```

**Lugares regionales.** Son `Place` sin `rect` ni `door`, hijos de un lugar `territorio.municipio` nuevo, la **ciudad de referencia**, que es ficticia. Tienen `travel: { minutes, cost }` desde la terminal o el paradero de Data's World, tomado del perfil de país. Existen, tienen horario y capacidad, y se puede ir a ellos (016), pero no se dibujan en el mapa. El visor los muestra como destinos "en la ciudad".

**Plantilla de mapa `DATAS_WORLD_V1`** (003). El perfil `prototipo` conserva `PROTOTYPE_64X40`, para mantener la paridad. El perfil colombiano pasa a una plantilla nueva:
- más grande (propuesta: 80 × 50 tiles);
- los tres barrios de siempre;
- parcelas de uso mixto y una plaza central con la iglesia, la alcaldía, la estación de policía y la biblioteca (el trazado colonial de los pueblos colombianos);
- un parque con polideportivo;
- un paradero intermunicipal.

Sigue el concepto visual B ("pueblo soleado", `docs/identidad-visual.md`).

Coste: ≈ 200 B por lugar (004). La dotación de 200 habitantes añade unos 15 lugares locales y 5 regionales: < 5 KB. El mapa de 80 × 50 ocupa 4 000 B (u8).

## 4. Reglas
- **R-001 (M1, dotación)** — La generación calcula la dotación a partir de `population.target`, con las reglas de cada entrada: existe si la población ≥ `minPopulation`, y hay `max(1, ⌊población / perInhabitants⌋)` instancias, hasta `max`. Los tipos con `scope: 'regional'` que no alcanzan su `minPopulation` se crean en la ciudad de referencia.
- **R-002 (M1, obligatorios por ley)** — Todo municipio tiene:
  - biblioteca pública (Ley 1379 de 2010, Red Nacional de Bibliotecas Públicas);
  - al menos una sede educativa con primaria (Ley 115 de 1994);
  - estación de policía (la Policía Nacional tiene presencia en toda cabecera municipal);
  - alcaldía.
- **R-003 (M1, ubicación)** — Los lugares locales se asignan a parcelas de la plantilla según su tipo:
  - los institucionales, alrededor de la plaza;
  - las tiendas de barrio, repartidas por los barrios en proporción a sus viviendas;
  - los bares y las discotecas, fuera de las manzanas residenciales de estrato 4 (norma de uso del suelo);
  - el polideportivo, en el parque.
- **R-004 (M1, horarios)** — Los horarios salen del catálogo y cumplen la norma vigente en el perfil:
  - bares y discotecas, hasta el horario de rumba municipal (`amenity.nightlifeClose`, por decreto municipal, típico entre las 01:00 y las 03:00);
  - bibliotecas y museos, en horario diurno y cerrados un día a la semana;
  - estación de policía, `24h`.
- **R-005 (M1, empleo)** — Cada lugar local nuevo con puestos crea su organización (006), con ocupaciones CIUO del catálogo. Los regionales no dan empleo a la población del mundo en M1. **Aviso:** más puestos formales cambian la calibración del empleo (006 CA-001, informalidad), que hay que revisar con estos lugares.
- **R-006 (M1, historia)** — Cada lugar local nuevo tiene `foundedAt` y `PLACE_BUILT` (030). La biblioteca y la escuela pueden ser antiguas; el coliseo, posterior a la década de su `minPopulation`.
- **R-007 (M2, uso)** — Ir a un lugar regional es un viaje (016): sale del paradero, dura `travel.minutes` en cada sentido y cuesta `travel.cost`. Solo cabe en un día libre o en un bloque de ocio largo (011, 032).
- **R-008 (peldaño 4+, crecimiento)** — Si la población crece, se recalcula la dotación. Un tipo que alcanza su `minPopulation` se construye en una parcela libre, con `PLACE_BUILT` y causa "crecimiento de la población". Así el mundo crece en orden, entrada a entrada del catálogo.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `PLACE_BUILT` (existe, 030) | un lugar nuevo, en la historia o por crecimiento | placeId, name, kind | barrio, ley, crecimiento de la población |
| `PLACE_CLOSED` (M2, existe en 004) | cierre excepcional | motivo | organización, decreto |

No hay eventos nuevos.

## 6. Invariantes
- **INV-001** — Todo `kind` instanciado existe en `place_kinds` y cumple su regla de dotación con la población del mundo.
- **INV-002** — Todo lugar local tiene rectángulo y puerta sobre una calle, dentro del mapa. Todo lugar regional no tiene `rect` y sí `travel`, y su padre es la ciudad de referencia.
- **INV-003** — Los obligatorios de R-002 existen siempre en el municipio.

## 7. Criterios de aceptación
- **CA-001 (M1)** — *Dado* un mundo de 200 habitantes con el perfil colombiano, *entonces* el municipio tiene biblioteca, escuela, estación de policía, alcaldía, polideportivo, al menos 3 tiendas de barrio, al menos un bar y un restaurante, y un banco o un corresponsal. Cine, centro comercial, museo y parque de diversiones existen en la ciudad de referencia.
- **CA-002 (M1)** — *Dado* un plan de dotación para 150 000 habitantes, *entonces* el coliseo, el cine y el museo pasan a ser locales, según sus `minPopulation`, y el parque de diversiones sigue siendo regional. La prueba es solo de la regla: no genera 150 000 personas.
- **CA-003 (M1)** — *Dado* un mundo generado, *entonces* se cumplen INV-001 a INV-003, y cada lugar nuevo tiene su `PLACE_BUILT` antes de sus primeros eventos (030 INV-003).
- **CA-004 (M1)** — *Dado* el perfil `prototipo`, *entonces* el mapa y los lugares siguen siendo los del prototipo (003 CA-004 y 004 CA-002 no cambian).
- **CA-005 (M1)** — *Dado* un mundo generado, *entonces* los horarios de bares y discotecas terminan a más tardar a `amenity.nightlifeClose`, y los turnos cumplen la jornada máxima (004 R-007).
- **CA-006 (M2)** — *Dado* una persona que va a cine, *entonces* su trayecto pasa por el paradero, dura al menos `2 × travel.minutes` y le cuesta `2 × travel.cost`.

## 8. Parámetros y calibración
| Parámetro | Valor inicial | Fuente / justificación | Estado |
|---|---|---|---|
| `minPopulation` del cine y el centro comercial | ≈ 100 000 habitantes | estimado: las salas de cine se concentran en ciudades grandes e intermedias (Proimágenes Colombia, anuario estadístico) | por_confirmar |
| `minPopulation` del museo | ≈ 30 000 | estimado; muchos municipios medianos tienen museo o casa museo (Red Nacional de Museos) | por_confirmar |
| `minPopulation` del coliseo | ≈ 20 000 | estimado; los pequeños tienen polideportivo o cancha múltiple | estimado |
| `perInhabitants` de las tiendas de barrio | 1 cada 105 habitantes de media nacional; ≈ 1 cada 60 en estratos 1–2 | Fenalco (2024): ≈ 500 000 tiendas de barrio, el 40 % de los comercios, para ≈ 52 millones de habitantes. El reparto por estrato es estimado | oficial (total) · estimado (por estrato) |
| `perInhabitants` de los bares | ≈ 1 cada 150 | estimado | estimado |
| `amenity.nightlifeClose` | 02:00 | decretos municipales ("horario de rumba"); varía por municipio | estimado |
| `travel` a la ciudad de referencia | 60 min; pasaje intermunicipal en COP del perfil | estimado; municipio a una hora de una ciudad intermedia | estimado |
| plantilla `DATAS_WORLD_V1` | 80 × 50 tiles, tres barrios, plaza central | estimado; concepto visual B | estimado |

## 9. Métricas y observabilidad
`world:report --places` muestra:
- los lugares por tipo, ámbito (local o regional) y barrio;
- la dotación esperada frente a la generada;
- los puestos de trabajo que añade cada tipo.

`world:map` marca la plaza y lista los destinos regionales.

## 10. Preguntas abiertas
- [x] **Escala (la decisión principal).** ¿Cine, centro comercial, museo y parque de diversiones en una "ciudad de referencia" fuera del mapa, a una hora en bus, mientras Data's World tenga pocos habitantes? → **Sí** (usuario, 2026-09-24). Con una precisión: la idea es **expandir primero el territorio y después la población**. Para simular una vida cotidiana, la ciudad debe llegar a tener todo lo que una ciudad tiene, construido por entregas. Por eso la dotación es un catálogo que crece: cada actualización añade tipos de lugar, parcelas o barrios, y R-008 los pasa de "regional" a "local" cuando el territorio y la población lo permiten.
- [x] ¿Nueva plantilla de mapa (80 × 50, con plaza central)? → Sí. El perfil `prototipo` conserva la suya para la paridad (usuario, 2026-09-24). Requiere una fila de historial en la 003.
- [x] "Escuela" → Una institución educativa (una organización) con dos sedes (dos lugares), como en Colombia (usuario, 2026-09-24).
- [x] ¿En qué hito? → En M1, bloque J, junto con la 031 y la 032 (usuario, 2026-09-24).
- [x] Revisar la calibración del empleo (006) con los puestos nuevos → sí, dentro del bloque J (usuario, 2026-09-24).
- [x] Cifras de §8 → tiendas de barrio: ≈ 500 000 en Colombia (Fenalco, 2024), el 40 % de los comercios del país. Con ≈ 52 millones de habitantes, sale ≈ 1 cada 105; en estratos bajos hay más. Los demás umbrales siguen estimados.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-24 | 0.1 | Borrador inicial a petición del usuario: cines, centros comerciales, bares, museos, bibliotecas, restaurantes, parques de diversiones, coliseos, escuelas, bancos, tiendas de barrio y estaciones de policía, con dotación por población y ley, lugares regionales fuera del mapa y una plantilla de mapa nueva |
| 2026-09-24 | 0.1 | Decisión del usuario sobre la escala: lugares regionales en la ciudad de referencia mientras la población sea pequeña; el territorio se expande primero y la población después, por entregas, hasta tener todo lo que tiene una ciudad |
| 2026-09-24 | 0.2 | Decisiones del usuario (§10): plantilla nueva de 80 × 50, escuela como sede de la institución educativa, bloque J en M1 y revisión del empleo. Cifra verificada de tiendas de barrio (Fenalco, 2024) |
| 2026-09-25 | 0.2 | Estado → aprobada |
| 2026-09-25 | 0.3 | Implementación del bloque J (J1–J3). Correcciones: CA-002 decía 60 000 habitantes, pero el cine tiene un umbral de ≈ 100 000 (§8), así que la prueba usa 150 000; la casa de la cultura es CIIU 8553 (enseñanza cultural), no 9006 (actividades teatrales). Precisiones: la regla `amenity` vive en `place_kinds` (2026.09.3), con `placement` (`template`: sitio fijo de la plantilla; `com`: parcela comercial libre) y `spread` (repartir entre barrios), y las tiendas se reparten primero; con 200 habitantes, el pueblo tiene 3 tiendas (una por barrio), bar, restaurante, café, panadería, droguería y corresponsal bancario, más los institucionales de la plantilla, y La Capital, a 60 min y $12 000, tiene cine, centro comercial, museo, coliseo, banco y parque de diversiones; la parroquia de la plaza toma su nombre de la plantilla; hay 19 organizaciones y la informalidad pasa a ≈ 0,46. CA-006 (viaje) queda para M2 |
