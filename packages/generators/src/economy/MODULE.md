---
modulo: economy-gen
ruta: packages/generators/src/economy
estado: en-desarrollo
specs: [015, 008, 029]
actualizado: 2026-09-25
---

# Módulo: economy-gen

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Estado económico inicial del mundo (spec 015, bloque F2 de M2): tenencia de la vivienda, arriendo, ahorro de los hogares, caja de las organizaciones y cuenta del resto del país.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 015 | §3 (estado inicial); CA-001, CA-002 y CA-003 sobre el mundo generado | CA-006 (bloque H) |

## 3. API pública
Desde `@datas-world/generators`:

| Símbolo | Descripción |
|---|---|
| `generateEconomy(world, householdIds, orgIds, rng)` → `EconomyResult \| null` | Crea `world.accounts` (resto del país en 0) y las columnas de la economía; pone tenencia, cuota y ahorro a cada hogar y caja a cada organización. Devuelve el conteo por tenencia. `null` si el perfil no tiene economía (prototipo) |

## 4. Diseño interno y decisiones
- **Tenencia:** proporciones de la ECV 2024 (`economy.tenure`; "otras" se suman al usufructo). Azar `gen:economy/<hogar>`.
- **Cuota de la vivienda** (arriendo o crédito): la del estrato (`economy.rent`, por confirmar) × U(0,8, 1,25), redondeada a $10 000.
- **Ahorro del hogar:** `gen.savings.household.sN` (miles de pesos), aparte del ahorro por persona de la 007.
- **Caja de cada organización:** `economy.orgs.initialPayrollMonths` (2) meses de nómina.
- `generateWorld` la llama al final, con el empleo ya asignado.

## 5. Invariantes y guardarraíles
Montos enteros en COP (015 R-001).

## 6. Cómo se prueba
`economy.test.ts` (4 pruebas sobre el mundo generado, semilla 482917):
- estado inicial;
- CA-001: un año de economía y 30 días con toda la vida diaria, error 0;
- CA-003: mediana del patrimonio por estrato tras 90 días;
- CA-002: despido y endeudamiento o gasto del ahorro en 90 días.

También comprueba el tope de caja y que los atrasos no produzcan un evento diario.

## 7. Paridad con el prototipo
El prototipo no tiene tenencia ni ahorro del hogar: solo ahorro por persona (007 R-005).

## 8. Pendientes y deuda
- [ ] Verificar los arriendos por estrato (DANE, IPC de arrendamientos).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-25 | m2/f-economia | — | Documento creado desde la plantilla (sin código) |
| 2026-09-25 | m2/f-economia (F2, F6) | 015, 008 | `generate.ts` (tenencia, cuota, ahorro del hogar, caja, resto del país) y 4 pruebas sobre el mundo generado |
| 2026-09-25 | m2/g-trabajo-objetos | 015, 006 | La prueba de 30 días con toda la vida diaria incluye los sistemas del trabajo y comprueba que casi nadie llega tarde por el viaje y que se cubren las vacantes iniciales |
