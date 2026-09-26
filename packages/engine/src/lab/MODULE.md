---
modulo: lab
ruta: packages/engine/src/lab
estado: en-desarrollo
specs: [042, 036, 009]
actualizado: 2026-09-25
---

# Módulo: lab

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Laboratorio determinista de la batería de validación conductual (spec 042): escenarios con semilla que ejercitan los mecanismos del motor funcional en condiciones controladas, sin el mundo.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 042 | V-1, V-2, V-3, V-6 (bloque MF2) | V-4, V-5 (MF3); V-7 en adelante (MF4–MF8) |
| 036 | CA-001 (V-1), CA-002 (V-2), CA-003 (V-3), CA-004, CA-005 | — |
| 009 | CA-E | — |

## 3. API pública
Solo para pruebas y validaciones; no se exporta desde `@datas-world/engine`.

| Símbolo | Descripción |
|---|---|
| `acquisitionExtinction(sens?, λ?)` | V-1: 30 emparejamientos y 30 extinciones; valor neto tras cada ensayo |
| `recoveryRenewal()` | V-2: adquisición en A, extinción en B; pruebas en B, en B a los 7 días y en A |
| `generalizationGradient()` | V-3: gradientes de 9 tonos, simple (S+ = tono 4) y discriminativo (S− = tono 6) |
| `avoidancePersistence(sens?, seed?, criterion?, trials?)` | V-6: evitaciones en 100 ensayos sin descargas tras adquirir hasta el criterio |

## 4. Diseño interno y decisiones
- Los escenarios usan solo los mecanismos de `functions` con `LEARNING_DEFAULTS` (042 R-002).
- **V-6 [M]:** probabilidad de evitar `0,05 + 0,9·fuerza`; evitar da alivio igual a la aversión elicitada por el aviso (reforzamiento negativo, dos factores). La exposición al evitar es tan breve que no extingue (conservación de la ansiedad de Solomon y Wynne, [T]); la adquisición sigue hasta 5 evitaciones seguidas (criterio clásico). Resultado: media de 5 sujetos ≈ 52 evitaciones con sensibilidad aversiva alta y ≈ 35 con baja. Está justo encima del umbral: la teoría de dos factores sola explica una persistencia moderada; la persistencia de cientos de ensayos pide otro mecanismo (señales de seguridad, PA-132).

## 5. Invariantes y guardarraíles
042 R-002: solo los mecanismos del motor, con sus parámetros por defecto. Azar solo por `Rng` con flujo `lab:evitacion`.

## 6. Cómo se prueba
`battery.test.ts` (7 pruebas).

## 7. Paridad con el prototipo
No aplica.

## 8. Pendientes y deuda
- [ ] V-4 y V-5 (MF3).
- [ ] V-6 con señales de seguridad si se aprueba (PA-132).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-25 | mf/2-funciones | — | Documento creado desde la plantilla (sin código) |
| 2026-09-25 | mf/2-funciones (MF2.4) | 042, 036, 009 | Escenarios V-1, V-2, V-3 y V-6 y batería con 036 CA-001 a CA-005 y 009 CA-E |
