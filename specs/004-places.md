---
id: 004
nombre: places
estado: aprobada
hito: M1 (generación) · M2 (ocupación y horarios)
depende_de: [003, 029]
version: 0.4
---

# 004 — Lugares

## 1. Propósito
Lugares con función social (viviendas, trabajos, colegio, hospital, comercios, ocio, iglesia, espacios públicos) donde ocurren los encuentros y las interacciones.

## 2. Alcance
**Incluye:** tipos de lugar, viviendas dentro de edificios, capacidad, horarios y atmósfera. La ocupación y las reglas de entrada se aplican desde M2.
**Fuera de alcance:** propiedad y precios (015); organizaciones (006), que referencian los lugares y no al revés.

**Decisión (v0.2):** hay **una iglesia** como lugar, con horario y capacidad, sin mecánicas religiosas propias por ahora.

## 3. Modelo de datos
**Tipos como catálogo (v0.3, ADR-006).** `kind` es una clave del catálogo `place_kinds`, no una unión fija. Entradas que usa M1, con su equivalente en el prototipo:

| Clave | Prototipo |
|---|---|
| `territorio.departamento`, `territorio.municipio`, `territorio.comuna`, `territorio.barrio` | barrios de `BARRIOS` |
| `vivienda.edificio`, `vivienda.unidad` | `casa` |
| `servicios.oficina` | `oficina` |
| `industria.fabrica` | `fabrica` |
| `educacion.colegio` | `colegio` |
| `salud.hospital` | `hospital` |
| `comercio.tienda_barrio` | `tienda` |
| `ocio.cafe`, `ocio.restaurante`, `ocio.gimnasio`, `espacio_publico.parque` | ídem |
| `religioso.iglesia` | — |

Entradas ya previstas en el catálogo, con el hito desde el que se pueden instanciar:
- **M2:** `comercio.supermercado`, `comercio.drogueria`, `comercio.panaderia`, `finanzas.cajero_automatico`, `finanzas.banco`, `industria.bodega`, `transporte.paradero`, `gobierno.alcaldia`, `gobierno.estacion_policia`, `salud.centro_salud`, `educacion.universidad`, `educacion.sena`, `ocio.bar`;
- **peldaño 4 o más:** `transporte.masivo.estacion_metro`, `transporte.masivo.estacion_brt`, `transporte.terminal`, `transporte.aeropuerto`.

En el resto de la spec, `residential` se refiere a `vivienda.edificio` y `dwelling` a `vivienda.unidad`.

```ts
type PlaceKind = string;           // clave válida de place_kinds (ADR-006)
interface Place {
  id: EntityId;                    // PLC-0040
  kind: PlaceKind; name: string;
  districtId: EntityId;            // el barrio (spec 003); en un 'district', él mismo
  parentId?: EntityId;             // 'dwelling' → su edificio 'residential'
  rect?: { x: number; y: number; w: number; h: number }; door?: { x: number; y: number }; // tiles
  capacity: number;                // personas a la vez (en 'dwelling': residentes máximos)
  openingHours: { days: 'all' | 'mon-fri' | 'mon-sat'; open: number; close: number } | '24h' | null;
                                   // minutos del día; null = privado (viviendas)
  ambience: { noise: number; crowding: number; comfort: number }; // [0,1]
}
```
- **Viviendas.** Un edificio `residential` (la "casa" del prototipo) contiene `UNITS_PER_BUILDING[estrato]` viviendas `dwelling`, que heredan la puerta del edificio. Así caben 200 personas en el mapa del prototipo sin cambiar la geografía.
- **Ocupación.** `occupants` es derivado por tick, no se persiste y no forma parte del hash. Llega con la movilidad (016) en M2.

Coste en memoria: ≈ 200 B por lugar; con ≈ 100 lugares, unos 20 KB.

## 4. Reglas
- **R-001 (M1)** — Los lugares se generan desde la plantilla `PLACE_LAYOUT`. En M1 es el `LAYOUT` del prototipo más una iglesia, que ocupa una de las casas de San Martín. Nombres, horarios y capacidades salen de `PDEF`.
- **R-007 (M1)** — Los horarios y los turnos del catálogo cumplen la jornada máxima vigente (`labor.maxWeeklyHours`, spec 029), con la hora de almuerzo excluida. Con el perfil "prototipo" se usan los turnos de `PDEF`.
- **R-002 (M1)** — Cada edificio `residential` crea sus viviendas `dwelling` en orden, con nombres "Vivienda 01-A", "01-B"…
- **R-003 (M2)** — Una persona está en un solo lugar a la vez o en tránsito (016).
- **R-004 (M2)** — Si la ocupación alcanza la capacidad, una nueva llegada se rechaza como acción inválida y se reprograma (017).
- **R-005 (M2)** — Un lugar cerrado no admite entradas, salvo empleados con turno (006).
- **R-006 (M3)** — La probabilidad de interacción entre dos presentes crece con la ocupación compartida y baja con `noise` (012).

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `PLACE_VISITED` (M2) | llegada relevante (nivel ≥ 2) | citizenId, placeId | rutina o decisión |
| `PLACE_CLOSED` (M2) | cierre excepcional | motivo | evento de organización |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados están en su rango y sin NaN.
- **INV-002** — Toda `dwelling` tiene un `parentId` de tipo `residential` del mismo barrio.

## 7. Criterios de aceptación
- **CA-001 (M1)** — *Dado* un mundo generado, *entonces* existe al menos un lugar de cada tipo esencial: vivienda, trabajo, colegio, hospital, tienda, parque e iglesia.
- **CA-002 (M1)** — *Dado* la plantilla del prototipo, *entonces* los tipos, nombres, horarios y rectángulos de los lugares no residenciales coinciden con `PDEF` y `LAYOUT`, salvo la iglesia añadida.
- **CA-003 (M1)** — *Dado* un mundo generado, *entonces* hay viviendas suficientes para `population.target` según las plantillas de hogar (008).
- **CA-006 (M1)** — *Dado* un mundo generado, *entonces* todo `kind` existe en el catálogo del mundo y su `desde` es ≤ M1.
- **CA-004 (M2)** — *Dado* una tienda con horario 9–20, *cuando* una persona intenta entrar a las 21:00, *entonces* la acción se rechaza.
- **CA-005 (M2)** — *Dado* un café con capacidad 3 y 3 ocupantes, *cuando* llega otra persona, *entonces* no entra.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto | Rango | Fuente / justificación |
|---|---|---|---|
| `PLACE_LAYOUT` | prototipo + iglesia | — | prototipo (`LAYOUT`, `PDEF`) |
| `UNITS_PER_BUILDING` | estrato 2 → 7 · 3 → 6 · 4 → 4 | 1–12 | provisional: edificios de apartamentos. Con la plantilla da 82 viviendas (6 edificios × 7 + 6 × 6 + 1 × 4), frente a ≈ 72 hogares para 200 personas (tamaño medio 2,8 en el prototipo) |
| iglesia | capacidad 60; `all`, 06:00–20:00 | — | provisional |

## 9. Métricas y observabilidad
Lugares por tipo y barrio, viviendas libres y ocupadas tras la generación, y, desde M2, la ocupación media por franja horaria.

## 10. Preguntas abiertas
- [x] ¿Lugares religiosos en el MVP? → Sí, una iglesia sin mecánicas propias (usuario, 2026-09-24).

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-24 | 0.2 | Revisión de M1 aprobada por el usuario: sin dependencia circular con 006 (`organizationId` sale del lugar, ahora lo guarda la organización); viviendas `dwelling` dentro de edificios `residential`; iglesia; `district` como tipo de lugar; plantilla del prototipo; reglas y criterios marcados por hito (generación en M1; ocupación, horarios y entrada en M2) |
| 2026-09-24 | 0.3 | Ajuste a Colombia y orden para crecer (usuario): `PlaceKind` pasa al catálogo `place_kinds` (ADR-006), con claves jerárquicas y las entradas futuras previstas (supermercado, cajero, banco, bodega, paradero, metro, BRT, terminal, aeropuerto…); turnos conformes a la jornada del perfil de país (R-007); CA-006 |
| 2026-09-24 | 0.3 | Estado → aprobada |
| 2026-09-24 | 0.4 | Implementación del bloque C: edificios "Edificio NN" con viviendas "Vivienda NN-A…"; capacidad de vivienda `DWELLING_CAPACITY` = 6; la iglesia ocupa la primera parcela de la tercera manzana de San Martín; la atmósfera (`ambience`) no se genera en M1 porque solo la usa la R-006 (M3); la capacidad de los lugares de uso llega con la R-004 (M2). Sin cambios en CA |
