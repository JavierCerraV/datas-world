# M1: bench, memoria, determinismo y paridad del mundo estático

- **Fecha:** 2026-09-24 · **Rama:** `m1/cierre` · **Motor:** `0.2.0`.
- **Máquina:** AMD Ryzen 7 5700G, 15 GB, Windows 11 Pro, Node 24.18.0.
- **Mundo:** semilla 482917, perfil `CO-2026.09`, epoch `2026-01-01T00:00`, historia desde 1900.

## Generación (`pnpm bench`, `world:new`)
| Medida | Valor | Criterio |
|---|---|---|
| Personas vivas / hogares | 199 / 72 | 007, 008 (agregado de 20 mundos frente al DANE) |
| Antepasados | 1 106 (93 vivos fuera del mundo) | 030 §3: ≈ 5,5 por persona viva |
| Eventos de la creación | 3 363 | — |
| Tiempo de `world:new` (generar + guardar) | 221–250 ms | 030 CA-007: < 5 s ✔ |
| Base en disco tras crear | 1,75 MB | 030 CA-007: < 2 MB ✔ (margen pequeño) |
| Memoria del mundo en RAM | ≈ 3,1 MB por mundo: ≈ 2,4 KB por ciudadano (vivos + antepasados), ≈ 16 KB por persona viva | CLAUDE.md regla 8: 10 000 personas vivas ≈ 160 MB, dentro de 1 GB |

## Avance del mundo poblado (`world:advance`)
El motor de M1 solo avanza el reloj; la vida diaria llega en M2. Aun así, el coste de guardar un mundo con población ya se nota:

| Avance | Tiempo | Base en disco |
|---|---|---|
| 30 días | 2,4 s (antes de 027 R-012: 12 s; antes de quitar las copias del hash: 22 s) | — |
| 365 días | 22 s | 30 MB (365 instantáneas diarias del mundo completo) |

**Puntos de atención para M2 y M4:**
- la instantánea diaria (hash y compresión del mundo completo, con los antepasados) y la comparación de entidades en cada flush son ahora el coste principal;
- la retención de instantáneas (027 R-004, M4) reducirá la base; conviene adelantarla si la base pasa de unos cientos de MB en las pruebas de 1 año;
- los antepasados no cambian nunca: se podrían excluir de la comparación por flush.

## Determinismo
| Prueba | Resultado |
|---|---|
| 023 CA-001: 100 personas, 30 días, dos procesos (`apps/cli/src/cli.test.ts`) | mismo hash ✔ |
| 030 CA-001: misma semilla → misma historia, antepasados y `stateHash` | ✔ |
| 001 CA-005: semillas distintas → hashes distintos tras la generación | ✔ |
| 027 CA-001 y CA-006 con población: guardar y cargar da el hash generado | ✔ |
| 027 R-011: mundo de ejemplo `docs/validaciones/mundos/m1-482917.db` se carga y avanza | ✔ |
| 023 CA-002: el 50 % de personas con un evento distinto el día 30 | pendiente de M2 (hoy nadie tiene eventos diarios) |

## Paridad con el prototipo (perfil `prototipo`, semillas 100–109)
En la generación, el perfil `prototipo` reproduce el mundo inicial del prototipo:

| Métrica | Motor TS | Prototipo | Prueba |
|---|---|---|---|
| Personas por mundo | 58,3 | 61 (línea base, semilla 100) | `population.test.ts` (unas 60 personas) |
| Tamaño medio del hogar | 2,75 | ≈ 2,8 (`genPopulation`) | ídem |
| Menores de 18 / 65 o más | 0,377 / 0,069 | edades de `genPopulation` | ídem |
| Adultos de 18 a 64 con empleo | 0,858 | 0,85 (tabla de tolerancias: 70–90 %) | `employment.test.ts` (0,86 ± 0,04) ✔ |
| Empleo formal por tipo de lugar | ±0,06 de `genJobs` | `genJobs` | 006 CA-003 ✔ |
| Mapa, calles y manzanas | idénticos | `genWorld` | 003 CA-004 ✔ |
| Lugares no residenciales | idénticos, más la iglesia | `PDEF`, `LAYOUT` | 004 CA-002 ✔ |
| Parámetros del perfil | idénticos | constantes del prototipo | 029 CA-004 ✔ |

La paridad de comportamiento (ánimo, estrés, relaciones, eventos por año; `docs/prototipo-referencia.md`) se mide desde M2 con `pnpm cli validate:parity`.
