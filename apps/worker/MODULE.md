---
modulo: worker
ruta: apps/worker
estado: en-desarrollo
specs: [002, 027]
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
| 027 | CA-003 con SIGTERM (R-007, prueba solo en Linux/CI), R-001 (cerrojo), R-002 (flush cada `FLUSH_TICKS` y al cambiar el control), R-004 (instantánea diaria) | — (los CA de almacenamiento están en `packages/persistence`) |


## 3. API pública
- Proceso: `pnpm worker [--db data/world.db] [--speed 0|1|10|100|1000]` (`src/main.ts`).
- `WorldWorker` (`src/worker.ts`, exportado desde `src/index.ts`):
  - `new WorldWorker(path, { speed? })`: abre y migra la base, toma el cerrojo de escritor, carga el mundo (verifica el hash) y hace un primer flush.
  - `pump(elapsedMs)`: una vuelta del bucle; devuelve `{ ticks, stop }`.
  - `shutdown(reason)`: devuelve `{ minute, hash }`.
  - Propiedades: `world`, `runner`, `repo`, `session`, `db`.

## 4. Diseño interno y decisiones
- **El reloj solo se lee en `main.ts`.** Cada 100 ms mide el tiempo con `performance.now()` y pasa los milisegundos enteros a `pump`, guardando la fracción sobrante. `WorldWorker` no lee el reloj, así que las pruebas le pasan el tiempo que quieren.
- **`pump`:**
  1. Aplica las órdenes pendientes en orden de id: `pause`, `resume`, `speed N`, `step`, `stop`. Una orden que el motor rechaza queda con `done = -1` y el mundo no cambia.
  2. Si alguna orden se aplicó, hace flush enseguida. Esto cubre el "o al pausar" de la R-002.
  3. Reparte el tiempo real en trozos de como mucho `FLUSH_TICKS` ticks para hacer flush cada `FLUSH_TICKS` también a 1000x. `stop` corta la vuelta sin avanzar.
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
- **Avance:** tiempo real × velocidad → ticks; lo persistido nunca va más de un lote por detrás; una instantánea por día.
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
