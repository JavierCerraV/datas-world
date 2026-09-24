# M0 — Arranque

Specs: 001, 002, 014, 023, 027 (el usuario las aprueba con `node scripts/aprobar-spec.mjs` antes de empezar).
Resultado esperado: repositorio en GitHub con guardarraíles activos y CI verde; un mundo vacío que avanza un año de forma determinista y se guarda en SQLite; cada módulo tocado con su `MODULE.md` al día.

Cada bloque se hace en una rama (`m0/a-tooling`, `m0/b-rng`…) y termina con un PR.

## Bloque 0 — Verificación del entorno (lo hace el usuario con ayuda de Claude)
- [x] 0.1 Repositorio creado y subido (`gh repo create mundo-social --private --source=. --push`) y `git config core.hooksPath .githooks` ejecutado.
- [x] 0.2 Claude Code abierto en la carpeta, carpeta marcada como de confianza; `/hooks` muestra SessionStart, PreToolUse y Stop.
- [x] 0.3 Prueba de guardarraíles: pedir a Claude que cree `packages/engine/src/tmp.ts` con una spec sin aprobar debe bloquearse; tras aprobar las de M0, debe permitirse y el hook Stop debe exigir la bitácora en `packages/engine/MODULE.md`. Borrar el archivo de prueba.
- [x] 0.4 Primera CI en verde en GitHub Actions.

## Bloque A — Repositorio y herramientas
- [x] A1. `pnpm init` en la raíz, `pnpm-workspace.yaml` con `packages/*` y `apps/*`, `packageManager` fijado, `.nvmrc` = 24. Script `"prepare": "git config core.hooksPath .githooks"` para que los git hooks se activen al instalar.
- [x] A2. TypeScript estricto compartido (`tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `module: NodeNext`).
- [x] A3. ESLint (flat config) + Prettier. Regla que prohíbe `Math.random`, `Date`, `performance`, `crypto.randomUUID` y módulos `fs`/`net`/`http` en `packages/engine` (spec 023 R-001).
- [x] A4. Vitest configurado en workspaces, con las pruebas junto al código (`src/**/*.test.ts`). Scripts: `pnpm test`, `pnpm check` (typecheck + lint + test + `node scripts/guardrails/check.mjs`), `pnpm test:determinism` (usado por la CI).
- [x] A5. Esqueleto de paquetes con `package.json` y `src/index.ts` junto a los `MODULE.md` ya existentes: `engine`, `generators`, `persistence`, `apps/worker`, `apps/api`, `apps/web`, `apps/cli` (llm-gateway queda solo con su MODULE.md hasta M6). Cada `MODULE.md` tocado pasa a `estado: en-desarrollo` y recibe su fila en la bitácora.
- [x] A6. Verificar que `.github/workflows/ci.yml` (ya incluido) ejecuta todos los pasos una vez que existe `pnpm-lock.yaml`.
- [x] A7. `.editorconfig` y licencia (preguntar al usuario). El `.gitignore` ya existe. → Sin licencia (UNLICENSED, todos los derechos reservados), decidido por el usuario.

## Bloque B — Azar reproducible (spec 023)
- [ ] B0. Leer `class RNG` y `sm32` del prototipo; decidir con el usuario si se mantiene splitmix32 o se pasa a PCG32/xoshiro (registrar la decisión en la spec 023 y en `packages/engine/MODULE.md`).
- [ ] B1. Pruebas CA-003 (fork estable) y distribución básica (media de `next()` ≈ 0,5; `int` sin sesgo).
- [ ] B2. Implementar `Rng` (PCG32 o xoshiro128**) con `fork`, `int`, `chance`, `pick`, `weighted`, `normal`, `state/restore`.
- [ ] B3. Prueba CA-005: el linter falla con `Math.random` en engine (fixture).

## Bloque C — Mundo y reloj (specs 001, 002)
- [ ] C1. Tipos `WorldMinute`, `EntityId`, `WorldConfig`, `World`; generador de ids (CA-002 de 001).
- [ ] C2. Calendario `toCalendar(minute, epoch)` con festivos (CA-001 de 002).
- [ ] C3. Scheduler (cola de prioridad por `(at, id)`) (CA-003 de 002).
- [ ] C4. Serialización canónica y `stateHash` (CA-001, CA-003 de 001).
- [ ] C5. Tipo `WorldEvent` y catálogo mínimo de eventos (spec 014: `WORLD_CREATED`, `DAY_STARTED`, `SPEED_CHANGED`, `EXTERNAL_INPUT_APPLIED`).
- [ ] C5b. `tick(world, rng)` mínimo: avanza reloj, emite `DAY_STARTED`, procesa scheduler.
- [ ] C6. Velocidad y controles (pausa, paso, avanzar N días) en una clase `Runner` que no depende del reloj real salvo en el worker (CA-002, CA-004 de 002).

## Bloque D — Persistencia (spec 027)
- [ ] D1. Esquema SQLite y migración 001; pragmas WAL.
- [ ] D2. Repositorio: guardar/cargar mundo, añadir eventos por lote, instantánea comprimida.
- [ ] D3. CA-001 (guardar, cerrar, cargar, continuar = mismo hash) y CA-003 (SIGTERM).

## Bloque E — CLI y worker mínimos
- [ ] E1. `pnpm cli world:new --seed N`, `world:advance --days N`, `world:info`.
- [ ] E2. `apps/worker` que carga el mundo, avanza a la velocidad configurada, atiende `control_commands` y hace flush.
- [ ] E3. `pnpm bench`: ticks/s y RSS para un mundo vacío durante 365 días (CA-005 de 002).

## Cierre de M0
- [ ] Prueba de determinismo en CI (dos procesos, mismo hash).
- [ ] `/sincronizar-docs all` sin discrepancias.
- [ ] Proponer al usuario pasar 001, 002, 014, 023 y 027 a `implementada` (lo hace él con `node scripts/aprobar-spec.mjs --estado implementada …`) si todos sus CA están cubiertos. Si no, listar los CA pendientes en cada `MODULE.md`.
- [ ] Nota breve en `docs/validaciones/` con los números del bench.
- [ ] Revisar y aprobar las specs de M1 antes de crear `tasks/M1-mundo-estatico.md` (pedir a Claude Code que la redacte).
