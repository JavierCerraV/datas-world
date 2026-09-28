---
modulo: personality
ruta: packages/generators/src/personality
estado: en-desarrollo
specs: [009, 029, 035]
actualizado: 2026-09-25
---

# Módulo: personality

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Genera el **temperamento** de cada ciudadano (spec 009 v1.0, ADR-007) en columnas del mundo:
- los descriptores Big Five;
- los parámetros de aprendizaje `tmp.*`.

Nada de esto produce conducta: solo lo leen los mecanismos de aprendizaje (009 R-003, R-006). También contiene el adaptador `@deprecated` de los generadores (`legacy.ts`), que caduca en MF7. No decide quién existe: lo llama el generador de población.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 009 v1.0 | CA-A, CA-C, CA-D, CA-G; R-001, R-002, R-007; INV-001–INV-003. CA-B, en `engine/src/architecture` y `generators/src/architecture` | CA-E (MF2, con el mecanismo respondiente de 036), CA-F (042 V-12), CA-H y R-005 (M3+) |

## 3. API pública
Desde `@datas-world/generators`:

| Símbolo | Descripción |
|---|---|
| `definePersonalityColumns(world, traits, temperament)` | Comprueba el catálogo de temperamento y define las columnas `f32` de descriptores y parámetros (0,5 inicial). Idempotente |
| `generatePersonality(world, citizenId, traits, { traitSd, extremeP }, rng)` → `{ extremeTrait? }` | Descriptores Big Five (R-001) con el flujo `gen:personality`, que usa `rng.fork(citizenId)` por dentro |
| `generateTemperament(world, citizenId, temperament, rng)` | Parámetros `tmp.*` (R-002) desde los descriptores ya guardados, con el flujo `gen:temperament`, por persona y por parámetro |
| `checkTemperamentCatalog(temperament, traits)` | 009 INV-003 y CA-A: `modula` no vacío y registrado, ningún término de conducta o clínico, mapeo solo desde descriptores. Lanza con todos los problemas |
| tipo `TemperamentAttrs` | Atributos de una entrada de `temperament_params` |

## 4. Diseño interno y decisiones
- **Catálogos** (ADR-006):
  - `personality_traits` 2026.10.1: solo los 5 descriptores Big Five;
  - `temperament_params` 2026.10.1: 8 parámetros, cada uno con columna, `modula`, `base`, `mapping`, `residualSd`, `scale`, `status` y `basis`;
  - `life_domains` 2026.10.1: los 12 valores del prototipo como dominios vitales, sin columnas (sustituye a `personal_values`).
- **Descriptores (R-001):** el algoritmo de la v0.3, sin cambios:
  1. una normal estándar por descriptor;
  2. correlaciones por mezcla que conserva la varianza (ninguna por defecto);
  3. `0,5 + sd·z` recortado a [0,03, 0,97];
  4. con probabilidad `extremeP`, uno al azar se vuelve extremo.
- **Parámetros (R-002):** `clamp(base + Σ w·(descriptor − 0,5) + N(0, residualSd), 0,02, 0,98)`, con el azar de `gen:temperament/<id>/<clave>`. Añadir un parámetro al final no cambia los demás.
- **Eliminado respecto a la v0.3:**
  - rasgos extra (impulsividad, sensibilidad social, necesidad de aprobación, honestidad, resiliencia);
  - valores `val.*`;
  - afrontamiento (`pers.coping`, `copingFor`, `COPING`);
  - `topValues`.
- **Sin adaptador desde MF7.4 (041):** los hábitos (031) y la ficha de esparcimiento (032) salen de lo aprendido en la historia de desarrollo, no de los descriptores.
- **Correlación configurada (CA-C):** con 5 descriptores, el paso de extremos atenúa cualquier correlación configurada ≈ 30 % (ρ = −0,4 se mide −0,27 con 2 000 personas). El mecanismo se comprueba sin extremos: [−0,5, −0,3].
- **Coste:** 13 columnas, 52 B por persona (la v0.3 usaba 23 columnas, 89 B).

## 5. Invariantes y guardarraíles
- Descriptores en [0,03, 0,97] y parámetros en [0,02, 0,98].
- Flujo propio por persona y por parámetro.
- El catálogo de temperamento se valida al definir columnas.
- Solo este módulo, el temperamento del motor, la arquitectura y el informe de la CLI nombran columnas `tmp.*` o `pers.*` (009 R-006).

## 6. Cómo se prueba
`src/personality/personality.test.ts` (8 pruebas) sobre 500 personas:

| Criterio | Qué se comprueba |
|---|---|
| CA-A | Términos prohibidos, `modula`, y rechazo de catálogos malos |
| CA-C | Distribuciones y extremos; correlación configurada; parámetros en rango, con varianza y con el signo del mapeo |
| CA-D | 10 frente a 500 personas, y un parámetro añadido al final |
| CA-G | Un peso cambiado cambia su parámetro y el hash, no los descriptores |
| Otras | Determinismo; ausencia de columnas eliminadas; idempotencia |

## 7. Paridad con el prototipo
Los descriptores siguen portando `newAgent`: normal(0,5, 0,17) recortada y 22 % con uno extremo. Para la conducta, el prototipo deja de ser la referencia (ADR-007 §7).

## 8. Pendientes y deuda
- [ ] Tabla de expertos: parámetros, mapeo y correlaciones (PA-101, PA-102).
- [x] Retirar `legacy.ts` (MF7.3 y MF7.4: hábitos y ficha desde el desarrollo, 041 R-008).
- [ ] `TRAIT_SHIFT` y cambio lento (R-005, M3+).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-24 | m1/e-personalidad | — | Documento creado desde la plantilla (sin código) |
| 2026-09-24 | m1/e-personalidad (E1) | 009 | Catálogos `personality_traits` y `personal_values`; `definePersonalityColumns`, `generatePersonality` (normal recortada, correlaciones, rasgo extremo), `copingFor`, `topValues`. 7 pruebas: 009 CA-001, CA-002, CA-003 |
| 2026-09-25 | mf/1-temperamento (MF1.2–MF1.4) | 009 v1.0, 035 | Reorientación a temperamento (ADR-007): catálogos `personality_traits` (Big Five), `temperament_params` (nuevo) y `life_domains` (sustituye a `personal_values`); `generateTemperament` y `checkTemperamentCatalog`; se eliminan afrontamiento, extras, valores y `topValues`; adaptador `legacy.ts` (@deprecated). Cambia el hash de los mundos nuevos (009 INV-002). 8 pruebas: CA-A, CA-C, CA-D, CA-G |
| 2026-09-28 | mf/7-desarrollo (MF7.4) | 041, 009 | Se elimina el adaptador `legacy.ts`: nadie lo usa (hábitos y ficha salen de la historia) |
