# bench:life — 254 personas × 365 días (perfil CO-2026.09, semilla 482917)

| Métrica | Valor | Objetivo |
|---|---|---|
| Generación | 3.2 s | — |
| Simulación | 411.5 s (0.89 días/s) | < 600 s para 500 personas × 1 año (021 CA-002) (no aplica a este tamaño) |
| Memoria del mundo al generarlo | 7.8 MB | — |
| Memoria al final (heap) | 31.4 MB · RSS 325.8 MB | < 1 GB (CLAUDE.md regla 8) |
| Memoria por persona viva | ≈ 55.3 KB (incluye antepasados y la parte fija) | < 40 KB (peldaño 4) |
| Motor funcional por persona (funciones, red, reglas y mente, serializado) | media 10.4 KB · máximo 14.5 KB | ≤ 20 KB (035 CA-003) ✔ |
| Hash final | `b125705bd9d3c787` | — |

Medido con `node --expose-gc`.
