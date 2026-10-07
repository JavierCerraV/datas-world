# Batería psicométrica: primera corrida con el LLM (spec 046)

Fecha: 2026-10-07 · Mundo `data/world.db` (copia) · 50 adultos estratificados · tomas el 2027-03-18, el 2027-04-17 (+30 días) y el 2028-04-16 (+1 año) · LLM: `nvidia/nemotron-3-super-120b-a12b:free` por OpenRouter, una llamada por persona y toma con las seis pruebas · Archivos (fuera de git): `data/psicometria/bateria.{xlsx,json}`.

> **Límite que gobierna todo lo de abajo (046 R-009):** estas puntuaciones **no son datos humanos**. Son la salida de un modelo [M] de cómo el estado de una persona simulada se refleja en cada escala, con pesos sin validar (PA-155). Sirven para comprobar que el mundo produce perfiles coherentes y cómo cambian, no para validar el modelo ni para inferir sobre personas reales. El nivel de AAQ-II, GPQ-9 y GTQ está fijado por el «origen de la escala» (046 §4 bis): su media no es un hallazgo.

## Qué se midió
50 personas × 3 tomas × 6 pruebas = 9 750 respuestas. El motor calculó la respuesta verdadera de cada ítem y decidió si la persona la dice tal cual; el LLM la expresó como charla y eligió dentro de ±1 punto.

| Quién escribió la respuesta | Ítems |
|---|---|
| El LLM | 9 739 (99,9 %) |
| Corregida por el motor (opción fuera del rango) | 2 |
| Plantilla (sin LLM) | 9 |

Disposición decidida por el motor: fiel 67,8 %, minimiza 10,3 %, impreciso 9,4 %, exagera 7,1 %, miente 5,4 %.

## Puntuaciones (media y, entre paréntesis, desviación; «dicho» es lo que la persona respondió)
| Prueba | Toma 0 | Toma 1 | Toma 2 | Verdadero (T0 / T1 / T2) | % sobre el corte (T0 / T1 / T2) |
|---|---|---|---|---|---|
| AAQ-II | 21,0 (4,5) | 21,7 (3,9) | 21,4 (4,8) | 20,5 / 20,9 / 20,3 | 6 / 6 / 4 % (> 29) |
| GHQ-12 | 12,5 (6,6) | 13,4 (6,3) | 12,2 (5,9) | 13,2 / 13,5 / 12,3 | 56 / 62 / 46 % (≥ 12) |
| GPQ-9 | 21,2 (5,0) | 22,3 (5,5) | 22,8 (5,6) | 22,9 / 22,8 / 23,4 | 12 / 18 / 26 % (> 27) |
| GTQ | 55,4 (3,7) | 55,2 (4,5) | 55,4 (4,7) | 57,8 / 58,0 / 58,3 | 26 / 28 / 32 % (≤ 52) |
| DASS-21 (total) | 11,4 (7,2) | 12,7 (7,2) | 12,7 (7,5) | 4,9 / 4,8 / 4,5 | — |
| · depresión / ansiedad / estrés | 4,9 / 2,1 / 4,4 | 5,0 / 2,9 / 4,9 | 5,1 / 2,5 / 5,1 | | |
| SWLS | 20,8 (4,3) | 20,4 (4,3) | 21,5 (4,6) | 21,2 / 21,0 / 21,1 | 12 / 8 / 10 % (≤ 14) |

## Lo que muestra
1. **El LLM infla el DASS-21.** Lo dicho (11,4) es más del doble de lo verdadero (4,9), mientras que en las otras cinco pruebas la diferencia es de 2,5 puntos o menos. En una escala de 0 a 3 con «no me ha ocurrido» como mínimo, el modelo tiende a reconocer «un poco» donde el motor decidió 0. Es un sesgo de la expresión, no de la persona: hay que acotar el rango del LLM en las escalas cortas (por ejemplo no permitir subir por encima de lo decidido) antes de leer el DASS-21. Propuesta, sin aplicar: rango asimétrico o decidir el valor en el motor y pedir al LLM solo la frase.
2. **El GHQ-12 sale «positivo» en la mitad de las personas, pero es un artefacto de la corrección.** Con la corrección de la ficha (0 a 3, corte ≥ 12), responder «igual que lo habitual» en los 12 ítems da exactamente 12. Con la media en 12,5 es esperable que más de la mitad lo supere; no indica malestar clínico.
3. **Las correlaciones entre pruebas tienen el signo esperado (046 R-010):** AAQ-II con GHQ-12 +0,45 y con DASS-21 +0,44; SWLS con AAQ-II −0,20 y con DASS-21 −0,37. **GPQ-9 con GTQ: −0,02**, cuando debería ser negativa: el motor casi no varía el *pliance* ni el *tracking* entre personas (solo siembra reglas de rutina), un límite ya anotado.
4. **La fiabilidad de lo dicho es mucho menor que la de lo verdadero.** Correlación de las puntuaciones a 30 días: dicho 0,17 (GPQ-9) a 0,64 (SWLS); verdadero 0,62 (GHQ-12) a 0,93 (SWLS). Las respuestas no fieles, un tercio de los ítems, reducen la estabilidad como se espera, pero el valor del GPQ-9 es bajo y no está validado.
5. **Entre 19 y 22 de 50 personas cambian de banda entre la toma 0 y la 2** (GHQ-12, AAQ-II y SWLS), pero con esa fiabilidad parte del cambio es ruido de respuesta, no de la persona. Las medias casi no se mueven (la diferencia de AAQ-II verdadero entre tomas es de 0,6 puntos), así que la población en conjunto es estable.
6. **No hubo muertes:** las 50 personas estaban vivas en las tres tomas.

## Defecto encontrado y corregido
Al reanudar la corrida (`--resume`), el comando recalculaba los indicadores de las tomas ya medidas con el mundo ya avanzado, y dejó los de las tomas 0 y 1 iguales a los de la toma 2. Las respuestas, puntuaciones, disposiciones y fechas **no** se vieron afectadas (se guardan al medir). Quedó dañada la hoja «Indicadores» de las tomas 0 y 1, que se **descartó** del libro entregado (no se pudo recuperar: el mundo de esas fechas ya no existe). La hoja «Método y límites» lo dice. Corregido: reanudar ya no relee ni reescribe las tomas ya medidas, con una prueba que falla con el código anterior (`psychometrics-resume.test.ts`).

## Pendiente
- ~~Acotar el rango del LLM en el DASS-21~~ (hallazgo 1): hecho el 2026-10-07 (046 v0.3, el LLM solo puede elegir igual o por debajo de lo decidido). **No se repitió la corrida**: sin medirla de nuevo no se sabe cuánto baja el DASS-21.
- Decidir si el corte del GHQ-12 debe interpretarse con la corrección de la ficha o con una de 0-0-1-1 (hallazgo 2).
- Variación del *pliance* y el *tracking* entre personas en el motor (hallazgo 3).
- Validar los pesos con datos humanos (PA-155).
