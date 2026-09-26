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
| Patrimonio de los adultos p50 (015 CA-006) | $7.342.503 | prototipo $210.400 | informativo | — |
| Patrimonio de los adultos p90 (015 CA-006) | $18.868.184 | prototipo $16.992.200 | informativo | — |

| Semilla | Personas | Ánimo | Estrés | Empleo | Enfermedad/año | p50 patrimonio | s |
|---|---|---|---|---|---|---|---|
| 100 | 95 | 0.477 | 0.275 | 69.2 % | 2.41 | 6169431 | 88 |
| 101 | 98 | 0.472 | 0.264 | 73.2 % | 2.90 | 7505471 | 87 |
| 102 | 99 | 0.439 | 0.274 | 88.1 % | 2.88 | 8352608 | 89 |

**Nota (MF3).** Perfil colombiano, 3 semillas × 100 personas × 1 año, con la selección de la 040: todos los indicadores de cordura en rango (en M2, semilla 482917: ánimo 0,463, estrés 0,280, empleo 74,6 %, enfermedad 2,54).
