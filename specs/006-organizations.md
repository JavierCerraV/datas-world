---
id: 006
nombre: organizations
estado: aprobada
hito: M1 (generación y empleo inicial) · M2 (desempeño, despidos, contratación)
depende_de: [004, 023, 029]
version: 0.5
---

# 006 — Organizaciones y ocupación

## 1. Propósito
Empresas, colegio, hospital y comercios: empleadores con puestos, salarios, jefes, cultura y finanzas simples. Son fuente de empleo, estatus y conflicto, y de eventos como `JOB_LOST`. Recoge también el trabajo informal e independiente, muy relevante en Colombia.

## 2. Alcance
**Incluye:** organizaciones, puestos, empleo inicial, tipo de ocupación (formal, informal, independiente), turnos, jefes y cultura. Desde M2: desempeño, advertencias, despidos, contratación y finanzas.
**Fuera de alcance:** mercado macroeconómico; flujo de dinero (015, M2).

**Decisión (v0.2):** el **trabajo informal** existe desde la generación, como tipo de ocupación. Sus ingresos variables llegan con la economía (015) en M2.

## 3. Modelo de datos
```ts
interface Organization {
  id: EntityId;                     // ORG-0012
  name: string;
  sector: string;                   // código CIIU Rev. 4 A.C. del catálogo org_sectors (ADR-006)
  placeIds: EntityId[];             // lugares donde opera (spec 004)
  positions: Position[];            // orden por id
  culture: { strictness: number; warmth: number; stability: number }; // [0,1]
  cash: number;                     // entero, moneda del mundo (desde M2)
}
interface Position {
  id: string;                       // "ORG-0012/P03"
  title: string; level: number;     // 0 = base; el jefe tiene level 1
  occupation: string;               // código CIUO-08 A.C. del catálogo occupations
  monthlyWage: number;              // entero, pesos; un puesto formal nunca está por debajo del salario mínimo
  shift: { days: 'mon-fri' | 'mon-sat'; start: number; end: number }; // minutos del día
  holderId?: EntityId; supervisorPositionId?: string;
}
// Ocupación de cada persona (entidad Citizen, spec 007):
type Occupation =
  | { kind: 'formal'; orgId: EntityId; positionId: string }
  | { kind: 'informal'; trade: string }        // vendedor ambulante, domicilios, oficios
  | { kind: 'independent'; trade: string }     // independiente con clientela propia
  | { kind: 'none'; reason: 'unemployed' | 'student' | 'home_duties' | 'pensioned' | 'other_inactive';
      since: WorldMinute };                    // desocupado (busca trabajo) o inactivo, como en la GEIH
```
Columnas nuevas (spec 001 §3.1): ninguna en M1. Las advertencias (`work.warnings`, u8) llegan en M2.

Coste en memoria: ≈ 150 B por puesto; con ≈ 50 puestos, unos 8 KB.

## 4. Reglas
- **R-001 (M1)** — Una organización por cada lugar de trabajo de la plantilla. Los puestos (`slots`), el sueldo (`pay`) y el turno salen de `PDEF` del prototipo.
- **R-002 (M1)** — Empleo inicial con `rng.fork('gen:jobs')`, en este orden:
  1. Se barajan los adultos de 18 a 64 años.
  2. Cada uno tiene trabajo con probabilidad `EMPLOYMENT_RATE`.
  3. Si lo tiene, es informal o independiente con probabilidad `INFORMAL_SHARE` y, si no, ocupa un puesto formal libre.
  4. El puesto formal se elige con pesos por estrato: oficina y hospital pesan ×3 para estrato 4, fábrica ×3 para estrato 2.
  5. El primer contratado de cada organización es el jefe, con el sueldo × 1,6.
- **R-003 (M1)** — Sueldo mensual = `WAGE_MULTIPLE[tipo de puesto] × labor.minimumWageMonthly × U(0,9, 1,2)`, redondeado a miles y **nunca por debajo del salario mínimo en un puesto formal** (ley). Con el perfil "prototipo", el sueldo diario es `pay × U(0,85, 1,2)` como en `hire`.
- **R-008 (M1)** — La situación laboral sigue las definiciones de la GEIH. Se calibra para que, en la población de 15 años o más, la tasa de ocupación, la de participación y la de desempleo se acerquen a las del perfil (029), y la informalidad a `labor.informality.world`.
  - La probabilidad de estar ocupado depende de la edad y del sexo: `EMPLOYMENT_BY_AGE`.
  - Los menores de 15 años no trabajan.
  - Los inactivos se reparten entre estudiantes, oficios del hogar, pensionados y otros.
- **R-009 (M1)** — Los turnos de los puestos respetan `labor.maxWeeklyHours` vigente en la fecha del mundo (Ley 2101 de 2021), con la hora de almuerzo excluida. Los recargos nocturnos y dominicales (Ley 2466 de 2025) se aplican desde M2, con la economía.
- **R-004 (M1)** — Si no quedan puestos formales libres, la persona pasa a informal. Quien no tiene trabajo queda como `none`, con `since` = epoch − U(10, 120) días.
- **R-005 (M2)** — El desempeño combina puntualidad, energía y habilidades. Las faltas y los retrasos repetidos acumulan `warnings` del supervisor.
- **R-006 (M2)** — El despido ocurre con `warnings ≥ WARN_LIMIT` o por crisis financiera de la organización, siempre con causas.
- **R-007 (M2)** — Las vacantes se cubren eligiendo candidatos por requisitos, red de contactos (012) y azar.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `JOB_HIRED` | contratación; en la generación, con fecha anterior al epoch | citizenId, orgId, positionId | búsqueda, contacto; en la generación, `{ state: 'backstory' }` |
| `INFORMAL_WORK_STARTED` | empieza un oficio informal o independiente; en la generación, con fecha anterior al epoch | citizenId, kind, trade | falta de empleo formal, `backstory` |
| `JOB_WARNING` (M2) | llamada de atención | motivo | retraso, falta |
| `JOB_LOST` | despido; en la generación, para los desempleados | motivo | advertencias o crisis; `backstory` |
| `PROMOTION` (M2) | ascenso | de, a | desempeño |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados están en su rango y sin NaN.
- **INV-002** — Cada puesto tiene como mucho un titular, y cada persona con ocupación `formal` ocupa exactamente un puesto, que la referencia.

## 7. Criterios de aceptación
- **CA-001 (M1)** — *Dado* 20 mundos de 200 personas con el perfil colombiano, *entonces* en la población de 15 años o más la tasa de ocupación agregada está en `labor.employmentRate ± 0,03` (y la de cada mundo, a ±0,10), la tasa de desempleo agregada en `labor.unemploymentRate ± 0,03`, y la informalidad agregada de los ocupados entre `labor.informality` de las 13 ciudades y la nacional. Con el perfil "prototipo", la ocupación agregada de 18 a 64 años está en `0,86 ± 0,04`.
- **CA-007 (M1)** — *Dado* un mundo generado, *entonces* ningún puesto formal tiene un sueldo inferior al salario mínimo vigente y ningún turno supera la jornada máxima vigente.
- **CA-002 (M1)** — *Dado* un mundo generado, *entonces* cumple INV-002 y cada organización con personal tiene jefe.
- **CA-003 (M1)** — *Dado* el perfil "prototipo" (sin informalidad, 60 personas) y 10 semillas, *entonces* la proporción del empleo formal en cada tipo de lugar está a ±0,06 de la que genera `genJobs` del prototipo con las semillas 100 a 109.
- **CA-004 (M2)** — *Dado* una persona con 3 retrasos en un mes y `WARN_LIMIT = 3`, *entonces* recibe `JOB_LOST` con causas que incluyen los 3 retrasos.
- **CA-005 (M2)** — *Dado* una vacante con candidatos, *entonces* se cubre en ≤ 30 días con probabilidad alta.
- **CA-006 (M2)** — *Dado* una organización con caja negativa 2 meses, *entonces* reduce plantilla.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto | Rango | Fuente / justificación |
|---|---|---|---|
| `EMPLOYMENT_BY_AGE` | calibrado para `labor.employmentRate` = 0,595 (15 años o más) | 0–1 | DANE, GEIH julio 2026 (spec 029). En el perfil "prototipo": 0,86 para 18 a 64 años |
| `INFORMAL_SHARE` | `labor.informality.world` = 0,45 | 0–0,7 | spec 029: entre 13 ciudades (0,405) y el total nacional (0,545). En el perfil "prototipo" vale 0 |
| `WAGE_MULTIPLE` | oficina 2,0 · hospital 2,2 · colegio 1,6 · fábrica 1,2 · tienda, café, restaurante y gimnasio 1,0 (× salario mínimo) | ≥ 1 en formal | estimado a partir del sueldo diario del prototipo × 22 días; pendiente de calibrar con la GEIH |
| `BOSS_WAGE_FACTOR` | 1,6 | — | prototipo (`hire`) |
| `WARN_LIMIT` (M2) | 3 | 1–10 | borrador 0.1 |

## 9. Métricas y observabilidad
Ocupación por tipo y por estrato, puestos libres y sueldo medio por organización. Alerta si una organización queda sin personal.

## 10. Preguntas abiertas
- [x] ¿Trabajo informal desde el MVP? → Sí, como tipo de ocupación desde la generación; sus ingresos llegan en M2 (usuario, 2026-09-24).
- [ ] Lista de oficios informales (`trade`) y sus ingresos típicos: se definen con la economía (015).

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-24 | 0.2 | Revisión de M1 aprobada por el usuario: ocupación formal, informal, independiente o ninguna; empleo inicial portado de `genJobs`/`hire` (R-001 a R-004); eventos de trayectoria previa con fecha anterior al epoch; sueldo diario como en el prototipo; reglas y criterios marcados por hito |
| 2026-09-24 | 0.3 | Ajuste a Colombia (usuario): sectores CIIU y ocupaciones CIUO por catálogo (ADR-006); sueldo mensual en múltiplos del salario mínimo, nunca por debajo en un puesto formal; ocupación, desempleo e inactividad según la GEIH julio 2026 (R-008); informalidad 0,45; jornada de la Ley 2101 (R-009); CA-001 recalibrado y CA-007. El perfil "prototipo" conserva la paridad |
| 2026-09-24 | 0.3 | Estado → aprobada |
| 2026-09-24 | 0.4 | Implementación del bloque D: el sueldo es `wage` con `wagePeriod` (`month` en el perfil colombiano; `day` en el perfil prototipo, por paridad con `hire`); el turno incluye `lunch`, que no cuenta como jornada (Ley 2101); el sueldo se fija por puesto al generar, con la misma distribución que el prototipo al contratar; ocupaciones del jefe y del personal en el catálogo `place_kinds`; cultura con normal 0,5 ± 0,15 (estimada); la caja llega en M2. Sin cambios en CA |
| 2026-09-24 | 0.5 | Implementación del bloque G, con la revisión de CA aprobada por el usuario (agregado de 20 mundos). La informalidad agregada sale 0,53 y no 0,45: con 45 puestos formales (los del prototipo) y unas 95 personas ocupadas, al menos la mitad trabaja de forma informal. Por eso el criterio pide que quede entre la informalidad de las 13 ciudades (0,405) y la nacional (0,545), lo propio de una ciudad intermedia. CA-003 se compara con el empleo inicial del prototipo (repartos a menos de 0,06). Precisiones: los de 15 a 17 años solo trabajan de forma informal; un pensionado trabaja con el 30 % de la probabilidad de su edad; los no ocupados se reparten en pensión, estudio (18–24), desempleo y oficios del hogar u otro motivo; los menores de 15 son `minor` o `student`; eventos `JOB_HIRED`, `INFORMAL_WORK_STARTED`, `JOB_LOST` y `RETIRED` con fecha anterior al presente |
| 2026-09-25 | 0.5 | Spec 033 (bloque J):
- una organización puede tener varias sedes: la escuela, con `orgWith`, suma sus puestos a la institución educativa, que toma su `orgName`;
- con la dotación hay 19 organizaciones y 76 puestos;
- la informalidad de un mundo baja de 0,53 a ≈ 0,46, más cerca de una ciudad intermedia. CA-001 (entre 0,405 y 0,545 en el agregado) sigue verde.

Sin cambios en CA |
