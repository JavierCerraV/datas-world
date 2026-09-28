---
modulo: development
ruta: packages/generators/src/development
estado: en-desarrollo
specs: [041, 030, 036, 037, 038, 039]
actualizado: 2026-09-28
---

# Módulo: development

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Historia de aprendizaje sintética (spec 041): cada persona llega al presente del mundo habiendo vivido una infancia, una juventud y una vida adulta en episodios. Los episodios se aprenden con los mecanismos del motor (036, 037, 038, 039), así que lo que la persona teme, valora o evita sale de su historia y se rastrea hasta el episodio que lo formó.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 041 | R-001 a R-009; CA-001 a CA-006 (CA-005 y CA-006 con la API y el visor); INV-001 e INV-002; 042 V-12 y 009 CA-F | Revisión experta del catálogo y las tasas (PA-120, PA-121) |

## 3. API pública
| Símbolo | Descripción |
|---|---|
| `generateDevelopment(world, citizenIds, prior, catalogs, onto, rng)` → `{ events }` | La fase de desarrollo de `generateWorld`: episodios de cada persona, aprendidos en orden, y un `DEVELOPMENT_YEAR` por año de vida |
| `applyEffects(store, net, effects, at, speakerStim, learner)` | Aplica los efectos de un episodio (`pair`, `operant`, `value`, `teach`) y devuelve lo aprendido |
| `EPISODES_PER_YEAR`, `MOOD_CENTER`, `MOOD_SPREAD` | Densidad (50 y 12 por año) y el ánimo de base desde el balance de lo vivido |
| `episodeDefs(catalog)`, `stageOf(age)`, tipos `EpisodeDef`, `Effect`, `Stage` | El catálogo `development_episodes` en la forma del generador |
| `devContext`, `historyIndex`, `meets`, `aliveAt`, `birthOf` | El contexto de cada persona: familia con fechas, hechos de infancia y condiciones de su vida adulta |

## 4. Diseño interno y decisiones
- **Densidad (R-001, decisión 1):** 50 episodios por año de 0 a 17 años y 12 de adulto (± 20 %), en un minuto al azar de cada año. Cada año se sortea el tipo de episodio por su peso en la etapa: infancia (0–5), escolar (6–11), adolescencia (12–17) y adulto.
- **Peso de un episodio:** peso base × modificadores (hechos de infancia de la 030, estrato ≤ 2, estudios superiores) × estilo de la familia, y 0 si no cumple sus condiciones (`edad_2`, `edad_14`, `empleado`, `con_pareja`, `con_hijos`).
- **Estilo de la familia [M]:** calidez, dureza y hablar de emociones, lognormales, sorteados una vez por familia (clave: la madre, o el padre) y compartidos por los hermanos. Multiplican los episodios que acercan, los conflictivos y «nombrar lo que siente». Sin él, todos terminaban iguales: en la 036 la fuerza de una respuesta se acerca al resultado que obtiene, así que la diversidad sale de qué episodios vive cada uno.
- **Episodios contrarios:** el catálogo incluye episodios que castigan o extinguen lo que otros refuerzan (castigar la expresión emocional, burlarse de una confidencia, castigar la defensa, enfrentar los problemas en casa). El estilo decide cuáles pesan más.
- **Quién interviene:** `cuidador_principal` (la abuela si creció con sus abuelos; si no, la madre, el padre o un abuelo vivo), `progenitor` (madre o padre vivos, al azar), la pareja, o un rol genérico (docente, par, jefe). Su estímulo `rol.*` recibe la función del episodio.
- **Hechos de la 030 (R-006):** separación de los padres, muerte del padre en la adolescencia, mudanzas, muerte de un pariente (duelo, al día siguiente), estudios terminados y migración producen su episodio en su fecha, con ese hecho como causa.
- **Registro (R-007, decisión 6):** todos los episodios quedan en el registro. Van agrupados en un evento `DEVELOPMENT_YEAR` por año de vida, cada uno con `[minuto, clave, rol, id, valencia, causa, aprendido]`. Un evento por episodio ocupaba ≈ 103 MB con 199 personas; agrupado ocupa ≈ 24 MB. El texto de cada episodio está en el catálogo. Lo aprendido va con dos decimales y sin los cambios menores de 0,005. Participa en el evento quien intervino y vive en su fecha (030 INV-002). El evento es el origen (`src`) de lo que cambió (INV-001).
- **Ánimo de base (decisión 4) [M]:** `0,55 + 0,3 × (balance − 0,3)`, con el balance = (lo que acercó − lo que dolió) / total, recortado a [0,3, 0,8].
- **Coste:** ≈ 1,2 s por mundo de 199 personas; ≈ 7 000 eventos y ≈ 200 000 episodios; base ≈ 24 MB.

## 5. Invariantes y guardarraíles
- 041 INV-001: lo aprendido en el desarrollo tiene su `DEVELOPMENT_YEAR` como origen (`src`). Prueba CA-002.
- 041 INV-002: flujos `gen:development/<id>` y `gen:development/familia/<madre o padre>`; misma semilla, misma historia.
- 030 INV-002: nadie participa en un evento antes de nacer ni después de morir.

## 6. Cómo se prueba
`src/development/development.test.ts` (5 pruebas, mundo de la semilla 482917):
- CA-001: tiempo y densidad;
- R-007: el evento por año, sus participantes y sus causas;
- CA-002 e INV-001: el origen de las 5 funciones más fuertes de 10 personas;
- CA-003: diversidad (abrirse, evitar, «Yo», valores) y más castigo físico en los estratos bajos;
- CA-004 y 042 V-12: con el mismo temperamento e historias distintas, repertorios distintos; con temperamentos opuestos y la misma historia, más parecidos.

## 7. Paridad con el prototipo
No aplica: el prototipo no tiene historia de aprendizaje.

## 8. Pendientes y deuda
- [ ] Revisión experta del catálogo, las tasas y las fuentes colombianas (PA-120, PA-121).
- [ ] Hermanos como interlocutores, y episodios de la pareja antes de formar el hogar.
- [ ] Relaciones enseñadas por la comunidad verbal en más episodios (037, PA-031).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-28 | mf/7-desarrollo (MF7.1) | 041 | Documento creado desde la plantilla (sin código) |
| 2026-09-28 | mf/7-desarrollo (MF7.1, MF7.2, MF7.5) | 041, 036, 037, 038, 039 | Primera implementación: catálogo, contexto, estilo de la familia, episodios sorteados y disparados por la 030, aprendizaje con los mecanismos del motor, un `DEVELOPMENT_YEAR` por año de vida y ánimo de base desde la historia. 5 pruebas |
