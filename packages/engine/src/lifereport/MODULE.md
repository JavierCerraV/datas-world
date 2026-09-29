---
modulo: lifereport
ruta: packages/engine/src/lifereport
estado: estable
specs: [020, 013, 019]
actualizado: 2026-09-29
---

# Módulo: lifereport

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Informe de vida (spec 020 v0.3): capítulos objetivos, divergencias con los recordados (013), puntos de inflexión con su «¿por qué?» (019) y perfil emergente, calculados bajo demanda desde los hechos, la memoria y la trayectoria. Funciones puras: no cambian el mundo ni el registro.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 020 | CA-001 a CA-006 (unidad y 100 personas × 1 año en `packages/generators`) | — |

## 3. API pública
- `lifeReport(input)` → `LifeReport` (capítulos, recordados, divergencias, puntos de inflexión, perfil y trayectoria).
- `objectiveChapters`, `divergences`, `concerns` (`chapters.ts`); `turningPoints`, `TURNING_POINTS` (`turning.ts`); `emergentProfile` (`profile.ts`).
- Tipos `ReportInput` (vista, persona, sus hechos más las muertes, búsqueda en el registro, trayectoria, ahora, nombres), `DayPoint`, `LifeChapter`, `Divergence`, `TurningPoint`, `EmergentProfile`, `ProfileKey`.

## 4. Diseño interno y decisiones
- **Capítulos objetivos (R-004).** Las mismas marcas que la memoria de partida (013): etapas por edad (citan el `CITIZEN_BORN` de la persona, CA-002), los hechos con tema del pasado, fundiendo los que distan menos de medio año y el primer empleo o el primer hijo una sola vez, y en la vida diaria todo hecho con tema. Así las fechas de ambos lados coinciden y solo aparece `boundary` cuando de verdad difieren. Tono: la media de la λ de sus hechos (013) y de sus episodios de desarrollo (valencia × 0,6), por 0,5, más el cambio de ánimo del tramo si hay trayectoria.
- **Divergencias (R-005), calibradas.** Con el umbral de 0,4 salían 3,3 de tono por persona, porque la memoria es en conjunto más amable que lo vivido (se recuerdan los episodios más salientes, y el catálogo tiene más buenos que malos). Ahora el tono se compara en el patrón de cada persona (cada tono menos la media de su lado), y el sesgo general se dice una vez («en general recuerda su vida mejor de lo que fue», capítulo −1, si la media difiere más de 0,3). Además se marca siempre una etapa recordada al revés de como fue, con los dos tonos por encima de 0,3.
- **Puntos de inflexión (R-002).** Por cada hecho de la persona que no sea rutina ni un registro de su memoria:
  - sus descendientes causales entre sus hechos, en 90 días;
  - 10 × |cambio de ánimo| y 3 × |cambio de dinero| relativo, en 30 días;
  - 2 × importancia y |λ|.

  Se muestran los 5 primeros, cada uno con su árbol `why` de profundidad 3.
- **Perfil (R-006).** Fórmulas en la spec. Un valor sin hechos de base queda en `null` (CA-005), incluidos la resiliencia sin golpes y la exposición sin estresores. El rumbo económico usa `tanh` del cambio relativo, porque con el cambio lineal saturaba en 0 o 1.
- **Sin estado.** El informe copia los capítulos recordados y no escribe nada (INV-002, prueba).

## 5. Invariantes y guardarraíles
- 020 INV-001: valores del perfil en [0,1] o `null`.
- 020 INV-002: `lifeReport` no cambia la vista (prueba).

## 6. Cómo se prueba
- `lifereport.test.ts` (5 pruebas): CA-001, CA-003, CA-004 (tono, fechas, ausencia), CA-005 (resiliencia rápida frente a lenta, base de cada valor), INV-002.
- `packages/generators/src/relationships-world.test.ts`: el informe de 100 personas tras 1 año (CA-001, CA-002, CA-005, CA-006 y menos de 3 divergencias por persona).

## 7. Paridad con el prototipo
Sin equivalente en el prototipo.

## 8. Pendientes y deuda
- [ ] La estabilidad laboral sale casi siempre alta (media 0,99): la historia generada (030) registra el empleo actual y pocos cambios. Mejorará con una historia laboral.
- [ ] PA-149: las fórmulas del perfil y la ventana de recuperación, con fuentes.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-29 | m3/historia (H1) | 020 | Documento creado desde la plantilla (sin código) |
| 2026-09-29 | m3/historia (H2–H4) | 020 | Módulo implementado: capítulos objetivos, divergencias calibradas (patrón de cada persona y sesgo general aparte), puntos de inflexión por consecuencias y cambio, perfil emergente con base. 5 pruebas |
