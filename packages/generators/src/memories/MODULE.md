---
modulo: memories
ruta: packages/generators/src/memories
estado: estable
specs: [013, 030, 041]
actualizado: 2026-09-29
---

# Módulo: memories

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
La memoria con que cada persona llega al día 0 (spec 013 R-002, R-010): recuerdos de su infancia y juventud desde su desarrollo (041) y de los hechos de su historia (030), ya olvidados en parte según su antigüedad, y los capítulos de su vida.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 013 | CA-007 (recuerdos y capítulos del pasado, topes, amnesia infantil) | — |

## 3. API pública
- `seedMemories(world, citizenIds, prior, catalogs, onto, p?)`: escribe `Citizen.memory` de cada persona viva y devuelve los `CHAPTER_OPENED` de todos sus capítulos. `generateWorld` la llama después del desarrollo, salvo en los mundos estáticos.
- `DEV_PER_YEAR` (2) y `FIRST_MEMORY_AGE` (4).

## 4. Diseño interno y decisiones
- **Desarrollo.** De cada `DEVELOPMENT_YEAR` desde los 4 años, los 2 episodios más salientes. Su valor es el de la 013 R-001 con las funciones de hoy (el adulto recuerda su infancia desde lo que siente ahora). La consecuencia es la suma de los λ que emparejó el episodio más 0,3 × su valencia de catálogo, porque esa valencia es gruesa (−1, 0, 1) y hay episodios dolorosos marcados 0. Estímulos: el rol, la persona concreta si vive en el mundo y lo primero que aprendió.
- **Historia.** Los hechos de la 030 que recuerda (los mismos tipos que la vida diaria; la muerte de padres, hijos, hermanos o pareja por genealogía), también desde los 4 años.
- **Olvido hasta hoy.** La intensidad se multiplica por la retención de la 013 R-004 a su antigüedad, con 2 repasos para la infancia (lo contado muchas veces) y 1 para lo adulto.
- **Lo repetido se funde.** De cada tipo de episodio o hecho quedan los 2 más intensos: sin esto, «logro en el trabajo» llenaba la memoria de los adultos (95 % de recuerdos positivos; con esto, 23 % negativos y 4,3 KB por persona).
- **Capítulos.** Infancia, adolescencia (12) y juventud (18) por edad, y los hechos con tema (estudios, migración, pareja, primer empleo, primer hijo, duelos, desempleo, jubilación). Dos cambios con menos de medio año de diferencia cuentan como uno. El tono sale de sus recuerdos o, si no los hay, de lo vivido en su desarrollo en ese tramo. Todos quedan en el registro como `CHAPTER_OPENED`; en la persona, los 12 más recientes.

## 5. Invariantes y guardarraíles
- 013 INV-002, INV-003 e INV-005 (lo comprueba `memory-world.test.ts`).
- Sin azar propio: todo sale del desarrollo y la historia ya generados.

## 6. Cómo se prueba
`packages/generators/src/memory-world.test.ts` (013 CA-007).

## 7. Paridad con el prototipo
Sin equivalente en el prototipo.

## 8. Pendientes y deuda
- [ ] PA-147: episodios por año y veces contadas, con fuentes sobre memoria autobiográfica (curva de reminiscencia).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-29 | m3/memoria (M3) | 013 | Documento creado desde la plantilla (sin código) |
| 2026-09-29 | m3/memoria (M3) | 013 | `seedMemories`: recuerdos de partida desde el desarrollo y la historia, olvido hasta hoy, fusión de lo repetido y capítulos del pasado con sus `CHAPTER_OPENED` |
| 2026-09-29 | m3/cierre | 013 | Los capítulos del pasado usan `themeOf`: terminar la primaria ya no abre la vida adulta |
