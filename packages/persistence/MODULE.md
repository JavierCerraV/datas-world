---
modulo: persistence
ruta: packages/persistence
estado: en-desarrollo
specs: [027]
actualizado: 2026-09-23
---

# Módulo: persistence

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Guarda y carga el mundo en SQLite: estado, registro de eventos append-only, instantáneas, entradas externas, órdenes de control, compactación.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 027 | — | todos |


## 3. API pública
Por definir al implementar.

## 4. Diseño interno y decisiones
better-sqlite3 síncrono, WAL, escrituras por lotes.

## 5. Invariantes y guardarraíles
Un solo escritor. Nunca UPDATE/DELETE sobre eventos salvo compactación documentada.

## 6. Cómo se prueba
Por definir al implementar.

## 7. Paridad con el prototipo
No aplica (el prototipo no persiste).

## 8. Pendientes y deuda
- [ ] Primera implementación.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-23 | kit de arranque | — | Documento creado (sin código) |
| 2026-09-23 | m0/a-tooling (A5) | — | Esqueleto del paquete: `package.json` (workspace, ESM, `exports` → `src/index.ts`) y `src/index.ts` vacío. Sin API todavía |
