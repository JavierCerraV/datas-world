# M2: cierre de la vida diaria (bloque H)

Estado a 2026-09-25, rama `m2/h-cierre`. M2 tiene la vida diaria completa de las specs 010, 011, 015, 016, 017 y 021, con el temperamento de la 009 v1.0 (MF1). Todo el detalle está en los informes enlazados.

## Qué se validó

| Criterio | Cómo | Resultado |
|---|---|---|
| 010 CA-002 (ánimo y estrés de un año) | `validate:parity`, perfil colombiano, 100 personas × 365 días (`M2-anio-CO.md`) | Ánimo 0,463 (desviación entre personas 0,124) y estrés 0,280 ✔ |
| 010 CA-006 (enfermedad aguda) | ídem | 2,54 episodios por persona y año ✔ |
| 015 CA-006 (distribución del dinero) | ídem, frente a la línea base del prototipo | Diferencia justificada en el historial de la 015 (ver abajo) |
| Empleo de 18 a 64 años | ídem | 74,6 % ✔ |
| Sin NaN ni valores fuera de rango | ídem y `M2-paridad-prototipo.md` | 0 ✔ (obligatorio) |
| 021 CA-001 (nivel 1 frente a 2) | `packages/generators/src/life.test.ts`, 100 personas × 30 días | Ánimo y gasto a < 5 % ✔ |
| 021 CA-002 (500 personas, 1 año en < 10 min) | `pnpm cli bench:life` (`M2-bench-vida.md`) | El mapa solo aloja 254 personas: 1 año en 228 s; proyección para 500 ≈ 450 s (< 600 s). Memoria ≈ 25 KB por persona (< 40 KB) y RSS 285 MB. Medición literal pendiente de un mapa más grande |
| 023 CA-002 (divergencia entre semillas) | `life.test.ts` | Hashes distintos y > 50 % de las personas con otro día 30 ✔ |
| 027 R-011 (mundo de ejemplo) | `mundos/m2-482917.db` y `apps/cli/src/m2.test.ts` | Se carga con hash verificado y sigue viviendo; el de M1 sigue estático ✔ |

## Paridad con el prototipo (perfil prototipo, 10 semillas × 365 días)

Desde ADR-007 el prototipo solo es referencia de mundo, economía y parte visual. Las métricas de conducta son **comprobaciones de cordura**. Con el perfil prototipo, cuatro de ellas quedan fuera de las tolerancias por causas conocidas:

| Métrica | Valor | Tolerancia | Por qué |
|---|---|---|---|
| Ánimo medio | 0,425 | 0,46–0,62 | El perfil prototipo no tiene ficha de esparcimiento (032): su tiempo libre es descansar en casa, sin diversión. Con el perfil colombiano, 0,463 ✔ |
| Estrés medio | 0,248 | 0,25–0,41 | A 0,002 del límite: sin economía en ese perfil no hay presión por dinero ni por deudas |
| Empleo de 18 a 64 | 96,9 % | 55–90 % | El mercado de trabajo (006, bloque G) cubre las vacantes y no hay despidos por crisis sin economía; el prototipo despedía más |
| Enfermedad aguda | 1,50 al año | 2–4 | El perfil prototipo tiene una sola enfermedad genérica, más baja que las del perfil colombiano |
| Patrimonio | sin movimiento | — | El perfil prototipo no tiene economía (015): su dinero no cambia |

## Hallazgos y correcciones del bloque H
- **Compañía:** el ánimo de un año caía a 0,28–0,32 porque la compañía se aproximaba por la actividad y descansar en casa con la familia contaba como soledad. Ahora se mide por ocupación del lugar, como en el prototipo (010).
- **Nivel 1:** sin decisiones en ese nivel no había esparcimiento y el gasto difería un 13 %. Ahora hay decisiones por horas (`runCoarse`, 017).
- **Mundos nuevos:** nacen con la vida diaria y los mundos de M1 siguen estáticos. La CLI y el worker avanzan con `lifeRunner`.

## Pendiente de decisión del usuario
- Pasar a `implementada` las specs con todos sus criterios cubiertos: **004, 006, 010, 011, 015 y 016**. La 005 y la 008 tienen criterios de M3; la 017 y la 021 tienen criterios de M3, M4 o M7.
- Transferencias públicas (Colombia Mayor, Renta Ciudadana) para los 16 hogares sin ingresos: hoy quedan para M3 (opción b).
- Siguiente: el plan MF (`tasks/MF-motor-funcional.md`), bloques MF2 a MF8, antes de M3.
