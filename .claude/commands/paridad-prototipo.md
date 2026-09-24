---
description: Compara el comportamiento del motor TS con el prototipo
argument-hint: <spec o módulo> (opcional)
---
Evalúa la paridad con el prototipo para `$ARGUMENTS` (o para todo si está vacío).

1. Si `docs/validaciones/linea-base-prototipo.json` no existe o el prototipo cambió, regénerala: `node scripts/prototipo/linea-base.mjs --seeds 100-109 --days 365`.
2. Ejecuta el motor TS con las mismas semillas y días (`pnpm cli validate:parity`; si aún no existe, dime qué falta para crearlo según la tarea correspondiente).
3. Muestra una tabla métrica por métrica (prototipo, motor TS, tolerancia de `docs/prototipo-referencia.md` y veredicto).
4. Para cada métrica fuera de tolerancia, indica la causa probable (regla, parámetro o spec) y propone una de dos salidas: corregir el motor, o documentar la diferencia como deliberada en la spec y en la sección 7 del `MODULE.md`.
5. Guarda el informe en `docs/validaciones/AAAA-MM-DD-paridad.md`.
