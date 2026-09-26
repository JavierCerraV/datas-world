# bench:life — 254 personas × 365 días (perfil CO-2026.09, semilla 482917)

| Métrica | Valor | Objetivo |
|---|---|---|
| Generación | 0.3 s | — |
| Simulación | 228.3 s (1.60 días/s) | < 600 s para 500 personas × 1 año (021 CA-002) (no aplica a este tamaño) |
| Memoria del mundo al generarlo | 4.1 MB | — |
| Memoria al final (heap) | 17.2 MB · RSS 290.1 MB | < 1 GB (CLAUDE.md regla 8) |
| Memoria por persona viva | ≈ 12.8 KB (incluye antepasados y la parte fija) | < 40 KB (peldaño 4) |
| Hash final | `f6f42064987d5cca` | — |

Medido con `node --expose-gc`.

**Nota (MF2).** Con el aprendizaje directo (036) activo, el tiempo de un año es el mismo que en M2 (228 s) y la memoria por persona sigue muy por debajo del tope. Tras un año, cada persona tiene de media 9 funciones aprendidas (máximo 16), ≈ 2 KB de JSON (máximo 3,5 KB); el tope de la 036 es 256.
