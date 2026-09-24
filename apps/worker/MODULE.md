---
modulo: worker
ruta: apps/worker
estado: planificado
specs: [002, 027]
actualizado: 2026-09-23
---

# Módulo: worker

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Proceso que carga el mundo, lo avanza a la velocidad configurada, atiende órdenes de control y persiste por lotes. Añadirá 021 al integrar los niveles de simulación.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 002 | — | todos |
| 027 | — | todos |


## 3. API pública
Por definir al implementar.

## 4. Diseño interno y decisiones
Bucle con temporizador real solo aquí (fuera del motor).

## 5. Invariantes y guardarraíles
Apagado limpio con SIGTERM. Un worker por mundo.

## 6. Cómo se prueba
Por definir al implementar.

## 7. Paridad con el prototipo
Equivale al bucle `requestAnimationFrame` + `tick` del prototipo.

## 8. Pendientes y deuda
- [ ] Primera implementación.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-23 | kit de arranque | — | Documento creado (sin código) |
