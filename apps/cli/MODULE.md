---
modulo: cli
ruta: apps/cli
estado: en-desarrollo
specs: [001, 002, 009, 023, 027, 029, 030]
actualizado: 2026-09-24
---

# Módulo: cli

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Herramientas de línea de comandos: crear mundo, avanzar N días, informes, exportación, comparación de semillas, bench.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 001 | CA-005: semillas distintas, hashes distintos tras la generación (`m1.test.ts`) | — |
| 002 | CA-005 desde la CLI: 365 `DAY_STARTED` en `cli.test.ts`; el límite de < 2 s, con `pnpm bench --check` en un paso propio de la CI | — |
| 023 | CA-001 entre dos procesos, con un mundo de 100 personas y 30 días | CA-002 (necesita la vida diaria de M2) |
| 027 | CA-001 y CA-006 con población: guardar y cargar da el hash generado; R-011: mundo de ejemplo `docs/validaciones/mundos/m1-482917.db` que se carga y avanza | — |
| 029 | CA-003 (`world:info` lista las cifras por confirmar); §9: `world:report` frente al perfil | — |
| 030 | CA-003 (`citizen:report` con padres y abuelos), CA-006 (`world:history --from 1948 --to 1958`), CA-007 (`bench --check`: `world:new` < 5 s y base < 2 MB) | — |


## 3. API pública
Desde la raíz, `pnpm cli <comando>` (`src/main.ts`). Base por defecto: `data/world.db` (en `.gitignore`).

| Comando | Qué hace |
|---|---|
| `world:new --seed N [--profile CO-2026.09\|prototipo] [--population N] [--name T] [--epoch AAAA-MM-DDT00:00] [--tick MIN] [--empty] [--db RUTA]` | Genera el mundo de M1 completo con `generateWorld` (perfil, catálogos, festivos de 10 años, epoch 2026-01-01, historia desde 1900) y lo guarda con sus eventos y su primera instantánea. `--population` sustituye al objetivo del perfil. `--empty` crea el mundo vacío de M0 (solo reloj), para las pruebas y el bench del tiempo. No pisa un mundo existente |
| `world:report [--history] [--json] [--db RUTA]` | Población, hogares y empleo frente al perfil (mundo, perfil, desviación, estado de la cifra) y las cifras `por_confirmar`. `--history`: nacimientos, muertes, edad media al morir, migraciones y fundaciones por década (030 §9) |
| `world:map [--db RUTA]` | El mapa en texto: `·` calle, `"` parque, `v` vivienda, una letra por lugar con su leyenda y los barrios con su estrato |
| `world:history [--from AAAA] [--to AAAA] [--type T,…] [--citizen CIT] [--place PLC\|ORG] [--limit N] [--no-causes] [--db RUTA]` | Eventos del registro en orden cronológico, con nombres en lugar de ids y sus causas (el nombre del hecho histórico, el evento causante o el estado) |
| `citizen:report CIT [--db RUTA]` | Ficha (nacimiento, lugar, hogar, ocupación), familia (padres, abuelos, bisabuelos si los hay, hijos; "desconocido" si faltan) y línea de vida |
| `world:advance --days N [--db RUTA]` | Toma el cerrojo de escritor (falla si el worker está en marcha), avanza con `WorldSession` (flush cada `FLUSH_TICKS`, instantánea diaria) y muestra el progreso cada 5 % por stderr |
| `world:info [--json] [--db RUTA]` | Abre en solo lectura; carga el mundo (verifica el hash) y muestra fecha, estado, capacidades, eventos, instantáneas, hash, tamaño y escritor |
| `control pause\|resume\|step\|stop\|speed <v> [--db RUTA]` | Encola una orden en `control_commands` para el worker. En M0 solo la CLI encola órdenes (decisión del usuario) |
| `bench [--days N] [--json] [--check]` | También `pnpm bench`. Ticks/s y memoria de un mundo vacío, solo con el motor y con el motor + SQLite, y tiempo y tamaño de `world:new` con el mundo de M1. Con `--check` (solo con 365 días) termina con código 1 si no se cumple la 002 CA-005 o la 030 CA-007 |

Código de salida: 0 bien, 1 error de ejecución, 2 uso incorrecto. Desde `src/index.ts`, para pruebas y reutilización: `run(argv, io)` con `io = { out, err, now }`, `bench(args, io)`, `DEFAULT_DB`, `USAGE` y el tipo `Io`.

## 4. Diseño interno y decisiones
- Sin dependencias: argumentos con `node:util` `parseArgs` (estricto: una opción desconocida es error de uso).
- `run` no toca `process`: recibe la salida y la marca de tiempo real (`now`, solo para `created_at` de las órdenes). `main.ts` conecta `run` con el proceso.
- `world:new` valida la configuración (`createWorld`) antes de crear nada en disco.
- Avanzar 10 + 5 días da el mismo hash que 15 seguidos: `world:advance` no emite eventos propios (no hay `WORLD_CLOSED`, que es del worker).
- Las consultas (`world:report`, `world:map`, `world:history`, `citizen:report`) abren la base en solo lectura y todo sale del estado guardado y del registro de eventos (030 R-008, CLAUDE.md §8). Los ids se cambian por nombres solo al mostrar.
- Un archivo por comando o grupo: `commands.ts` (despacho, `world:advance`, `world:info`, `control`), `world-new.ts`, `report.ts`, `map.ts`, `history.ts`; utilidades en `common.ts`.

### Mundo de M1 (I, 2026-09-24, semilla 482917)
`world:new` genera 199 personas, 1 106 antepasados y 3 363 eventos en ≈ 0,25 s; la base ocupa 1,75 MB. Avanzar 30 días tarda ≈ 2,4 s, con el hash solo en los puntos de control (027 R-012); antes eran 12 s.

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
- 023 CA-001: dos procesos `node main.ts` con un mundo de 100 personas y la misma semilla dan el mismo hash tras 30 días, y el mismo que en el proceso de la prueba. Lleva "determinismo" en el nombre, así que también la corre `pnpm test:determinism` en la CI.

`src/m1.test.ts` (11 pruebas, un mundo de M1 compartido):
- `world:new`: hash guardado = hash generado; semillas distintas; perfil prototipo y perfil desconocido;
- `world:report`: desviaciones pequeñas y cifras por confirmar; `--history`;
- `world:map`: 40 filas de 64 columnas, barrios y leyenda;
- `world:history`: 030 CA-006 y filtros; nombres en lugar de ids;
- `citizen:report`: 030 CA-003 para todas las personas vivas; errores de uso;
- el mundo de ejemplo se carga y avanza (027 R-011).

## 7. Paridad con el prototipo
Sustituye a los scripts headless usados para calibrar el prototipo.

## 8. Pendientes y deuda
- [ ] Exportar, comparar semillas y `validate:parity` (M1–M2).
- [ ] 023 CA-002 completo (el 50 % de las personas con un evento distinto el día 30) necesita la vida diaria de M2. Hoy solo se comprueba que el hash difiere (001 CA-005).

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
| 2026-09-24 | m1/i-cli (I1–I5) | 001, 023, 027, 029, 030 | `world:new` genera el mundo de M1 completo con `generateWorld` (perfil, catálogos, festivos, epoch 2026-01-01; `--profile`, `--empty` para el mundo vacío de M0); comandos `world:report` (con `--history`), `world:map`, `world:history` y `citizen:report`; `world:info` cuenta antepasados, hogares, lugares, organizaciones y objetos; `bench` mide `world:new` (030 CA-007). El código se divide en `common.ts`, `world-new.ts`, `report.ts`, `map.ts` e `history.ts`; `main.ts` termina sin error si se corta la salida. 11 pruebas nuevas en `m1.test.ts`; 023 CA-001 pasa a un mundo de 100 personas |
| 2026-09-24 | m1/cierre | 029 | `world:info` lista las cifras del perfil por confirmar (`pending` en `--json`), como pide la 029 CA-003 |
| 2026-09-24 | m1/j-dotacion | 033 | `world:map` lista los lugares de la ciudad de referencia (fuera del mapa), con el tiempo y el coste del viaje. Las pruebas pasan al mapa de 80 × 50 |
| 2026-09-25 | m1/j-salud | 030 | `bench` mide la 030 CA-007 como dice la spec, "lo que añade la historia": bytes de los eventos de la 030, de sus participantes y de los antepasados (≈ 0,79 MB). Antes medía la base entera, que ahora incluye las fichas de salud (1,93 MB). Muestra ambos |
| 2026-09-25 | m1/j-ocio (J6) | 031, 032, 033 | `ficha.ts`: `citizen:report` muestra la ficha de salud (afiliación, peso, hábitos, discapacidad, condiciones, salud física) y la de esparcimiento (afinidad y veces al mes; "le gusta, pero hoy no le alcanzan el dinero o el tiempo" si es 0). `world:report --health`, `--leisure` (práctica frente a la popularidad del perfil) y `--places` (dotación esperada frente a generada y lugares de La Capital). 1 prueba nueva y 1 ampliada |
| 2026-09-25 | mf/1-temperamento (MF1.7) | 009 v1.0 | `citizen:report` muestra el temperamento (descriptores Big Five y parámetros `tmp.*`) con la advertencia de que describe cómo aprende y no explica la conducta (`temperamentLines` en `ficha.ts`) |
