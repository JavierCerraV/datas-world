---
modulo: architecture
ruta: packages/engine/src/architecture
estado: en-desarrollo
specs: [009, 035]
actualizado: 2026-09-25
---

# Módulo: architecture

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Guardarraíl anticircularidad verificable (009 R-006, CA-B; 035 INV-003, §9): solo los módulos permitidos leen el temperamento, la selección de conducta no lo importa y el adaptador `@deprecated` caduca a tiempo. Aquí están las reglas, puras. El recorrido del repositorio está en `generators/src/architecture/scan.test.ts`.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 009 v1.0 | CA-B; R-006 | — |
| 035 | INV-003; §9 | — |

## 3. API pública
Desde `@datas-world/engine`:

| Símbolo | Descripción |
|---|---|
| `checkArchitecture(files, doneTasks, policy = POLICY)` → `Violation[]` | Violaciones de la política |
| `POLICY`, tipo `ArchitecturePolicy` | Quién puede nombrar `tmp.*`/`pers.*`, qué módulos son de selección, qué archivos son el adaptador, quién puede importarlo y hasta qué tarea del plan MF |
| `doneTasks(plan)` | Tareas cerradas (`- [x] MF…`) de `tasks/MF-motor-funcional.md` |
| tipos `SourceFile`, `Violation` | — |

## 4. Diseño interno y decisiones
- **Reglas:**
  - `lectura-temperamento`: un literal `'tmp.…'` o `'pers.…'` fuera de los permitidos;
  - `seleccion-importa-temperamento`: `decision/` o `selection/` importan `temperament/` (salvo el adaptador);
  - `adaptador-no-autorizado`;
  - `adaptador-caducado`: se cerró la tarea del bloque que retira ese uso, o se cerró MF7.4 y el adaptador sigue existiendo.
- **Pruebas excluidas:** los archivos `*.test.ts` no cuentan, porque montan columnas para sus escenarios.
- **Dónde vive cada parte:** el escaneo del disco va en `generators`, porque el guardarraíl de determinismo prohíbe `node:fs` en todo `packages/engine`, incluidas las pruebas. La 009 decía `packages/engine/src/architecture.test.ts`: la precisión consta en su historial.
- **ESLint:** además, `eslint.config.js` restringe las importaciones de `temperament/*` (salvo el adaptador) en `decision/` y `selection/`.

## 5. Invariantes y guardarraíles
`pnpm check` falla con cualquier violación (escaneo del repositorio y ESLint).

## 6. Cómo se prueba
`rules.test.ts` (4 pruebas) con los fixtures de `fixtures.ts`:
- CA-B: una selección que importa y lee el temperamento;
- un sistema que lee un rasgo;
- un mecanismo permitido;
- la autorización y la caducidad del adaptador;
- la lectura del plan.

## 7. Paridad con el prototipo
No aplica.

## 8. Pendientes y deuda
- [ ] Añadir los archivos de los mecanismos de 036–039 a `temperamentReaders` a medida que existan.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-25 | mf/1-temperamento | — | Documento creado desde la plantilla (sin código) |
| 2026-09-25 | mf/1-temperamento (MF1.5) | 009 v1.0, 035 | `rules.ts` (política y comprobación), `fixtures.ts` y 4 pruebas (CA-B) |
| 2026-09-25 | mf/2-funciones (MF2.5) | 035, 009 | `POLICY`: `functions/` es lector registrado de `tmp.*`; `needs/emotions.ts` deja de importar el adaptador |
| 2026-09-26 | mf/3-seleccion (MF3.4) | 040, 009 | `POLICY.legacyImporters` ya no incluye `decision/options.ts`, `decision/system.ts` ni `routines/system.ts`. La prueba usa `needs/system.ts` como importador vigente y comprueba que `decision/system.ts` queda no autorizado (040 CA-004) |
