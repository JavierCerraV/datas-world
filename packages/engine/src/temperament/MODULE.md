---
modulo: temperament
ruta: packages/engine/src/temperament
estado: en-desarrollo
specs: [009, 035]
actualizado: 2026-09-25
---

# Módulo: temperament

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Capa 1 del motor funcional-contextual (009 v1.0, ADR-007):
- el registro de mecanismos de aprendizaje que puede modular el temperamento (035 §5);
- los términos que ningún parámetro puede nombrar;
- durante la migración, el adaptador `@deprecated` que traduce el temperamento a los rasgos que aún leen los sistemas de M2.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 009 v1.0 | INV-003 (registro); apoyo a CA-A (`FORBIDDEN_TERMS`) | Los mecanismos llegan con 036–039 (MF2–MF6) |
| 035 | §5 (registro de mecanismos); §9 (adaptador) | — |

## 3. API pública
Desde `@datas-world/engine`:

| Símbolo | Descripción |
|---|---|
| `MECHANISMS`, tipo `MechanismId`, `isMechanism(id)` | Registro de mecanismos (035 §5): id → regla que lo implementa. `modula` solo puede citar estos |
| `FORBIDDEN_TERMS` | Raíces de términos de conducta o clínicos prohibidos en el catálogo de temperamento (009 CA-A) |
| `legacyTraits(view, row)`, `legacyTrait(view, row, rasgo)`, tipo `LegacyTraits` (**@deprecated**) | Rasgos de la v0.3 para needs, routines y decision: Big Five tal cual; impulsividad = `tmp.discount0`; resiliencia = 1 − `tmp.aversiveSensitivity`; 0,5 sin la columna |

## 4. Diseño interno y decisiones
- **Traducciones del adaptador:** se eligió la traducción más cercana en significado [M]:
  - la impulsividad de la v0.3 (elegir lo inmediato) ≈ la pendiente inicial del descuento;
  - la resiliencia ≈ lo contrario de la sensibilidad aversiva.

  Son provisionales y caducan por bloques (política en `architecture/rules.ts`): emociones en MF2.5, decisión y quedarse dormido en MF3.4, estresores y línea base del ánimo en MF6.4, horas de sueño iniciales en MF7.3, y el adaptador entero en MF7.4.
- El módulo **no** lee el catálogo de temperamento (el motor no hace E/S): las columnas `tmp.*` las crea el generador y los mecanismos las leerán por nombre desde este módulo.

## 5. Invariantes y guardarraíles
009 R-006: solo los mecanismos de 036–039 (y este módulo) leen `tmp.*`; la selección de conducta nunca. Lo comprueban `architecture/` (reglas y escaneo del repositorio) y ESLint.

## 6. Cómo se prueba
- Indirectamente por las pruebas de needs, routines y decision, que siguen pasando con el adaptador.
- El registro y los términos, en `generators/src/personality/personality.test.ts` (CA-A).

## 7. Paridad con el prototipo
No aplica: el prototipo deja de ser la referencia de conducta (ADR-007 §7).

## 8. Pendientes y deuda
- [ ] Mecanismos de aprendizaje que leen el temperamento (MF2–MF6).
- [ ] Eliminar `legacy.ts` (MF7.4).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-25 | mf/1-temperamento | — | Documento creado desde la plantilla (sin código) |
| 2026-09-25 | mf/1-temperamento (MF1.4, MF1.5) | 009 v1.0, 035 | `mechanisms.ts` (registro de mecanismos y términos prohibidos) y `legacy.ts` (adaptador @deprecated) |
