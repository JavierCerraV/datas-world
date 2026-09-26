# bench:life — 254 personas × 365 días (perfil CO-2026.09, semilla 482917)

| Métrica | Valor | Objetivo |
|---|---|---|
| Generación | 0.3 s | — |
| Simulación | 228.3 s (1.60 días/s) | < 600 s para 500 personas × 1 año (021 CA-002) (no aplica a este tamaño) |
| Memoria del mundo al generarlo | 4.1 MB | — |
| Memoria al final (heap) | 20.3 MB · RSS 284.9 MB | < 1 GB (CLAUDE.md regla 8) |
| Memoria por persona viva | ≈ 25.4 KB (incluye antepasados y la parte fija) | < 40 KB (peldaño 4) |
| Hash final | `8af80a93e4d54a8d` | — |

Medido con `node --expose-gc`.

**Nota (021 CA-002).** Se pidieron 500 personas, pero el mapa de Data's World (80 × 50, ≈ 82 viviendas) solo aloja 254: la población se limita por las viviendas y el crecimiento del territorio llega después (033 R-008). Con 254 personas, 1 año de vida diaria tarda 228 s. **Proyección** lineal para 500 personas: ≈ 450 s, bajo el límite de 600 s. La medición literal queda pendiente de un mapa más grande o de una plantilla de prueba con más viviendas.
