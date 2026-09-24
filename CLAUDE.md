# CLAUDE.md — Datas World

Este archivo lo lee Claude Code al empezar cada sesión. Es la fuente de verdad sobre **cómo** se trabaja en este repositorio. El **qué** está en `specs/` y el **por qué** en `docs/`.

## 1. Qué estamos construyendo

Un laboratorio de simulación social: un mundo con población artificial que vive de forma autónoma (trabaja, se relaciona, gasta, recuerda, se equivoca, aprende) y sigue evolucionando aunque nadie lo observe. La interfaz pixel art es solo una ventana al estado; no contiene lógica.

La capa clínica (terapeuta que entra al mundo) es **posterior** y no debe condicionar ninguna decisión del núcleo.

Documento de visión completo: `docs/vision/mundo-social-autonomo.md`.
Pregunta guía de todo el proyecto: *¿estas personas parecen haber vivido, y podemos explicar por qué terminaron donde terminaron?*

## 2. Reglas de oro (no negociables)

1. **Sin spec aprobada no hay código.** Antes de implementar, la spec correspondiente debe tener `estado: aprobada`. Si falta información, se propone una modificación a la spec, no se improvisa en el código.
2. **El motor es determinista.** Dentro de `packages/engine` están prohibidos `Math.random()`, `Date.now()`, `new Date()` sin argumentos, `performance.now()`, E/S de red o disco y la iteración sobre estructuras con orden no garantizado. Toda aleatoriedad pasa por `Rng` (spec 023) con flujos nombrados. Misma semilla + mismas entradas = mismo mundo, bit a bit.
3. **Verdad del mundo ≠ creencias.** `WorldState` guarda lo que es. Cada persona guarda lo que cree (`Belief`). Nunca se lee la verdad del mundo para decidir lo que una persona "sabe" (spec 025).
4. **El estado solo cambia mediante acciones validadas.** Ningún módulo muta el estado de otro directamente. Un agente (o el LLM) *solicita* una acción; el motor verifica precondiciones y la aplica (spec 017, 026).
5. **Todo cambio relevante produce un evento con causas.** Los eventos son inmutables y se guardan en un registro append-only. Cada evento lleva `causes[]`, referencias a eventos o estados que lo explican (spec 014, 019).
6. **La historia no se borra.** Estado actual, eventos, historia y memoria son cuatro cosas distintas (spec 020). Cambiar el estado nunca elimina historia.
7. **El LLM no es el núcleo.** El MVP funciona sin LLM. Cuando exista, solo genera expresión o propuestas de acción que el motor valida (spec 026).
8. **Presupuesto de servidor real.** Se desarrolla en local (ADR-004), pero el diseño debe caber en 1 GB de RAM, medio vCore y 5 GB de disco, el servidor previsto para publicarlo. Cualquier dependencia o estructura de datos nueva debe justificar su coste de memoria (`pnpm bench`).
9. **Documentación viva.** Todo cambio de código de un módulo actualiza en el mismo cambio su `MODULE.md`: API, diseño, criterios cubiertos y una fila nueva en la bitácora. Lo verifican los guardarraíles (§10).
10. **El prototipo es la referencia.** `prototipo/index.html` define el comportamiento mínimo esperado. Se porta el comportamiento, no el código, y se mide la paridad (`docs/prototipo-referencia.md`).

## 3. Stack (decidido en `docs/adr/ADR-001-stack-tecnologico.md`)

- TypeScript estricto sobre Node.js LTS (24), módulos ES.
- Monorepo con pnpm workspaces.
- SQLite (better-sqlite3, modo WAL) para estado, registro de eventos e instantáneas.
- API: Fastify + Server-Sent Events para el flujo en vivo.
- Web: Vite + TypeScript + Canvas 2D (sin framework de UI en el MVP).
- Validación de esquemas: Zod en los bordes (API, importación, LLM). Dentro del motor, tipos puros.
- Pruebas: Vitest. Pruebas de propiedades con fast-check donde aporte.

## 4. Estructura del repositorio

```
packages/
  engine/        Núcleo puro: tipos, reglas, reloj, scheduler, RNG. Sin E/S.
  generators/    Generación de mundo y población (usa engine).
  persistence/   SQLite: esquema, migraciones, repositorios, instantáneas.
  llm-gateway/   (M6) Adaptador de proveedores LLM con caché y presupuesto.
apps/
  worker/        Proceso que avanza el mundo y persiste. Uno solo por mundo.
  api/           HTTP + SSE de solo lectura (más controles de tiempo).
  web/           Visor pixel art y paneles de observación.
  cli/           Herramientas: generar, avanzar N días, exportar, comparar.
specs/           Especificaciones numeradas (SDD).
docs/            Visión, ADR, arquitectura, roadmap, despliegue, glosario.
tasks/           Planes de trabajo por hito, con casillas.
prototipo/       Prototipo HTML: referencia de comportamiento y visual (solo lectura).
scripts/         guardrails/ (hooks y verificaciones), prototipo/ (línea base), aprobar-spec.mjs.
.claude/         settings.json (hooks) y commands/ (comandos personalizados).
.githooks/       pre-commit y commit-msg (se activan con `git config core.hooksPath .githooks`).
.github/         CI y plantilla de PR.
```

Cada paquete, cada app y cada sistema del motor o de los generadores (`packages/engine/src/<sistema>/`, `packages/generators/src/<generador>/`) es un **módulo** con su `MODULE.md`. Las pruebas van junto al código (`src/<sistema>/<archivo>.test.ts`), para que cuenten como parte de ese módulo.

## 5. Flujo de trabajo SDD

1. Elegir la siguiente tarea en `tasks/` según `docs/roadmap.md` (el hook de inicio de sesión muestra cuál es).
2. Trabajar en una rama corta: `git switch -c m0/rng`.
3. Leer las specs que la tarea cita, el `MODULE.md` del módulo y su fila en `docs/prototipo-referencia.md`. Si hay ambigüedad, proponer cambio en la spec (*Preguntas abiertas*) y pedir aprobación antes de codificar. **Nunca cambies el `estado` de una spec sin la aprobación explícita del usuario en la conversación.** Con su "sí", lo ejecuta Claude con `node scripts/aprobar-spec.mjs` (decisión del usuario, 2026-09-24). Lo mismo vale para los demás pasos que antes eran manuales (fusionar PRs, etc.): Claude propone, el usuario aprueba y Claude ejecuta. Cuando un paso solo pueda hacerlo el usuario, dale instrucciones numeradas y concretas.
4. Si el módulo no existe, crear su `MODULE.md` desde `docs/modulos/_plantilla-MODULE.md` antes que cualquier código.
5. Escribir primero las pruebas de los criterios de aceptación (`CA-xxx`).
6. Implementar lo mínimo para que pasen.
7. Actualizar el `MODULE.md`: API pública, diseño, tabla de criterios, paridad y fila en la bitácora.
8. Ejecutar `pnpm check` (tipos, lint, pruebas y guardarraíles). Si cambia comportamiento de simulación (desde M2), `pnpm cli validate:parity`.
9. Actualizar la spec si la implementación reveló algo (con fila en su *Historial de cambios*).
10. Marcar la casilla en `tasks/`, hacer commit con los IDs de spec (`feat(engine): reloj global [002 CA-001..CA-004]`) y proponer el PR.

Comandos personalizados disponibles en `.claude/commands/`: `/nueva-spec`, `/implementar-spec`, `/sincronizar-docs`, `/paridad-prototipo`, `/revisar-causalidad`, `/prueba-un-anio`.

## 6. Convenciones

- **Idioma:** documentación y specs en español. Identificadores de código en inglés. Tipos de evento en `UPPER_SNAKE_CASE` en inglés (`JOB_LOST`). Textos visibles al usuario en español.
- **Tiempo:** el tiempo del mundo es un entero de minutos desde `world.epoch` (`WorldMinute`). Nada de fechas del sistema dentro del motor.
- **Identificadores:** estables y legibles: `CIT-000123`, `ORG-0012`, `PLC-0040`, `OBJ-001842`, `EVT-…` (spec 001).
- **Números:** valores psicológicos en `[0,1]` con `clamp`. Dinero en enteros (unidad mínima de la moneda del mundo). Nunca `float` para dinero.
- **Funciones del motor:** puras cuando sea posible: `(state, input, rng) => { patches, events }`.
- **Orden de iteración:** siempre por id ascendente o por orden de inserción documentado.
- **Tamaño:** archivos de menos de ~300 líneas; si crece, dividir por responsabilidad.

## 7. Definición de terminado

- Todas las pruebas de los `CA-xxx` implementados pasan.
- `pnpm check` en verde.
- Prueba de determinismo: dos ejecuciones con la misma semilla producen el mismo hash de estado (spec 023, CA-001).
- Sin nuevas dependencias no justificadas en el PR.
- `MODULE.md` de cada módulo tocado actualizado y guardarraíles en verde (`node scripts/guardrails/check.mjs`).
- Spec y `tasks/` actualizados.

## 8. Qué no hacer

- No introducir WordPress, ORMs pesados, colas externas (Redis, Kafka) ni contenedores en producción durante el MVP.
- No añadir un LLM para resolver algo que puede resolver una regla con parámetros.
- No generar estados "de fábrica" arbitrarios al consultar una persona: todo lo que se muestra debe salir del estado persistido o de eventos.
- No mezclar lógica en `apps/web`: la web solo lee.
- No desactivar, rodear ni editar los guardarraíles (`scripts/guardrails/`, `.claude/settings.json`, `.githooks/`) sin que el usuario lo pida expresamente. Si un guardarraíl bloquea, lee su mensaje, corrige la causa o pide al usuario la acción que indica.
- No copiar el código del prototipo tal cual: portar su comportamiento con tipos, eventos con causas y RNG por flujos.
- No optimizar antes de medir; pero sí medir memoria en cada hito (`pnpm bench`).

## 9. Referencia rápida de comandos (a crear en M0)

```
pnpm install
pnpm check              # typecheck + lint + test
pnpm test               # vitest
pnpm dev                # worker + api + web en local
pnpm cli world:new --seed 482917 --population 200
pnpm cli world:advance --days 30
pnpm cli citizen:report CIT-000042
pnpm bench              # memoria y ticks/s del motor
pnpm cli validate:parity   # (desde M2) comparación con la línea base del prototipo
node scripts/guardrails/check.mjs     # guardarraíles (también en hooks, pre-commit y CI)
node scripts/guardrails/indice.mjs    # regenerar specs/000-indice.md y docs/modulos.md
node scripts/aprobar-spec.mjs 012     # aprobar una spec (Claude, solo con el "sí" del usuario)
node scripts/prototipo/linea-base.mjs # regenerar la línea base del prototipo
```

## 10. Guardarraíles (qué te bloqueará y por qué)

| Momento | Qué comprueba | Si falla |
|---|---|---|
| Al abrir sesión | — | Inyecta el estado: specs por estado, módulos, siguiente tarea |
| Antes de editar un archivo | Código de módulo: existe su `MODULE.md` y todas sus specs están `aprobada`/`implementada`. No se tocan `docs/vision/`, `prototipo/` ni `.env` | La edición se bloquea con el motivo |
| Antes de un comando Bash | Sin `--no-verify`, sin push forzado, sin `reset --hard`, sin escribir código o referencias por terminal | El comando se bloquea |
| Al terminar tu turno | Código de módulo cambiado → su `MODULE.md` cambiado con fila nueva en la bitácora. Spec aprobada cambiada → fila en su historial. Motor sin APIs no deterministas. Índices regenerados | No puedes terminar hasta corregirlo |
| Commit | Lo mismo + `pnpm check` + formato de mensaje con spec | El commit se rechaza |
| CI / PR | Lo mismo contra `main` + determinismo | El PR no se fusiona |

Excepción puntual del determinismo: una línea con el comentario `// determinismo-permitido: <motivo>`, solo si el usuario lo aprueba y dentro de pruebas o utilidades de depuración.
