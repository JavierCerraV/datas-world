# Validación de M2: perfil prototipo, semillas 100-109, 365 días

Generado con `pnpm cli validate:parity --profile prototipo --seeds 100-109 --days 365`.

| Métrica | Valor | Objetivo | Tipo | Resultado |
|---|---|---|---|---|
| Valores NaN o fuera de rango | 0 | 0 | obligatorio | ✔ |
| Ánimo medio (010 CA-002) | 0.425 | 0,46–0,62 | cordura | ✘ |
| Desviación del ánimo entre personas | 0.111 | > 0,05 | cordura | ✔ |
| Estrés medio (010 CA-002) | 0.248 | 0,25–0,41 | cordura | ✘ |
| Adultos de 18 a 64 con empleo | 96.9 % | 55–90 % | cordura | ✘ |
| Enfermedad aguda por persona y año (010 CA-006) | 1.50 | 2–4 | cordura | ✘ |
| Patrimonio de los adultos p10 (015 CA-006) | $537.100 | prototipo $-4.719.900 | informativo | — |
| Patrimonio de los adultos p50 (015 CA-006) | $1.505.700 | prototipo $210.400 | informativo | — |
| Patrimonio de los adultos p90 (015 CA-006) | $3.448.200 | prototipo $16.992.200 | informativo | — |

| Semilla | Personas | Ánimo | Estrés | Empleo | Enfermedad/año | p50 patrimonio | s |
|---|---|---|---|---|---|---|---|
| 100 | 60 | 0.425 | 0.241 | 100.0 % | 1.22 | 1537000 | 39 |
| 101 | 56 | 0.431 | 0.232 | 100.0 % | 1.52 | 2579000 | 37 |
| 102 | 59 | 0.413 | 0.247 | 100.0 % | 1.51 | 1452000 | 38 |
| 103 | 57 | 0.435 | 0.247 | 96.8 % | 1.49 | 1331000 | 37 |
| 104 | 57 | 0.430 | 0.241 | 93.3 % | 1.82 | 1546000 | 37 |
| 105 | 59 | 0.432 | 0.256 | 93.9 % | 1.54 | 1171000 | 37 |
| 106 | 58 | 0.431 | 0.254 | 97.1 % | 1.43 | 1463000 | 37 |
| 107 | 59 | 0.427 | 0.249 | 93.8 % | 1.37 | 1505000 | 37 |
| 108 | 59 | 0.431 | 0.258 | 97.0 % | 1.59 | 1210000 | 37 |
| 109 | 59 | 0.392 | 0.260 | 97.1 % | 1.53 | 1263000 | 38 |
