# Validación de M2: perfil prototipo, semillas 100-109, 365 días

Generado con `pnpm cli validate:parity --profile prototipo --seeds 100-109 --days 365`.

| Métrica | Valor | Objetivo | Tipo | Resultado |
|---|---|---|---|---|
| Valores NaN o fuera de rango | 0 | 0 | obligatorio | ✔ |
| Ánimo medio (010 CA-002) | 0.424 | 0,46–0,62 | cordura | ✘ |
| Desviación del ánimo entre personas | 0.111 | > 0,05 | cordura | ✔ |
| Estrés medio (010 CA-002) | 0.249 | 0,25–0,41 | cordura | ✘ |
| Adultos de 18 a 64 con empleo | 96.9 % | 55–90 % | cordura | ✘ |
| Enfermedad aguda por persona y año (010 CA-006) | 1.50 | 2–4 | cordura | ✘ |
| Patrimonio de los adultos p10 (015 CA-006) | $537.100 | prototipo $-4.719.900 | informativo | — |
| Patrimonio de los adultos p50 (015 CA-006) | $1.505.700 | prototipo $210.400 | informativo | — |
| Patrimonio de los adultos p90 (015 CA-006) | $3.448.200 | prototipo $16.992.200 | informativo | — |

| Semilla | Personas | Ánimo | Estrés | Empleo | Enfermedad/año | p50 patrimonio | s |
|---|---|---|---|---|---|---|---|
| 100 | 60 | 0.425 | 0.242 | 100.0 % | 1.22 | 1537000 | 37 |
| 101 | 56 | 0.430 | 0.232 | 100.0 % | 1.52 | 2579000 | 36 |
| 102 | 59 | 0.412 | 0.247 | 100.0 % | 1.51 | 1452000 | 37 |
| 103 | 57 | 0.435 | 0.247 | 96.8 % | 1.49 | 1331000 | 35 |
| 104 | 57 | 0.430 | 0.242 | 93.3 % | 1.82 | 1546000 | 35 |
| 105 | 59 | 0.432 | 0.257 | 93.9 % | 1.54 | 1171000 | 37 |
| 106 | 58 | 0.431 | 0.254 | 97.1 % | 1.45 | 1463000 | 37 |
| 107 | 59 | 0.426 | 0.250 | 93.8 % | 1.37 | 1505000 | 37 |
| 108 | 59 | 0.431 | 0.258 | 97.0 % | 1.58 | 1210000 | 37 |
| 109 | 59 | 0.391 | 0.260 | 97.1 % | 1.53 | 1263000 | 38 |

**Nota (MF3).** Prácticamente igual que en M2 y MF2 (ánimo 0,424 frente a 0,425; estrés 0,249 frente a 0,248): el cambio de la utilidad con rasgos (017) a las fuentes de control (040) conserva el comportamiento. Las marcas ✘ de cordura ya estaban en M2 y se explican allí.
