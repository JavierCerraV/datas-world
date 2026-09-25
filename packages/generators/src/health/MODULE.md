---
modulo: health
ruta: packages/generators/src/health
estado: en-desarrollo
specs: [031, 029, 030, 006]
actualizado: 2026-09-25
---

# Módulo: health

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Ficha de salud inicial de cada persona viva (spec 031): afiliación al SGSSS, hábitos, peso, discapacidad, condiciones crónicas y salud física base. No simula enfermedades agudas (010) ni diagnósticos de salud mental (capa clínica, 034).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 031 | CA-001 a CA-005; R-001 a R-006, R-009 (con la precisión de §10: los antepasados solo tienen hipertensión y diabetes); INV-001 a INV-004 | CA-006, R-007 (efectos en necesidades y gasto, M2); R-008 (evolución, peldaño 4) |

## 3. API pública
Interna al paquete: la usa `generateWorld` (`src/generate.ts`).

| Símbolo | Descripción |
|---|---|
| `healthParams(profile, date, conditionKeys)` → `HealthParams \| null` | Parámetros del perfil (§8 de la 031). `null` si el perfil no tiene ficha de salud: el perfil prototipo no la tiene, por paridad |
| `generateHabits(world, livingIds, P, rng)` | Fase 1, antes del empleo. Define las columnas `health.*` y sortea tabaco, alcohol, actividad física, sueño, peso y discapacidad (flujo `gen:health/<id>`) |
| `limitsWork(world, id)` | Discapacidad para caminar o para el autocuidado (R-004). El empleo la usa |
| `generateConditions(world, livingIds, ancestorIds, catalog, P, rng)` → eventos | Fase 2, después de la historia: condiciones crónicas con `CONDITION_DIAGNOSED` |
| `generateInsurance(world, livingIds, priorEvents, P, rng)` → eventos | Afiliación (R-001) con `HEALTH_INSURANCE_SET` |
| `computePhysical(world, livingIds, catalog)` | `health.physical` (R-006) |
| `HEALTH_COLUMNS`, `DISABILITY_BITS`, `INSURANCE`, `INSURANCE_NAMES`, `stepAt` | Constantes y utilidades |

## 4. Diseño interno y decisiones
- **Dos fases.** La discapacidad baja la probabilidad de empleo (`gen.health.disabilityEmploymentFactor`), así que va antes. La afiliación depende del empleo, y el riesgo familiar de los antepasados, así que va después de la historia.
- **Prevalencias en el perfil, biología en el catálogo.**
  - `gen.health.condition.<clave>` da la prevalencia por escalones de edad;
  - el catálogo `health_conditions` (CIE-10) da la edad mínima, los multiplicadores de riesgo y el efecto sobre la salud física.
- **Normalización de riesgos.** En cada condición, los factores de cada persona se dividen por su media en el mundo:
  - los factores son sexo, peso, tabaco, alcohol de riesgo, actividad y otras condiciones;
  - así el total sigue siendo la prevalencia del perfil y los factores solo la reparten;
  - el antecedente familiar se aplica después, y las personas van de mayor a menor edad, para que los padres se decidan antes.
- **Antepasados:** solo hipertensión y diabetes (hereditarias), con la prevalencia de los mayores y diagnóstico entre los 45 y los 70 años, siempre antes de morir y del presente.
- **Afiliación (Ley 100):**
  - cotizan quien tiene empleo formal y quien tiene pensión;
  - policía y docentes oficiales van al especial;
  - son beneficiarios del mismo régimen la pareja y los hijos menores de 18 (o de 25 que estudian);
  - el resto va al subsidiado con la probabilidad del estrato; si no, queda sin afiliación.
- **Medido en 20 mundos, frente al perfil:**
  - contributivo 0,452 (0,44), subsidiado 0,465 (0,503), especial 0,067 (0,04), sin afiliación 0,016 (0,017);
  - exceso de peso en adultos 0,541 (0,564) y tabaquismo 0,081 (0,10);
  - discapacidad 0,078 (0,071), hipertensión 0,139 (0,119) y diabetes 0,047 (0,044);
  - salud física media de 0,98 (18–39 años) a 0,65 (60+).
- **Coste:** 7 columnas `u8` (7 B por persona) más ≈ 0,5 condiciones por persona. Añade ≈ 270 eventos por mundo.

## 5. Invariantes y guardarraíles
- 031 INV-001: rangos de las columnas y `health.physical` ∈ [0,05, 1].
- 031 INV-002: un empleado formal cotiza; un beneficiario tiene a su cotizante en el hogar.
- 031 INV-003: las condiciones son del catálogo, posteriores a su edad mínima y anteriores al presente, con su diagnóstico.
- 031 INV-004: los menores de 15 no fuman ni beben.

## 6. Cómo se prueba
`health.test.ts` (8 pruebas):
- INV-001 a INV-004 y los eventos con causas (CA-003);
- determinismo (CA-005);
- el perfil prototipo sin ficha;
- sobre el agregado de 20 mundos: afiliación (CA-001), prevalencias (CA-002) y salud física por edad y por número de condiciones (CA-004).

## 7. Paridad con el prototipo
No aplica: el perfil `prototipo` no tiene ficha de salud y su `health.physical` sigue siendo el de 007.

## 8. Pendientes y deuda
- [ ] Efectos en M2 (R-007): energía, `FELL_ILL`, sueño de partida, gasto en salud por régimen y estrato.
- [ ] Revisar los multiplicadores y la prevalencia por edad con expertos (hoy estimados).
- [ ] La hipertensión sale ≈ 2 puntos por encima del perfil por el riesgo familiar; está dentro de la tolerancia.

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-25 | m1/j-salud | — | Documento creado desde la plantilla (sin código) |
| 2026-09-25 | m1/j-salud (J4) | 031, 029, 030, 006 | Primera implementación: `params.ts`, `habits.ts` (fase 1), `conditions.ts` y `insurance.ts` (fase 2). 8 pruebas |
