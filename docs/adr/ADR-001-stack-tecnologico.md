# ADR-001 — Stack tecnológico y plataforma de despliegue

- **Estado:** aceptada
- **Fecha:** 2026-09-23
- **Contexto de servidor:** Clouding.io, Linux, 1 GB RAM, ½ vCore, 5 GB SSD NVMe, 4 TB de transferencia, 3 €/mes.

## Contexto

El proyecto es un **simulador que debe seguir vivo aunque nadie lo mire**: un proceso que avanza el reloj del mundo continuamente, mantiene cientos de personas en memoria, escribe eventos y sirve una vista en tiempo real. Además exige determinismo (misma semilla → mismo mundo), trazabilidad causal y un presupuesto de hardware mínimo.

Requisitos que condicionan la decisión:

1. **Proceso persistente** que ejecuta ticks aunque no haya visitas.
2. **CPU eficiente** en bucles numéricos (medio núcleo).
3. **Memoria baja** (1 GB total, incluido el sistema operativo).
4. **Datos relacionales y append-only** (eventos, relaciones, memorias) con consultas por persona y por tiempo.
5. **Visor web en tiempo real** (pixel art, 2D).
6. **Mantenible por una persona con Claude Code**, con pruebas y tipos.

## Opciones evaluadas

### Opción 1 — WordPress + plugin (PHP, JS, HTML, CSS)

El mundo como plugin de WordPress; ciudadanos como Custom Post Types o tablas propias; simulación con WP-Cron; visor como tema o bloque.

- A favor: hosting conocido, panel de administración gratis, usuarios y login listos, ecosistema para una futura parte comercial (landing, pagos, blog).
- En contra:
  - PHP en WordPress es **dirigido por peticiones**: no hay un proceso que viva entre ticks. WP-Cron solo se ejecuta cuando alguien visita la web; habría que sustituirlo por cron del sistema llamando a scripts cada minuto, reconstruyendo todo el estado en cada llamada.
  - WordPress + PHP-FPM + MariaDB consumen **350–500 MB en reposo**, la mitad del servidor antes de simular nada.
  - El modelo `wp_posts`/`wp_postmeta` (clave-valor) es inadecuado para relaciones asimétricas, eventos y consultas causales; habría que crear tablas propias, perdiendo la principal ventaja de WP.
  - Superficie de ataque y mantenimiento (actualizaciones de núcleo y plugins) sin aportar nada al motor.
  - Tipado débil y pruebas más costosas para un motor determinista.
- **Veredicto:** no recomendada para el núcleo. WordPress solo tiene sentido **más adelante** para la capa comercial/divulgativa, en otro servidor, consumiendo la API del simulador.

### Opción 2 — PHP 8.3 puro, sin WordPress

Daemon PHP CLI gestionado por systemd (bucle de ticks), SQLite, API ligera (Slim o PHP nativo), visor JS/Canvas.

- A favor: sigue en PHP/JS/HTML/CSS; PHP 8 con JIT es razonablemente rápido; SQLite evita un servidor de base de datos; consumo ~80–150 MB.
- En contra: dos lenguajes (PHP en servidor, JS en el visor) y el motor **no puede ejecutarse en el navegador** para prototipos o réplica local; ecosistema de pruebas de propiedades, streaming (SSE) y tipos más pobre; los procesos PHP de larga vida requieren cuidado con fugas de memoria.
- **Veredicto:** viable si hay una razón fuerte para quedarse en PHP.

### Opción 3 — TypeScript full-stack (RECOMENDADA)

Node.js 24 LTS, monorepo pnpm, motor puro en TypeScript, SQLite con better-sqlite3 (WAL), Fastify + Server-Sent Events, visor Vite + Canvas 2D, Zod en los bordes, Vitest y fast-check.

- A favor:
  - **Un solo lenguaje** en motor, servidor, visor y herramientas; el mismo motor corre en el worker, en la CLI, en las pruebas y en el navegador (como en el prototipo).
  - V8 es muy rápido en bucles numéricos: el prototipo simula 60 personas × 1 año en ~4 s en medio núcleo de referencia.
  - Proceso persistente natural (worker con systemd); consumo total estimado **~150–250 MB** (worker + API + Caddy).
  - Tipos estrictos: contratos de las specs se traducen a tipos; Claude Code trabaja muy bien con TS.
  - better-sqlite3 es síncrono y rápido, ideal para escrituras por lotes de eventos en un solo proceso.
- En contra: requiere disciplina de determinismo (prohibir `Math.random`, orden de iteración); el análisis estadístico avanzado se hará fuera (exportando CSV/Parquet a Python/R), lo cual es deseable igualmente para no cargar el servidor.

### Comparación

| Criterio | WP + plugin | PHP puro | TypeScript |
|---|---|---|---|
| Proceso persistente | ✗ (WP-Cron por visitas) | ✓ (daemon) | ✓ (worker) |
| RAM en reposo | 350–500 MB | 80–150 MB | 60–150 MB |
| Velocidad en bucles | media | media-alta | alta |
| Motor también en navegador | ✗ | ✗ | ✓ |
| Tipado y pruebas | débil | medio | fuerte |
| Tiempo real (SSE/WebSocket) | difícil | posible | nativo |
| Encaje del modelo de datos | malo | bueno | bueno |
| Capa comercial futura | excelente | media | media (o WP aparte) |
| Riesgo operativo en 1 GB | alto | bajo | bajo |

## Decisión

Se adopta la **Opción 3 (TypeScript full-stack)** con SQLite, un **worker** independiente que avanza el mundo, una **API de solo lectura** con SSE y un **visor Canvas**. Caddy como proxy HTTPS. Sin contenedores ni servicios externos en el MVP.

## Consecuencias

- Reglas de determinismo obligatorias en `packages/engine` (ver CLAUDE.md y spec 023).
- Build en local o CI; el servidor solo recibe artefactos (no compila).
- Si en el futuro se quiere una web comercial, se evaluará WordPress como sitio independiente que enlaza o incrusta el visor.
- Si la población supera ~2 000 personas con nivel de detalle alto, se revisará el plan del servidor (M7).
