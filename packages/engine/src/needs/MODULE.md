---
modulo: needs
ruta: packages/engine/src/needs
estado: en-desarrollo
specs: [010, 009, 021, 031]
actualizado: 2026-09-25
---

# Módulo: needs

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Estado interno que cambia hora a hora (spec 010): necesidades, emociones, estrés, ánimo, deuda de sueño y enfermedades agudas. Sin diagnósticos (010 R-008).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 010 | CA-003, CA-004, CA-005; R-001 a R-008 (R-005: la tabla de emociones por evento está; la usan los sistemas que emiten cada evento) | CA-001 lo cubre el módulo `routines` (`OVERSLEPT`); CA-002 y CA-006 (bloque H, 1 año) |
| 009 | CA-004 (el estrés sube más con neuroticismo alto) | — |
| 031 | CA-006 (con EPOC, menos energía) | — |

## 3. API pública
Desde `@datas-world/engine`:

| Símbolo | Descripción |
|---|---|
| `NEEDS_SYSTEMS` (`needsSystem`, `illnessSystem`, `sleepSystem`) | Los tres sistemas del módulo para el registro (021), con la capacidad `needs` |
| `initNeeds(world, rng)`, `defineNeedsColumns(world)`, `NEEDS_COLUMNS`, `NEEDS`, `EMOTIONS`, `stability(world, row)` | Columnas y estado inicial; lo llama `generateWorld` al crear el mundo |
| `emotionPatches(view, row, eventType)`, `EVENT_EMOTIONS` | Parches que suben las emociones por un evento (R-005), filtrados por la personalidad |
| `needsParams(profile, date)`, `acuteKeys(P)`, tipo `NeedsParams` | Parámetros del perfil (029), memorizados por perfil y fecha |
| `ACTIVITY`, `ACTIVITY_COLUMN`, tipo `ActivityKind` (en `src/activity.ts`) | Actividad actual (`act.kind`, u8), que escriben las rutinas y las decisiones y leen las necesidades |

## 4. Diseño interno y decisiones
- **Porta `updateNeeds` del prototipo**, con las necesidades en "1 = satisfecha" (hambre → `need.hunger` = 1 − hambre; soledad → `need.social`). Añade higiene, diversión, emociones y la ficha de salud. Los parámetros van en el perfil: `needs.rates`, `needs.stress` y `needs.mood` (029).
- **Estrés (R-002):** tiende a un objetivo, como en el prototipo:
  - base + inestabilidad (1 − estabilidad, con estabilidad = 1 − neuroticismo) + estresores × (0,5 + neuroticismo) × (1,5 − resiliencia);
  - los estresores son: poco dinero o deuda, desempleo, hambre, agotamiento y enfermedad;
  - el mismo golpe estresa más a quien tiene neuroticismo alto, y la media coincide con el prototipo.
- **Ánimo (R-003):** tiende a su línea base personal (0,55 + 0,12·(estabilidad − 0,5), la del prototipo), corregida por energía, estrés, soledad, hambre, valencia emocional y diversión.
- **Emociones (R-005):** 5 con nombre, que decaen con media vida de 12 h. Los eventos las suben mediante `emotionPatches`: las negativas × (0,5 + neuroticismo) y la alegría × (0,5 + extraversión).
- **Salud (R-006, R-007):**
  - `health.energyFactor` (1 + 2 × carga de las condiciones de la 031; EPOC → × 1,3) acelera la caída de energía;
  - la enfermedad aguda se decide a medianoche: base del perfil × edad × estrés × deuda de sueño × salud física; dura los días del perfil y termina con `RECOVERED`;
  - las enfermedades y su duración están en el perfil (`health.acute.*`), no en un catálogo, porque son tasas del país.
- **Comer:** con la actividad `eat`, el hambre sube `eatRate` por hora (1,3), así que un desayuno de 30 min sacia ≈ 0,4 y un almuerzo de 45 min ≈ 0,65, como el prototipo.
- **Sueño (R-004):** `state.sleptToday` suma los minutos dormidos (y el reposo del enfermo); a medianoche, la deuda suma lo que faltó respecto a `health.sleepHours` de la ficha. `OVERSLEPT` lo emite la rutina (módulo `routines`), con la deuda como causa.
- **Compañía:** sin posiciones todavía (016, bloque D), se aproxima por la actividad (trabajo, estudio, socializar, ocio, cuidado).
- **Rendimiento:** los sistemas devuelven un parche `setMany` por columna. Con el mundo de M1 (199 personas), 30 días de necesidades tardan ≈ 1,7 s.
- **Coste:** 21 columnas ≈ 64 B por persona.

## 5. Invariantes y guardarraíles
- 010 INV-001: todos los valores en [0,1] y sin NaN (las pruebas lo comprueban cada hora durante 30 días).
- 010 INV-002: solo parches del sistema.
- 010 INV-003: una persona enferma tiene `health.acuteUntil` > ahora hasta su `RECOVERED`.

## 6. Cómo se prueba
`needs.test.ts` (6 pruebas, con un perfil de prueba y una rutina mínima):
- estado inicial;
- CA-003: 30 días con la vista congelada y el mismo hash con la misma semilla;
- CA-004 y 031 CA-006: EPOC;
- CA-005 y 009 CA-004: pérdida del empleo, emociones y estrés según el neuroticismo;
- R-007: incidencia de enfermedades en medio año;
- R-004: deuda de sueño.

## 7. Paridad con el prototipo
Porta `updateNeeds` (tasas de energía, hambre y soledad; objetivos de estrés y ánimo) y `bump`. El perfil `prototipo` tiene los mismos valores y una sola enfermedad genérica (≈ 2,2 episodios al año, como la línea base). La paridad del ánimo y del estrés se mide en el bloque H.

## 8. Pendientes y deuda
- [x] `OVERSLEPT` y 010 CA-001 con la rutina (bloque C, módulo `routines`).
- [ ] Compañía real por ocupación de los lugares (bloque D).
- [ ] `EMOTIONAL_OUTBURST` con las relaciones (M3).
- [ ] Revisar la tabla de emociones por evento con expertos (como la de rasgos de la 009).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-25 | m2/b-necesidades | — | Documento creado desde la plantilla (sin código) |
| 2026-09-25 | m2/b-necesidades (B1–B4) | 010, 009, 031, 021 | `columns.ts`, `params.ts`, `system.ts`, `illness.ts`, `emotions.ts` e `index.ts`; `src/activity.ts`. 6 pruebas |
| 2026-09-25 | m2/c-rutinas | 010 | Comer sacia: con `eat`, el hambre sube `eatRate` por hora (1,3; prototipo: desayuno −0,4, comida −0,65). Las pruebas usan `TEST_PROFILE` de `testing.ts` |
| 2026-09-25 | m2/d-movilidad | 010 | El reposo del enfermo cuenta como sueño: antes, cada día de enfermedad sumaba una noche entera de deuda y, al curarse, la persona se quedaba dormida horas durante días (visto en una semana del mundo generado) |
| 2026-09-25 | m2/e-decisiones | 010, 032 | El ejercicio (`exercise`) también sube la diversión, como `leisure` y `socialize` |
