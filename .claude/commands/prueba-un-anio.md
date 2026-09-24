---
description: Ejecuta la prueba de validación "100 ciudadanos durante 1 año"
argument-hint: <semilla> (opcional, por defecto 482917)
---
Ejecuta la prueba de validación de la visión (sección de pruebas) con semilla `$ARGUMENTS` (o 482917 si está vacío).

1. `pnpm cli world:new --seed <semilla> --population 100` y `pnpm cli world:advance --days 365`.
2. Mide: tiempo total, ticks/s, memoria máxima (RSS), tamaño de la base SQLite.
3. Comprueba: ningún NaN/valor fuera de rango, reproducibilidad (repite con la misma semilla y compara hash de estado), divergencia (semilla distinta produce historias distintas).
4. Estadísticas de población: distribución de ánimo, estrés, dinero, empleo, relaciones, eventos por tipo. Señala distribuciones degeneradas (todos iguales, todos en 0 o 1, crecimiento sin límite).
5. Elige 5 ciudadanos al azar (con el RNG de la prueba) y genera su informe de vida (spec 020). Juzga si cada historia es plausible y explicable.
6. Compara también con la línea base del prototipo (`docs/prototipo-referencia.md`).
7. Guarda el informe en `docs/validaciones/AAAA-MM-DD-semilla.md` y resume los hallazgos y las calibraciones sugeridas.
