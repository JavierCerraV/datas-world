---
id: 015
nombre: economy
estado: implementada
hito: M2
depende_de: [006, 007, 008, 021, 029, 031, 032, 033]
version: 0.2
---

# 015 — Economía

## 1. Propósito
Ingresos, gastos, ahorro y deudas, con presión real sobre la vida: la escasez genera estrés (010), conflictos (012) y decisiones difíciles (017). Sigue las reglas colombianas: quincena, descuentos de ley, auxilio de transporte, subsidios por estrato, cuotas moderadoras y el crédito informal "gota a gota".

## 2. Alcance
**Incluye:**
- sueldos formales, ingresos informales y pensiones;
- arriendo, servicios públicos, alimentación y transporte;
- gastos de salud y de esparcimiento;
- ahorro del hogar;
- deudas (red social, banco y gota a gota);
- el "resto del país" como fuente y sumidero.

**Fuera de alcance:** mercados financieros, inflación compleja, impuestos a la renta.

## 3. Modelo de datos
- **Saldos:** columna `money` (`i32`, COP) por persona, ya existe (007), y `household.savings` (`i32`) por hogar.
- **Vivienda:** `Household.tenure`: `'propia' | 'pagando' | 'arriendo' | 'usufructo'`; `Household.rent` (COP al mes) si arrienda.
- **Deudas:** `Debt { id; debtorId; creditor: EntityId | 'banco' | 'gota_a_gota'; principal: number; monthlyRate: number; startAt; dueDay }` en la entidad de la persona.
- **Cuentas del sistema:** `world.accounts: { restOfCountry: number; organizations: Record<EntityId, number> }`. El dinero que entra o sale del mundo pasa por `restOfCountry`.

Todo en enteros de COP (R-001). Coste: ≈ 16 B por persona, más ≈ 40 B por deuda.

## 4. Reglas
- **R-001** — Todos los montos son enteros en COP. Nunca `float`.
- **R-002 (ingresos):**
  - **empleo formal:** pago quincenal, los días 15 y 30. Se entrega el sueldo menos el 4 % de salud y el 4 % de pensión (Ley 100 de 1993), más el auxilio de transporte si gana hasta 2 salarios mínimos (029). Lo paga la organización;
  - **informal e independiente:** ingreso diario variable según el oficio (`trades_informal`), con días malos;
  - **pensión:** mensual, desde el resto del país (Colpensiones o fondo).
- **R-003 (gastos del hogar):**
  - **arriendo mensual:** si la vivienda es arrendada. La tenencia sale de la Encuesta de Calidad de Vida y el valor, del estrato;
  - **servicios públicos mensuales:** con subsidio en los estratos 1 a 3 y contribución en el 5 y el 6 (Ley 142 de 1994; `stratum.utilitySubsidy`, 029);
  - **alimentación diaria:** base de la línea de pobreza extrema del DANE, según el estrato;
  - **transporte:** por viaje (016);
  - **salud:** cuotas moderadoras por consulta según el régimen y el ingreso, y medicamentos de las condiciones crónicas (031);
  - **esparcimiento:** lo que gasta la persona en sus actividades (032).
- **R-004 (déficit):** si el saldo no cubre un gasto obligatorio, se recurre en este orden:
  1. el ahorro del hogar;
  2. un préstamo de la red social (M3, con relaciones);
  3. un préstamo bancario, si tiene empleo formal;
  4. el **gota a gota** (préstamo informal diario, con interés mensual `GOTA_RATE`);
  5. el impago, con evento.

  El gota a gota sube el miedo y el estrés (010), y su impago puede producir amenazas y conflicto (M3).
- **R-005 (presión):** una deuda por encima de un umbral, con histéresis (prototipo: saldo < −200 000), aumenta el estrés y la probabilidad de conflicto en el hogar.
- **R-006 (conservación):** la suma de todos los saldos (personas, hogares, organizaciones y resto del país) no cambia. Todo pago es una transferencia entre dos cuentas.
- **R-007 (organizaciones):** cobran por ventas y servicios (tiendas, restaurantes, bares…) y pagan sueldos. Si su caja no alcanza durante un tiempo, pueden despedir (006, M2).

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `SALARY_PAID` | quincena | citizenId, orgId, neto | turno cumplido, organización |
| `RENT_PAID` | mes | householdId, monto | tenencia en arriendo |
| `DEBT_TAKEN` | déficit | citizenId, acreedor, monto, tasa | gasto obligatorio sin saldo |
| `DEBT_REPAID` | pago final | citizenId, deuda | ingreso |
| `PAYMENT_MISSED` | impago | citizenId, concepto, monto | saldo insuficiente |

## 6. Invariantes
- **INV-001** — Los montos son enteros; los saldos, `i32` sin desbordamiento.
- **INV-002** — Conservación exacta (R-006) en cada tick.
- **INV-003** — Ningún cambio fuera de los parches del sistema (021) o de acciones validadas (017).

## 7. Criterios de aceptación
- **CA-001 (M2)** — *Dado* 1 año de simulación, *entonces* la suma de todos los saldos es la misma que al principio (error 0).
- **CA-002 (M2)** — *Dado* una persona que pierde el empleo, *entonces* en ≤ 3 meses su saldo baja y aparece `DEBT_TAKEN` o un recorte de gastos (esparcimiento).
- **CA-003 (M2)** — *Dado* estratos distintos, *entonces* la mediana del saldo de los adultos difiere en el sentido esperado.
- **CA-004 (M2)** — *Dado* un empleado formal que gana 1 salario mínimo, *entonces* cada quincena recibe (salario − 8 %)/2 + auxilio de transporte/2, exacto en pesos.
- **CA-005 (M2)** — *Dado* un hogar de estrato 2 y otro de estrato 5 con el mismo consumo, *entonces* el de estrato 2 paga menos por servicios públicos y el de estrato 5 más, según los porcentajes del perfil.
- **CA-006 (M2)** — *Dado* 100 personas × 1 año, *entonces* la distribución del dinero de los adultos cae dentro de la tolerancia del prototipo (línea base: `moneyAdults` p10, p50, p90), o la diferencia se justifica aquí.

## 8. Parámetros y calibración
| Parámetro | Valor inicial | Fuente | Estado |
|---|---|---|---|
| tenencia de la vivienda | arriendo 0,404 · propia pagada 0,36 · pagándola 0,035 · usufructo 0,14 · otras 0,061 | DANE, ECV 2024 (total nacional) | oficial |
| arriendo por estrato | por estrato | estimado; verificar con el DANE (IPC arrendamientos) | por_confirmar |
| alimentación | desde la línea de pobreza extrema: $227 220 por persona al mes (2024), por estrato | DANE, pobreza monetaria 2024 | oficial (base) · estimado (por estrato) |
| cuota moderadora 2026 | ≈ $5 000 (menos de 2 SMMLV) · ≈ $20 100 (2–5) · ≈ $52 800 (más de 5) por consulta | Circular 048 de 2025 (MinSalud), UVB 2026 = $12 110 | oficial |
| descuentos del empleado | salud 4 % · pensión 4 % | Ley 100 de 1993 | oficial |
| auxilio de transporte | del perfil (029) | decreto anual | oficial |
| `GOTA_RATE` | 20 % mensual (rango 20–40 %) | ANIF, citada por Portafolio y Banca de las Oportunidades | oficial (rango) · estimado (valor) |
| umbral de deuda | saldo < −200 000 | prototipo | estimado |
| costo diario (perfil prototipo) | 35 000 / 55 000 / 85 000 por estrato | prototipo | oficial (del prototipo) |

## 9. Métricas
- saldo por estrato y por situación;
- deudas por tipo (red, banco, gota a gota);
- impagos por mes;
- gasto del hogar por rubro (comparable con la ENPH);
- flujo con el resto del país.

## 10. Preguntas abiertas
- [x] ¿Gota a gota? → Sí, como último recurso antes del impago (usuario, 2026-09-25).
- [x] ¿Quincena, descuentos de ley y auxilio de transporte? → Sí (usuario, 2026-09-25).
- [x] ¿Resto del país como fuente y sumidero? → Sí (usuario, 2026-09-25).
- [ ] ¿Programas sociales (Renta Ciudadana, Colombia Mayor)? Propuesta: en M3 o después, como transferencias del resto del país a los hogares elegibles por Sisbén.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-25 | 0.2 | Revisión de M2 con las decisiones del usuario: quincena y descuentos de ley (salud y pensión 4 %), auxilio de transporte, tenencia de la vivienda (ECV 2024), servicios por estrato (Ley 142), cuotas moderadoras 2026, gasto de esparcimiento (032), gota a gota (20–40 % mensual), resto del país como fuente y sumidero con conservación exacta; CA-004 a CA-006 nuevos |
| 2026-09-25 | 0.2 | Estado → aprobada |
| 2026-09-25 | 0.2 | Implementación del bloque F de M2. Precisiones [M]: (1) todo movimiento es un parche `transfer` entre cuentas (persona `money`, hogar `savings`, organización `cash`, resto del país), así que R-006 se cumple por construcción; (2) los gastos del hogar los pagan sus adultos (de más a menos saldo) y después el ahorro; (3) alimentación con escala de equivalencia (menores de 12 = 0,6) a la tienda de barrio del distrito, y un rubro de "otros gastos" = 35 % del ingreso esperado del hogar (vestuario, comunicaciones, educación…), porque sin él el patrimonio crecía de forma irreal; (4) las organizaciones privadas venden a clientes de fuera (nómina/30 × U(0,8, 1,3)) y a los vecinos, y lo que pasa de 3 meses de nómina sale a proveedores y dueños; las públicas reciben su nómina del resto del país; (5) topes de crédito: banco ≤ 3 sueldos de deuda, gota a gota ≤ $1 000 000, así que un hogar sin ingresos termina en impago; (6) una cuota atrasada emite evento la primera vez y cada 30; (7) las cuotas no piden préstamos nuevos; (8) sin `economy.*` en el perfil (prototipo) no hay economía. Hallazgo: 16 de 72 hogares del mundo generado no tienen ningún ingreso (mayores sin pensión, desempleados) y viven en déficit crónico; faltan las transferencias de §10 y la red familiar (M3). Sin cambios en CA |
| 2026-09-25 | 0.2 | Bloque H de M2, CA-006 (diferencia justificada): con el perfil colombiano, 100 personas y 1 año, el patrimonio de los adultos (saldo − deudas) queda en p10 −$0,95 M, p50 $7,5 M y p90 $22 M, frente a −$4,7 M, $0,21 M y $17 M del prototipo. El prototipo no tiene ahorro del hogar, crédito con tope ni gasto proporcional al ingreso, y su costo diario fijo por estrato endeuda a la mitad de la población; aquí los hogares con empleo formal ahorran y los sin ingresos se endeudan con tope (ver el hallazgo de los 16 hogares sin ingresos). El perfil prototipo no tiene economía (su dinero no se mueve), así que no se compara. Sin cambios en CA |
| 2026-09-26 | 0.2 | Estado → implementada |
