---
modulo: nombre-del-modulo
ruta: packages/engine/src/needs
estado: planificado          # planificado | en-desarrollo | estable
specs: []                    # ids de specs que implementa; TODAS deben estar aprobadas para escribir código
actualizado: AAAA-MM-DD
---

# Módulo: nombre

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Qué hace este módulo en una o dos frases y qué no hace.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|

## 3. API pública
Tipos y funciones exportadas, con su contrato (entradas, salidas, errores). Si algo no aparece aquí, es interno.

## 4. Diseño interno y decisiones
Estructuras de datos, algoritmo, por qué se eligió así, alternativas descartadas. Coste de memoria por entidad si aplica.

## 5. Invariantes y guardarraíles
Condiciones que el módulo garantiza y cómo se comprueban (prueba o aserción). Restricciones propias (p. ej. "no lee WorldState para hechos de otros").

## 6. Cómo se prueba
Archivos de prueba, comando, semillas usadas, pruebas de propiedades.

## 7. Paridad con el prototipo
Funciones de `prototipo/index.html` que porta, parámetros heredados y métricas comparadas con `docs/validaciones/linea-base-prototipo.json`. Diferencias deliberadas y su justificación.

## 8. Pendientes y deuda
- [ ] …

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
