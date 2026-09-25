---
id: 007
nombre: population
estado: implementada
hito: M1 (generación) · peldaño 4 (nacimientos y muertes)
depende_de: [001, 003, 004, 006, 008, 009, 014, 023, 029]
version: 0.5
---

# 007 — Población

## 1. Propósito
Generar y mantener a los ciudadanos: identidad, datos demográficos, educación, salud base y trayectoria previa. Son personas, no pacientes.

## 2. Alcance
**Incluye:** atributos del ciudadano, el generador del mundo inicial (que orquesta 003, 004, 006, 008, 009 y 005) y la trayectoria previa.
**Fuera de alcance:** personalidad (009), necesidades (010), relaciones (012).

**Decisión (v0.2):** **nacimientos y muertes se posponen** al peldaño 4 (capacidad `lifecourse`, ADR-005).

## 3. Modelo de datos
```ts
interface Citizen extends BaseEntity {   // spec 001; status 'active' | 'inactive'
  id: EntityId;                          // CIT-000123
  name: { given: string; family: [string, string] }; // dos apellidos
  sex: 'F' | 'M';
  birthplace: string;
  householdId: EntityId;
  occupation: Occupation;                // spec 006
  backstory: EntityId[];                 // eventos anteriores al epoch, en orden
}
```
Columnas (spec 001 §3.1): los datos numéricos no van en el objeto.

| Columna | Tipo | Rango | Inicial | Qué es |
|---|---|---|---|---|
| `demo.birthMinute` | `i32` | minutos, negativo = antes del epoch | 0 | nacimiento (edad = (now − birth) / 525 600) |
| `demo.education` | `u8` | 0–9 | 0 | nivel CINE 2011 A.C. (catálogo `education_levels`): 0 ninguno · 1 primaria · 2 básica secundaria · 3 media (bachiller) · 4 técnica profesional · 5 tecnológica · 6 universitaria · 7 especialización · 8 maestría · 9 doctorado |
| `money` | `i32` | pesos, entero | 0 | ahorro inicial; desde M2 lo mueve la economía (015) |
| `health.physical` | `f32` | [0,1] | 1 | salud física base |
| `demo.student` | `u8` | 0/1 | 0 | estudia, de 5 a 17 años |
| `demo.pensioned` | `u8` | 0/1 | 0 | recibe pensión. Solo es posible desde `pension.age` (mujeres 57, hombres 62; spec 029), y con probabilidad `pension.coverage` |
| `look.skin` | `u8` | 1–5 | 1 | tono de piel del sprite (catálogo `appearance`) |
| `look.hairStyle` | `u8` | 0–7 | 0 | peinado: corto, bob, largo, moño, colitas, en punta, gorra, calvo |
| `look.hairColor` | `u8` | índice | 0 | color de pelo base (sin canas) del catálogo `appearance` |
| `look.glasses` | `u8` | 0/1 | 0 | gafas |
| `look.beard` | `u8` | 0/1 | 0 | barba |

Coste en memoria: ≈ 300 B de objeto y 23 B de columnas por persona.

**Apariencia (v0.4).** Las columnas `look.*` alimentan los sprites del concepto visual B (docs/identidad-visual.md). **Las canas y la ropa no se guardan:** el visor (M4) las deduce de la edad y de la ocupación, para no duplicar datos.

## 4. Reglas
- **R-001 (M1)** — La población se genera **por hogares** (008), no persona a persona, para que edades, apellidos y estratos sean coherentes. Orden del generador: geografía (003) → lugares (004) → organizaciones (006) → hogares con sus personas (008 + 007, con la personalidad de 009) → empleo (006) → objetos (005). Cada paso usa su flujo `gen:<paso>`.
- **R-002 (M1)** — Nombres de `GIVEN_NAMES_F`, `GIVEN_NAMES_M` y `FAMILY_NAMES` (español colombiano, del prototipo), y lugar de nacimiento de `BIRTHPLACES`. Los menores nacen en Data's World.
- **R-003 (M1)** — La fecha de nacimiento es el epoch menos la edad de la plantilla (008) menos `U(0, 364)` días.
- **R-008 (M1)** — Con el perfil colombiano, la estructura por edades sigue `demo.share.*` y la educación sigue `education.attainment.*` por estrato (spec 029). Mientras esas entradas estén `por_confirmar`, se usa la tabla de R-004 traducida a niveles CINE, marcada `estimado`.
- **R-004 (M1)** — Educación de los adultos según el estrato:
  - estrato 2: primaria, bachillerato o técnico;
  - estrato 3: bachillerato, técnico, tecnólogo o universitario;
  - estrato 4: universitario (con doble peso) o posgrado.

  Es la tabla del prototipo.
- **R-005 (M1)** — Ahorro inicial de los adultos, en miles de pesos:
  - estrato 2: `U(300, 1 600)`;
  - estrato 3: `U(800, 4 000)`;
  - estrato 4: `U(2 500, 9 000)`;
  - los de 65 años o más suman `U(300, 2 000)`.

  Es la tabla del prototipo.
- **R-006 (M1)** — **Trayectoria previa.** Cada persona recibe eventos con fecha anterior al epoch que explican su situación inicial:
  - llegada al hogar (`HOUSEHOLD_FORMED`, 008);
  - fin de estudios (`STUDIES_COMPLETED`);
  - su ocupación (`JOB_HIRED`, `INFORMAL_WORK_STARTED` o `JOB_LOST`, 006), o su pensión (`RETIRED`, solo si `demo.pensioned`);
  - un hecho de infancia (`CHILDHOOD_EVENT`, de la lista `KID` del prototipo).

  Sus causas son `{ state: 'backstory' }` o eventos previos de la misma persona.
- **R-009 (M1)** — **Apariencia.** Se genera con `rng.fork('gen:appearance').fork(citizenId)`, reproducible por persona:
  - el tono de piel es uniforme entre 1 y 5 (estimado). No se asocia a etnia; podrá calibrarse con el autorreconocimiento del censo si el usuario lo considera pertinente;
  - el peinado y las gafas dependen del sexo y la edad, y la barba solo de los hombres adultos, con probabilidades del catálogo `appearance` (estimadas).
- **R-007 (peldaño 4)** — Nacimientos y muertes (`CITIZEN_BORN`, `CITIZEN_DIED`) con la capacidad `lifecourse`.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `STUDIES_COMPLETED` | trayectoria previa | citizenId, level | `backstory` |
| `RETIRED` | trayectoria previa (≥ 65) | citizenId | `backstory`, último empleo |
| `CHILDHOOD_EVENT` | trayectoria previa | citizenId, kind | `backstory` |
| `CITIZEN_BORN` (peldaño 4) | nacimiento | padres | — |
| `CITIZEN_DIED` (peldaño 4) | muerte | causa | salud (010) |

Los eventos anteriores al epoch tienen `at < 0`. Se registran con la creación del mundo, en orden de `at` y luego de id.

## 6. Invariantes
- **INV-001** — Todos los valores normalizados están en su rango y sin NaN.
- **INV-002** — Todo menor de 18 años vive en un hogar con al menos un adulto.
- **INV-003** — `backstory` solo contiene eventos con `at < 0` en los que la persona participa.

## 7. Criterios de aceptación
- **CA-001 (M1)** — *Dado* 20 mundos de 200 personas, *entonces* su pirámide agregada (grupos 0–11, 12–17, 18–29, 30–44, 45–59, 60+) difiere menos de 0,03 por grupo de la de otros 20 mundos con otras semillas; y el `stateHash` es idéntico con la misma semilla.
- **CA-002 (M1)** — *Dado* un menor de edad, *entonces* vive en un hogar con al menos un adulto.
- **CA-003 (M1)** — *Dado* cualquier persona adulta, *entonces* su situación laboral inicial está explicada por ≥ 1 evento de su `backstory`.
- **CA-004 (M1)** — *Dado* `population.target = 200`, *entonces* se generan entre 190 y 200 personas (los hogares no se parten).
- **CA-005 (M1)** — *Dado* semillas distintas y la misma configuración, *entonces* los hashes difieren. Es la spec 001 CA-005, que M0 dejó pendiente.
- **CA-007 (M1)** — *Dado* 20 mundos de 200 personas con el perfil colombiano, *entonces* las proporciones agregadas de menores de 12 años, de 12 a 17 y de 60 o más están dentro de ±0,03 de `demo.share.*` y, en cada mundo, dentro de ±0,10; y nadie recibe pensión por debajo de `pension.age` de su sexo.
- **CA-006 (M1)** — *Dado* `population.target = 60` y el perfil de paridad, *entonces* la edad media, el porcentaje de menores y el ahorro medio están dentro de la tolerancia de la línea base del prototipo.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto | Rango | Fuente / justificación |
|---|---|---|---|
| `population.target` | 200 (60 en el perfil de paridad) | 10–500 | roadmap M1; prototipo (60) |
| `GIVEN_NAMES_*`, `FAMILY_NAMES`, `BIRTHPLACES` | listas `MN`, `FN`, `SUR`, `BIRTH` | — | prototipo |
| tablas de educación y ahorro | R-004, R-005 | — | prototipo |

## 9. Métricas y observabilidad
Pirámide de edades, educación por estrato, ahorro por estrato y edad, y ocupación. Es el **informe de población** del M1 (`pnpm cli world:report`).

## 10. Preguntas abiertas
- [x] ¿Nacimientos y muertes en M3 o posponer? → Posponer al peldaño 4, `lifecourse` (usuario, 2026-09-24).
- [ ] Identidad de género (`genderIdentity` del borrador 0.1): se retira de M1; se retomará con la tabla de expertos (009).

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-24 | 0.2 | Revisión de M1 aprobada por el usuario: datos numéricos como columnas (ADR-005); personalidad, estado y nivel de simulación fuera del objeto `Citizen` (009, 010, 021); orden del generador y flujos por paso; tablas de nombres, educación y ahorro portadas de `newAgent`; trayectoria previa con eventos de fecha anterior al epoch; nacimientos y muertes en el peldaño 4; incluye la 001 CA-005; criterios marcados por hito |
| 2026-09-24 | 0.3 | Ajuste a Colombia (usuario): educación en niveles CINE 2011 A.C. (0–9); pensión por edad según el sexo (57/62, Ley 100 de 1993 y Ley 2381 de 2024) y cobertura del perfil, en lugar de jubilación a los 65; estructura por edades del DANE 2026 (R-008, CA-007) |
| 2026-09-24 | 0.3 | Estado → aprobada |
| 2026-09-24 | 0.3 | Aclaración por la spec 030 (usuario): los nacimientos y las muertes **anteriores al presente** (desde 1900) los genera la historia; R-007 (peldaño 4) se refiere solo a los del presente simulado. El presente del mundo es el 2026-01-01 |
| 2026-09-24 | 0.3 | Nombre (usuario): el mundo y su municipio se llaman **Data's World**, en lugar de Villa Cordillera. Inspirado en el androide Data: ciudadanos autónomos, curiosos y capaces de aprender. Solo cambia el nombre; la información sigue siendo de Colombia |
| 2026-09-24 | 0.4 | Apariencia para los sprites del concepto visual B, aprobada por el usuario: columnas `look.*` y R-009. El tono de piel es uniforme (estimado) y no se asocia a etnia; las canas y la ropa las deduce el visor de la edad y la ocupación |
| 2026-09-24 | 0.5 | Implementación del bloque F. CA-001 y CA-007 se comprueban sobre el agregado de 20 mundos (±0,03), con un margen por pueblo (±0,10), porque las personas vienen agrupadas en hogares y un pueblo de 200 varía ±5 puntos: con 20 semillas, las proporciones de un solo pueblo van de 8,5 % a 22,6 % en menores de 12, mientras el agregado da 17,5 / 8,6 / 14,3 frente a 17,1 / 9,4 / 15,3 del DANE. Precisiones: las edades de hogares, el ahorro y la educación por estrato son parámetros del perfil (`gen.household.*`, `gen.savings.*`, `gen.education.*`); con el perfil colombiano, la edad de los hijos es la edad del progenitor menos la que tenía al tenerlos (calibrado con el DANE); la educación se limita por la edad; los menores nacen en el municipio; nombres, apellidos, lugares de nacimiento (DIVIPOLA real), hechos de infancia y apariencia en catálogos |
| 2026-09-24 | 0.5 | Revisión de CA estadísticos aprobada por el usuario |
| 2026-09-24 | 0.5 | Bloque G: CA-003 cubierto. Explican la situación de cada adulto: `JOB_HIRED` o `INFORMAL_WORK_STARTED` si está ocupado, `JOB_LOST` si está desocupado y `RETIRED` si está pensionado. A los inactivos por estudio u oficios del hogar los explican su trayectoria de estudios y la de su hogar |
| 2026-09-24 | 0.5 | Bloque H (030 R-005): un adulto nace en el campo con probabilidad 1 − urbanización de su año de nacimiento (`demo.urbanization.byYear`); si no, en una ciudad del catálogo `birthplaces` (v2026.09.2, con la marca `rural`). Cada persona viva gana `CITIZEN_BORN` y, si nació fuera, `MIGRATED` en su trayectoria. Sin cambios en CA |
| 2026-09-24 | 0.5 | Cierre de M1: CA-006 se comprueba contra el propio `genWorld` del prototipo, porque la línea base solo tiene métricas tras un año. Tolerancias sobre 10 semillas: edad media ±2 años, menores ±0,03 y ahorro medio de los adultos ±15 %. Medido: 30,7 frente a 30,1 años, 0,377 frente a 0,386 y 1,95 M frente a 2,18 M COP |
| 2026-09-25 | 0.5 | Estado → implementada |
