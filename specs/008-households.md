---
id: 008
nombre: households
estado: borrador
hito: M1
depende_de: [007, 004, 015]
version: 0.1
---

# 008 — Hogares

## 1. Propósito
Unidad familiar y económica: quién vive con quién, parentesco, economía compartida, tareas domésticas y tensiones.

## 2. Alcance
**Incluye:** composición, parentesco, presupuesto del hogar, reglas de convivencia.
**Fuera de alcance:** relaciones afectivas detalladas (012).

## 3. Modelo de datos
```ts
interface Household {
  id: EntityId;              // HOU-0014
  homeId: EntityId; memberIds: EntityId[];
  kinship: { a: EntityId; b: EntityId; kind: 'parent'|'child'|'partner'|'sibling'|'grandparent'|'other' }[];
  sharedMoney: number; monthlyRent: number;
  headId: EntityId;
  climate: number;           // [0,1] armonía percibida media
}
type HouseholdTemplate = 'single'|'couple'|'couple_kids'|'single_parent'|'extended'|'roommates';
```

## 4. Reglas
- **R-001** — Plantillas de hogar con probabilidades por estrato.
- **R-002** — Los ingresos se aportan al fondo común según regla del hogar; los gastos fijos salen del fondo.
- **R-003** — El clima del hogar baja con discusiones y estrés de sus miembros y afecta el ánimo de todos.
- **R-004** — Mudanzas (separación, independencia) crean o disuelven hogares con eventos.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `HOUSEHOLD_FORMED` | nuevo hogar | miembros | pareja, independencia |
| `MOVED_OUT` | sale del hogar | de, a | ruptura, trabajo |
| `RENT_LATE` | arriendo atrasado | monto | falta de dinero |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* un hogar sin ingresos 2 meses, *entonces* aparece RENT_LATE y sube el estrés de los adultos.
- **CA-002** — *Dado* una pareja que rompe, *entonces* uno de los dos cambia de hogar en ≤ 60 días.
- **CA-003** — *Dado* la generación, *entonces* todo ciudadano pertenece a un solo hogar.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto |
|---|---|
| plantillas | ver tabla por estrato |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] ¿Modelar abuelos cuidadores y remesas?

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
