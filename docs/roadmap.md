# Hoja de ruta

Cada hito termina con una **demostración** y una **prueba de validación**. No se empieza un hito sin cerrar el anterior.

| Hito | Objetivo | Specs | Demostración / validación |
|---|---|---|---|
| **M0 — Arranque** | Repo en GitHub, guardarraíles activos, tooling, CI, RNG, reloj, eventos base, persistencia base | 001, 002, 014, 023, 027 | `pnpm check` y CI verdes; misma semilla → mismo hash; reloj avanza 1 año en CLI |
| **M1 — Mundo estático** | Generar geografía, lugares, objetos, organizaciones, población, hogares, personalidad, con el perfil de Colombia y catálogos (ADR-006) | 003–009, 029 | `world:new` crea 200 personas coherentes; informe de población; mapa estático en web |
| **M2 — Vida diaria** | Necesidades, rutinas, economía, movilidad, motor de decisiones, niveles de simulación; comando `validate:parity` | 010, 011, 015, 016, 017, 021 | Personas van a trabajar, comen, duermen, cobran, gastan; ánimo, estrés, empleo y dinero dentro de la tolerancia del prototipo |
| **M3 — Vida social** | Relaciones asimétricas, memoria, causalidad, historia, conocimiento/creencias | 012, 013, 019, 020, 025 | **Prueba: 100 ciudadanos × 1 año**; paridad completa con el prototipo (corrigiendo sus desviaciones conocidas); informes de vida explicables; rumores con verdad ≠ creencia |
| **M4 — Observación local** | API, SSE, visor pixel art (portado del prototipo), inspector, línea temporal | 022, 024 | `pnpm dev`: el mundo corre en local y se observa desde el navegador igual o mejor que el prototipo |
| **M5 — Aprendizaje y experimentos** | Hábitos, aprendizaje, experimentos A/B con semillas, rewind/replay completo | 018, 028, 023 | Mismo mundo con y sin un evento (p. ej. JOB_LOST) → trayectorias comparables |
| **M6 — LLM nivel 4** | Gateway LLM, diálogos y diarios, propuestas validadas | 026 | Persona observada escribe diario coherente con sus memorias; replay sin llamadas |
| **M7 — Escala** | 1 000–10 000 personas, perfiles de rendimiento, posible cambio de plan | 021, 027 | Benchmark publicado; decisión sobre servidor |
| **Publicación (diferida)** | Despliegue en Clouding según `docs/despliegue-clouding.md` | — | Cuando se decida; la arquitectura no cambia |
| **Después** | Capa clínica (terapeuta entra al mundo), poblaciones con características específicas | nuevas | — |

## Escalera de complejidad (ADR-005)

Los hitos se agrupan en **peldaños**. Cada peldaño añade capacidades al mundo (spec 001 R-007), parte de mundos guardados del peldaño anterior (spec 027 R-011) y se cierra con una puerta de validación local.

| Peldaño | Hitos | Población | Capacidades que añade | Puerta de validación |
|---|---|---|---|---|
| 0 | M0 | — | `clock` | Mismo hash con la misma semilla; 1 año en CLI |
| 1 | M1–M2 | 60–100 | `needs`, `routines`, `economy`, `mobility` | `pnpm cli validate:parity` dentro de tolerancia |
| 2 | M3–M4 | 200 | `relationships`, `memory` (episódica), `beliefs` | 100 × 1 año; 5 informes de vida explicables |
| 3 | M5 | 500 | `learning`, `consolidation`, `conflict` | Experimento A/B con y sin JOB_LOST; con y sin `consolidation` (spec 028 CA-003) |
| 4 | M6–M7 | 1 000–2 000 | `lifecourse`, `reputation` (specs por redactar) | `pnpm bench` < 1 GB; 10 años simulados; memoria < 40 KB por persona |
| 5 | M7+ | 5 000–10 000 | `culture` (spec por redactar), `llm` solo para nivel 4 | Diario coherente con las memorias; replay sin llamadas; spec 021 CA-007 |

**Decisión pendiente:** esta escalera pone el LLM (hito M6) después del ciclo vital y la escala (M7). La tabla de hitos de arriba los tiene en el orden contrario. Hay que elegir un orden antes de aprobar las specs de M5.

Cada puerta deja su resultado en `docs/validaciones/` y un mundo de ejemplo del peldaño en `docs/validaciones/mundos/` para probar la migración al siguiente.

## Criterio de calidad transversal

La pregunta de la visión: *¿estas personas parecen haber vivido y podemos explicar por qué terminaron donde terminaron?* A partir de M3 cada hito incluye revisar 5 informes de vida al azar.

## El prototipo como referencia

`prototipo/index.html` es el comportamiento objetivo. De él salen los parámetros por defecto, la línea base estadística y la referencia visual (M4). Todo está en `docs/prototipo-referencia.md`: el mapa de funciones → specs → módulos, las tolerancias y las desviaciones que no deben copiarse.

## Desarrollo local

Todo se ejecuta en el equipo del usuario, con el repositorio privado en su GitHub personal (ADR-004). El límite de 1 GB se mantiene como objetivo de diseño, medido con `pnpm bench` al cerrar cada hito.
