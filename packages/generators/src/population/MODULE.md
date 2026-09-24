---
modulo: population
ruta: packages/generators/src/population
estado: en-desarrollo
specs: [001, 007, 008, 009, 014, 029]
actualizado: 2026-09-24
---

# Módulo: population

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Genera los hogares y las personas del presente del mundo (specs 008 y 007): composición por plantillas, vivienda, parentesco, datos de cada persona (nombre, nacimiento, educación, ahorro, pensión, apariencia), su personalidad (009) y los eventos de su pasado. No crea el empleo (bloque G) ni la historia anterior de las familias (bloque H).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 007 | CA-001 y CA-007 (sobre el agregado de 20 mundos, spec v0.5), CA-002, CA-004; R-001 a R-006 (sin la ocupación), R-009; INV-002, INV-003 | CA-003 (situación laboral explicada por la trayectoria: bloque G), CA-005 y CA-006 (bloque I) |
| 008 | CA-001, CA-003; CA-002 y CA-006 (sobre el agregado, spec v0.4); R-001 a R-004 | CA-004 (M2), CA-005 (M3) |
| 001 | CA-005 (semillas distintas dan hashes distintos) | — |

## 3. API pública
Desde `@datas-world/generators`:

| Símbolo | Descripción |
|---|---|
| `generatePopulation(world, territory, places, catalogs, rng)` → `{ citizenIds, householdIds, events }` | Genera hogares hasta `config.population.target` sin partir hogares. Necesita `world.config.profile`. Los `events` son la trayectoria previa (`at < 0`) para guardarlos con la creación del mundo |
| `populationParams(profile, fecha)` → `PopulationParams` | Lee del perfil las claves `gen.household.*`, `gen.savings.*`, `gen.education.*`, `gen.personality.*` y `pension.*` |
| `composeHousehold(rng, params)` → `HouseholdSpec`, `pickTemplate` | Composición pura de un hogar: miembros (sexo, edad, de quién toman el apellido), parentesco por índices, cabeza y cuidadores |
| `PEOPLE_COLUMNS`, `definePeopleColumns(world)` | Columnas de la 007 (y `household.idx` de la 008), idempotente |
| `birthMinuteFor(rng, epoch, edad)`, `maxLevelForAge(edad)`, `COMPLETION_AGE` | Nacimiento con la edad exacta en el epoch y límites de educación por edad |
| `TEMPLATES`, tipos `Template`, `PopulationParams`, `HouseholdSpec`, `MemberSpec` | |

## 4. Diseño interno y decisiones
- **Por hogares** (007 R-001):
  1. se sortea la plantilla con los pesos del perfil;
  2. se compone el hogar;
  3. se asigna la primera vivienda libre de un barrio sorteado en proporción a sus viviendas libres;
  4. se crean las personas.

  La generación se para en cuanto el siguiente hogar superaría el objetivo (008 R-004) o no quedan viviendas libres.
- **Edad de los hijos, dos modelos del perfil:**
  - `uniform` (prototipo): U(0, min(17, edad del progenitor − 20 o 19));
  - `birthAge` (Colombia): edad del progenitor menos la que tenía al tenerlo (21–36), lo que permite hijos adultos que viven en casa.
- **Calibración con el DANE.** Las edades y los hijos del perfil colombiano se ajustaron por simulación para acercarse al DANE 2026. Agregado de 20 mundos: menores de 12 17,5 %, de 12 a 17 8,6 % y 60+ 14,3 %, frente a 17,1 / 9,4 / 15,3 %. Tamaño medio ≈ 2,80.
- **Efecto de conglomerado.** Un pueblo de 200 personas varía unos ±5 puntos respecto al país (menores de 12, entre 8,5 % y 22,6 % según la semilla), porque las personas vienen en hogares. Por eso los criterios estadísticos se comprueban sobre el agregado de 20 mundos. Así lo dicen las specs 007 v0.5 y 008 v0.4, con la revisión aprobada por el usuario.
- **Personas:**
  - nombre del catálogo según el sexo;
  - apellidos colombianos: los hijos llevan el primero del padre y el primero de la madre (008 R-002);
  - los menores nacen en el municipio;
  - el nacimiento es un día al azar con la edad exacta en el epoch;
  - educación por estrato (007 R-004, en CINE), limitada por la edad (`maxLevelForAge`);
  - ahorro por estrato y bonificación desde los 65 (R-005);
  - pensión desde `pension.age` según el sexo, con probabilidad `pension.coverage`;
  - estudiante de 5 a 17 años.
- **Azar por persona.** Flujos `gen:people/<hogar>/<i>`, `gen:personality/<id>`, `gen:appearance/<id>` y `gen:backstory/<id|hogar>`. La composición usa `gen:households/<n>` y la vivienda `gen:dwellings/<n>`.
- **Trayectoria previa** (007 R-006), con causa `{ state: 'backstory' }`:
  - `CHILDHOOD_EVENT` a los 8 años;
  - `STUDIES_COMPLETED` a la edad de terminar el nivel, a final de noviembre (calendario A);
  - `HOUSEHOLD_FORMED` antes del hijo mayor, o unos años atrás, nunca antes de que el adulto más joven cumpliera 18. Participan los miembros ya nacidos.

  Cada `backstory` queda ordenada por fecha.
- **Apariencia** (007 R-009): piel uniforme; peinado por sexo y edad (colitas ≤ 13, moño y gorra desde cierta edad, calvo en hombres ≥ 35); color de pelo ponderado; gafas más probables con la edad; barba en hombres adultos. Todo sale del catálogo `appearance`. Las canas y la ropa las deduce el visor.
- **Coste:** unos 45 B de columnas por persona (con la personalidad, más de 130 B) y un objeto `Citizen` de ≈ 300 B.

## 5. Invariantes y guardarraíles
- 008 INV-002: una persona, un hogar; todo hogar con un adulto. Lo valida en parte `completeHousehold` del motor.
- 008 INV-003: padre o madre ≥ 15 años mayor; abuelo o abuela ≥ 30 años mayor. Probado.
- 007 INV-002: todo menor vive con un adulto.
- 007 INV-003: la trayectoria solo tiene eventos pasados en los que la persona participa.

## 6. Cómo se prueba
`src/population/population.test.ts` (15 pruebas):
- **Mundo de 200 personas:**
  - CA-004 (entre 190 y 200 personas);
  - 008 CA-001 (INV-002 e INV-003);
  - 007 CA-002;
  - 008 CA-003 (abuelos cuidadores);
  - pensión por edad legal;
  - apellidos;
  - 007 INV-003;
  - apariencia coherente;
  - datos por edad.
- **Determinismo:** 001 CA-005.
- **Perfil prototipo:** unas 60 personas, sin `roommates`, jubilación a los 65.
- **Agregado de 20 mundos:** 007 CA-007 y CA-001; 008 CA-002 y CA-006.

## 7. Paridad con el prototipo
Con el perfil `prototipo` porta `genPopulation` (plantillas, edades, sexos, apellidos, hijos) y `newAgent` (educación por clase, ahorro, jubilación a los 65). Diferencias deliberadas:
- una vivienda por hogar, en lugar de hasta dos hogares por casa;
- la personalidad de la spec 009 (10 rasgos);
- la trayectoria como eventos con causa, en lugar del texto `bio`.

## 8. Pendientes y deuda
- [x] Aprobación del usuario de la revisión de CA (007 v0.5, 008 v0.4), el 2026-09-24.
- [ ] Educación por estrato con cifras oficiales cuando las haya (hoy, la tabla del prototipo traducida a CINE).
- [ ] Ocupación y su trayectoria (bloque G); historia de las familias antes del presente (bloque H).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-24 | m1/f-poblacion | — | Documento creado desde la plantilla (sin código) |
| 2026-09-24 | m1/f-poblacion (F1–F3) | 001, 007, 008, 009 | Generación de hogares y personas con parámetros del perfil (calibrados con el DANE), personalidad, apariencia y trayectoria previa. 15 pruebas |
| 2026-09-24 | m1/f-poblacion | 007, 008 | El usuario aprueba la revisión de los CA estadísticos (agregado de 20 mundos) |
