# M5 — Primer experimento: despido forzado y sin `consolidation`

Fecha: 2026-10-07 · Spec 028 v0.4 · Definición: [`M5-experimentos/despido-y-consolidacion.json`](M5-experimentos/despido-y-consolidacion.json) · Mundo: `data/world.db` (199 personas), rama el 2027-05-01 · 3 brazos × 3 semillas × 60 días, 50 adultos.

> **Límite que gobierna todo lo de abajo (028 R-011):** esto es lo que predice el **modelo** sobre personas simuladas. Con 3 semillas y 50 personas, los intervalos son orientativos; las observaciones de una misma semilla y persona no son independientes, así que los intervalos son optimistas.

## Qué se hizo
| Brazo | Qué cambia |
|---|---|
| control | nada |
| despido forzado | `force_job_loss` el día 0 a las 50 personas medidas: 20 tenían empleo formal (aplicada), 30 no (rechazada con motivo, fuera del contraste) |
| sin consolidation | se desactiva la capacidad `consolidation` en la rama (se conservan sus datos) |

Los tres arrancan con el **mismo hash de estado** (rama). Cada semilla da el mismo azar a los tres brazos.

## Resultados (diferencia brazo − control, pareada por semilla y persona)
| Métrica | Día 0 | Día 7 | Día 60 |
|---|---|---|---|
| Empleo (despido forzado) | −1,00 | 0,00 | 0,00 |
| Ánimo (media de 7 días) | 0,000 | −0,025 [−0,034; −0,015] | −0,012 [−0,035; 0,008] |
| Estrés (media de 7 días) | 0,000 | +0,045 [0,040; 0,050] | +0,005 [0,002; 0,008] |
| Vínculos fuertes | 0,0 | +2,1 [1,5; 2,8] | +2,6 [1,8; 3,4] |
| Dinero | 0 | +66 691 [44 966; 91 327] | −119 082 [−430 917; 169 518] |
| `sin consolidation`, cualquier métrica de estado | 0 | 0 | 0 |

## Lo que muestra
1. **El despido forzado dura menos de una semana.** La persona queda sin empleo el día 0 (−1,00) y para el día 7 ya fue recontratada (0,00, en las tres semillas y en las 20 personas). Con esa recontratación tan rápida, el efecto sobre el ánimo y el estrés es pequeño y se diluye hacia el día 60 (el intervalo del ánimo incluye el 0). Es un hallazgo sobre el mercado laboral del motor (006: puestos libres que se llenan casi de inmediato), no sobre la gente. Para estudiar un desempleo prolongado hace falta una intervención que lo sostenga (p. ej. congelar la contratación de esa persona N días): queda en la spec.
2. **Un despido fortalece vínculos en el modelo, y no sé por qué.** Los vínculos fuertes (confianza ≥ 0,5) suben +2,1 a +2,6 en quienes fueron despedidos, solo en ese brazo. Una explicación plausible es que el hecho entra por el mismo canal que cualquier otro (se cuenta a otros y eso sube la confianza), pero **no lo verifiqué**: en un mundo pequeño de prueba no se reprodujo. Es un efecto del modelo a investigar, no un resultado.
3. **El dinero no se explica todavía.** A los 7 días quienes fueron despedidos tienen *más* dinero que el control (+66 691), y a los 60 días menos con un intervalo enorme que incluye el 0. La primera diferencia no tiene una causa que yo pueda señalar (¿liquidación? ¿gasto distinto?). Hay que mirar los eventos de pago de esas personas antes de leerlo.
4. **Sin `consolidation` no cambia ninguna métrica de estado.** Es esperable: la consolidación (013) actúa sobre la **memoria**, no sobre el ánimo, el dinero o los vínculos en 60 días. La spec (CA-003) pide comparar la memoria en RAM por persona y las decisiones sociales; esa métrica **todavía no existe**, así que esta comparación está incompleta.

## Memoria (CA-007)
Pico de memoria del proceso: **563 a 574 MB** para un mundo de 199 personas y 60 días (el proceso mantiene la base cargada, su copia y el brazo en marcha, así que sobrestima lo de un solo brazo). Dentro del presupuesto de 1 GB, sin margen para mundos mucho mayores. La prueba formal con 200 personas × 90 días queda pendiente (`pnpm bench`).

## Lo que encontré y corregí en el camino
- El chequeo de que la base no cambió (INV-003) falló porque el worker del usuario la tenía abierta para escribir. El experimento solo abre en solo lectura; ahora avisa en vez de fallar cuando hay un escritor.
- Los eventos de una intervención no llegaban al aprendizaje ni a la memoria (los sistemas solo veían los de su tick). Se resolvió con `feedKinds`; la prueba muestra que la persona despedida acumula más ensayos de «despido».

## Estado
- Criterios con prueba: CA-001, CA-002, CA-004, CA-005, CA-006, CA-008, INV-004; la parte de capacidades de CA-003 (mismo hash, capacidad desactivada con datos conservados).
- **Pendiente:** métrica de memoria por persona (CA-003 completo), CA-007 con `pnpm bench`, métrica `psychometrics` por brazo, `--keep-events`, y el experimento de cierre con más semillas.
- Archivos del experimento (fuera de git): `data/experimentos/despido-y-consolidacion.{xlsx,csv,json}`.
