---
modulo: private
ruta: packages/engine/src/private
estado: en-desarrollo
specs: [039, 036, 037, 038, 044]
actualizado: 2026-09-28
---

# Módulo: private

> Documentación viva. Se actualiza en el mismo cambio en que se toca el código (lo exigen los guardarraíles).

## 1. Propósito
Capa 5 del motor funcional (spec 039). Los pensamientos son estímulos con función en la misma red de la 036 y la 037. El módulo modela:
- el pensamiento negativo repetitivo (PNR) como **episodio** con inicio, pasos y fin;
- la evitación experiencial como respuesta reforzada por el alivio;
- el enmarque jerárquico con «Yo» como repertorio aprendido.

No hay rasgos ni columnas de rumiación o evitación (039 INV-002): todo es proceso e historia. No elige la conducta abierta: la selección (040) recibe de aquí la carga y el alivio como fuentes.

## 2. Specs que implementa
| Spec | Criterios cubiertos | Criterios pendientes |
|---|---|---|
| 039 | R-001 a R-007; INV-001 e INV-002; CA-001 a CA-003 (con `lab/private.ts`, 042 V-10) | Evitar a alguien, consumir y suprimir como respuestas del mundo (hoy solo dormir y distraerse); el enmarque con «Yo» con historia propia (MF7, 041) |

## 3. API pública
Desde `@datas-world/engine`:

| Símbolo | Descripción |
|---|---|
| `MindState`, `PrivateEvent`, `PnrEpisode`, `EpisodeEnd` | `Citizen.mind`: pensamientos activos (estímulo, función, de dónde salió, causa) y episodio en curso |
| `PRIVATE_DEFAULTS`, `PrivateParams` | 039 §8 y §9: entrada 0,5, salida 0,25, 12 pasos por hora, 16 activos, 3 pasos para registrar, desvanecimiento, alivio, «Yo» |
| `SELF_RESPONSE`, `AVOIDANCE_RESPONSES`, `AVOIDANCE_W0` | Respuestas del almacén de la 036: `yo.enmarque` y `evit.*` |
| `loadOf`, `rawLoadOf`, `focusOf`, `activate`, `scale`, `fade` | Carga (con y sin techo), foco, activar un pensamiento, escalar y desvanecer |
| `derivationStep`, `applyStep`, `consolidate` | R-002 y R-005: un paso de derivación por la red y su consolidación (`derived_stored`) |
| `responseStrength`, `seedResponse` | Fuerza vigente de una respuesta, o su fuerza de partida |
| `avoidanceOf(act)` | R-004: dormir → `evit.dormir`; ocio y ejercicio → `evit.distraccion` |
| `stepMind(mind, store, net, c, triggers, rng, p)` | El núcleo de un tick de la mente, sin mundo (lo usa el laboratorio) |
| `mindTick(view, row, ctx, onto, rng, p, triggers)` | Un tick en el mundo: lee la persona y llama a `stepMind` |
| `createPrivateSystem(onto, p?)` | Sistema `private` (fase `memory`, orden 5): disparos del tick y mente de quien tiene algo activo |

## 4. Diseño interno y decisiones
- **Disparo (R-001):** cada hecho aversivo del tick (λ < 0 en las reglas de la 036) activa, para cada participante, los estímulos presentes que tengan función aversiva para esa persona (la aprendida o la derivada por la red). En un despido dispara «despido», no «trabajo», que el sueldo volvió apetitivo. La creencia de una charla (044) entra con la función `−preocupación`.
- **Carga (PA-116):** la suma de las funciones aversivas activas, con techo 1. El alivio se mide sin techo, para que se vea aunque la carga esté en 1.
- **Episodio (R-002, R-003):** empieza con carga ≥ 0,5 (despierta). En cada tick sin evitar ni tomar distancia:
  - da un paso: deriva, desde el foco (el pensamiento más aversivo), el estímulo relacionado de función transformada más aversiva (`factor × función × fuerza`); si no hay a dónde ir, vuelve sobre lo mismo y se habitúa un 10 %;
  - quedarse con el pensamiento es exposición: un ensayo de extinción del disparador por paso (036 R-003);
  - termina con carga < 0,25 (`bajo`) o al llegar a 12 pasos en la hora (`tope`).
- **Consolidación (R-005):** un camino de varias aristas queda guardado como relación derivada directa. La red se vuelve más compleja y menos derivada, y el siguiente bucle llega antes.
- **Evitación (R-004):** pasar a dormir o a distraerse durante un episodio es emitir la evitación. Suprime la mitad de la carga, y ese alivio (normalizado por la entrada) refuerza la respuesta (036 R-002). Mientras sigue dormida o distraída, lo pensado se desvanece sin extinguirse: no hay contacto, así que la función se conserva (042 V-6). Dormir de noche no cuenta: solo el paso a dormir con un episodio abierto.
- **Selección (R-004, `decision/options.ts`):** con un episodio abierto, dormir un rato y cada afición llevan la fuente `alivio` = `2 × carga × fuerza de la evitación`. Así compite con las demás fuentes de la 040.
- **«Yo» (R-006, R-007):** en cada tick de episodio se emite con probabilidad igual a su fuerza (0,1 para todos hasta MF7). Si se emite, los eventos privados conservan la mitad de su función y el episodio termina. La respuesta se refuerza (resultado 1) si hay un dominio vital con función apetitiva (un valor al alcance) y se extingue (resultado 0) si no.
- **Coste:** solo cambia quien tiene algo activo; como mucho 16 pensamientos (< 1 KB por persona).

## 5. Invariantes y guardarraíles
- 039 INV-001: todo episodio termina (carga, evitación, «Yo» o tope de pasos por hora). Prueba con 20 redes al azar.
- 039 INV-002: ningún campo ni columna de rumiación o evitación: `mind` guarda lo activo y el episodio, no un rasgo.
- Sin temperamento directo: la sensibilidad llega por la 036 (`sensitivityOf`).

## 6. Cómo se prueba
- `src/private/private.test.ts` (7 pruebas): carga, activación y tope; paso de derivación, consolidación y repetición; episodio con disparo, sin carga suficiente, con evitación, con «Yo» (con y sin valor); INV-001 con redes al azar.
- `src/lab/private.test.ts` (6 pruebas, 042 V-10 y 039 CA-001 a CA-003).

Mundo de la semilla 482917, 30 días de vida normal: 59 enfermedades y 1 deuda, ningún episodio (carga máxima 0,06). Los hechos del mundo actual pesan poco; los episodios llegan con las revelaciones de la charla (044) y, más adelante, con los conflictos (M3) y la historia del desarrollo (MF7).

## 7. Paridad con el prototipo
No aplica: el prototipo no tiene eventos privados. El efecto en el estrés y el ánimo (MF6.4) se mide en `docs/validaciones/MF6-paridad-prototipo.md`.

## 8. Pendientes y deuda
- [ ] Evitar a alguien, consumir y suprimir como respuestas del mundo (PA-117).
- [ ] La historia del enmarque con «Yo» (041, MF7).
- [ ] Recordatorios: que la persona vuelva a pensar en una creencia al ver a quien trata.
- [ ] Calibración (PA-115, PA-116).

## 9. Bitácora de cambios
| Fecha | Tarea / commit | Specs | Cambio |
|---|---|---|---|
| 2026-09-28 | mf/6-privados (MF6.1) | 039 | Documento creado desde la plantilla (sin código) |
| 2026-09-28 | mf/6-privados (MF6.1 a MF6.3, MF6.5) | 039, 036, 037, 044 | Primera implementación: tipos (`Citizen.mind`), parámetros, lógica pura del PNR (`pnr.ts`), núcleo `stepMind` y sistema `private` (disparo, episodio, evitación, consolidación, «Yo»). Eventos `PNR_EPISODE` y `THOUGHT_DERIVED`. 7 pruebas |
| 2026-09-28 | mf/8-rendimiento (MF8.5) | 039, 021 | El sistema cede la propiedad de la mente, el almacén y la red que parchea (`owned`): son copias propias de `mindTick`. Sin cambios de comportamiento |
