# bench:life — 254 personas × 365 días (perfil CO-2026.09, semilla 482917)

| Métrica | Valor | Objetivo |
|---|---|---|
| Generación | 0.3 s | — |
| Simulación | 270.1 s (1.35 días/s) | < 600 s para 500 personas × 1 año (021 CA-002) (no aplica a este tamaño) |
| Memoria del mundo al generarlo | 4.4 MB | — |
| Memoria al final (heap) | 18.3 MB · RSS 287.2 MB | < 1 GB (CLAUDE.md regla 8) |
| Memoria por persona viva | ≈ 15.9 KB (incluye antepasados y la parte fija) | < 40 KB (peldaño 4) |
| Hash final | `299e4777b0ec6b8f` | — |

Medido con `node --expose-gc`.

**Nota (MF4).** Con la red relacional (037) en la vida diaria, un año tarda 270 s frente a 254 s en MF3 (+6 %: el valor funcional en la fuente de aversión de cada candidata y en la elicitación). La memoria sigue muy por debajo del tope.
