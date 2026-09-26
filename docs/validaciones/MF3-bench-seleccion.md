# bench:life — 254 personas × 365 días (perfil CO-2026.09, semilla 482917)

| Métrica | Valor | Objetivo |
|---|---|---|
| Generación | 0.3 s | — |
| Simulación | 254.4 s (1.43 días/s) | < 600 s para 500 personas × 1 año (021 CA-002) (no aplica a este tamaño) |
| Memoria del mundo al generarlo | 4.4 MB | — |
| Memoria al final (heap) | 17.9 MB · RSS 294.1 MB | < 1 GB (CLAUDE.md regla 8) |
| Memoria por persona viva | ≈ 15.4 KB (incluye antepasados y la parte fija) | < 40 KB (peldaño 4) |
| Hash final | `e0d01149556f8f64` | — |

Medido con `node --expose-gc`.

**Nota (MF3).** Con la selección por fuentes de control (040), un año tarda 254 s frente a 228 s en MF2 (+11 %: el valor neto de las funciones aversivas por candidata y el aprendizaje de la selección). La memoria sigue muy por debajo del tope.
