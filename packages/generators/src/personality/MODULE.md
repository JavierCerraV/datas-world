---
modulo: personality
ruta: packages/generators/src/personality
estado: en-desarrollo
specs: [009, 029]
actualizado: 2026-09-24
---

# Módulo: personality

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Genera la personalidad de cada ciudadano (rasgos Big Five + extras, valores y estilo de afrontamiento) en columnas del mundo. No decide quién existe: lo llama el generador de población (bloque F).

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 009 | CA-001, CA-002, CA-003; R-001, R-002, R-003 | CA-004 (M2), CA-005 (M3) |

## 3. API pública
Desde `@datas-world/generators`:

| Símbolo | Descripción |
|---|---|
| `definePersonalityColumns(world, traits, values)` | Define las columnas `f32` de cada rasgo (inicial 0,5) y de cada valor (inicial 0), y la `u8` `pers.coping`. Es idempotente |
| `generatePersonality(world, citizenId, traits, values, { traitSd, extremeP }, rng)` → `{ extremeTrait? }` | Rellena la fila del ciudadano. `rng` es el flujo `gen:personality`; por dentro usa `rng.fork(citizenId)`. Devuelve el rasgo que se volvió extremo, si lo hubo |
| `copingFor(neuroticismo, responsabilidad, extraversión)` | Regla R-003 |
| `COPING`, `COPING_COLUMN` | Códigos de afrontamiento (0 problema, 1 evitativo, 2 apoyo social, 3 rumiación) y nombre de su columna |
| `topValues(world, citizenId, values, n = 3)` | Los `n` valores más altos, con desempate por el orden del catálogo |

## 4. Diseño interno y decisiones
- **Catálogos** (ADR-006):
  - `personality_traits`: 10 rasgos, con columna, rasgo equivalente del prototipo y correlaciones;
  - `personal_values`: 12 valores del prototipo.

  La tabla de expertos que llegará cambiará datos, no código.
- **Algoritmo por persona** (009 R-001):
  1. una normal estándar por rasgo, en el orden del catálogo;
  2. correlaciones por mezcla que conserva la varianza (`z_a = ρ·z_b + √(1−ρ²)·z_a`). La correlación debe apuntar a un rasgo anterior del catálogo; si no, error;
  3. `0,5 + sd·z`, recortado a [0,03, 0,97];
  4. con probabilidad `extremeP`, un rasgo al azar pasa a `U(0,03, 0,12)` o a `U(0,88, 0,97)`.

  Los valores son `U(0,1)` independientes. El afrontamiento se calcula con los rasgos ya guardados en `f32`, para que la regla dé lo mismo al releerlos.
- **Parámetros del perfil:** `gen.personality.traitSd` (0,17) y `gen.personality.extremeP` (0,22), tomados del prototipo.
- **Resultados** con 500 personas (semilla 482917):
  - medias entre 0,478 y 0,516;
  - desviaciones entre 0,167 y 0,191;
  - 23,6 % con un rasgo extremo;
  - r(resiliencia, neuroticismo) = −0,401;
  - afrontamiento: 44 % centrado en el problema, 18 % evitativo, 18 % apoyo social y 21 % rumiación.
- **Coste:** 23 columnas, unos 89 B por persona.

## 5. Invariantes y guardarraíles
Rasgos en [0,03, 0,97] y valores en [0,1]. Cada persona tiene su propio flujo de azar, así que añadir personas no cambia la personalidad de las que ya existen.

## 6. Cómo se prueba
`src/personality/personality.test.ts` (7 pruebas) sobre 500 personas de prueba (la población real llega en el bloque F):
- **CA-001:** media, desviación, rango y porcentaje de extremos;
- **CA-002:** correlación resiliencia ↔ neuroticismo y las otras 44 parejas;
- **CA-003:** 10 frente a 500 personas;
- **R-002:** valores y "tres principales";
- **R-003:** afrontamiento;
- determinismo;
- idempotencia y ciudadano inexistente.

## 7. Paridad con el prototipo
Porta `newAgent`: normal(0,5, 0,17) recortada a [0,03, 0,97] y 22 % con un rasgo extremo. Los 8 rasgos del prototipo tienen su equivalente en el catálogo; la estabilidad del prototipo es el neuroticismo invertido (`invert`). Diferencias deliberadas:
- dos rasgos extra (honestidad y resiliencia) y la correlación entre ellos;
- valores numéricos en lugar de una lista barajada. Los tres más altos equivalen a una permutación uniforme.

## 8. Pendientes y deuda
- [ ] Sustituir rasgos, valores y correlaciones por la tabla de expertos cuando exista (spec 009, pregunta abierta).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-24 | m1/e-personalidad | — | Documento creado desde la plantilla (sin código) |
| 2026-09-24 | m1/e-personalidad (E1) | 009 | Catálogos `personality_traits` y `personal_values`; `definePersonalityColumns`, `generatePersonality` (normal recortada, correlaciones, rasgo extremo), `copingFor`, `topValues`. 7 pruebas: 009 CA-001, CA-002, CA-003 |
