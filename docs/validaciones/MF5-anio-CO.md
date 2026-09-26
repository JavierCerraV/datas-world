# Validación de M2: perfil CO-2026.09, semillas 100-102, 365 días

Generado con `pnpm cli validate:parity --profile CO-2026.09 --seeds 100-102 --days 365 --population 100`.

| Métrica | Valor | Objetivo | Tipo | Resultado |
|---|---|---|---|---|
| Valores NaN o fuera de rango | 0 | 0 | obligatorio | ✔ |
| Ánimo medio (010 CA-002) | 0.463 | 0,46–0,62 | cordura | ✔ |
| Desviación del ánimo entre personas | 0.122 | > 0,05 | cordura | ✔ |
| Estrés medio (010 CA-002) | 0.271 | 0,25–0,41 | cordura | ✔ |
| Adultos de 18 a 64 con empleo | 76.8 % | 55–90 % | cordura | ✔ |
| Enfermedad aguda por persona y año (010 CA-006) | 2.73 | 2–4 | cordura | ✔ |
| Patrimonio de los adultos p10 (015 CA-006) | $-631.489 | prototipo $-4.719.900 | informativo | — |
| Patrimonio de los adultos p50 (015 CA-006) | $7.343.070 | prototipo $210.400 | informativo | — |
| Patrimonio de los adultos p90 (015 CA-006) | $18.868.184 | prototipo $16.992.200 | informativo | — |

| Semilla | Personas | Ánimo | Estrés | Empleo | Enfermedad/año | p50 patrimonio | s |
|---|---|---|---|---|---|---|---|
| 100 | 95 | 0.477 | 0.275 | 69.2 % | 2.42 | 6171131 | 96 |
| 101 | 98 | 0.472 | 0.264 | 73.2 % | 2.90 | 7505471 | 93 |
| 102 | 99 | 0.439 | 0.274 | 88.1 % | 2.88 | 8352608 | 92 |

**Nota (MF5).** Mismas cifras que en MF3 y MF4: las reglas de la rutina empiezan con el aporte del número fijo de la 040, y el desaliento en la búsqueda de empleo solo afecta a quien lleva meses desempleado (2 personas de 100 en la semilla 482917), sin mover los promedios del pueblo.
