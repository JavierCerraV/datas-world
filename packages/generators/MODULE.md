---
modulo: generators
ruta: packages/generators
estado: planificado
specs: [001, 023]
actualizado: 2026-09-23
---

# Módulo: generators

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Genera el mundo inicial a partir de semilla y parámetros. Cada generador (geografía, lugares, organizaciones, población, hogares, personalidad, objetos) vive en `src/<generador>/` con su MODULE.md.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 001 | — | todos |
| 023 | — | todos |


## 3. API pública
Por definir al implementar.

## 4. Diseño interno y decisiones
Composición de generadores en orden: geografía → lugares → organizaciones → población por hogares → personalidad → relaciones iniciales → objetos.

## 5. Invariantes y guardarraíles
Mismo seed → mismo mundo. Generación explicada: cada situación inicial tiene eventos de backstory.

## 6. Cómo se prueba
Por definir al implementar.

## 7. Paridad con el prototipo
Porta `genWorld`, `buildPlaces`, `genPopulation`, `newAgent`, `genJobs`, `genRelations`, `genObjects`, `genFacts`.

## 8. Pendientes y deuda
- [ ] Primera implementación.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-23 | kit de arranque | — | Documento creado (sin código) |
