---
id: 005
nombre: objects
estado: borrador
hito: M1
depende_de: [001, 014]
version: 0.1
---

# 005 — Objetos con historia

## 1. Propósito
Objetos que tienen dueño, valor económico, valor emocional e historia propia (regalos, herencias, pérdidas). La visión insiste en que los objetos cuentan la vida de las personas.

## 2. Alcance
**Incluye:** objetos significativos (no cada cuchara), propiedad, transferencias, desgaste, valor emocional por persona.
**Fuera de alcance:** inventario fino de consumibles (se modela como gasto, 015).

## 3. Modelo de datos
```ts
interface WorldObject {
  id: EntityId;             // OBJ-001842
  kind: string;             // 'watch', 'bicycle', 'photo', 'guitar', 'phone'
  name: string;
  ownerId?: EntityId; locationId?: EntityId;
  marketValue: number;      // entero, moneda del mundo
  condition: number;        // [0,1]
  sentimental: Record<EntityId, number>; // valor emocional por persona [0,1]
  historyEventIds: EntityId[]; // eventos en que participó
  status: 'active'|'lost'|'destroyed'|'sold';
}
```

## 4. Reglas
- **R-001** — Solo se crean objetos "significativos": con valor emocional > umbral o valor económico alto.
- **R-002** — Transferir un objeto (regalo, venta, herencia, robo) genera un evento y añade la referencia a `historyEventIds`.
- **R-003** — El valor emocional nace de eventos: recibirlo de alguien querido, usarlo en momentos importantes; decae lentamente.
- **R-004** — Perder un objeto con valor emocional alto produce una memoria negativa (013) proporcional.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `OBJECT_GIFTED` | regalo | from,to,objectId,occasion | relación (012), fecha especial |
| `OBJECT_LOST` | pérdida | objectId | distracción, estrés |
| `OBJECT_SOLD` | venta | price | dificultad económica (015) |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* un reloj regalado por la madre, *entonces* `sentimental[hijo] ≥ 0.6` y su historia incluye OBJECT_GIFTED.
- **CA-002** — *Dado* una persona con deuda alta, *cuando* vende un objeto con valor emocional alto, *entonces* se registra memoria con valencia negativa.
- **CA-003** — *Dado* un objeto, *entonces* nunca desaparece de la base: solo cambia `status`.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto |
|---|---|
| umbral emocional | 0.3 |
| objetos iniciales por persona | 1–4 |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] ¿Objetos compartidos por el hogar (casa, carro) con varios dueños?

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
