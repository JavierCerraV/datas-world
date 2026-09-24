---
id: 003
nombre: geography
estado: borrador
hito: M1
depende_de: [001]
version: 0.1
---

# 003 — Geografía

## 1. Propósito
Espacio físico del mundo: mapa de tiles, barrios con nivel socioeconómico, calles y distancias. Sostiene movilidad (016), desigualdad territorial y el visor (024).

## 2. Alcance
**Incluye:** mapa en rejilla, barrios, tipos de terreno, red de calles, cálculo de distancias/tiempos.
**Fuera de alcance:** lugares concretos (004), transporte (016).

## 3. Modelo de datos
```ts
type TileKind = 'grass'|'road'|'building'|'water'|'park'|'plaza';
interface GeoMap { width: number; height: number; tileMeters: number; tiles: Uint8Array; } // índice y*width+x
interface District {
  id: EntityId;             // PLC-xxxx de tipo distrito
  name: string;             // "La Esperanza"
  socioeconomicLevel: 0|1|2|3|4|5; // estrato
  bounds: { x: number; y: number; w: number; h: number };
  safety: number;           // [0,1]
}
```

## 4. Reglas
- **R-001** — El mapa se genera a partir de la semilla con plantillas de barrio; mismo seed → mismo mapa.
- **R-002** — Distancia entre lugares = camino más corto sobre la red de calles (A* o BFS precalculado); se cachea en una matriz lugar×lugar.
- **R-003** — Cada vivienda pertenece exactamente a un barrio; el estrato del barrio condiciona precios de vivienda (015) y composición de hogares (008).
- **R-004** — MVP: un mapa de 64×40 tiles de 8 m (como el prototipo), ampliable.

## 5. Eventos
No define tipos propios (usa los de otras specs).

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* la misma semilla, *entonces* el mapa y los barrios son idénticos.
- **CA-002** — *Dado* dos lugares, *entonces* la distancia A→B = B→A y es ≥ distancia euclídea.
- **CA-003** — *Dado* un mundo generado, *entonces* todo edificio es alcanzable por calle desde cualquier otro.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto |
|---|---|
| tileMeters | 8 |
| districts | 3 (MVP) |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] ¿Mapa inspirado en una ciudad colombiana real o totalmente ficticio?

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
