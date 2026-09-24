---
id: 015
nombre: economy
estado: borrador
hito: M2
depende_de: [006, 008, 007]
version: 0.1
---

# 015 — Economía

## 1. Propósito
Dinero, ingresos, gastos, deudas y precios con presión real sobre la vida: la escasez genera estrés, conflictos y decisiones difíciles.

## 2. Alcance
**Incluye:** salarios, gastos fijos y variables, deudas, precios por estrato, ahorro, venta de objetos.
**Fuera de alcance:** mercados financieros, inflación compleja.

## 3. Modelo de datos
```ts
interface Ledger { citizenId: EntityId; balance: number; debts: Debt[]; monthlyFixed: number; }
interface Debt { id: string; creditor: EntityId|'bank'|'informal'; principal: number; rate: number; dueDay: number; }
interface Transaction { at: WorldMinute; from: EntityId; to: EntityId; amount: number; reason: string; }
```

## 4. Reglas
- **R-001** — Todos los montos son enteros en la unidad mínima (COP). Nunca float.
- **R-002** — Salario mensual o quincenal por scheduler; gastos fijos del hogar (arriendo, servicios) mensuales; gastos diarios por acciones (comer fuera, transporte).
- **R-003** — Si el saldo no cubre un gasto obligatorio: usar ahorro del hogar → pedir prestado (red social o gota a gota informal) → impago con evento.
- **R-004** — Deuda > umbral con histéresis (prototipo: > 200 000) aumenta estrés y probabilidad de conflicto en el hogar.
- **R-005** — Conservación: la suma total de dinero solo cambia por fuentes/sumideros explícitos (salarios de organizaciones con ingresos, gastos a comercios).

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `SALARY_PAID` |  | monto |  |
| `DEBT_TAKEN` |  | acreedor, monto | déficit |
| `PAYMENT_MISSED` |  | concepto | saldo insuficiente |

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4).

## 7. Criterios de aceptación
- **CA-001** — *Dado* 1 año de simulación, *entonces* la suma de dinero cuadra con fuentes y sumideros (error 0).
- **CA-002** — *Dado* una persona que pierde el empleo, *entonces* en ≤ 3 meses su saldo baja y aparece DEBT_TAKEN o recorte de gastos.
- **CA-003** — *Dado* estratos distintos, *entonces* la mediana de saldo difiere en el sentido esperado.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto |
|---|---|
| costo diario por estrato | 35 000 / 55 000 / 85 000 COP (prototipo) |

## 9. Métricas
Distribuciones de los valores que introduce esta spec en la prueba de 100 personas × 1 año; alertas de degeneración (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite).

## 10. Preguntas abiertas
- [ ] ¿Incluir "gota a gota" (préstamo informal) como fuente de riesgo?

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
