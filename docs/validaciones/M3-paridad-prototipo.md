# Validación de M2: perfil prototipo, semillas 100-109, 365 días

Generado con `pnpm cli validate:parity --profile prototipo --seeds 100-109 --days 365`.

| Métrica | Valor | Objetivo | Tipo | Resultado |
|---|---|---|---|---|
| Valores NaN o fuera de rango | 0 | 0 | obligatorio | ✔ |
| Ánimo medio (010 CA-002) | 0.486 | 0,46–0,62 | cordura | ✔ |
| Desviación del ánimo entre personas | 0.114 | > 0,05 | cordura | ✔ |
| Estrés medio (010 CA-002) | 0.251 | 0,25–0,41 | cordura | ✔ |
| Adultos de 18 a 64 con empleo | 96.9 % | 55–90 % | cordura | ✘ |
| Enfermedad aguda por persona y año (010 CA-006) | 1.49 | 2–4 | cordura | ✘ |
| Patrimonio de los adultos p10 (015 CA-006) | $537.100 | prototipo $-4.719.900 | informativo | — |
| Patrimonio de los adultos p50 (015 CA-006) | $1.505.700 | prototipo $210.400 | informativo | — |
| Patrimonio de los adultos p90 (015 CA-006) | $3.448.200 | prototipo $16.992.200 | informativo | — |

| Semilla | Personas | Ánimo | Estrés | Empleo | Enfermedad/año | p50 patrimonio | s |
|---|---|---|---|---|---|---|---|
| 100 | 60 | 0.485 | 0.250 | 100.0 % | 1.23 | 1537000 | 75 |
| 101 | 56 | 0.468 | 0.250 | 100.0 % | 1.48 | 2579000 | 73 |
| 102 | 59 | 0.477 | 0.250 | 100.0 % | 1.46 | 1452000 | 75 |
| 103 | 57 | 0.503 | 0.251 | 96.8 % | 1.54 | 1331000 | 68 |
| 104 | 57 | 0.486 | 0.253 | 93.3 % | 1.82 | 1546000 | 75 |
| 105 | 59 | 0.494 | 0.253 | 93.9 % | 1.54 | 1171000 | 75 |
| 106 | 58 | 0.491 | 0.251 | 97.1 % | 1.45 | 1463000 | 75 |
| 107 | 59 | 0.486 | 0.251 | 93.8 % | 1.36 | 1505000 | 51 |
| 108 | 59 | 0.504 | 0.252 | 97.0 % | 1.54 | 1210000 | 51 |
| 109 | 59 | 0.470 | 0.251 | 97.1 % | 1.51 | 1263000 | 51 |
