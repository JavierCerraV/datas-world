# bench:life — 254 personas × 365 días (perfil CO-2026.09, semilla 482917)

| Métrica | Valor | Objetivo |
|---|---|---|
| Generación | 1.6 s | — |
| Simulación | 270.5 s (1.35 días/s) | < 600 s para 500 personas × 1 año (021 CA-002) (no aplica a este tamaño) |
| Memoria del mundo al generarlo | 8.0 MB | — |
| Memoria al final (heap) | 31.3 MB · RSS 358.3 MB | < 1 GB (CLAUDE.md regla 8) |
| Memoria por persona viva | ≈ 54.4 KB (incluye antepasados y la parte fija) | < 40 KB (peldaño 4) |
| Motor funcional por persona (funciones, red, reglas y mente, serializado) | media 10.4 KB · máximo 14.6 KB | ≤ 20 KB (035 CA-003) ✔ |
| Hash final | `7a6ac58f5bb7eff6` | — |

Medido con `node --expose-gc`.
