# M3 · Historia e informe de vida (spec 020, bloque H) — validación

Fecha: 2026-09-29. Mundo de la semilla del proyecto (482917), 100 personas, 1 año con trayectoria diaria. Prueba: `packages/generators/src/relationships-world.test.ts`.

## Resultados

| Métrica | Valor | Criterio |
|---|---|---|
| Puntos de inflexión por persona | 5 (mínimo 5) | CA-001: ≥ 3 |
| Etapas objetivas por persona | 5,5 | — |
| Frases sin un hecho citado | 0 | CA-002 |
| Valores del perfil sin hechos de base | 0 | CA-005 |
| Tamaño de la trayectoria | 100 × 366 filas ≈ 0,7 MB (unos 2 MB en SQLite) | CA-006: < 10 MB |
| Desviación de la resiliencia entre personas | 0,12 | CA-006: > 0,05 |
| Informe de 100 personas | ≈ 2 s en total | — |

Perfil emergente (media · desviación · personas sin datos):

| Medida | Media | Desv. | Sin datos |
|---|---|---|---|
| Estabilidad laboral | 0,99 | 0,04 | 47 (menores o sin hechos laborales) |
| Estabilidad en sus relaciones | 0,86 | 0,29 | 32 |
| Red social | 0,40 | 0,22 | 4 |
| Golpes del último año | 0,64 | 0,30 | — |
| Rumbo económico | 0,66 | 0,39 | 58 (sin hechos económicos de base) |
| Resiliencia | 0,93 | 0,12 | 4 |

## Qué reveló

1. **La memoria es más amable que la vida.** Con la regla de la spec (tono distinto en más de 0,4), casi todas las etapas salían como divergentes (3,3 por persona). Se recuerdan los episodios más salientes, y el catálogo de desarrollo tiene más buenos que malos. El informe dice ahora ese sesgo una vez («en general recuerda su vida mejor de lo que fue») y marca las etapas que se apartan del patrón de la persona, o que recuerda al revés de como fueron.
2. **La estabilidad laboral apenas varía (0,99).** La historia generada (030) registra el empleo actual y casi ningún cambio anterior. No es un fallo del informe; mejorará cuando la historia tenga trayectoria laboral.
3. **El rumbo económico saturaba** con el cambio lineal de dinero (los salarios mueven mucho de un día a otro): ahora usa `tanh` del cambio relativo.

## Pendiente

- PA-149: fórmulas del perfil y ventana de recuperación (60 días), con fuentes.
- Historia laboral en la generación (030), para que la estabilidad laboral informe.
