# Cierre de M3 — Vida social (2026-09-29)

Hito del roadmap: relaciones asimétricas, memoria, causalidad, historia y conocimiento, escritas sobre el motor funcional (035 §8). Specs: 012, 013, 019, 020 y 025, reescritas y aprobadas con las decisiones del usuario (P1–P5 de cada una), e implementadas en los PR #58 a #62.

## Criterios del hito

| Criterio | Resultado | Dónde |
|---|---|---|
| 100 ciudadanos × 1 año | En verde, con los criterios de las cinco specs en la misma prueba | `packages/generators/src/relationships-world.test.ts` |
| Paridad con el prototipo en mundo y economía | Igual que al cerrar el motor funcional. Ánimo 0,486 y estrés 0,251 en rango. Siguen fuera empleo (96,9 %) y enfermedad (1,49 al año), deuda anterior a M3 | `M3-paridad-prototipo.md` |
| Batería conductual 042 | En verde (corre en `pnpm check`) | `bateria-conductual.md` |
| Informes de vida con explicación funcional | 5 informes al azar revisados; 6 defectos corregidos (abajo) | `pnpm cli citizen:life CIT-…` |
| Rumores con verdad ≠ creencia | Una creencia falsa compartida por 7 personas; 18 correcciones; la verdad solo en el análisis | `M3-creencias.md` |
| Memoria y velocidad | 254 personas × 1 año: 388 s (+43 % frente a MF8); 71 KB por persona (MF8: 54, objetivo 40); motor funcional 16 KB de media (≤ 20 ✔); heap 36 MB, RSS 392 MB (< 1 GB) | `M3-bench-vida.md` |

## Revisión de 5 informes de vida al azar

Mundo de la semilla del proyecto, 100 personas, un año con la CLI (`world:new`, `world:advance --days 365`), trayectoria incluida. Personas elegidas con una secuencia fija sobre las 100: CIT-000067, CIT-000069, CIT-000009, CIT-000073 (cuatro niños) y CIT-000029 (un adulto).

Lo que se entiende bien:
- **Carlos (CIT-000029, 57 años).** Los capítulos de su vida van de la infancia a dos duelos, la crianza, la migración, el desempleo y un trabajo nuevo. Recuerda el segundo duelo como «muy malo» cuando lo vivido fue neutro, y todavía se cuenta en el desempleo aunque ya trabaja. Su punto de inflexión principal es una discusión con Sofía, que se explica por los ocho roces de las tres semanas anteriores; de esa discusión nace además un rumor sobre él.
- **Los niños.** Su vida cabe en una etapa (la infancia), con enfermedades, amistades del colegio y lo que les cuentan. La resiliencia es alta (84–98 %), porque el ánimo se recupera pronto tras enfermar.

Defectos encontrados y corregidos:
1. **Muertes de antes de nacer como puntos de inflexión.** El informe recibe las muertes de todo el mundo, y a una niña de un año le salían muertes de 2000 y 2007. Ahora solo cuentan los hechos que le tocan a la persona y desde que nació (020).
2. **Relatos contados como consecuencias.** Los `RUMOR_TOLD` que citaban un hecho inflaban sus «consecuencias»; recuperarse de una gripa salía como punto de inflexión. Los relatos ya no cuentan, y la recuperación es rutina (020).
3. **La vida adulta a los 11 años.** Terminar la primaria abría el capítulo «vida adulta»; ahora abre desde los 16 (`themeMinAge`, 013).
4. **Una etapa no contada, mal clasificada.** Si en ese tramo recuerda otra etapa (el desempleo cuando ya trabaja), la diferencia es que no la cuenta («en su relato sigue el desempleo»), no que la sitúa 44 días antes (020).
5. **Contar de sí mismo una versión deformada.** Alguien contaba de sí «es agresivo»; la deformación ya no se aplica a lo propio (025).
6. **«Deuda de sueño de 0 h» como causa.** Sin deuda no se cita (019). Además, los textos de `why` y del informe pasan a ser neutros en género, y el «¿por qué?» de cada punto de inflexión se corta en 15 nodos para que se lea.

## Deuda que queda (para M4 y siguientes)

- **Paridad:** empleo 96,9 % (objetivo 55–90 %) y enfermedad 1,49 al año (objetivo 2–4), anteriores a M3.
- **Calibración de M3:**
  - relaciones: PA-142 a PA-145;
  - memoria: PA-146 a PA-148;
  - perfil: PA-149;
  - rumores: PA-150 a PA-152;
  - en particular, se cuenta mucho y la estabilidad laboral apenas varía (falta historia laboral en la 030).
- **Memoria por persona:** 71 KB frente a un objetivo de 40 (la deuda de MF8 crece). Los candidatos para recortar son las creencias y los recuerdos de desconocidos, los `cit.*` de personas olvidadas y la parte fija por antepasados.
- **Velocidad:** +43 % en el año. Todavía cabe en los 600 s del 021 CA-002 con 254 personas, pero con 500 no cabría sin optimizar los encuentros y la memoria.
- **Tamaño del mapa:** sigue alojando 254 personas cuando se piden 500.
- **Capa clínica:** la mentira activa y las sesiones (034).
