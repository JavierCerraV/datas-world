# bench:life — 254 personas × 365 días (perfil CO-2026.09, semilla 482917)

| Métrica | Valor | Objetivo |
|---|---|---|
| Generación | 3.2 s | — |
| Simulación | 387.6 s (0.94 días/s) | < 600 s para 500 personas × 1 año (021 CA-002) (no aplica a este tamaño) |
| Memoria del mundo al generarlo | 10.2 MB | — |
| Memoria al final (heap) | 35.9 MB · RSS 392.5 MB | < 1 GB (CLAUDE.md regla 8) |
| Memoria por persona viva | ≈ 71.2 KB (incluye antepasados y la parte fija) | < 40 KB (peldaño 4) |
| Motor funcional por persona (funciones, red, reglas y mente, serializado) | media 16.3 KB · máximo 28.4 KB | ≤ 20 KB (035 CA-003) ✔ |
| Hash final | `ba5420ff5bedefae` | — |

Medido con `node --expose-gc`.

## Comparación con el cierre del motor funcional (MF8)

| Métrica | MF8 | M3 | Cambio |
|---|---|---|---|
| Simulación de un año | 270,5 s | 387,6 s | +43 % |
| Memoria por persona | 54,4 KB | 71,2 KB | +17 KB |
| Motor funcional por persona | 10,4 KB | 16,3 KB (máx. 28,4) | +6 KB |
| Memoria al final (heap) | 31,3 MB | 35,9 MB | +4,6 MB |

**Qué ocupa lo nuevo.** Los vínculos (012), los recuerdos y capítulos (013, ≈ 6,5 KB), los orígenes de los estados (019) y las creencias (025). El motor funcional crece por las funciones de otras personas (`cit.*`) y las relaciones aprendidas por experiencia.

**Qué cuesta tiempo.** Los encuentros con su intercambio de posturas y lo que se cuenta en ellos (012, 025), y la memoria al final de cada tick (013).

**Dentro del presupuesto del servidor.** Heap de 36 MB y RSS de 392 MB, dentro de 1 GB. Queda por encima del objetivo de 40 KB por persona del peldaño 4; es deuda anterior (MF8: 54 KB) que M3 agranda. El motor funcional sigue por debajo de 20 KB de media, aunque el máximo (28,4 KB) lo supera.
