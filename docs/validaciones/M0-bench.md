# M0: bench y determinismo de un mundo vacío

Fecha: 2026-09-24 · Rama: `m0/cierre` · Motor `0.1.0` (`ENGINE_VERSION`)
Máquina: AMD Ryzen 7 5700G (16 hilos), 15 GB, Windows 11 Pro, Node 24.18.0, SQLite 3.53.4 (better-sqlite3 13.0.3)

Mundo: semilla 482917, epoch `2027-01-04T00:00`, tick de 5 min, capacidad `clock`, sin población.

## Rendimiento (`pnpm bench`, 365 días = 105 120 ticks)

| Modo | Tiempo | ticks/s | RSS | Heap | Base en disco | 002 CA-005 (< 2 s, 365 `DAY_STARTED`) |
|---|---|---|---|---|---|---|
| Solo el motor | 22 ms | ≈ 4,8 millones | 61 MB | 12 MB | — | ✔ |
| Motor + SQLite (flush cada 12 ticks, instantánea diaria) | 948 ms | ≈ 111 000 | 74 MB | 11 MB | 0,3 MB | ✔ |

- RSS máximo del proceso: 74 MB, frente a un presupuesto de 1 GB de RAM (CLAUDE.md regla 8). La base de un año vacío ocupa 312 KiB, con 366 instantáneas y 366 eventos.
- `world:advance --days 365` desde la CLI tarda 1,3 s, contando el arranque de Node.
- **Regresión evitada.** Antes de preparar las sentencias SQL una sola vez, el camino con SQLite tardaba 2,6 s y llegaba a **483 MB** de RSS: las 8 760 sentencias preparadas por flush quedaban esperando al recolector. Ver `packages/persistence/MODULE.md`.
- En el servidor previsto (medio vCore) se espera que los tiempos sean varias veces mayores. Hay que repetir la medición allí antes de publicar.

## Determinismo

| Comprobación | Resultado |
|---|---|
| Hash tras 30 días | `09f1c8e9f52784e9` |
| Hash tras 365 días | `48d31b21a2b0d78f` |
| 30 + 335 días en dos ejecuciones de la CLI = 365 seguidos | ✔ mismo hash |
| Dos procesos con la misma semilla, 30 días (023 CA-001, `apps/cli/src/cli.test.ts`) | ✔ mismo hash, también en la CI (Ubuntu) |
| Guardar, cerrar, cargar y continuar (027 CA-001) | ✔ |
| Muerte abrupta y continuación (027 CA-003) | ✔ mismo hash y mismos eventos que sin interrupción |
| 1x frente a 1000x, 7 días (002 CA-002) | ✔ |

Límite: todo esto es con un mundo **vacío**. La 023 CA-001 pide 100 personas y se completará en M1, cuando haya generación de población. Los números de memoria de esta nota son la línea base para comparar en cada hito.
