---
id: 003
nombre: geography
estado: borrador
hito: M1
depende_de: [001, 023]
version: 0.2
---

# 003 — Geografía

## 1. Propósito
Espacio físico del mundo: mapa de tiles, barrios con estrato, calles y distancias. Sostiene la movilidad (016), la desigualdad territorial y el visor (024).

## 2. Alcance
**Incluye:** mapa en rejilla, barrios, tipos de terreno, red de calles, distancias entre puertas.
**Fuera de alcance:** lugares concretos (004), transporte y desplazamiento (016).

**Decisión (v0.2):** la ciudad es **ficticia, con sabor colombiano**: Villa Cordillera, con estratos, nombres de barrios locales y una rejilla de manzanas. No copia el mapa de una ciudad real.

## 3. Modelo de datos
```ts
type TileKind = 'grass' | 'road' | 'building' | 'water' | 'park' | 'plaza';
interface GeoMap {
  width: number; height: number; tileMeters: number;  // 64 × 40, 8 m (prototipo)
  tiles: Uint8Array;                                  // índice y*width+x → TileKind (enum u8)
  districts: District[];                              // orden por id
}
interface District {
  id: EntityId;                     // PLC-xxxx (lugar de tipo 'district', spec 004)
  name: string;                     // "San Martín"
  stratum: 1 | 2 | 3 | 4 | 5 | 6;   // estrato socioeconómico colombiano
  bounds: { x: number; y: number; w: number; h: number };
  safety: number;                   // [0,1]
}
```
El mapa se guarda en `meta` como un blob (`tiles`, 2 560 B) más la lista de barrios. La matriz de distancias es derivada: se recalcula al cargar y no se persiste.

Coste en memoria: mapa ≈ 2,5 KB. Distancias entre N puertas: N² × 2 B (con ≈ 40 puertas, 3,2 KB).

## 4. Reglas
- **R-001** — El mapa se genera desde la plantilla `MAP_TEMPLATE` y el flujo `rng.fork('gen:geography')`. Misma semilla → mismo mapa. En M1 la plantilla reproduce el prototipo:
  - calles de 2 tiles en `x ∈ {5, 17, 29, 41, 53}` e `y ∈ {4, 14, 24, 34}`;
  - 3 filas de 4 manzanas;
  - un barrio por fila.
- **R-002** — La distancia entre dos lugares es la del camino más corto por las calles, entre sus puertas (BFS sobre tiles de calle). Se calcula una vez al cargar, para todos los pares de puertas.
- **R-003** — Cada lugar pertenece exactamente a un barrio. El estrato del barrio condiciona la composición de hogares (008), la educación y el ahorro iniciales (007), la contratación (006) y, desde M2, los precios (015).
- **R-004** — Barrios iniciales, de arriba abajo:
  - La Esperanza, estrato 3;
  - Centro, estrato 4;
  - San Martín, estrato 2.

  Corresponden a las clases 1, 2 y 0 del prototipo.

## 5. Eventos
No define tipos propios.

## 6. Invariantes
- **INV-001** — Todos los valores normalizados están en su rango y sin NaN.
- **INV-002** — El mapa no cambia después de generarse. Los cambios de terreno quedan fuera del alcance.

## 7. Criterios de aceptación
Cada criterio indica el hito en que se prueba.
- **CA-001 (M1)** — *Dado* la misma semilla, *entonces* el mapa, los barrios y el `stateHash` son idénticos.
- **CA-002 (M1)** — *Dado* dos lugares A y B, *entonces* `dist(A,B) = dist(B,A)` y es ≥ la distancia de Manhattan entre sus puertas.
- **CA-003 (M1)** — *Dado* un mundo generado, *entonces* toda puerta es alcanzable por calle desde cualquier otra.
- **CA-004 (M1)** — *Dado* un mundo generado con la plantilla del prototipo, *entonces* los tiles de calle y los rectángulos de las manzanas coinciden con `isRoad`, `COLS` y `ROWS` del prototipo.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto | Rango | Fuente / justificación |
|---|---|---|---|
| `tileMeters` | 8 | — | prototipo (`TS`) |
| `MAP_TEMPLATE` | `prototipo-64x40` | — | prototipo (`TW`, `TH`, `ROAD_X`, `ROAD_Y`) |
| barrios | 3 | 3–8 | prototipo (`BARRIOS`) |
| `safety` por estrato | 2 → 0,5 · 3 → 0,65 · 4 → 0,8 | [0,1] | provisional, sin efecto hasta M2 |

## 9. Métricas y observabilidad
Número de puertas, longitud media de las rutas y la ruta más larga. Alerta si alguna puerta queda aislada.

## 10. Preguntas abiertas
- [x] ¿Mapa inspirado en una ciudad colombiana real o totalmente ficticio? → Ficticio, con sabor colombiano (usuario, 2026-09-24).

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-24 | 0.2 | Revisión de M1 aprobada por el usuario: ciudad ficticia; estrato colombiano 1–6 (`stratum`) en lugar de 0–5; plantilla del prototipo (R-001, R-004, CA-004); distancias por BFS entre puertas, derivadas y no persistidas; criterios marcados por hito |
