---
id: 028
nombre: experiments
estado: aprobada
hito: M5
depende_de: [001, 021, 022, 023, 027, 046]
version: 0.3
---

# 028 — Experimentos y ramas

## 1. Propósito
Responder preguntas causales sobre el mundo: *¿qué habría pasado con estas mismas personas si…?* Un experimento parte de una instantánea, crea varios **brazos** que difieren solo en una intervención (o en una capacidad activada o desactivada), los hace avanzar con el mismo azar y compara los resultados. Es la herramienta con la que se cierra cada peldaño de la escalera (ADR-005) y la base de la capa clínica (034: un plan de tratamiento por brazo).

La pregunta guía del proyecto («¿podemos explicar por qué terminaron donde terminaron?») pide algo más que una trayectoria: pide ver la **misma** vida con y sin un hecho. Sin brazos pareados solo se puede describir.

## 2. Alcance
**Incluye:** ramas desde instantáneas, intervenciones como entradas externas validadas, brazos por capacidad, lotes de semillas con azar común, métricas por persona y en el tiempo, comparación pareada con intervalo de confianza, y exportación a CSV, JSON y Excel.

**Fuera de alcance:**
- estadística avanzada (se exporta en formato largo para R o Python);
- diseños en los que se asigna tratamiento a unas personas y control a otras **dentro del mismo mundo** (hay interferencia entre personas; PA-156);
- ejecutar en el worker del mundo vivo (R-002) y paralelizar brazos (una sola ejecución a la vez en el MVP).

## 3. Modelo de datos
```ts
interface Experiment {
  id: string;                       // «exp-perdida-empleo-01»
  base: { db: string; branchAt: WorldMinute };   // base y minuto de la instantánea (la más cercana anterior, 027)
  durationDays: number;             // días que corre cada brazo desde la rama
  seeds: number[];                  // semillas del azar futuro; todos los brazos usan las mismas (R-005)
  arms: Arm[];                      // el primero es el control
  metrics: MetricId[];
  sampleEveryDays: number;          // cada cuántos días se miden las métricas por persona
  subjects: Subjects;               // a quién se mide
}
type Subjects = { citizens: EntityId[] } | { cohort: CohortFilter; n: number };   // la cohorte es la de 024 R-026; `n` con selectSample (046 R-005)

interface Arm {
  name: string;                     // «control», «pierde el empleo»
  interventions: Intervention[];
  capabilities?: { enable?: Capability[]; disable?: Capability[] };   // solo en ramas (001 R-007)
}
interface Intervention { afterDays: number; kind: InterventionKind; target: EntityId | 'subjects'; params?: Record<string, number | string> }
type InterventionKind = 'force_job_loss' | 'grant_money' | 'enable_capability' | 'disable_capability';

type MetricId = 'mood' | 'stress' | 'money' | 'debt' | 'employed' | 'bonds' | 'events:<TYPE>' | 'pnr_episodes' | 'psychometrics';
interface Observation { seed: number; arm: string; citizenId: EntityId; day: number; metric: MetricId; value: number }
interface Contrast { arm: string; metric: MetricId; day: number; n: number; meanDiff: number; sd: number; ci95: [number, number]; dz: number }
```
Memoria: un brazo en marcha ocupa lo de un mundo (≈ 20–40 KB por persona más sus eventos del periodo, que se cuentan y se descartan: R-007). No se escribe a la base.

## 4. Reglas
- **R-001** [T] — **Rama.** Un brazo parte de la instantánea más cercana anterior a `branchAt` de la base (027 R-004) y la avanza hasta `branchAt` sin intervenir, de modo que todos los brazos arrancan con el **mismo hash**. La base nunca se modifica: el experimento no escribe en ella y no toma el cerrojo de escritor.
- **R-002** [T] — **Dónde corre.** En la CLI, local o en el servidor con prioridad baja, nunca en el worker del mundo vivo. Un brazo a la vez.
- **R-003** [T] — **Intervenciones como entradas externas.** Cada intervención se registra como `ExternalInput` y se aplica en el mismo `(at, seq)` (023 R-004). Un manejador valida sus precondiciones (`check`) y solo entonces cambia el estado (`apply`), emitiendo **eventos con causas** (el `EXTERNAL_INPUT_APPLIED` y los que siguen). Una intervención rechazada no cambia el mundo y se anota en el informe con su motivo (p. ej. «la persona ya no tiene empleo»). Tipos de la primera versión:
  - `force_job_loss`: la persona pierde su empleo formal en ese minuto (`JOB_LOST`, motivo `experiment`); el resto (ánimo, dinero, búsqueda) lo hace el motor como ante cualquier despido;
  - `grant_money`: transferencia de dinero entero (`params.amount`) a la cuenta de la persona, desde la cuenta del resto del país (015); queda como evento;
  - `enable_capability` y `disable_capability`: ver R-004.
- **R-004** [T] — **Brazos por capacidad.** Un brazo puede activar o desactivar capacidades en `branchAt`. Desactivar deja de ejecutar sus sistemas pero conserva sus datos (no se borra nada, CLAUDE.md regla 6). Mide qué aporta cada capacidad al mismo mundo (p. ej. con y sin `consolidation`).
- **R-005** [M] — **Azar común.** Para cada semilla `s`, todos los brazos usan `createRng(s)` como azar futuro después de la rama (el de antes de la rama es el de la base). Así, dos brazos sin intervención con la misma semilla son idénticos (CA-001) y la diferencia entre brazos con la misma semilla se debe a la intervención, no al azar. Un brazo se identifica por `(arm, seed)`. El azar de la rama se registra en los metadatos.
- **R-006** [M] — **Métricas.** Se miden por persona en `sampleEveryDays` y al final, desde el estado del mundo (nunca desde lo que la persona «cree»):
  - `mood`, `stress` (semana móvil), `money`, `debt` (suma de saldos), `employed` (0 o 1), `bonds` (vínculos con confianza ≥ 0,5), `pnr_episodes` (acumulados) y `events:<TYPE>` (conteo acumulado de un tipo de evento);
  - `psychometrics`: la batería de la spec 046 al final de cada brazo (sin LLM por defecto: proveedor `mock` o respuesta verdadera; con LLM solo si se pide, por su coste).
- **R-007** [M] — **Eventos que no se guardan.** Para respetar el presupuesto de memoria, los eventos de un brazo pasan por un colector que cuenta los tipos pedidos y los descarta; no se acumulan. El experimento no produce registro de eventos. Si se quiere explicar una trayectoria en detalle, se repite ese `(arm, seed)` con `--keep-events` (lo guarda en una base aparte, con las causas, para `event:why`).
- **R-008** [M] — **Comparación.** Para cada brazo distinto del control, cada métrica y cada día medido: la diferencia **pareada** por `(semilla, persona)` (brazo − control), con n, media, desviación, tamaño del efecto `dz` (media / desviación) e intervalo del 95 % por *bootstrap* con el flujo `experiment:bootstrap` (`BOOTSTRAP_N` remuestreos). Las personas con una intervención rechazada se excluyen de ese brazo y se cuentan aparte.
- **R-009** [T] — **Exportación.** `--out` escribe `<out>.json` (todo), `<out>.csv` (formato largo: `seed, arm, citizen, day, metric, value`, para R o Python) y `<out>.xlsx` (método y límites, brazos, contrastes, observaciones). Metadatos: versión del motor, hash de la base y de la rama, semillas, capacidades e intervenciones de cada brazo, parámetros. Mismos datos de entrada, mismo informe, byte a byte.
- **R-010** [T] — **Puertas de peldaño.** Cada peldaño de la escalera (ADR-005, `docs/roadmap.md`) se cierra con un experimento guardado en `docs/validaciones/` cuyos brazos comparan el mundo con y sin las capacidades nuevas.
- **R-011** [M] — **Honestidad.** Un experimento sobre personas simuladas muestra lo que **el modelo** predice, no lo que ocurriría a personas reales: depende de las reglas y parámetros [M] del motor. El informe lo dice en su primera hoja, igual que la batería psicométrica (046 R-009). Con pocas semillas, los intervalos son anchos y no deben leerse como evidencia de efecto.

## 5. Eventos
No define tipos propios. Las intervenciones emiten los de otras specs (`JOB_LOST` con motivo `experiment`, un `EXTERNAL_INPUT_APPLIED` como causa) y el cambio de capacidades usa `CAPABILITY_ENABLED` (001 R-007); `disable_capability` añade `CAPABILITY_DISABLED` (spec 001, por incorporar).

## 6. Invariantes
- **INV-001** — Todos los valores normalizados permanecen en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera del flujo de acciones validadas (CLAUDE.md, regla 4): toda intervención pasa por `check` y `apply` y deja eventos con causas.
- **INV-003** — Un experimento no modifica su base ni toma el cerrojo de escritor.
- **INV-004** — Los brazos de un mismo experimento arrancan con el mismo hash de estado.

## 7. Criterios de aceptación
- **CA-001** — *Dado* dos brazos idénticos sin intervención y la misma semilla, *entonces* resultados idénticos; con semillas distintas, distintos.
- **CA-002** — *Dado* un `force_job_loss` en un brazo, *entonces* el informe compara ánimo, dinero y vínculos de la persona entre brazos, con la diferencia pareada por semilla.
- **CA-003** — *Dado* un brazo con `consolidation` desactivada y otro con ella activa, *entonces* ambos arrancan con el mismo hash y el informe compara memoria en RAM por persona y decisiones sociales.
- **CA-004** — *Dada* una intervención sobre una persona que no cumple la precondición (sin empleo), *entonces* el mundo no cambia, el informe la lista como «no aplicada» con su motivo y esa persona no entra en la comparación de ese brazo.
- **CA-005** — *Dado* un experimento sobre una base, *entonces* el hash de la base y su archivo no cambian y no se escribe en ella (INV-003).
- **CA-006** — *Dado* el mismo experimento y la misma base, *entonces* `json`, `csv` y `xlsx` son idénticos byte a byte (sin LLM).
- **CA-007** — *Dado* un brazo de 200 personas × 90 días, *entonces* el pico de memoria queda dentro del presupuesto (CLAUDE.md regla 8; `pnpm bench`).
- **CA-008** — *Dado* el informe, *entonces* su primera hoja trae los límites (R-011) y los metadatos de R-009.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto | Rango | Fuente / justificación |
|---|---|---|---|
| `durationDays` | 90 | 1–730 | [M] horizonte típico de un duelo o un cambio laboral |
| `seeds` | 5 | 1–30 | [M] compromiso entre intervalo y tiempo de cómputo |
| `sampleEveryDays` | 7 | 1–90 | [M] semana, como las ventanas de 046 |
| `BOOTSTRAP_N` | 1 000 | 200–10 000 | [M] estándar para un intervalo percentil |
| `arms` máximo | 6 | 2–10 | [M] límite de tiempo y de informe |
| `bonds` (umbral de confianza) | 0,5 | 0,3–0,8 | [M] vínculo fuerte (012) |

## 9. Métricas y observabilidad
Por experimento: tiempo y memoria pico por brazo, número de intervenciones aplicadas y rechazadas, y alertas de degeneración sobre las métricas (varianza ≈ 0, saturación en 0 o 1, crecimiento sin límite) como en las demás specs. Distribuciones en la prueba de 100 personas × 1 año.

## 10. Preguntas abiertas
- [ ] **PA-156** — Diseño dentro del mismo mundo (unas personas tratadas, otras de control): es más barato (una corrida) pero las personas interactúan, así que hay interferencia. Qué resolvería la duda: medir cuánto cambia el control cuando los tratados son sus vecinos o su familia.
- [ ] ¿Qué intervenciones faltan para la primera validación (apoyo social, un conflicto forzado, una enfermedad)? Cada una necesita su manejador y su spec de origen.
- [ ] Enganche de la capa clínica (034 R-007): brazos por intervención (un plan de tratamiento por brazo, incluido «sin intervención») sobre la misma persona y la misma instantánea.
- [ ] ¿Una métrica `psychometrics` con LLM por brazo es asumible en coste? 150 llamadas por brazo y semilla (046); propongo `mock` por defecto y LLM solo en los experimentos de cierre.
- [ ] Orden con M6: este hito (M5) va antes de la pasarela LLM de nivel 4; ninguna regla de esta spec depende del LLM.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-23 | 0.2 | Brazos que activan o desactivan capacidades y experimentos como puerta de cada peldaño (R-004, R-005, CA-003). ADR-005 |
| 2026-09-24 | 0.2 | Pregunta abierta: brazos por intervención para la capa clínica (spec 034) |
| 2026-10-06 | 0.3 | Diseño completo para revisión: rama desde instantánea sin tocar la base (R-001, INV-003), intervenciones como entradas externas con `check` y `apply` (R-003), azar común por semilla (R-005), métricas, colector de eventos que respeta el presupuesto de memoria (R-006, R-007), comparación pareada con intervalo por *bootstrap* (R-008), exportación en CSV, JSON y Excel (R-009), límites (R-011), CA-004 a CA-008 y PA-156. Usa la batería psicométrica (046) como medida de resultado. Pendiente de revisión del usuario |
| 2026-10-07 | 0.3 | Estado → aprobada |
| 2026-10-07 | 0.4 | Implementación (aprobada por el usuario el 2026-10-07, «como lo propones»). Precisiones: (1) `subjects` admite `{ citizens }` o `{ sample: n }` (muestra estratificada de adultos de la 046); el filtro de cohorte del visor queda como mejora; (2) los eventos de una intervención llegan a los sistemas de aprendizaje y memoria en el tick siguiente mediante `Runner` `feedKinds` (sin eso un despido forzado no dejaba huella en lo aprendido); (3) el pico de memoria va a la consola y no a los archivos, para que el informe se repita byte a byte (CA-006); (4) `base.branchAt` 0 significa el estado actual de la base; (5) la métrica `psychometrics` queda pendiente (la CLI la rechaza con un aviso) y `--keep-events` (R-007) también; (6) desactivar una capacidad exige que ninguna activa dependa de ella. Módulos: `engine/experiment`, `generators/experiment` y `experiment:run`
| 2026-10-07 | 0.4 | Primer experimento real (`docs/validaciones/M5-experimentos.md`): el despido forzado se revierte en menos de una semana por la recontratación del motor; sin `consolidation` no cambian las métricas de estado y falta la métrica de memoria por persona que pide CA-003; el chequeo INV-003 avisa en vez de fallar si el worker tiene la base abierta. Pendientes: memoria por persona, CA-007 con `pnpm bench`, `psychometrics`, `--keep-events` e intervención de desempleo sostenido |
