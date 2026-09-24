---
id: 006
nombre: organizations
estado: borrador
hito: M1 (generación y empleo inicial) · M2 (desempeño, despidos, contratación)
depende_de: [004, 023, 029]
version: 0.3
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
- **CA-001 (M1)** — *Dado* 200 personas generadas con el perfil colombiano, *entonces* en la población de 15 años o más la tasa de ocupación está en `labor.employmentRate ± 0,07` y la informalidad de los ocupados en `labor.informality.world ± 0,1`. Con el perfil "prototipo", la ocupación de 18 a 64 años está en `0,86 ± 0,08`.
- **CA-007 (M1)** — *Dado* un mundo generado, *entonces* ningún puesto formal tiene un sueldo inferior al salario mínimo vigente y ningún turno supera la jornada máxima vigente.
- **CA-002 (M1)** — *Dado* un mundo generado, *entonces* cumple INV-002 y cada organización con personal tiene jefe.
- **CA-003 (M1)** — *Dado* `INFORMAL_SHARE = 0` y 60 personas, *entonces* la distribución de empleo por tipo de lugar está dentro de la tolerancia del prototipo (paridad estadística).
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
