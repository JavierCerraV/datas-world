# M3 · Relaciones (spec 012, bloque R) — validación

Fecha: 2026-09-28. Mundo de la semilla del proyecto (482917), 100 personas, 1 año de vida diaria. Prueba: `packages/generators/src/relationships-world.test.ts`.

## Resultados (1 año, 100 personas)

| Métrica | Valor | Referencia |
|---|---|---|
| Vínculos con familiaridad > 0,3 por persona | 3,9 | CA-002: entre 3 y 15 (el prototipo se pasa: 16) |
| Vínculos por persona (todos) | 5,0 | tope 40 (P2) |
| Discusiones (`ARGUMENT`) | 79 (0,8 por persona) | prototipo: 50 con ~60 personas |
| Roces (`ENCOUNTER`) | 580 | — |
| Amistades formadas (`FRIENDSHIP_FORMED`, por lado) | 268; 128 vigentes al final | prototipo: 334 con ~60 personas (se pasa, §67 de la referencia) |
| Parejas nuevas | 2 | prototipo: 2 |
| Rupturas | 0 | prototipo: ~0 |
| Primeros encuentros / olvidos | 1 852 / 3 451 | — |
| Afecto por familiares (p10 · p50 · p90) | 0,08 · 0,17 · 0,26 | sin relaciones: media −0,10 (solo el desarrollo) |
| Afecto por no familiares (p10 · p50 · p90) | 0,02 · 0,13 · 0,20 | — |
| Asimetría: pares con afecto ≥ 0,2 no correspondidos (< 0,1) | 4 de 26 (15 %) | CA-001 (escala medida) |
| Tiempo del año | 144 s (sin relaciones: 109 s, +32 %) | — |

## Qué reveló la calibración

1. **El choque necesita ocasión.** Con la selección de la charla tal cual, ante un saludo neutro el 25 % elegía contraatacar o poner un límite: 753 discusiones en 60 días. En análisis de conducta son respuestas bajo control de un estímulo aversivo; solo se ofrecen con trato aversivo, tensión viva o función negativa del otro. Tras el cambio: 9 de 2 000 encuentros neutros.
2. **Quien inicia no se oye a sí mismo.** El primer intercambio emparejaba a B con el saludo neutro de A, como si lo hubiera dicho B, y diluía el afecto.
3. **La tensión se repara.** Sin reparación, las familias que conviven entraban en un bucle (percentil 90 de tensión 0,97). Con el 20 % de reparación en los encuentros amables, la tensión familiar vuelve a 0 y las discusiones se concentran donde hay función negativa.
4. **La escala del afecto.** Con la mezcla real de posturas (≈ 40 % abrirse, el resto breve o callar), el afecto de equilibrio por otra persona ronda 0,1–0,2. Los umbrales de amistad y de pareja se fijaron en esa escala, y la CA-001 se reescribió en ella (spec 012 v0.3).

## Pendiente

- El coste (+32 %) y el ruido de `MET`/`BOND_FORGOTTEN` con desconocidos de paso (MODULE.md de `relationships`, §8).
- `verbal.aprobacion` sale saturada (1,0) en todas las personas desde el desarrollo: alerta de degeneración que no es de este bloque (041).
