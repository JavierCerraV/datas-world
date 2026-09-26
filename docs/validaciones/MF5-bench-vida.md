# bench:life — 254 personas × 365 días (perfil CO-2026.09, semilla 482917)

| Métrica | Valor | Objetivo |
|---|---|---|
| Generación | 0.3 s | — |
| Simulación | 268.5 s (1.36 días/s) | < 600 s para 500 personas × 1 año (021 CA-002) (no aplica a este tamaño) |
| Memoria del mundo al generarlo | 4.8 MB | — |
| Memoria al final (heap) | 19.2 MB · RSS 295.7 MB | < 1 GB (CLAUDE.md regla 8) |
| Memoria por persona viva | ≈ 19.5 KB (incluye antepasados y la parte fija) | < 40 KB (peldaño 4) |
| Hash final | `486d1ab7ca5b2fc6` | — |

Medido con `node --expose-gc`.

**Nota (MF5).** Con las reglas y los valores (038), un año tarda 268 s, igual que en MF4 (270 s). La memoria por persona sube a ≈ 19,5 KB por las 5 reglas de la rutina y sus aristas en la red relacional; sigue lejos del tope.
