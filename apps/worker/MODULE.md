---
modulo: worker
ruta: apps/worker
estado: en-desarrollo
specs: [002, 027, 021]
actualizado: 2026-09-24
---

# Módulo: worker

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Proceso que carga el mundo, lo avanza a la velocidad configurada, atiende órdenes de control y persiste por lotes. Añadirá 021 al integrar los niveles de simulación.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 002 | R-002, R-003 y R-008 en proceso real (velocidad → ticks con el tiempo medido aquí) | `effectiveSpeed` de la R-003 (informar si la CPU no alcanza la velocidad) |
| 027 | CA-003 con SIGTERM (R-007, prueba solo en Linux/CI), CA-009 y CA-010, R-001 (cerrojo), R-002 (flush cada `FLUSH_TICKS` y al cambiar el control), R-004 (instantánea diaria), R-013 (viajes anotados tick a tick), R-014 (flush por tiempo real) y R-015 (avance sin observar) | — (los CA de almacenamiento están en `packages/persistence`) |


## 3. API pública
- Proceso: `pnpm worker [--db data/world.db] [--speed 0|1|10|100|1000]` (`src/main.ts`).
- `WorldWorker` (`src/worker.ts`, exportado desde `src/index.ts`):
  - `new WorldWorker(path, { speed?, clock? })`: abre y migra la base, toma el cerrojo de escritor, carga el mundo (verifica el hash), activa la anotación de viajes y hace un primer flush. `clock` mide los tramos de un avance sin observar (`main.ts` pasa `performance.now`).
  - `pump(elapsedMs)`: una vuelta del bucle; devuelve `{ ticks, stop }`.
  - `shutdown(reason)`: devuelve `{ minute, hash }`.
  - Propiedades: `world`, `runner`, `repo`, `session`, `db`, `advance` (el avance sin observar en curso o `null`).

## 4. Diseño interno y decisiones
- **El reloj solo se lee en `main.ts`.** Cada 100 ms mide el tiempo con `performance.now()` y pasa los milisegundos enteros a `pump`, guardando la fracción sobrante. `WorldWorker` no lee el reloj, así que las pruebas le pasan el tiempo que quieren.
- **`pump`:**
  1. Aplica las órdenes pendientes en orden de id: `pause`, `resume`, `speed N`, `step`, `stop` y `advance N` (1 día, semana, mes o año; otro valor se rechaza). Una orden que el motor rechaza queda con `done = -1` y el mundo no cambia.
  2. Si alguna orden se aplicó, hace flush enseguida. Esto cubre el "o al pausar" de la R-002.
  3. Reparte el tiempo real en trozos del tiempo de un tick: cada trozo da como mucho un tick. Tras cada tick, la sesión anota los viajes que empiezan (027 R-013). El resultado es el mismo que con trozos mayores y el hash no cambia (CA-009). `stop` corta la vuelta sin avanzar.
  4. Flush cada `FLUSH_TICKS` ticks (en la sesión) y también si pasan `FLUSH_MS` (2 s) de tiempo real con ticks sin guardar (R-014). Así el visor ve el mundo con pocos segundos de retraso a cualquier velocidad.
- **Avance sin observar (R-015).**
  - Mientras dura, cada `pump` avanza el mundo tick a tick durante `ADVANCE_SLICE_MS` (250 ms del reloj inyectado), sin anotar viajes, y hace flush. `main.ts` no espera entre vueltas.
  - Guarda el inicio y el destino en `meta.advance`; al llegar, hace un punto de control y lo borra. La velocidad no cambia.
  - Una pausa lo interrumpe, y al arrancar se borra uno que quedara a medias.
- **Al arrancar**, un mundo `created` se reanuda (spec 001 R-006) y uno en pausa sigue en pausa. `--speed` se aplica como entrada externa si difiere de 1x.
- **Cierre** (R-007), con SIGTERM, SIGINT o la orden `stop`, en este orden:
  1. entrada `close`, que emite `WORLD_CLOSED` con el hash previo;
  2. flush;
  3. instantánea;
  4. liberar el cerrojo;
  5. `wal_checkpoint(TRUNCATE)` y cerrar.
- El flush y las instantáneas los decide `WorldSession` (persistence), compartida con `world:advance`.

## 5. Invariantes y guardarraíles
Apagado limpio con SIGTERM. Un worker por mundo (cerrojo `meta.writer_pid`; un segundo proceso vivo no arranca).

## 6. Cómo se prueba
`src/worker.test.ts` (9 pruebas, 1 solo en Linux):
- **Avance:** tiempo real × velocidad → ticks; flush cada `FLUSH_TICKS` ticks o cada `FLUSH_MS` con ticks pendientes; una instantánea por día.
- **`src/moves.test.ts` (4 pruebas):** CA-009 (cada viaje de un día anotado una vez, sin solaparse, y el mismo hash que sin anotarlos), R-014, CA-010 (avance de un día exacto, con progreso y sin cambiar la velocidad) y la pausa que interrumpe un avance.
- **Órdenes de control:** pausa, orden inválida rechazada, paso, velocidad, reanudar; `stop` y el hash de `WORLD_CLOSED`.
- **Escritor y reinicio:** cerrojo con otro proceso vivo; reinicio en el mismo minuto y estado.
- **Como proceso:** parada limpia con la orden `stop` y, en Linux, con SIGTERM. En Windows las señales no llegan a los manejadores y `kill` termina el proceso en seco, caso que ya cubre la CA-003 de persistence.

## 7. Paridad con el prototipo
Equivale al bucle `requestAnimationFrame` + `tick` del prototipo.

## 8. Pendientes y deuda
- [ ] `effectiveSpeed` (002 R-003): si la CPU no alcanza la velocidad, informar de ella en lugar de acumular retraso.
- [ ] Avisar a la API tras cada flush (arquitectura, paso 6), cuando exista la API (M5).
- [ ] `apps/worker/dist/main.js` para el despliegue (docs/despliegue-clouding.md): hoy Node 24 ejecuta el `.ts` directamente.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-23 | kit de arranque | — | Documento creado (sin código) |
| 2026-09-23 | m0/a-tooling (A5) | — | Esqueleto del paquete: `package.json` (workspace, ESM, `exports` → `src/index.ts`) y `src/index.ts` vacío. Sin API todavía |
| 2026-09-24 | m0/e-cli-worker (E2) | 002, 027 | `WorldWorker` (arranque, `pump` con órdenes de control y flush por lotes, cierre con `WORLD_CLOSED`) y `main.ts` (bucle de 100 ms, SIGTERM/SIGINT). Script `pnpm worker`. 9 pruebas |
| 2026-09-24 | chore/renombrar-datas-world-2 | — | Renombrado de los paquetes `@mundo-social/*` → `@datas-world/*` (imports y `package.json`). Sin cambios de comportamiento |
| 2026-09-24 | chore/nombre-datas-world | — | El nombre del mundo en las configuraciones de prueba y por defecto pasa de "Villa Cordillera" a "Data's World" (decisión del usuario). Sin cambios de comportamiento |
| 2026-09-24 | m1/hash-puntos-control | 027 | Una orden de control aplicada (pausa, velocidad…) hace un flush con punto de control (027 R-012). El cierre ya guardaba instantánea, que también lo es |
| 2026-09-25 | m2/h-cierre | 021 | El worker avanza con la vida diaria (`lifeRunner` de los generadores, que pasan a ser dependencia del worker); un mundo de M1 solo avanza el reloj |
| 2026-09-27 | charla/l3-mundo (L3) | 043 | Atiende las órdenes `chat_open` y `chat_session` (payload JSON) como entradas externas del Runner, que el replay reproduce. 1 prueba nueva |
| 2026-09-29 | m4/observacion (paridad, P1) | 027, 022 | Viajes anotados tick a tick para el visor (el tiempo real se reparte en trozos de un tick; `session.trackMoves`), flush también cada `FLUSH_MS` de tiempo real con ticks pendientes y orden `advance` (avance sin observar en tramos de `ADVANCE_SLICE_MS`, con `meta.advance`; una pausa lo interrumpe). `WorkerOptions.clock` para medir los tramos; `main.ts` no espera entre vueltas durante un avance. 4 pruebas nuevas (`moves.test.ts`, CA-009 y CA-010); la de lotes se adapta al flush por tiempo |
