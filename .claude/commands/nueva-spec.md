---
description: Crea una nueva especificación a partir de la plantilla
argument-hint: <numero-nombre> (ej. 029-rumores)
---
Crea la spec `specs/$ARGUMENTS.md` usando `specs/_plantilla.md`.

1. Lee `docs/vision/mundo-social-autonomo.md` y busca todo lo relacionado con el tema.
2. Lee las specs de las que dependerá y cítalas en `depende_de`.
3. Rellena todas las secciones. Las reglas (`R-xxx`) deben ser verificables; los criterios (`CA-xxx`) en formato Dado/Cuando/Entonces y comprobables con una prueba automática.
4. Define los eventos nuevos con nombre `UPPER_SNAKE_CASE`, payload y `causes` esperadas.
5. Estima el coste de memoria por ciudadano si la spec añade estado.
6. Si la spec crea un módulo nuevo, indícalo y añade su fila en la tabla de `docs/prototipo-referencia.md` si porta algo del prototipo.
7. Deja `estado: borrador` (el índice `specs/000-indice.md` se regenera solo).
8. Termina listando las preguntas abiertas que necesitan decisión humana. No escribas código.
