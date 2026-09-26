---
modulo: rules
ruta: packages/engine/src/rules
estado: en-desarrollo
specs: [038, 037, 040, 036]
actualizado: 2026-09-26
---

# Módulo: rules

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Capa 4 del motor funcional (spec 038): reglas por persona con su historia y su tipo (pliance, tracking, augmenting), su competencia con las contingencias en la selección, las reglas de la rutina del mundo y los valores como subredes jerárquicas de la red relacional (037).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 038 | CA-001 (V-9), CA-002 (V-11b) y CA-003 en `lab/rules.test.ts`; CA-004 en `rules.test.ts` y `decision/decision.test.ts`; CA-005 en `generators/src/stimuli/stimuli.test.ts`; R-001 a R-011; INV-001 a INV-003 | Augmentals motivadores (MF6); cambio de pliance por la presencia o la aprobación del hablante (M3); `RULE_DERIVED` y `RULE_ABANDONED` en nivel ≥ 3 |

## 3. API pública
Desde `@datas-world/engine`:

| Símbolo | Descripción |
|---|---|
| `Rule`, `RuleKind`, `NewRule` | Regla (`Citizen.rules`): antecedente, respuesta, consecuencia, quién la dijo, fuerza, contraste e historia |
| `addRule(rules, net, x)` | R-002, INV-001, INV-003: añade la regla y su arista `resp causes cons` (crel = antecedente); la aprobación del hablante bonifica la fuerza; poda por encima de 32 |
| `kindOf(r)` | R-003: pliance, tracking o augmenting según la historia |
| `ruleContribution(r)`, `applicable(rules, ante, resp)` | R-004: aporte `s × (1 − contraste × d)`, con d = 0,3 en pliance |
| `observe(r, discrepancia, tasa, reforzadaPor?)` | R-005: seguir la regla y observar la consecuencia |
| `ROUTINE_RULES`, `initRules(world)`, `routineResponse(activity)`, `rulesOf(view, row)`, `rulesSystem`, `JOB_SEARCH_CONTRAST_RATE` | R-010 y R-005: reglas de la rutina, su inicialización al generar y la confirmación con `JOB_HIRED` (fase `memory`, orden 3) |
| `valueContribution(net, directOf, stim, ctx?)`, `DOMAIN_PREFIX` | R-006: aporte apetitivo de lo que señala un valor (raíz `dominio.*` por jerarquía) |
| `thoughtAppears(net, trigger, thought, ctx?)`, `THOUGHT_THRESHOLD` | CA-002: un pensamiento aparece si la coordinación con su disparador alcanza 0,6 |
| `MAX_RULES`, `PLIANCE_DISCOUNT`, `LAB_CONTRAST_RATE`, `SPEAKER_APPROVAL_BONUS` | Parámetros de la 038 §8 |

## 4. Diseño interno y decisiones
- **Reglas como redes (INV-001):** cada regla añade `resp causes cons` con `crel` = antecedente a la red relacional. La consecuencia transfiere su función a la respuesta (037 R-003), así que una regla también cambia el valor funcional de la respuesta.
- **Tipo:** pliance si el hablante la reforzó más que la contingencia; tracking si la contingencia la confirmó; sin historia, según quién la dijo. En el laboratorio de V-9, obedecer se refuerza por el experimentador en cada ensayo (pliance) o solo por el resultado (tracking).
- **Competencia (R-004):** el aporte entra en la fuente `regla` de la 040. El pliance descuenta el contraste al 30 %: de ahí su insensibilidad (R-001). V-9 da, en media de 20 sujetos, más ensayos hasta ajustarse con pliance que moldeado, y más con pliance fuerte que débil; el tracking se ajusta como la experiencia.
- **Reglas de la rutina (R-010):** al generar, a cada persona activa de 12 años o más: buscar empleo y diligencias (tracking, de la comunidad), oficios y cuidado (pliance, de la familia), estudiar (pliance, del colegio). Su aporte inicial es el número fijo de la 040 (0,45; 0,35 estudiar): la conducta de partida no cambia.
- **Desaliento (R-005):** seguir la regla de buscar empleo sin conseguirlo suma discrepancia 1 con tasa 0,004 por seguimiento (lo hace el sistema de decisiones al elegirla); `JOB_HIRED` la confirma (contraste 0). En un año del mundo generado, el aporte de quien sigue desempleado baja de 0,45 a 0,23 hacia el quinto mes y a 0,11 al año.
- **Valores (R-006, R-007):** un valor es la subred `X part_of dominio.<d>` con raíz de función apetitiva aprendida. `valueContribution` da la fuente `valor` de la 040. La aversión de la selección se calcula sin las raíces de valor, para que el valor no la tape ni cuente dos veces (no compiten). La red opuesta se deriva con `opposition ∘ part_of = opposition` (ampliación de la tabla de la 037).

## 5. Invariantes y guardarraíles
038 INV-001 (toda regla tiene su arista en la red y un tipo según su historia), INV-002 (sin columnas `val.*`) e INV-003 (tope de 32). No lee el temperamento.

## 6. Cómo se prueba
- `rules.test.ts` (6 pruebas): tipo, contraste y pliance, arista en la red y bonificación por aprobación, tope, reglas de la rutina (aporte inicial igual al de la 040; menores de 12 sin reglas) y confirmación con `JOB_HIRED`.
- `lab/rules.test.ts`: V-9, V-11b y CA-003.
- `decision/decision.test.ts`: CA-004 en marcha (14 días buscando sin éxito bajan el aporte).
- `generators/src/stimuli/stimuli.test.ts`: CA-005 y reglas en los adultos del mundo generado.

## 7. Paridad con el prototipo
No aplica (ADR-007 §7).

## 8. Pendientes y deuda
- [ ] Pliance con hablante presente y aprobación (M3); augmentals motivadores (MF6).
- [ ] Reglas y valores construidos en el desarrollo (041, MF7) y por conversaciones (025, M3).
- [ ] Seguimiento de las demás reglas de la rutina (hoy solo cuenta el de buscar empleo).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-26 | mf/5-reglas-valores | — | Documento creado desde la plantilla (sin código) |
| 2026-09-26 | mf/5-reglas-valores (MF5.1, MF5.2) | 038, 037, 040 | Primera implementación: reglas (`rules.ts`), reglas de la rutina y confirmación (`routine.ts`), valores y aparición de pensamientos (`values.ts`) |
