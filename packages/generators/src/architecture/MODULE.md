---
modulo: architecture-scan
ruta: packages/generators/src/architecture
estado: en-desarrollo
specs: [009, 035]
actualizado: 2026-09-25
---

# Módulo: architecture-scan

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Aplica el guardarraíl anticircularidad (009 R-006, CA-B) al **repositorio real**. Recorre el código de `packages/*/src` y `apps/*/src`, lee las tareas cerradas del plan MF y pasa todo a `checkArchitecture` del motor (`packages/engine/src/architecture/`).

Vive en `generators` porque necesita leer archivos del disco, y el motor no puede hacer E/S (CLAUDE.md regla 2; el guardarraíl de determinismo prohíbe `node:fs` en todo `packages/engine`, pruebas incluidas).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 009 | CA-B (sobre el código real) | — |
| 035 | INV-003; §9 (caducidad del adaptador) | — |

## 3. API pública
Ninguna: es una prueba (`scan.test.ts`), que corre en `pnpm check`.

## 4. Diseño interno y decisiones
- Recorre los `.ts` de `packages/*/src` y `apps/*/src` (sin `node_modules`), con las rutas relativas a la raíz y separadas por `/`.
- Lee `tasks/MF-motor-funcional.md` para saber qué tareas están cerradas: un uso del adaptador caduca cuando se cierra la tarea de su bloque.
- Si hay violaciones, el mensaje lista archivo, regla y detalle.

## 5. Invariantes y guardarraíles
La prueba falla con cualquier violación: lectura de `tmp.*`/`pers.*` fuera de los permitidos, selección que importa el temperamento, uso del adaptador no autorizado o caducado.

## 6. Cómo se prueba
Es en sí una prueba. La lógica de las reglas se prueba con fixtures en `packages/engine/src/architecture/rules.test.ts`.

## 7. Paridad con el prototipo
No aplica.

## 8. Pendientes y deuda
- [ ] Añadir `packages/engine/src/selection/` a la política cuando exista (MF3).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-25 | mf/1-temperamento (MF1.5) | 009, 035 | Prueba `scan.test.ts` del repositorio real con la política del motor |
