---
modulo: economy
ruta: packages/engine/src/economy
estado: en-desarrollo
specs: [015, 008, 006, 010, 021, 029, 031]
actualizado: 2026-09-25
---

# Módulo: economy

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Economía de la vida diaria (spec 015): ingresos, gastos del hogar, ahorro, deudas e impagos, con conservación exacta del dinero: todo movimiento es una transferencia entre dos cuentas.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 015 | CA-001, CA-002, CA-003 (en `generators/src/economy`), CA-004, CA-005; R-001 a R-007 (R-004 sin la red social, que llega en M3) | CA-006 (distribución frente al prototipo: bloque H2) |
| 008 | CA-004 (`RENT_LATE` y estrés) | — |

## 3. API pública
Desde `@datas-world/engine`:

| Símbolo | Descripción |
|---|---|
| `economySystem` | Sistema de la fase `economy`, cadencia `day`, capacidad `economy`, nivel ≥ 0. Sin `economy.*` en el perfil o sin cuentas del sistema, no hace nada |
| `totalMoney(view)` | Suma de todos los saldos: personas, hogares, organizaciones y resto del país (CA-001) |
| `quincena`, `utilityBill`, `foodDaily`, `copay`, `loanTerms` (y `otherDaily`, interna) | Reglas de dinero puras, en pesos enteros |
| `formalWorkers`, `monthlyWage` | Trabajadores formales y sueldo mensual de un puesto |
| `economyParams(profile, date)`, tipo `EconomyParams` | Parámetros del perfil (`economy.*`, `labor.*`, `stratum.utilitySubsidy`), memorizados; `null` sin economía |
| `ECONOMY_COLUMNS`, `defineEconomyColumns` | `econ.debt` (i32), `econ.debtPressure` (u8), `econ.consulted` (u8) |
| `balanceOf(world, account)` (en `simulation/patches.ts`) | Saldo de una cuenta |

## 4. Diseño interno y decisiones
- **Cuentas y conservación (R-006):**
  - las cuentas son de persona (`money`), de hogar (`Household.savings`), de organización (`Organization.cash`) y del resto del país (`World.accounts.restOfCountry`);
  - el único movimiento es el parche `transfer` (021), así que la suma se conserva por construcción;
  - la movilidad (pasajes, combustible) y el esparcimiento (a la organización del lugar) también transfieren.
- **Libro del día** (`ledger.ts`): lleva los saldos durante la corrida para que los pagos seguidos vean el saldo actualizado, y emite los parches.
- **Orden del día** (medianoche):
  1. ingresos de las organizaciones (las públicas, su nómina desde el resto del país; las privadas, demanda externa = nómina/30 × U(0,8, 1,3)), con un tope de caja de 3 meses de nómina: lo demás sale a proveedores y dueños;
  2. quincenas (días 15 y último), con descuentos de ley al resto del país;
  3. ingreso informal del día trabajado de ayer (lunes a sábado), con días malos;
  4. pensiones (último día);
  5. consulta al empezar una enfermedad aguda;
  6. gastos del hogar;
  7. cuotas de las deudas;
  8. presión por deuda.
- **Gastos del hogar (R-003):**
  - alimentación diaria a la tienda de barrio del distrito, con escala de equivalencia (menores de 12 años = 0,6);
  - otros gastos: 35 % del ingreso esperado del hogar;
  - arriendo o cuota de la vivienda (día 5), servicios con subsidio o contribución (día 15), medicamentos de las condiciones crónicas (día 1).
- **Déficit (R-004), en orden:**
  1. el saldo de los adultos del hogar (de más a menos);
  2. el ahorro del hogar;
  3. un préstamo al banco si tiene empleo formal (≤ 3 sueldos de deuda);
  4. el gota a gota (≤ $1 000 000 de deuda);
  5. el impago (`PAYMENT_MISSED`; si es el arriendo, `RENT_LATE`).

  La red social llega en M3.
- **Deudas:**
  - banco: cuota mensual de anualidad el día 10;
  - gota a gota: 20 % en un mes, cuota diaria;
  - las cuotas no piden préstamos nuevos;
  - un atraso emite evento la primera vez y cada 30 atrasos seguidos.
- **Presión (R-005):** con más de $200 000 de deuda entra `econ.debtPressure` (sale por debajo de $100 000). Las necesidades la suman como estresor (`needs.stress.debt`). El gota a gota da miedo y vergüenza (010 R-005).

## 5. Invariantes y guardarraíles
- INV-001: pesos enteros; un saldo de persona fuera de i32 se rechaza.
- INV-002: conservación exacta, por construcción y comprobada.
- INV-003: solo parches del sistema.

## 6. Cómo se prueba
`economy.test.ts` (8 pruebas, mundo hecho a mano):
- CA-004 (quincena exacta y mes cuadrado);
- CA-005 (servicios por estrato);
- condiciones de los préstamos;
- conservación en 60 días;
- orden del déficit (ahorro → banco → gota a gota);
- 008 CA-004;
- determinismo;
- mundo sin economía.

En `generators/src/economy/economy.test.ts`: estado inicial, CA-001 (un año y 30 días con toda la vida diaria), CA-003 y CA-002.

## 7. Paridad con el prototipo
Porta el `daily` del prototipo, sustituyendo el costo diario por estrato por los gastos de la 015. La paridad del dinero (015 CA-006) se mide en el bloque H.

**Hallazgo del bloque F:** 16 de los 72 hogares del mundo generado no tienen ningún ingreso (mayores sin pensión, desempleados solos). Viven en déficit crónico: comida sin pagar y gota a gota. Faltan las transferencias (Colombia Mayor, Renta Ciudadana; 015 §10) y la ayuda de la red familiar (M3). Decisión pendiente del usuario.

## 8. Pendientes y deuda
- [ ] Préstamos de la red social (R-004, paso 2) y amenazas por impago del gota a gota (M3).
- [ ] Transferencias públicas (015 §10), según decida el usuario.
- [ ] Despidos por caja negativa (006, bloque G).
- [ ] CA-006 frente a la línea base (bloque H).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-25 | m2/f-economia | — | Documento creado desde la plantilla (sin código) |
| 2026-09-25 | m2/f-economia (F1–F6) | 015, 008, 010, 021 | `params.ts`, `rules.ts`, `ledger.ts`, `income.ts`, `columns.ts`, `system.ts` e `index.ts`. 8 pruebas |
| 2026-09-29 | m3/causalidad (C2) | 019 | 019 R-005: `DEBT_TAKEN` y `PAYMENT_MISSED`/`RENT_LATE` citan, junto al déficit o el saldo insuficiente, el hecho que dejó sin dinero (despido, deuda o impago anterior; en un hogar, los de su jefe o jefa) |
