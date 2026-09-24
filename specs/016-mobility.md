---
id: 016
nombre: mobility
estado: borrador
hito: M2
depende_de: [003, 004]
version: 0.1
---

# 016 — Movilidad

## 1. Propósito
Cómo se desplazan las personas entre lugares: tiempo, costo y medios; afecta puntualidad, encuentros y cansancio.

## 2. Alcance
**Incluye:** modos de transporte, tiempos de viaje, tránsito, posición para el visor.
**Fuera de alcance:** tráfico microscópico.

## 3. Modelo de datos
```ts
type Mode = 'walk'|'bus'|'bike'|'car'|'moto';
interface Trip { citizenId: EntityId; from: EntityId; to: EntityId; mode: Mode; departAt: WorldMinute; arriveAt: WorldMinute; }
```

## 4. Reglas
- **R-001** — Tiempo de viaje = distancia (003) / velocidad del modo + espera (bus) con ruido.
- **R-002** — El modo depende de propiedad (objetos), dinero y distancia.
- **R-003** — Salir tarde o viajes más largos de lo esperado producen retrasos (006).
- **R-004** — Para el visor, la posición interpolada se calcula en la web, no en el motor.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `ARRIVED_LATE` |  | minutos | overslept, viaje largo |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* distancia 2 km a pie, *entonces* el viaje dura 20–30 min.
- **CA-002** — *Dado* salida con 5 min de margen y viaje de 20 min, *entonces* ARRIVED_LATE tiene como causa el evento de salida tardía.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto |
|---|---|
| velocidad a pie | 4.5 km/h |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] Revisar parámetros con los resultados de la primera validación.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
