---
modulo: cli
ruta: apps/cli
estado: en-desarrollo
specs: [001, 002, 027]
actualizado: 2026-09-24
---

# Módulo: cli

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Herramientas de línea de comandos: crear mundo, avanzar N días, informes, exportación, comparación de semillas, bench.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 001 | — (crea el mundo con `createWorld`; los CA se prueban en el motor) | CA-005 (generación de población, M1) |
| 002 | CA-005 desde la CLI: 365 `DAY_STARTED` en `cli.test.ts`; el límite de < 2 s, con `pnpm bench --check` en un paso propio de la CI | — |
| 023 | CA-001 entre dos procesos, con un mundo vacío | CA-001 con 100 personas (M1) |
| 027 | — (usa persistence; sus CA se prueban allí) | — |


## 3. API pública
Desde la raíz, `pnpm cli <comando>` (`src/main.ts`). Base por defecto: `data/world.db` (en `.gitignore`).

| Comando | Qué hace |
|---|---|
| `world:new --seed N [--population N] [--name T] [--epoch AAAA-MM-DDT00:00] [--tick MIN] [--db RUTA]` | Crea la carpeta y la base, el mundo (capacidad `clock`, motor `ENGINE_VERSION`) y su primera instantánea. No pisa un mundo existente |
| `world:advance --days N [--db RUTA]` | Toma el cerrojo de escritor (falla si el worker está en marcha), avanza con `WorldSession` (flush cada `FLUSH_TICKS`, instantánea diaria) y muestra el progreso cada 5 % por stderr |
| `world:info [--json] [--db RUTA]` | Abre en solo lectura; carga el mundo (verifica el hash) y muestra fecha, estado, capacidades, eventos, instantáneas, hash, tamaño y escritor |
| `control pause\|resume\|step\|stop\|speed <v> [--db RUTA]` | Encola una orden en `control_commands` para el worker. En M0 solo la CLI encola órdenes (decisión del usuario) |
| `bench [--days N] [--json] [--check]` | También `pnpm bench`. Ticks/s y memoria de un mundo vacío, solo con el motor y con el motor + SQLite. Con `--check` (solo con 365 días) termina con código 1 si no se cumple la 002 CA-005 |

Código de salida: 0 bien, 1 error de ejecución, 2 uso incorrecto. Desde `src/index.ts`, para pruebas y reutilización: `run(argv, io)` con `io = { out, err, now }`, `bench(args, io)`, `DEFAULT_DB`, `USAGE` y el tipo `Io`.

## 4. Diseño interno y decisiones
- Sin dependencias: argumentos con `node:util` `parseArgs` (estricto: una opción desconocida es error de uso).
- `run` no toca `process`: recibe la salida y la marca de tiempo real (`now`, solo para `created_at` de las órdenes). `main.ts` conecta `run` con el proceso.
- `world:new` valida la configuración (`createWorld`) antes de crear nada en disco.
- Avanzar 10 + 5 días da el mismo hash que 15 seguidos: `world:advance` no emite eventos propios (no hay `WORLD_CLOSED`, que es del worker).

### Bench (E3, 2026-09-24, Windows 11, Node 24.18)
| Modo | 365 días (105 120 ticks) | ticks/s | RSS | Base |
|---|---|---|---|---|
| Motor | 21 ms | ≈ 5 millones | 62 MB | — |
| Motor + SQLite | 942 ms | ≈ 112 000 | 74 MB (pico 75 MB) | 0,3 MB |

## 5. Invariantes y guardarraíles
No contiene reglas de simulación.

## 6. Cómo se prueba
`src/cli.test.ts` (9 pruebas):
- `world:new`: creación y protección contra pisar un mundo; opciones inválidas; ayuda.
- `world:advance`:
  - 002 CA-005: 365 `DAY_STARTED` (el tiempo lo mide `pnpm bench --check`);
  - 10 + 5 días = 15 días;
  - rechazo con otro escritor vivo.
- `control`: órdenes válidas e inválidas.
- 023 CA-001: dos procesos `node main.ts` con la misma semilla dan el mismo hash tras 30 días, y el mismo que en el proceso de la prueba. Lleva "determinismo" en el nombre, así que también la corre `pnpm test:determinism` en la CI.

## 7. Paridad con el prototipo
Sustituye a los scripts headless usados para calibrar el prototipo.

## 8. Pendientes y deuda
- [ ] `citizen:report`, exportar, comparar semillas y `validate:parity` (M1–M2).
- [ ] `world:new` con población (spec 007, M1).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-23 | kit de arranque | — | Documento creado (sin código) |
| 2026-09-23 | m0/a-tooling (A5) | — | Esqueleto del paquete: `package.json` (workspace, ESM, `exports` → `src/index.ts`) y `src/index.ts` vacío. Sin API todavía |
| 2026-09-24 | m0/e-cli-worker (E1, E3) | 002, 023, 027 | Comandos `world:new`, `world:advance`, `world:info`, `control` y `bench`; scripts `pnpm cli` y `pnpm bench`. 9 pruebas |
| 2026-09-24 | m0/cierre (sincronizar-docs) | 023 | Solo documentación: exportaciones de `index.ts` completas; 023 CA-001 marcada como parcial (mundo vacío) |
| 2026-09-24 | chore/renombrar-datas-world-2 | — | Renombrado de los paquetes `@mundo-social/*` → `@datas-world/*` (imports y `package.json`). Sin cambios de comportamiento |
| 2026-09-24 | fix/bench-ci | 002 | La medición de < 2 s de la 002 CA-005 sale de `cli.test.ts` (falso fallo de 2,08 s en la CI, con 15 archivos en paralelo) y pasa a `pnpm bench --check`, en un paso propio de la CI. 1 prueba nueva |
| 2026-09-24 | chore/nombre-datas-world | — | El nombre del mundo en las configuraciones de prueba y por defecto pasa de "Villa Cordillera" a "Data's World" (decisión del usuario). Sin cambios de comportamiento |
