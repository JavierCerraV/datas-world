# Arquitectura

## Vista general

```
                    ┌──────────────────────────── Servidor Clouding (1 GB / ½ vCore) ─────────────┐
                    │                                                                             │
 Navegador ──HTTPS──┤ Caddy ──► apps/api (Fastify, solo lectura + controles) ──► SQLite (WAL)     │
 (apps/web,         │              │  ▲ SSE (eventos en vivo)                     ▲              │
  Canvas 2D)        │              │  └──────────────── notificaciones ───────────┤              │
                    │              └── órdenes de tiempo (pausa, velocidad) ──►  apps/worker     │
                    │                                                           (packages/engine)│
                    └─────────────────────────────────────────────────────────────────────────────┘
                                   backups (.backup + rclone) ──► almacenamiento externo
```

## Paquetes

| Paquete | Responsabilidad | Depende de |
|---|---|---|
| `packages/engine` | Tipos del dominio, RNG, reloj, scheduler, sistemas (necesidades, decisiones, relaciones, memoria, economía…), validación de acciones, generación de eventos. **Puro: sin E/S.** | — |
| `packages/generators` | Crear mundo, geografía, lugares, organizaciones, población y hogares a partir de semilla y parámetros. | engine |
| `packages/persistence` | Esquema SQLite, migraciones, repositorios, escritura por lotes del event log, instantáneas, retención. | engine |
| `packages/llm-gateway` | (M6) Proveedores LLM, caché, presupuesto, validación de propuestas. | engine |
| `apps/worker` | Bucle de simulación: carga mundo, avanza ticks según la velocidad, persiste en lotes, emite notificaciones. **Uno por mundo.** | engine, persistence |
| `apps/api` | HTTP de consulta (mundo, personas, eventos, historia) y SSE; recibe órdenes de control y las pasa al worker. | persistence |
| `apps/web` | Visor pixel art y paneles (inspector, registro, línea temporal). Solo lee. | API |
| `apps/cli` | Generar mundos, avanzar N días sin UI, exportar CSV/JSON, comparar semillas, informes de vida. | todos |

## Flujo de un tick

1. `Clock.advance()` → nuevo `WorldMinute`.
2. `Scheduler.popDue(now)` → eventos programados que vencen.
3. Por cada persona en orden de id, según su nivel de simulación:
   `needs.update` → `decision.choose` (produce `ActionRequest`) → `actions.validate` → `actions.apply` (produce `Patch[]` + `WorldEvent[]`).
4. Sistemas globales: interacciones en lugares compartidos, economía, propagación de información, decaimiento de memoria.
5. Se aplican los parches al estado y los eventos se añaden al buffer.
6. Cada N ticks (o al pausar) el worker vuelca el buffer a SQLite en una transacción y notifica a la API.

## Comunicación worker ↔ API

- Base de datos compartida (SQLite WAL permite un escritor y varios lectores).
- Órdenes de control (pausa, velocidad, paso) mediante una tabla `control_commands` que el worker consulta cada ciclo; así no se necesita ningún bus ni cola externa.
- Notificaciones en vivo: la API consulta `events` por `id > último` cada ~500 ms y los reenvía por SSE (suficiente para el MVP).

## Estado en memoria vs disco

- El worker mantiene todo el `WorldState` en memoria (estimación: < 20 KB por ciudadano con memoria acotada → 500 personas ≈ 10 MB).
- En disco: estado actual normalizado, event log, instantáneas diarias comprimidas, historia resumida.

## Principios

- Dependencias solo hacia abajo (apps → packages → engine).
- El motor no conoce SQLite ni HTTP.
- Todo lo que se muestra se deriva de estado persistido o eventos.
