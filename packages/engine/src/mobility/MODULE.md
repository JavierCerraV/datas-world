---
modulo: mobility
ruta: packages/engine/src/mobility
estado: en-desarrollo
specs: [016, 004, 005, 021, 033]
actualizado: 2026-09-25
---

# Módulo: mobility

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Dónde está cada persona y cómo va de un lugar a otro (spec 016): modos, tiempos, costes, bus a La Capital, llegadas tarde, y horarios y capacidad de los lugares (004 R-003 a R-005).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 016 | CA-001, CA-002, CA-003, CA-004; R-001 a R-004 (R-005 es de la web) | `TRIP_TAKEN` a La Capital lo disparará el motor de decisiones (bloque E); hoy solo lo emite el sistema si una actividad lleva allá |
| 004 | CA-004, CA-005; R-003, R-004, R-005 | `PLACE_VISITED` y `PLACE_CLOSED` (nivel ≥ 2, bloque E) |
| 033 | CA-006 (prueba en `generators/src/amenities/viajes.test.ts`) | — |

## 3. API pública
Desde `@datas-world/engine`:

| Símbolo | Descripción |
|---|---|
| `mobilitySystem` | Sistema de la fase `actions` (orden 0, capacidad `mobility`, cada tick): sale, viaja, llega y entra; emite `ARRIVED_LATE` y `TRIP_TAKEN` |
| `initMobility(world)`, `defineMobilityColumns(world)`, `MOBILITY_COLUMNS`, `MODES`, `modeCode`, tipo `Mode` | Columnas y estado inicial (todos en su vivienda); lo llama `generateWorld` |
| `planTrip(view, row, from, to, now, rng \| null, P)`, tipo `TripPlan` | Viaje entre dos lugares: modo, minutos, coste, paradero; con `rng = null`, la estimación sin ruido y sin mirar el dinero |
| `travelMinutes`, `busWait`, `vehiclesOf` | Tiempo por distancia y velocidad con ruido; espera del bus; vehículos de la persona y de su hogar |
| `enterRefusal(view, row, place, at, occupancy)`, `isOpen`, `worksAt`, `occupancy` | Entrada a un lugar: `'cerrado'`, `'lleno'` o `null` (004 R-004, R-005) |
| `placeFor(view, row, activity)`, `workplaceOf`, `schoolOf`, `homeOf` | Dónde se hace cada actividad de la rutina |
| `networkOf`, `metersBetween`, `firstOfKind`, `travelTo` | Red derivada: metros por calle entre puertas, lugares por tipo, viajes fuera del mapa |
| `mobilityParams(profile, date)`, tipo `MobilityParams` | Parámetros del perfil (`mobility.*`), memorizados |

## 4. Diseño interno y decisiones
- **Columnas:** `loc.place` (número del lugar; 0 = en tránsito), `trip.from`, `trip.to`, `trip.departAt`, `trip.arriveAt` (i32) y `trip.mode` (u8). Son 21 B por persona, algo más que los ≈ 12 B de la spec, porque se guardan el origen y la salida para el visor y para las causas.
- **Red (`network.ts`):** matriz de pasos por calle entre las puertas distintas (`doorDistanceMatrix`, 003), calculada una vez por mundo y memorizada por el mapa de lugares. Las viviendas comparten la puerta de su edificio. Los lugares con `travel` (033), o hijos de un municipio con `travel`, están fuera del mapa.
- **Dónde (`where.ts`):**
  - en casa: dormir, asearse, oficios, cuidado, enfermedad, tiempo libre (hasta el bloque E);
  - trabajo formal: el primer lugar de la organización; informal: la plaza; independiente: la casa;
  - colegio: la sede primaria hasta los 10 años;
  - búsqueda de empleo: la alcaldía; diligencias: el corresponsal bancario;
  - comer: donde esté.
- **Modo (R-002):**
  - dentro del pueblo, a pie; en bicicleta desde 400 m si la tiene; en carro solo si tiene dificultad para caminar y carro en el hogar (y camina a la mitad de velocidad si no tiene carro);
  - a La Capital, en carro o moto del hogar si es adulto y alcanza el combustible; si no, en bus desde el paradero, con espera hasta la próxima salida y el pasaje de `travel.cost`;
  - sin paradero o sin dinero, no hay viaje.
- **Decisión en curso (017):** mientras `now < act.until`, el destino es `act.place` (si lo hay) y no se mira adelante antes de que termine; si el lugar elegido está cerrado o lleno, se deja la decisión (`act.until = now`) para que se elija otra cosa.
- **Salida a tiempo (R-004):** si la actividad de ahora se hace aquí, se mira hasta 30 min adelante la siguiente que se hace en otro lugar. Se sale cuando la estimación sin ruido del viaje de la persona, más el 10 % y 5 min de margen, alcanza ese momento. Quien duerme o está enfermo en casa no sale.
- **Llegada:** se entra si el lugar está abierto y cabe; si no, se vuelve a casa (el motor de decisiones reprogramará, 017). Quien trabaja ahí con turno siempre entra.
- **Llegar tarde (R-004):** si llega a su turno o al colegio después de la hora de inicio, `ARRIVED_LATE` con la duración del viaje como causa y, si hoy se quedó dormido, el evento `OVERSLEPT` (que la rutina anota en `routine.oversleptEvt` con `recordAs`, 021).
- **Coste:** el pasaje y el combustible salen de `money` (015).

## 5. Invariantes y guardarraíles
016 INV-001 (`arriveAt ≥ departAt`; en tránsito, `loc.place = 0`), INV-002 (sin vehículo no hay modo) e INV-003 (solo parches). Se comprueban en `mobility.test.ts` y `viajes.test.ts`.

## 6. Cómo se prueba
`mobility.test.ts`: un pueblo lineal de 2 km construido a mano, con paradero, tienda, café, oficina y La Capital.

| Criterio | Prueba |
|---|---|
| 016 CA-001 | 2 km a pie: 20–30 min en 200 semillas y en el mapa |
| 016 CA-002 | Se queda dormido hasta las 7:55 con turno a las 8:00 y 20 min de viaje: `ARRIVED_LATE` con `OVERSLEPT` como causa |
| 016 CA-003 | Ida y vuelta al cine en bus: pasa por el paradero, ≥ 120 min, $24 000; sin dinero no hay viaje |
| 016 CA-004 | Sin moto ni carro, nunca en moto ni en carro; con ellos, sí |
| 004 CA-004, CA-005, R-005 | Tienda cerrada a las 21:00; café lleno; el empleado entra antes de abrir |
| INV-001 y determinismo | Una semana: van y vuelven; en tránsito sin lugar; mismo hash con la vista congelada |

En `generators`: el paradero de la plaza, 033 CA-006 y una semana del mundo generado (≥ 80 % de los empleados en su trabajo a las 10:00 de un día hábil; nadie en moto o carro sin tenerlos).

## 7. Paridad con el prototipo
El prototipo mueve a las personas tile a tile por la calle; aquí el viaje es un intervalo (salida y llegada) y el visor interpola (016 R-005). La velocidad a pie y la llegada tarde se miden en el bloque H.

## 8. Pendientes y deuda
- [ ] Los lugares del tiempo libre, las compras y las comidas fuera los elige el motor de decisiones (bloque E).
- [ ] `PLACE_VISITED` (nivel ≥ 2) y `PLACE_CLOSED`.
- [ ] `vehiclesOf` recorre todos los objetos; basta hoy (se llama al salir), pero conviene un índice por hogar si crecen los objetos.
- [ ] Mototaxi (016 §10, peldaño 4).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-25 | m2/d-movilidad | — | Documento creado desde la plantilla (sin código) |
| 2026-09-25 | m2/d-movilidad (D2–D4) | 016, 004, 005, 021, 033 | `columns.ts`, `params.ts`, `network.ts`, `where.ts`, `enter.ts`, `trip.ts`, `system.ts` e `index.ts`. 8 pruebas |
| 2026-09-25 | m2/e-decisiones | 016, 017 | La movilidad lleva al lugar de la decisión en curso (`act.place` hasta `act.until`) y la cancela si el lugar está cerrado o lleno. `planTrip` con `rng = null` no mira el dinero (la estimación de una opción que después valida el motor de decisiones) |
| 2026-09-25 | m2/f-economia | 015, 016 | Pasajes y combustible son transferencias al resto del país (015 R-006); en mundos sin cuentas del sistema, se descuentan como antes |
