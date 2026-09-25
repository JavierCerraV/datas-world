---
modulo: work
ruta: packages/engine/src/work
estado: en-desarrollo
specs: [006, 015, 016, 010, 011, 021]
actualizado: 2026-09-25
---

# Módulo: work

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
El trabajo en la vida diaria (spec 006, M2): advertencias por retrasos, despidos, vacantes y contratación, y despidos por crisis de caja.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 006 | CA-004, CA-005, CA-006; R-005 (retrasos), R-006, R-007 (sin red de contactos) | Faltas y desempeño por energía y habilidades (R-005, M3 o M5); red de contactos (R-007, 012); `PROMOTION` |

## 3. API pública
Desde `@datas-world/engine`:

| Símbolo | Descripción |
|---|---|
| `workLateSystem` | Fase `memory`, cada tick, capacidad `mobility`: convierte cada retraso a su trabajo en `JOB_WARNING` y, al llegar al límite, en `JOB_LOST` |
| `workMarketSystem` | Fase `economy` (orden 1, después de la economía), cada día, capacidad `economy`: crisis de caja y vacantes |
| `WORK_SYSTEMS` | Los dos sistemas |
| `JobChanges` | Despidos y contrataciones de una corrida como parches (una copia de los puestos por organización) |
| `WORK_COLUMNS`, `defineWorkColumns` | `work.lastLateEvt`, `work.lastLateMin` (los anota la movilidad) y `work.seenLateEvt` |
| `workParams(profile, date)`, tipo `WorkParams` | `work.market` del perfil o los valores por defecto |

## 4. Diseño interno y decisiones
- **Del retraso a la advertencia:**
  1. la movilidad emite `ARRIVED_LATE` con `recordAs: work.lastLateEvt` cuando se llega tarde a su propio trabajo (021), y anota los minutos;
  2. el sistema de retrasos ve el número nuevo;
  3. si pasa la tolerancia (10 min, prototipo `arriveWork`) y la persona no es jefe, emite `JOB_WARNING` con ese retraso como causa y lo guarda en `Citizen.jobRecord.lates`;
  4. con `warnLimit` (3) retrasos en 30 días, `JOB_LOST` con todos ellos como causas.
- **Despido:** libera el puesto, pone a la persona en "desempleada desde ahora" y le sube la tristeza y el miedo (010 R-005). La economía deja de pagarle la quincena.
- **Crisis (R-006):**
  - con la caja en negativo 60 días seguidos (`Organization.crisisDays`), se despide a quien ocupa el último puesto no directivo;
  - la cuenta vuelve a 30, así que si sigue en negativo hay otro despido a los 30 días;
  - una organización en crisis o con la caja negativa no contrata.
- **Vacantes (R-007):**
  - cada puesto libre se cubre con probabilidad 0,2 al día (≥ 99 % en 30 días), con un desempleado de 18 a 64 años sin discapacidad para caminar ni para el autocuidado, al azar (`sys:work.market/<org>/<puesto>`);
  - la rutina toma el turno nuevo (se levanta 85 min antes);
  - los requisitos y la red de contactos llegan con 012 (M3).

## 5. Invariantes y guardarraíles
006 INV-002: un puesto, un titular. Un desempleado no se contrata dos veces el mismo día, y cada organización recibe un único parche de puestos por corrida.

## 6. Cómo se prueba
`work.test.ts` (3 pruebas):
- **CA-004:** extremo a extremo, con necesidades, rutina y movilidad: se queda dormido 3 mañanas → 3 retrasos → advertencias 1, 2 y 3 → despido con los 3 retrasos como causas; el jefe no recibe advertencias;
- **CA-005:** 20 de 20 semillas cubren la vacante en 30 días;
- **CA-006:** con la caja en negativo, nada a los 59 días y un despido por crisis a los 61, sin contrataciones.

En `generators/src/economy`, 30 días del mundo generado con todos los sistemas: menos de 30 retrasos y contrataciones de las vacantes iniciales.

## 7. Paridad con el prototipo
- Porta `arriveWork`: tolerancia de 10 minutos, sin llamada de atención al jefe; el retraso se explica por quedarse dormido o por el viaje.
- Porta `fire`.
- Diferencia: el prototipo baja la confianza del jefe y crea memorias. Eso llega con relaciones y memoria (012, 013).

## 8. Pendientes y deuda
- [ ] Faltas (no ir al trabajo) como causa de advertencia.
- [ ] Red de contactos y requisitos en la contratación (012).
- [ ] Confianza del jefe y memoria del retraso (012, 013).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-25 | m2/g-trabajo-objetos | — | Documento creado desde la plantilla (sin código) |
| 2026-09-25 | m2/g-trabajo-objetos (G1) | 006, 015, 016 | `jobs.ts` (columnas, parámetros, `JobChanges`), `systems.ts` (retrasos y mercado de trabajo) e `index.ts`. 3 pruebas: 006 CA-004, CA-005, CA-006 |
