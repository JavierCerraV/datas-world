---
modulo: lab
ruta: packages/engine/src/lab
estado: en-desarrollo
specs: [042, 036, 040, 037, 009]
actualizado: 2026-09-25
---

# Módulo: lab

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Laboratorio determinista de la batería de validación conductual (spec 042): escenarios con semilla que ejercitan los mecanismos del motor funcional en condiciones controladas, sin el mundo.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 042 | V-1, V-2, V-3, V-6 (MF2); V-4, V-5 (MF3); V-7, V-8, V-11a (MF4) | V-9, V-10, V-11b en adelante (MF5–MF8) |
| 040 | CA-001 (V-4), CA-002 (V-5) | — |
| 037 | CA-001 (V-7), CA-002 (V-8), CA-003 (V-11a) | — |
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
| `concurrentChoice(ratio, seed, trials?, total?)` | V-4: respuestas y reforzadores de dos respuestas con intervalo variable (`choice.ts`) |
| `delayChoice(a, da, b, db, seed?, trials?, k?)` | V-5: proporción de elección de la consecuencia menor y más próxima |

## 4. Diseño interno y decisiones
- Los escenarios usan solo los mecanismos de `functions` con `LEARNING_DEFAULTS` (042 R-002).
- **V-6 [M]:** probabilidad de evitar `0,05 + 0,9·fuerza`; evitar da alivio igual a la aversión elicitada por el aviso (reforzamiento negativo, dos factores). La exposición al evitar es tan breve que no extingue (conservación de la ansiedad de Solomon y Wynne, [T]); la adquisición sigue hasta 5 evitaciones seguidas (criterio clásico). Resultado: media de 5 sujetos ≈ 52 evitaciones con sensibilidad aversiva alta y ≈ 35 con baja. Está justo encima del umbral: la teoría de dos factores sola explica una persistencia moderada; la persistencia de cientos de ensayos pide otro mecanismo (señales de seguridad, PA-132).

- **V-4 [M]:** en cada ensayo el reforzador de cada respuesta se arma con su probabilidad (total 0,2) y espera a que se emita; elección por softmax sobre el aporte de la fuerza (040) y aprendizaje operante de la emitida. Pendiente 0,72 con R² ≈ 1 (subigualación, como en los datos). Depende de la riqueza del programa (0,64 con total 0,05; 0,73 con 0,3).
- **V-5:** valor = magnitud relativa descontada con k = 0,2 (036 R-009), softmax con la variabilidad por defecto: 10 ahora frente a 15 en 7 días, 76 %; 10 en 30 frente a 15 en 37, 48 % (la inversión es clara en signo pero pequeña).

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
| 2026-09-26 | mf/3-seleccion (MF3.5) | 042, 040 | `choice.ts`: V-4 (igualación: pendiente 0,72, R² ≈ 1) y V-5 (descuento e inversión: 76 % y 48 %), con `choice.test.ts` |
| 2026-09-26 | mf/4-red (MF4.4) | 042, 037 | `relational.ts`: V-7 (`trainedPair`, `relationOf`), V-8 (`comparisonTransform`) y V-11a (`chessScenario`), con `relational.test.ts` |
