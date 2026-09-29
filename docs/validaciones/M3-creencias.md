# M3 · Conocimiento, creencias y rumores (spec 025, bloque K) — validación

Fecha: 2026-09-29. Mundo de la semilla del proyecto (482917), 100 personas, 1 año. Prueba: `packages/generators/src/relationships-world.test.ts`.

## Resultados

| Métrica | Valor | Criterio |
|---|---|---|
| Relatos (`RUMOR_TOLD`) | 2 632 (≈ 26 por persona) | — |
| Deformaciones · correcciones | 32 · 18 | CA-002: ≥ 1 corrección |
| Creencias por persona al final | 7,8 (tope 12) | — |
| Creencias falsas al final | 21; la más compartida, por 7 personas | CA-002: una por ≥ 3 |
| Credibilidad media por bocas (0 · 1 · 2 · 3) | 1 · 0,55 · 0,40 · 0,32 | CA-005: no sube |
| Intenciones y confrontaciones por un rumor | 3 · 2 | R-007 |
| Tiempo del año | ≈ 152 s (antes 147 s) | — |

Temas de los que se habla en el año: pareja nueva, peleas (y su versión deformada, «es agresivo»), enfermedad y recuperación, trabajo conseguido y deuda con el gota a gota.

## Qué se ve

1. **Las creencias falsas salen de tres sitios:** lo que se quedó viejo (alguien se recuperó y otros lo siguen creyendo enfermo), lo deformado al pasar de boca en boca y lo que siembra un visitante en la charla.
2. **Contar es una historia, no un rasgo.** 97 de 100 personas aprendieron algo sobre contar en el año; a quien lo cortaban cuenta menos (CA-004, en la prueba del motor).
3. **Un rumor puede terminar en una confrontación:** la intención formada por lo que se oyó cita el `RUMOR_TOLD`, y la cadena causal llega hasta el hecho que lo originó (CA-005).

## Pendiente

- PA-150 a PA-152: se cuenta mucho y los temas se concentran en lo más frecuente del año (pareja nueva, peleas, enfermedades).
- La mentira activa, con la capa clínica (fuera de alcance de la 025 v0.2).
