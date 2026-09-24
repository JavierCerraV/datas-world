---
id: 008
nombre: households
estado: aprobada
hito: M1 (plantillas y composición) · M2–M3 (economía del hogar, clima, mudanzas)
depende_de: [001, 004, 023, 029]
version: 0.3
---

# 008 — Hogares

## 1. Propósito
Unidad familiar y económica: quién vive con quién, parentesco, economía compartida, tareas domésticas y tensiones.

## 2. Alcance
**Incluye:** plantillas de hogar, composición, parentesco estructural y vivienda. Desde M2–M3: presupuesto común, clima y mudanzas.
**Fuera de alcance:**
- el afecto, la confianza y el conflicto entre familiares (012, M3). Aquí solo se dice quién es madre, hijo o abuela;
- los precios y el arriendo (015, M2).

**Decisión (v0.2):** los **abuelos cuidadores** existen desde la generación, en la plantilla de hogar extendido. Las **remesas** se posponen a la economía (015).

## 3. Modelo de datos
```ts
type HouseholdTemplate = 'single' | 'couple' | 'couple_kids' | 'single_parent' | 'extended' | 'roommates';
interface Household {
  id: EntityId;                     // HOU-0014
  template: HouseholdTemplate;
  dwellingId: EntityId;             // vivienda 'dwelling' (spec 004)
  memberIds: EntityId[];            // orden de creación
  headId: EntityId;                 // adulto de referencia
  kinship: { from: EntityId; to: EntityId; kind: 'parent' | 'partner' | 'sibling' | 'grandparent' }[];
                                    // dirigido, "from es <kind> de to"; los inversos se derivan
  caregiverIds: EntityId[];         // adultos que cuidan a los menores (abuelos incluidos)
}
```
Columnas: `household.idx` (`i32`, número del `HOU`) para búsquedas rápidas por persona.

Los campos `sharedMoney`, `monthlyRent` y `climate` del borrador 0.1 pasan a M2–M3, con 015 y 012.

Coste en memoria: ≈ 120 B por hogar más 24 B por vínculo.

## 4. Reglas
- **R-001 (M1)** — Los hogares se generan con `rng.fork('gen:households')` hasta llegar a `population.target`. La plantilla se elige con `TEMPLATE_WEIGHTS[estrato]`, las edades con `TEMPLATE_AGES` y la vivienda es la siguiente libre del estrato elegido. Por defecto las plantillas reproducen `genPopulation` del prototipo:
  - `single`: una persona de 21 a 74 años;
  - `couple`: pareja de 23 a 70 años, con edades separadas ±5;
  - `couple_kids`: pareja de 28 a 50 años con 1 a 3 hijos;
  - `single_parent`: un adulto de 25 a 50 años (mujer con p = 0,7) con 1 o 2 hijos;
  - `roommates`: de 2 a 3 adultos de 18 a 40 años sin parentesco (hogar "no familiar" del DANE);
  - `extended`: abuelo o abuela de 64 a 84 años (mujer con p = 0,6), un hijo o hija adulto y un nieto o nieta.
- **R-002 (M1)** — Apellidos al estilo colombiano: los hijos llevan el primer apellido del padre y el primero de la madre. En el hogar extendido, el nieto lleva el primero del adulto.
- **R-003 (M1)** — En los hogares extendidos con menores, el abuelo o abuela figura en `caregiverIds` junto al adulto (abuelos cuidadores).
- **R-004 (M1)** — El número de personas no supera `capacity` de su vivienda. La generación se detiene al llegar a `population.target`: un hogar incompleto no se crea.
- **R-005 (M2)** — Los ingresos se aportan al fondo común según la regla del hogar, y los gastos fijos salen de él (015).
- **R-006 (M3)** — El clima del hogar baja con las discusiones y el estrés de sus miembros, y afecta el ánimo de todos (010, 012).
- **R-007 (M3)** — Las mudanzas (separación, independencia) crean o disuelven hogares, con eventos.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `HOUSEHOLD_FORMED` | nuevo hogar; en la generación, con fecha anterior al epoch | householdId, template, miembros | pareja, independencia; `backstory` |
| `MOVED_OUT` (M3) | sale del hogar | de, a | ruptura, trabajo |
| `RENT_LATE` (M2) | arriendo atrasado | monto | falta de dinero |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados están en su rango y sin NaN.
- **INV-002** — Todo ciudadano activo pertenece exactamente a un hogar, y todo hogar tiene al menos un adulto.
- **INV-003** — El parentesco es coherente: un padre o madre es al menos 15 años mayor que su hijo, y un abuelo o abuela, al menos 30 años mayor que su nieto.

## 7. Criterios de aceptación
- **CA-001 (M1)** — *Dado* la generación, *entonces* se cumplen INV-002 e INV-003.
- **CA-002 (M1)** — *Dado* 200 personas generadas, *entonces* la proporción de plantillas está dentro de ±0,08 de `TEMPLATE_WEIGHTS`.
- **CA-006 (M1)** — *Dado* 200 personas con el perfil colombiano, *entonces* el tamaño medio del hogar está en `household.meanSize ± 0,25` (2,82, DANE ECV 2025) y las tipologías DANE (unipersonal, biparental, monoparental, otros) están dentro de ±0,08 del perfil.
- **CA-003 (M1)** — *Dado* un hogar extendido con menores, *entonces* el abuelo o abuela aparece en `caregiverIds`.
- **CA-004 (M2)** — *Dado* un hogar sin ingresos durante 2 meses, *entonces* aparece `RENT_LATE` y sube el estrés de los adultos.
- **CA-005 (M3)** — *Dado* una pareja que se separa, *entonces* uno de los dos cambia de hogar en ≤ 60 días.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto | Rango | Fuente / justificación |
|---|---|---|---|
| `TEMPLATE_WEIGHTS` (perfil colombiano) | single 0,202 · couple 0,14 · couple_kids 0,31 · extended 0,10 (biparental o monoparental con abuelos) · single_parent 0,205 · roommates 0,043 | 0–1 | DANE, ECV 2024–2025 (spec 029): unipersonal 0,202; biparental 0,516 ≈ couple + couple_kids + 2/3 de extended; monoparental 0,243 ≈ single_parent + 1/3 de extended; otros 0,043 = roommates. El reparto entre pareja sin hijos, con hijos y extendido es `estimado` |
| `TEMPLATE_WEIGHTS` (perfil "prototipo") | single 0,18 · couple 0,20 · couple_kids 0,40 · single_parent 0,12 · extended 0,10 · roommates 0 | 0–1 | prototipo (`genPopulation`) |
| `TEMPLATE_AGES` | ver R-001 | — | prototipo |
| pareja del mismo sexo | 0,1 | 0–1 | prototipo |

## 9. Métricas y observabilidad
Distribución de plantillas y tamaño medio del hogar (≈ 2,8 en el prototipo); menores por hogar; hogares por estrato. Alerta si hay viviendas insuficientes.

## 10. Preguntas abiertas
- [x] ¿Modelar abuelos cuidadores y remesas? → Abuelos cuidadores sí, desde la generación; remesas después, con la economía (usuario, 2026-09-24).
- [ ] Pesos de las plantillas por estrato a partir de datos reales.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-24 | 0.2 | Revisión de M1 aprobada por el usuario: sin dependencias con 007 ni con 015 (el dinero y el arriendo pasan a M2); plantillas y edades portadas de `genPopulation`; apellidos colombianos; abuelos cuidadores (`caregiverIds`); parentesco dirigido y estructural (el afecto va en 012); vivienda `dwelling` (004); criterios marcados por hito |
| 2026-09-24 | 0.3 | Ajuste a Colombia (usuario): pesos de plantilla del perfil colombiano según las tipologías de hogar del DANE (ECV 2024–2025), con la plantilla `roommates` como hogar no familiar; el perfil "prototipo" conserva los pesos anteriores; CA-006 con tamaño medio de 2,82 |
| 2026-09-24 | 0.3 | Estado → aprobada |
