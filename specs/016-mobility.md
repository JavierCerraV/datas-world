---
id: 016
nombre: mobility
estado: aprobada
hito: M2
depende_de: [003, 004, 005, 015, 021, 033]
version: 0.2
---

# 016 — Movilidad

## 1. Propósito
Cómo van las personas de un sitio a otro: a pie, en bicicleta, en moto, en carro o en bus intermunicipal. Cada modo tiene su tiempo y su coste, y la movilidad afecta la puntualidad (006), el cansancio (010), el gasto (015) y los encuentros (012).

**Escala real.** El pueblo de M1 mide ≈ 640 × 400 m, así que dentro de él todo está a menos de 10 minutos a pie. La movilidad importa sobre todo para ir a la ciudad de referencia (033: 1 hora en bus, $12 000 por trayecto) y para llegar tarde.

## 2. Alcance
**Incluye:** modos, tiempos, coste por viaje, paradero intermunicipal, viajes a La Capital, y posición de las personas para el visor.
**Fuera de alcance:** tráfico microscópico y accidentes (peldaño 4).

## 3. Modelo de datos
```ts
type Mode = 'walk' | 'bike' | 'moto' | 'car' | 'bus';
interface Trip {
  citizenId: EntityId; from: EntityId; to: EntityId; mode: Mode;
  departAt: WorldMinute; arriveAt: WorldMinute;   // en tránsito entre ambos (004 R-003)
}
```
El viaje en curso va en columnas (`trip.to`, `trip.arriveAt`, `trip.mode`). El visor interpola la posición (R-005). Coste: ≈ 12 B por persona.

**Paradero:** un lugar `transporte.paradero` en la plaza de Data's World (plantilla `datas-world-v1`, 003). Pasa a M1 en el catálogo `place_kinds`.

## 4. Reglas
- **R-001 (tiempo)** — Tiempo del viaje = distancia por calle entre puertas (003 R-002) / velocidad del modo, más espera y ruido del flujo `sys:mobility/<id>`. El bus a La Capital tarda `amenity.travel.minutes` (033), más la espera en el paradero (salidas cada `BUS_HEADWAY` minutos).
- **R-002 (modo)** — Depende de los objetos de la persona (005: bicicleta, moto o carro del hogar), del dinero, de la distancia y de la salud (031: discapacidad para caminar). Dentro del pueblo, casi siempre a pie. A La Capital, en bus o en moto o carro propio.
- **R-003 (coste)** — El bus intermunicipal cuesta `amenity.travel.cost` por trayecto. La moto y el carro, un coste por km de combustible. Todo sale del saldo (015).
- **R-004 (retrasos)** — Salir tarde (`OVERSLEPT`, 010) o un viaje más largo de lo esperado producen `ARRIVED_LATE`, que el trabajo registra (006).
- **R-005 (visor)** — La posición interpolada se calcula en la web a partir de `Trip`, nunca en el motor (CLAUDE.md §8).

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `ARRIVED_LATE` | llega tarde a un bloque obligatorio | citizenId, minutos | `OVERSLEPT`, viaje largo, espera del bus |
| `TRIP_TAKEN` (nivel ≥ 2, solo viajes fuera del municipio) | viaje a La Capital | citizenId, destino, modo | actividad de esparcimiento, diligencia |

## 6. Invariantes
- **INV-001** — `arriveAt ≥ departAt`; una persona en tránsito no está en ningún lugar (004 R-003).
- **INV-002** — Nadie usa un modo que no tiene: sin objeto moto, no hay viaje en moto.
- **INV-003** — Ningún cambio fuera de los parches del sistema (021) o de acciones validadas (017).

## 7. Criterios de aceptación
- **CA-001 (M2)** — *Dado* 2 km a pie, *entonces* el viaje dura 20–30 min (velocidad 4,5 km/h con ruido).
- **CA-002 (M2)** — *Dado* una salida con 5 min de margen y un viaje de 20 min, *entonces* `ARRIVED_LATE` tiene como causa el evento de salida tardía.
- **CA-003 (M2)** — *Dado* una persona que va a cine en La Capital en bus, *entonces* su viaje de ida y vuelta dura ≥ 2 × `amenity.travel.minutes` y le cuesta 2 × `amenity.travel.cost` (033 CA-006).
- **CA-004 (M2)** — *Dado* una persona sin moto ni carro en el hogar, *entonces* nunca viaja en moto ni en carro.

## 8. Parámetros y calibración
| Parámetro | Valor inicial | Fuente | Estado |
|---|---|---|---|
| velocidad a pie | 4,5 km/h | estándar | estimado |
| velocidad en bicicleta · moto · carro en el pueblo | 12 · 25 · 25 km/h | estimado | estimado |
| `BUS_HEADWAY` | 60 min (entre 5:00 y 20:00) | estimado: bus intermunicipal de un municipio pequeño | estimado |
| combustible | COP por km en moto y carro | estimado; verificar con el precio del galón (MinMinas) | por_confirmar |

## 9. Métricas
Viajes por modo y por destino, minutos de retraso por mes, gasto en transporte por estrato.

## 10. Preguntas abiertas
- [x] ¿Modos? → A pie, bicicleta, moto, carro y bus intermunicipal (usuario, 2026-09-25).
- [x] ¿Paradero? → En la plaza (usuario, 2026-09-25).
- [ ] ¿Mototaxi? Propuesta: como oficio informal (`trades_informal`) y modo de transporte pagado en el peldaño 4.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-25 | 0.2 | Revisión de M2 con las decisiones del usuario: modos a pie, bicicleta, moto, carro y bus intermunicipal; paradero en la plaza; viajes a La Capital (033) con tiempo y coste; el modo según los objetos, el dinero y la salud; CA-003 (viaje a La Capital) y CA-004 nuevos |
| 2026-09-25 | 0.2 | Estado → aprobada |
| 2026-09-25 | 0.2 | Implementación del bloque D de M2 (módulo `mobility` del motor). Precisiones: el viaje en curso ocupa 21 B por persona (se guardan también el origen y la salida); dónde se hace cada actividad de la rutina (casa, trabajo, colegio por edad, plaza para el trabajo informal, alcaldía para buscar empleo, corresponsal para diligencias); se sale a tiempo mirando 30 min adelante con la estimación sin ruido del viaje de la persona más 5 min de margen; en bicicleta desde 400 m; con dificultad para caminar, a media velocidad o en el carro del hogar; a La Capital en vehículo propio (80 % del tiempo del bus, 45 km de combustible) o en bus desde el paradero; sin pasaje no hay viaje. Los parámetros van en el perfil como `mobility.speeds`, `mobility.fuelPerKm` (por confirmar), `mobility.bus`, `mobility.intercity` y `mobility.habits`. `ARRIVED_LATE` cita el `OVERSLEPT` de hoy gracias a `recordAs` (021). La moto del hogar se añade al catálogo de objetos (005). Sin cambios en CA |
| 2026-09-25 | 0.2 | Bloque E de M2: la movilidad lleva al lugar elegido por el motor de decisiones mientras dura lo elegido y lo cancela si está cerrado o lleno; la estimación de un viaje (`planTrip` sin azar) no mira el dinero. Sin cambios en CA |
