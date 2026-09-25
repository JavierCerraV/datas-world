---
id: 005
nombre: objects
estado: aprobada
hito: M1 (objetos iniciales) · M2–M3 (transferencias, valor emocional, pérdidas)
depende_de: [001, 007, 008, 014, 023, 029]
version: 0.4
---

# 005 — Objetos con historia

## 1. Propósito
Objetos con dueño, valor económico, valor emocional e historia propia (regalos, herencias, pérdidas). La visión insiste en que los objetos cuentan la vida de las personas.

## 2. Alcance
**Incluye:** objetos significativos (no cada cuchara), propiedad personal o del hogar, transferencias, desgaste y valor emocional por persona.
**Fuera de alcance:** inventario fino de consumibles, que se modela como gasto (015).

**Decisión (v0.2):** un objeto puede ser de **una persona o de un hogar**, como la casa o el carro.

## 3. Modelo de datos
```ts
interface WorldObject extends BaseEntity {  // spec 001; status 'active' | 'inactive'
  id: EntityId;                     // OBJ-001842
  kind: string;                     // clave del catálogo object_kinds (ADR-006): 'tecnologia.telefono',
                                    // 'transporte.bicicleta', 'transporte.carro', 'recuerdo.herencia'…
  name: string;                     // "el anillo de su abuela"
  ownerId: EntityId;                // CIT-… o HOU-… (propiedad del hogar)
  marketValue: number;              // entero, moneda del mundo
  condition: number;                // [0,1]
  sentimental: Record<EntityId, number>; // valor emocional por persona [0,1]; claves ordenadas
  historyEventIds: EntityId[];      // eventos en que participó, en orden
  fate: 'owned' | 'lost' | 'destroyed' | 'sold' | 'given';
}
```
`status` (spec 001) indica si el objeto sigue en el mundo y `fate` qué fue de él. Nunca se borra (CA-005).

Coste en memoria: ≈ 250 B por objeto; con 1 a 4 objetos por persona, ≈ 1 KB por persona.

## 4. Reglas
- **R-001 (M1)** — Objetos iniciales con `rng.fork('gen:objects').fork(citizenId)`, como `genObjects` del prototipo:
  - teléfono: adultos con p = 0,9 y de 12 a 17 años con p = 0,6; 650 000;
  - bicicleta: de 10 a 59 años con p = 0,3; 480 000;
  - herencia (`heirloom`, "el anillo de su abuela"): 25 años o más con p = 0,08; 300 000; valor emocional 0,95.
- **R-002 (M1)** — Objetos del hogar: carro con probabilidad `CAR_P[estrato]` y dueño el hogar. Su valor emocional nace en 0 para cada miembro.
- **R-003 (M1)** — Cada objeto inicial tiene un evento de origen con fecha anterior al epoch (`OBJECT_ACQUIRED` u `OBJECT_INHERITED`) en `historyEventIds`.
- **R-008 (M1)** — Los precios salen del catálogo `object_kinds`, en pesos colombianos y marcados `estimado` hasta tener una fuente (spec 029 R-001).
- **R-004 (M1)** — Solo se crean objetos significativos: con valor emocional > `SENTIMENTAL_MIN` o valor de mercado ≥ `MARKET_MIN`.
- **R-005 (M2)** — Transferir un objeto (regalo, venta, herencia, robo) genera un evento y añade su id a `historyEventIds`.
- **R-006 (M3)** — El valor emocional nace de eventos (recibirlo de alguien querido, usarlo en momentos importantes) y decae despacio (013).
- **R-007 (M3)** — Perder un objeto con valor emocional alto produce una memoria negativa proporcional (013).

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `OBJECT_ACQUIRED` | compra; en la generación, con fecha anterior al epoch | objectId, ownerId, price | necesidad, deseo; `backstory` |
| `OBJECT_INHERITED` | herencia; en la generación, con fecha anterior al epoch | objectId, from?, to | muerte de un familiar; `backstory` |
| `OBJECT_GIFTED` (M2) | regalo | from, to, objectId, occasion | relación (012), fecha especial |
| `OBJECT_LOST` (M2) | pérdida | objectId | distracción, estrés |
| `OBJECT_SOLD` (M2) | venta | price | dificultad económica (015) |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados están en su rango y sin NaN.
- **INV-002** — `ownerId` existe y es un `CIT` o un `HOU`.

## 7. Criterios de aceptación
- **CA-001 (M1)** — *Dado* 20 mundos de 200 personas, *entonces* las proporciones agregadas de teléfono (adultos), bicicleta y herencia están a ±0,03 de R-001, y la de teléfono de 12 a 17 años a ±0,06 (hay pocos adolescentes); el carro del hogar por estrato está a ±0,08 de `CAR_P`.
- **CA-002 (M1)** — *Dado* un objeto inicial, *entonces* su `historyEventIds` empieza con un evento de origen con `at < 0`.
- **CA-003 (M1)** — *Dado* un carro de hogar, *entonces* su `ownerId` es el `HOU` y todos los miembros pueden verlo como suyo.
- **CA-004 (M2)** — *Dado* un reloj regalado por la madre, *entonces* `sentimental[hijo] ≥ 0,6` y su historia incluye `OBJECT_GIFTED`.
- **CA-005 (M2)** — *Dado* un objeto, *entonces* nunca desaparece de la base: solo cambian `status` y `fate`.
- **CA-006 (M3)** — *Dado* una persona con deuda alta, *cuando* vende un objeto con valor emocional alto, *entonces* se registra una memoria de valencia negativa.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto | Rango | Fuente / justificación |
|---|---|---|---|
| probabilidades y precios de R-001 | ver R-001 | — | prototipo (`genObjects`, `PRICE`) |
| `CAR_P` | estrato 2 → 0,05 · 3 → 0,2 · 4 → 0,45 | 0–1 | provisional. En el perfil de paridad vale 0 |
| `SENTIMENTAL_MIN` | 0,3 | 0–1 | borrador 0.1 |
| `MARKET_MIN` | 300 000 | — | provisional |

## 9. Métricas y observabilidad
Objetos por persona y hogar, por tipo y estrato; valor emocional medio. Alerta si hay objetos sin evento de origen.

## 10. Preguntas abiertas
- [x] ¿Objetos compartidos por el hogar (casa, carro) con varios dueños? → Sí, con dueño `HOU` (usuario, 2026-09-24).

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-24 | 0.2 | Revisión de M1 aprobada por el usuario: propiedad personal o del hogar; `fate` separado de `status` (001); objetos iniciales portados de `genObjects`; eventos de origen con fecha anterior al epoch; dependencias con 007 y 008 (se generan después de la población); criterios marcados por hito |
| 2026-09-24 | 0.3 | Orden para crecer (usuario): `kind` pasa al catálogo `object_kinds` (ADR-006); precios en el catálogo, en pesos y marcados `estimado` (R-008) |
| 2026-09-24 | 0.3 | Estado → aprobada |
| 2026-09-24 | 0.4 | Implementación del bloque G, con la revisión de CA aprobada por el usuario (agregado de 20 mundos). Precisiones: las reglas por edad y el rango de estado (`condition`) de cada tipo están en el catálogo `object_kinds` (2026.09.2); una compra ocurre en los últimos 5 años (desde los 10 de edad) y una herencia en algún momento de la vida adulta; el carro lo registra la cabeza del hogar |
| 2026-09-25 | 0.4 | Bloque D de M2 (016 R-002): la moto del hogar (`transporte.moto`, $7 500 000, estimado) entra en `object_kinds` 2026.09.3, con probabilidad por estrato `gen.objects.motoP` del perfil (0,4 · 0,35 · 0,25, por confirmar con la ECV). Los vehículos del hogar indican su tabla con `pKey`. Sin cambios en CA |
