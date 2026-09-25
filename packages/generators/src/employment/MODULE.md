---
modulo: employment
ruta: packages/generators/src/employment
estado: en-desarrollo
specs: [006, 007, 029]
actualizado: 2026-09-24
---

# Módulo: employment

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Asigna la situación laboral inicial de cada persona según las definiciones de la GEIH y crea los eventos de su trayectoria que la explican:
- ocupada: formal, informal o independiente;
- desocupada;
- inactiva: estudio, oficios del hogar, pensión u otro motivo.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 006 | CA-001 (agregado de 20 mundos), CA-002, CA-003 (paridad con `genJobs`); R-002, R-004, R-008 | CA-004 a CA-006 (M2) |
| 007 | CA-003 (situación laboral explicada por la trayectoria) | — |

## 3. API pública
Desde `@datas-world/generators`:

| Símbolo | Descripción |
|---|---|
| `generateEmployment(world, citizenIds, orgIds, { trades_informal }, rng)` → `{ events }` | Da una ocupación a cada persona con `hire`/`setOccupation` del motor y devuelve los eventos de trayectoria (`at < 0`). Necesita el perfil de país y las columnas de la población. Tras llamarla hay que reordenar las trayectorias con `sortBackstories` usando todos los eventos |
| `employmentProbability(tabla, edad)` | Probabilidad de estar ocupado según la tabla por tramos del perfil |

## 4. Diseño interno y decisiones
- **Parámetros del perfil:**
  - `gen.labor.employmentByAge.{F,M}`: tabla por tramos 15, 18, 25, 55 y 65;
  - `gen.labor.informalShare`, `gen.labor.unemployedP`, `gen.labor.adultStudentP` y `gen.labor.homeDutiesP.{F,M}`.

  En Colombia están estimados y calibrados con la GEIH; en el prototipo, los de `genJobs`.
- **Orden de asignación:**
  1. los menores de 15 son `minor` o `student`;
  2. la población de 15 años o más se baraja (flujo `gen:jobs/order`) y se recorre;
  3. cada persona está ocupada con la probabilidad de su edad y sexo (× 0,3 si está pensionada);
  4. las ocupadas son formales si tienen 18 años o más, queda puesto libre y no salen informales (`informalShare`). El puesto se elige con los pesos por estrato del prototipo (oficina y hospital × 3 en estrato 4, fábrica × 3 en estrato 2) y es el primero libre de la organización, así que el primer contratado es el jefe;
  5. el resto de ocupados trabaja en un oficio del catálogo `trades_informal`;
  6. las no ocupadas quedan pensionadas si lo están; estudiantes si tienen menos de 18 (o menos de 25, con probabilidad); desocupadas (18–64, con probabilidad); y si no, en oficios del hogar u otro motivo.
- **Eventos**, con causa `{ state: 'backstory' }`:
  - `JOB_HIRED`: antigüedad de hasta 20 años, nunca antes de los 18;
  - `INFORMAL_WORK_STARTED`: hasta 15 años atrás, nunca antes de los 15;
  - `JOB_LOST`: desocupado desde hace 10 a 120 días, como `genJobs`;
  - `RETIRED`: al cumplir la edad de pensión.
- **Calibración** (agregado de 20 mundos, perfil colombiano):

  | | Mundo | GEIH |
  |---|---|---|
  | Tasa de ocupación (15+) | 0,607 | 0,595 |
  | Tasa de desempleo | 0,081 | 0,081 |
  | Tasa global de participación | 0,661 | 0,648 |
  | Informalidad | 0,529 | objetivo 0,45 |

  La informalidad queda por encima del objetivo porque solo hay 45 puestos formales para unas 95 personas ocupadas. Aun así está entre 13 ciudades (0,405) y el total nacional (0,545), como una ciudad intermedia.
- **Perfil prototipo:** 0,866 de ocupación de 18 a 64 años (0,86 en el prototipo). El reparto por tipo de lugar está a menos de 0,06 del de `genJobs`; la fábrica es algo mayor porque San Martín tiene más viviendas.

## 5. Invariantes y guardarraíles
006 INV-002 (un puesto, un titular; una persona, un puesto), comprobado por `hire` en el motor y probado. Los menores de 15 no trabajan; los de 15 a 17 no tienen puesto formal.

## 6. Cómo se prueba
`src/employment/employment.test.ts` (8 pruebas):
- **006 CA-002:** titulares y jefes;
- edades mínimas;
- **007 CA-003:** evento que explica la situación y trayectorias ordenadas;
- `employmentProbability`;
- determinismo del mundo completo;
- **006 CA-001:** agregado de 20 mundos, en el perfil colombiano y en el prototipo;
- **006 CA-003:** paridad con el prototipo, cargando su motor con `vm`, como `scripts/prototipo/linea-base.mjs`.

## 7. Paridad con el prototipo
Con el perfil `prototipo` porta `genJobs` y `hire`: 86 % de ocupación de 18 a 64 años, pesos por estrato, el jefe como primer contratado y desempleados desde hace 10 a 120 días.

## 8. Pendientes y deuda
- [ ] Calibrar `homeDutiesP` y `adultStudentP` con la GEIH (hoy estimados).
- [ ] Más empleo formal cuando M2 añada lugares del catálogo (supermercado, banco, alcaldía…), lo que bajará la informalidad hacia el objetivo.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-24 | m1/g-empleo-objetos | — | Documento creado desde la plantilla (sin código) |
| 2026-09-24 | m1/g-empleo-objetos (G1) | 006, 007 | `generateEmployment` con definiciones GEIH, pesos por estrato y eventos de trayectoria; parámetros del perfil calibrados. 8 pruebas: 006 CA-001, CA-002, CA-003; 007 CA-003 |
| 2026-09-25 | m1/j-salud | 031, 006 | 031 R-004: con discapacidad para caminar o para el autocuidado (`limitsWork`), la probabilidad de empleo se multiplica por `gen.health.disabilityEmploymentFactor` (0,4, estimado); sin la entrada en el perfil, no cambia. Las pruebas de 006 siguen verdes |
| 2026-09-25 | m1/j-ocio | 006 | Solo pruebas: las tres que generan 10 o 20 mundos dentro de un `it` tienen un límite de 60 s. Con la salud y el esparcimiento, cada mundo tarda más y pasaban de los 5 s por defecto de Vitest en paralelo. Sin cambios de código |
