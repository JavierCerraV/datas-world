---
description: Implementa una spec aprobada con pruebas primero y documentación del módulo al día
argument-hint: <numero-nombre> (ej. 012-relationships)
---
Implementa `specs/$ARGUMENTS.md`.

1. Verifica que la spec tiene `estado: aprobada`. Si no, detente y avísame (no cambies tú el estado).
2. Verifica que sus dependencias (`depende_de`) están implementadas.
3. Identifica el módulo destino (tabla de `docs/prototipo-referencia.md`). Si no existe su `MODULE.md`, créalo desde `docs/modulos/_plantilla-MODULE.md`, con la spec en `specs:`.
4. Lee las funciones del prototipo que la spec porta y los parámetros heredados.
5. Presenta un plan breve: rama, archivos, tipos, eventos, qué `CA-xxx` cubre cada prueba y diferencias deliberadas con el prototipo.
6. Crea la rama (`git switch -c <hito>/<nombre>`). Escribe primero las pruebas de los CA (junto al código, `*.test.ts`) y confirma que fallan.
7. Implementa lo mínimo para que pasen, respetando las reglas de oro de CLAUDE.md.
8. Actualiza el `MODULE.md`: API pública, diseño y decisiones, tabla de criterios cubiertos o pendientes, paridad con el prototipo, pendientes y una fila en la bitácora.
9. Ejecuta `pnpm check` y la prueba de determinismo. Desde M2, también `pnpm cli validate:parity`.
10. Si la implementación reveló algo, actualiza la spec (con fila en su historial). Cuando todos los CA pasen, propón pasarla a `implementada` y pídeme confirmación.
11. Marca la tarea en `tasks/`, haz commit con los IDs (`feat(engine): … [NNN CA-001..CA-00x]`), haz push y abre el PR con `gh pr create`, rellenando la plantilla.
