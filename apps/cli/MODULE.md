---
modulo: cli
ruta: apps/cli
estado: en-desarrollo
specs: [001, 002, 027]
actualizado: 2026-09-23
---

# Módulo: cli

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Herramientas de línea de comandos: crear mundo, avanzar N días, informes, exportación, comparación de semillas, bench.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 001 | — | todos |
| 002 | — | todos |
| 027 | — | todos |


## 3. API pública
Por definir al implementar.

## 4. Diseño interno y decisiones
Comandos pequeños sobre engine + persistence.

## 5. Invariantes y guardarraíles
No contiene reglas de simulación.

## 6. Cómo se prueba
Por definir al implementar.

## 7. Paridad con el prototipo
Sustituye a los scripts headless usados para calibrar el prototipo.

## 8. Pendientes y deuda
- [ ] Primera implementación.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-23 | kit de arranque | — | Documento creado (sin código) |
| 2026-09-23 | m0/a-tooling (A5) | — | Esqueleto del paquete: `package.json` (workspace, ESM, `exports` → `src/index.ts`) y `src/index.ts` vacío. Sin API todavía |
