---
modulo: leisure
ruta: packages/generators/src/leisure
estado: en-desarrollo
specs: [032, 029, 031, 033, 009, 035, 041]
actualizado: 2026-09-25
---

# Módulo: leisure

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Ficha de esparcimiento inicial de cada persona viva (spec 032): qué hace para divertirse, cuánto le gusta y con qué frecuencia. Depende de la personalidad, la edad, el sexo, el estrato, la salud, el dinero, el tiempo libre y la oferta de lugares. El uso diario (elegir la actividad en cada bloque de ocio) llega en M2.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 032 | CA-001 a CA-005; R-001 a R-005; INV-001 a INV-003 | CA-006 y R-006: los cubre el módulo `decision` del motor (bloque E de M2), con la prueba de una semana en `vida.test.ts`; R-007 (compañía, M3); R-008 (cambio de aficiones, M5) |

## 3. API pública
La usa `generateWorld`; `leisureParams` y `leisureTable` se exportan desde `@datas-world/generators`.

| Símbolo | Descripción |
|---|---|
| `leisureParams(profile, date)` → `LeisureParams \| null` | Parámetros del perfil. `null` si no tiene ficha de esparcimiento (perfil prototipo) |
| `generateLeisure(world, livingIds, catalog, P, rng)` → eventos | Genera la ficha de cada persona de 3 años o más (`Citizen.leisure`) y sus `LEISURE_TAKEN_UP`. Cada afición lleva `lastDone`, un momento al azar de su intervalo (30 días / `perMonth`), para que el motor de decisiones no las haga todas el primer día |
| `leisureTable(catalog, profile, date)` → `LeisureTable` | Tabla para el motor de decisiones (017): lugares, si se puede en casa, coste por vez (la mensualidad repartida), horas, grupo y exigencia física. Vacía sin ficha de esparcimiento |
| `selectActivities`, `offerOf`, `reachOf` | Elección de actividades (R-001) y oferta de lugares, local o regional (R-004) |
| `expectedSpend(world, id, catalog, P)`, `leisureBudget(world, id, P)` | Gasto mensual esperado y presupuesto de una persona (R-002), para informes y pruebas |
| tipo `ActivityAttrs` | Atributos del catálogo `leisure_activities` |

## 4. Diseño interno y decisiones
- **Elección (R-001).** Para cada actividad posible:
  - la probabilidad es la popularidad del perfil × los factores de la persona;
  - los factores son sexo, curva de edad, rasgos y valores de la 009 (`1 + peso · (2·rasgo − 1)`) y coste frente al estrato;
  - los factores se normalizan por su media en el mundo, así la práctica total sigue la popularidad;
  - después se completa hasta `min` y se recorta a `max` (2 y 8) por puntuación.
- **Salud (R-003).** Quien tiene discapacidad para caminar o para el autocuidado no tiene actividades de esfuerzo. Con EPOC o artrosis, no tiene las de esfuerzo 2 o más.
- **Oferta (R-004):**
  - una actividad sin lugar en el municipio, ni en casa, ni en la ciudad de referencia no se asigna;
  - si solo se hace en La Capital, su frecuencia se multiplica por `leisure.regionalFrequency` (0,3) y cuesta el viaje de ida y vuelta.
- **Frecuencia y límites:**
  - veces al mes = frecuencia típica × (0,5 + afinidad);
  - R-005, tiempo: la suma semanal no pasa de las horas libres de su situación (80 % si cuida menores; ENUT);
  - R-002, dinero: el gasto esperado no pasa de su parte del presupuesto del hogar. El presupuesto es la proporción por estrato (ENPH: 3,1 % de media) × el ingreso aproximado: sueldos formales, informales y pensión en salarios mínimos. Si se pasa, bajan las frecuencias de las actividades pagas.
- **Medido en 20 mundos:**
  - 6 actividades por persona de media;
  - práctica en personas de 12 años o más: cine 0,38 (DANE: 0,40) y lectura 0,48 (DANE: 0,50);
  - correlación de la extraversión con las actividades en compañía: 0,42; de la apertura con las culturales y artísticas: 0,40.
- **Punto de calibración.** Con el 3,1 % del ingreso, las actividades pagas son poco frecuentes. Ir a cine en La Capital, con entrada y bus, sale ≈ 1 vez al año; ver televisión, ≈ 21 veces al mes. Es realista para un pueblo, pero conviene revisarlo con la economía (015).
- **Coste:** ≈ 6 aficiones × 40 B por persona. Añade ≈ 1 100 eventos por mundo.

## 5. Invariantes y guardarraíles
- 032 INV-001: actividades del catálogo, dentro de su rango de edad y compatibles con la salud.
- 032 INV-002: afinidad en [0,1], veces al mes en [0,30], entre `min` y `max` actividades.
- 032 INV-003: toda actividad asignada tiene un lugar posible (en casa, en el municipio o en La Capital).

## 6. Cómo se prueba
`leisure.test.ts` (7 pruebas):
- CA-001 (INV-001 a INV-003 y eventos);
- R-003 (salud);
- CA-005 (determinismo);
- el perfil prototipo sin ficha;
- sobre 20 mundos: CA-002 (correlaciones), CA-003 (gasto por estrato y presupuesto) y CA-004 (cine y lectura frente al DANE).

## 7. Paridad con el prototipo
No aplica: el perfil `prototipo` no tiene ficha de esparcimiento. El prototipo elige el ocio en cada momento (`decide`), lo que corresponde a M2 (R-006).

## 8. Pendientes y deuda
- [ ] Revisar los pesos de rasgos y valores con expertos en psicología (tabla de la 009).
- [ ] Calibrar el presupuesto con la economía (015) y la ECC 2022 o 2024 cuando esté disponible.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-25 | m1/j-ocio | — | Documento creado desde la plantilla (sin código) |
| 2026-09-25 | m1/j-ocio (J5) | 032, 029, 031, 033 | Primera implementación: `params.ts`, `select.ts` y `generate.ts`. 7 pruebas |
| 2026-09-25 | m2/e-decisiones | 032, 017 | `leisureTable` para el motor de decisiones; `lastDone` inicial de cada afición. Prueba nueva `vida.test.ts`: una semana del mundo generado con decisiones (frecuencia de la ficha y diversión) |
| 2026-09-25 | mf/1-temperamento (MF1.4) | 032, 035 | La elección de la ficha lee los `traits` y `values` del catálogo por el adaptador @deprecated: los rasgos siguen modulando (la impulsividad desde `tmp.discount0`); los valores dan 0,5 (neutro) y ya no modulan. Caduca en MF7.3 (ficha desde el desarrollo) |
| 2026-09-28 | mf/7-desarrollo (MF7.3) | 032, 041 | Sin adaptador: `learnedColumn` lee lo aprendido que nombra el catálogo (una respuesta o un dominio vital) y la elección usa la posición de la persona en la población (`0,5 + 0,2 × z`). La apertura de la 009 v0.3 pasa a ser el valor del conocimiento en la cultura y el de la creatividad en el arte y la música. 032 CA-002 se comprueba con lo aprendido (abrirse → actividades en compañía; valorar el conocimiento o la creatividad → cultura y arte) |
