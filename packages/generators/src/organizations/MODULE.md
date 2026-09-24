---
modulo: organizations
ruta: packages/generators/src/organizations
estado: en-desarrollo
specs: [006, 029]
actualizado: 2026-09-24
---

# Módulo: organizations

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Crea las organizaciones empleadoras del mundo (una por lugar de trabajo) con sus puestos, sueldos, turnos y cultura. No contrata a nadie: eso es el empleo inicial (bloque G).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 006 | CA-007 en su parte de sueldos y turnos; CA-002 en parte (cada organización tiene puesto de jefe); R-001; R-003 | CA-001, CA-003 y el resto de CA-002 (empleo inicial, bloque G); CA-004 a CA-006 (M2) |

## 3. API pública
Desde `@datas-world/generators`:

| Símbolo | Descripción |
|---|---|
| `generateOrganizations(world, workplaceIds, catalogs, rng, { prototype? })` → `EntityId[]` | Una organización por lugar de trabajo, en el orden recibido (el de `generatePlaces`). Necesita `world.config.profile`. Lanza si un turno supera la jornada vigente o si falta un sector u ocupación en el catálogo |
| `worldDate(world)` | Fecha del mundo "AAAA-MM-DD" con la que se consulta el perfil de país |

## 4. Diseño interno y decisiones
- **Datos del catálogo** (`place_kinds`): `slots` (número de puestos), `wageMultiple`, `shiftCO`, `shiftProto`, `payProtoDaily` y `occupations` (`{ boss, staff[] }`, añadido en la versión 2026.09.2 del catálogo). El sector es `ciiu.<code>` del lugar.
- **Puestos:**
  - el primero es el jefe (nivel 1) y los demás son de nivel 0 y le reportan;
  - las ocupaciones del personal se reparten en ciclo sobre `staff` (el hospital alterna medicina y enfermería; el colegio, primaria y secundaria);
  - el título es el nombre CIUO del catálogo.
- **Sueldos:**
  - **perfil colombiano:** `wageMultiple × salario mínimo × U(0,9, 1,2)`, redondeado a miles y con un **suelo en el salario mínimo** (006 R-003); el jefe × `gen.jobs.bossWageFactor` (1,6, estimado);
  - **perfil prototipo:** sueldo diario `pay × U(0,85, 1,2)` y jefe × 1,6, como `hire`.

  El salario mínimo se consulta en la fecha del mundo (2026-01-01 → $1.750.905).
- **Turnos:** `shiftCO` (≤ 42 h sin almuerzo) o `shiftProto` sin almuerzo en el perfil prototipo. Se comprueban contra la jornada vigente en la fecha del mundo.
- **Azar:** `rng.fork(placeId).fork(i)` para el sueldo del puesto `i` y `.fork('culture')` para la cultura (normal 0,5 ± 0,15 recortada, estimada). Añadir un puesto no altera los sueldos de los demás.
- **Diferencia con el prototipo:** allí el sueldo se sortea al contratar a cada persona; aquí se fija por puesto al generar. La distribución es la misma.
- **Sin caja** (`cash`) en M1: llega con la economía (015, M2).

## 5. Invariantes y guardarraíles
Ningún puesto formal por debajo del salario mínimo; ningún turno por encima de la jornada máxima vigente. Las validaciones de forma (lugares, sueldos, turnos, supervisores, cultura) las hace `addOrganization` en el motor.

## 6. Cómo se prueba
`src/organizations/organizations.test.ts` (5 pruebas):
- 8 organizaciones con 45 puestos, sectores CIIU y ocupaciones CIUO del catálogo;
- jefe y supervisión (CA-002 en parte);
- **CA-007:** sueldo ≥ salario mínimo y turno ≤ jornada (≤ 42 h también tras el 15-jul-2026);
- perfil prototipo: sueldo diario y turnos de `PDEF`;
- determinismo y cultura en [0,1].

## 7. Paridad con el prototipo
Porta `PDEF` (`slots`, `pay`, `shift`, `wd`) y el jefe × 1,6 de `hire`. Con el perfil prototipo, los sueldos y turnos reproducen su distribución.

## 8. Pendientes y deuda
- [ ] Calibrar `wageMultiple` por ocupación con la GEIH (hoy estimado desde el prototipo).
- [ ] Caja y finanzas de las organizaciones (M2).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-24 | m1/d-organizaciones | — | Documento creado desde la plantilla (sin código) |
| 2026-09-24 | m1/d-organizaciones (D1) | 006 | `generateOrganizations`: 8 organizaciones, 45 puestos con ocupación CIUO, sueldo mensual con suelo en el salario mínimo (o diario en el perfil prototipo), turnos legales y cultura. 5 pruebas: 006 CA-007 (sueldos y turnos) y CA-002 en parte |
