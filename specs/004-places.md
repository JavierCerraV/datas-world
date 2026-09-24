---
id: 004
nombre: places
estado: borrador
hito: M1
depende_de: [003, 006]
version: 0.1
---

# 004 — Lugares

## 1. Propósito
Lugares con función social: viviendas, trabajos, colegios, hospital, comercios, ocio, espacios públicos. Donde ocurren encuentros e interacciones.

## 2. Alcance
**Incluye:** tipos de lugar, capacidad, horarios, ocupación, atmósfera.
**Fuera de alcance:** propiedad y precios (015), organizaciones (006).

## 3. Modelo de datos
```ts
type PlaceKind = 'home'|'office'|'factory'|'school'|'hospital'|'shop'|'cafe'|'restaurant'|'gym'|'park'|'church'|'bar';
interface Place {
  id: EntityId;             // PLC-0040
  kind: PlaceKind; name: string; districtId: EntityId;
  tile: { x: number; y: number; w: number; h: number };
  capacity: number;
  openingHours: [number, number][] | '24h'; // por día de semana, minutos del día
  organizationId?: EntityId;
  ambience: { noise: number; crowding: number; comfort: number }; // [0,1]
  occupants: EntityId[];    // derivado por tick, no persistido
}
```

## 4. Reglas
- **R-001** — Una persona solo puede estar en un lugar a la vez o en tránsito (016).
- **R-002** — Si la ocupación supera la capacidad, las nuevas llegadas se rechazan o esperan (acción inválida → reprogramar).
- **R-003** — La probabilidad de interacción entre dos presentes crece con la ocupación compartida y baja con `noise` (012).
- **R-004** — Los lugares cerrados no admiten entradas salvo empleados con turno.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `PLACE_VISITED` | llegada relevante (nivel ≥2) | citizenId, placeId | rutina o decisión |
| `PLACE_CLOSED` | cierre excepcional | motivo | evento de organización |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* una tienda con horario 8–20, *cuando* una persona intenta entrar a las 21:00, *entonces* la acción se rechaza.
- **CA-002** — *Dado* un café con capacidad 10 y 10 ocupantes, *cuando* llega otra, *entonces* no entra.
- **CA-003** — *Dado* un mundo generado, *entonces* existe al menos un lugar de cada tipo esencial (home, work, school, hospital, shop).

## 8. Parámetros y calibración
| Parámetro | Valor por defecto |
|---|---|
| capacidad café | 10–20 |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] ¿Lugares religiosos en MVP?

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
