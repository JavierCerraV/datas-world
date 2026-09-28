---
id: 032
nombre: leisure
estado: aprobada
hito: M1 (ficha inicial) · M2 (actividades en la rutina y gasto) · M3 (con amigos) · M5 (hábitos que cambian)
depende_de: [004, 007, 009, 010, 011, 012, 015, 023, 029, 031, 033]
version: 0.3
---

# 032 — Esparcimiento

## 1. Propósito
Cada persona tiene una **ficha de esparcimiento**: lo que hace para divertirse, con qué frecuencia, dónde y con quién. Algunos ejemplos:
- una señora de San Martín que va a misa, juega parqués con las vecinas y baila salsa los sábados;
- un joven de La Esperanza que juega fútbol, sale con amigos y va a cine al centro comercial de la ciudad cuando le pagan;
- un jubilado que lee en la biblioteca y hace voluntariado en la parroquia.

El esparcimiento responde a la necesidad `fun` (y en parte `social`) de la 010. Da contenido al tipo de actividad `leisure` de la rutina (011) y es una causa frecuente de encuentros (012), gastos (015) y recuerdos (013).

La visión lo pide cuando dice que la edad cambia los "intereses" y en la lista de lugares ("espacios culturales", "espacios públicos", §20).

## 2. Alcance
**Incluye:**
- el catálogo `leisure_activities`: qué actividades existen, dónde ocurren, cuánto cuestan y a quién atraen;
- la ficha de cada persona: sus actividades con afinidad y frecuencia;
- la generación inicial, coherente con la edad, el sexo, el estrato, la personalidad, los valores, la salud (031) y la oferta de lugares (033);
- las reglas de uso en la rutina (M2), con compañía (M3) y el cambio de aficiones (M5).

**Fuera de alcance:**
- la mecánica de elegir la actividad en cada momento (017, motor de decisiones);
- la calidad de la experiencia (disfrute, recuerdos): 010 y 013;
- el tiempo en redes o pantallas como adicción o problema: capa clínica, posterior.

## 3. Modelo de datos
**Catálogo `leisure_activities`** (ADR-006). Claves jerárquicas por categoría:

| Clave | Nombre | Dónde (`place_kinds`) | Coste por vez (estimado) |
|---|---|---|---|
| `social.salir_amigos` | Salir con amigos | café, bar, parque, centro comercial | bajo–medio |
| `social.salir_cenar` | Salir a cenar | restaurante | medio–alto |
| `social.visitar_familia` | Visitar a la familia | vivienda de un pariente | nulo |
| `social.juegos_mesa` | Parqués, cartas o dominó | vivienda, tienda de barrio | nulo |
| `baile.rumba` | Bailar (salsa, rumba) | bar o discoteca | medio |
| `arte.manualidades` | Arte y manualidades | vivienda, casa de la cultura | bajo |
| `arte.musica` | Tocar un instrumento o cantar | vivienda, casa de la cultura, iglesia | bajo |
| `cultura.cine` | Ir a cine | cine (033) | medio |
| `cultura.museo` | Ir a un museo | museo (033) | bajo |
| `cultura.lectura` | Leer o ir a la biblioteca | vivienda, biblioteca (033) | nulo |
| `deporte.futbol` | Jugar fútbol o microfútbol | parque, coliseo o polideportivo (033) | nulo–bajo |
| `deporte.gimnasio` | Ir al gimnasio | gimnasio | medio (mensual) |
| `deporte.caminar` | Caminar o montar en bicicleta | parque, calle | nulo |
| `deporte.ver_partido` | Ver un partido | coliseo (033), bar, vivienda | nulo–medio |
| `deporte.tejo` | Jugar tejo | cancha de tejo (bar) | bajo |
| `entretenimiento.parque_diversiones` | Ir a un parque de diversiones | parque de diversiones (033) | alto |
| `entretenimiento.centro_comercial` | Pasear en el centro comercial | centro comercial (033) | nulo–medio |
| `entretenimiento.tv_series` | Ver televisión o series | vivienda | nulo |
| `entretenimiento.videojuegos` | Videojuegos | vivienda | bajo |
| `comunidad.voluntariado` | Voluntariado | iglesia, colegio, parque, junta de acción comunal | nulo |
| `religioso.culto` | Misa, culto o grupo de oración | iglesia | nulo |
| `naturaleza.paseo_olla` | Paseo de olla o al río | fuera del municipio (033) | bajo |

Atributos de cada entrada:
- `placeKinds` (dónde ocurre);
- `costRange` (COP por vez, desde el perfil);
- `group` (`solo` · `con_otros` · `ambos`);
- `ageRange`;
- `physical` (exigencia física 0–3, que se cruza con la salud de la 031);
- `traits` (pesos de los rasgos de 009, p. ej. extraversión → rumba; apertura → museo);
- `values` (valores de 009, p. ej. altruismo → voluntariado; salud → gimnasio);
- `popularity` (proporción base de la población que la practica, del perfil).

**Ficha por persona** (en la entidad; es de tamaño variable):
```ts
interface LeisureInterest {
  key: string;             // clave de leisure_activities
  affinity: number;        // [0,1] cuánto le gusta
  perMonth: number;        // veces al mes que lo hace de media (0–30)
  since: WorldMinute;      // desde cuándo (< 0 si es previo al presente)
}
interface Citizen { /* … */ leisure?: LeisureInterest[] } // 2 a LEISURE_MAX actividades, en orden de afinidad
```
Coste estimado: 4 actividades de media × ≈ 40 B = 160 B por persona. Para 200 personas, ≈ 32 KB.

## 4. Reglas
- **R-001 (M1, generación)** — Para cada persona y cada actividad posible por edad y salud:

  `score = popularity × f(edad, sexo) × g(estrato, coste) × Π(rasgos) × Π(valores) × ruido`

  Se quedan las de mayor `score`, entre `LEISURE_MIN` y `LEISURE_MAX`. La `affinity` es el `score` normalizado. Flujo: `rng.fork('gen:leisure').fork(id)`.
- **R-002 (M1, presupuesto)** — La frecuencia de las actividades pagas se limita por el ingreso del hogar (008, 015): su gasto mensual esperado no supera `LEISURE_BUDGET_SHARE` del ingreso según el estrato. Una persona sin ingresos propios depende del hogar.
- **R-003 (M1, salud)** — Una actividad con `physical` mayor que lo que permite la salud (031: discapacidad para caminar, EPOC, artrosis) queda excluida o con frecuencia reducida.
- **R-004 (M1, oferta)** — Una actividad solo se asigna si existe un lugar de alguno de sus `placeKinds`, en el municipio o en la ciudad de referencia (033). Si el lugar está fuera del municipio, la frecuencia se reduce por el tiempo y el coste del viaje.
- **R-005 (M1, tiempo)** — El tiempo semanal total de esparcimiento de una persona respeta el presupuesto de tiempo libre por edad, sexo y ocupación (ENUT). Las mujeres con cuidado de menores tienen menos tiempo libre, como muestra la ENUT.
- **R-006 (M2, rutina)** — En los bloques de ocio de la rutina (011), la persona elige entre sus actividades según afinidad, necesidad `fun`/`social`, dinero, horario del lugar y compañía disponible (017). Hacerlo satisface `fun` y gasta según `costRange` (015).
- **R-007 (M3, compañía)** — Las actividades `con_otros` se hacen preferentemente con amigos o familia que comparten la actividad. Compartir una afición sube la probabilidad de encuentro y de vínculo (012).
- **R-008 (M5, cambio)** — Las aficiones cambian con causas: una invitación de un amigo (`LEISURE_TAKEN_UP`), falta de dinero, una lesión, una mudanza o la edad (`LEISURE_DROPPED`).

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `LEISURE_TAKEN_UP` | empieza una afición (también en la trayectoria previa) | citizenId, activity | personalidad, amigo, oferta nueva, jubilación |
| `LEISURE_DROPPED` (M5) | deja una afición | citizenId, activity, reason | dinero, salud (031), mudanza, falta de tiempo |
| `LEISURE_DONE` (M2, nivel ≥ 2) | hace la actividad en un lugar | citizenId, activity, placeId, with[] | rutina, invitación, necesidad `fun` |

## 6. Invariantes
- **INV-001** — Toda actividad de una ficha existe en el catálogo, respeta el `ageRange` y es compatible con la salud (R-003).
- **INV-002** — `affinity` en [0,1] y `perMonth` en [0,30], sin NaN. Una ficha tiene entre `LEISURE_MIN` y `LEISURE_MAX` actividades.
- **INV-003** — Toda actividad que requiere un lugar tiene al menos un lugar posible (R-004).

## 7. Criterios de aceptación
- **CA-001 (M1)** — *Dado* un mundo, *entonces* se cumplen INV-001 a INV-003 y cada afición tiene su `LEISURE_TAKEN_UP` en la trayectoria.
- **CA-002 (M1)** — *Dado* 20 mundos, *entonces* en el agregado la extraversión se correlaciona positivamente (r > 0,15) con el número de actividades `con_otros`, y la apertura con las de `cultura.*` y `arte.*`.
- **CA-003 (M1)** — *Dado* 20 mundos, *entonces* el gasto mensual esperado en esparcimiento de los estratos 1–2 es menor que el del estrato 4, y ninguno supera `LEISURE_BUDGET_SHARE` del ingreso de su hogar.
- **CA-004 (M1)** — *Dado* 20 mundos, *entonces* la proporción de personas que practican cada actividad está dentro de ±0,08 de `popularity` (DANE, Encuesta de Consumo Cultural), para las actividades con fuente oficial.
- **CA-005 (M1)** — *Dado* la misma semilla, *entonces* la ficha es idéntica (023).
- **CA-006 (M2)** — *Dado* una persona con `fun` baja, dinero y un bar abierto, *cuando* llega su bloque de ocio, *entonces* elige una de sus actividades, y la actividad satisface `fun`.

## 8. Parámetros y calibración
| Parámetro | Valor inicial | Fuente / justificación | Estado |
|---|---|---|---|
| `leisure.popularity` (por actividad) | personas de 12 años o más en los últimos 12 meses: cine 0,40 (2016; 0,33 en 2020, año de pandemia); bibliotecas 0,196 (2016; 0,126 en 2020); leer libros 0,50 (2020, 3,9 libros de media). Museos, conciertos y práctica deportiva: estimado | DANE, Encuesta de Consumo Cultural (ECC) 2016 y 2020 | oficial (cine, bibliotecas, lectura) · estimado (resto) |
| `leisure.freeTime` | participación en vida social 0,749 (hombres) y 0,726 (mujeres); en vida cultural y deportiva 0,334 y 0,271, con 1 h 38 min al día de media entre quienes participan. Horas por edad y ocupación: estimado | DANE, Encuesta Nacional de Uso del Tiempo (ENUT) 2024–2025 (citada en prensa) | oficial (participación) · estimado (horas por edad) |
| `LEISURE_BUDGET_SHARE` | recreación y cultura = 3,1 % del gasto de los hogares (total nacional); por estrato, estimado | DANE, Encuesta Nacional de Presupuestos de los Hogares (ENPH) 2016–2017 | oficial (total) · estimado (por estrato) |
| `LEISURE_MIN`, `LEISURE_MAX` | 2 y 8 (v0.3; antes 6) | estimado | estimado |
| pesos de rasgos y valores | por actividad | estimado; para revisar con expertos en psicología (como la tabla de rasgos de la 009) | estimado |

## 9. Métricas y observabilidad
`world:report --leisure` muestra:
- la práctica de cada actividad por edad, sexo y estrato, frente al perfil;
- el gasto esperado frente al presupuesto;
- las actividades sin lugar en el municipio, que se hacen fuera.

Alerta si una actividad no la practica nadie o si todos practican lo mismo.

## 10. Preguntas abiertas
- [x] ¿Lista inicial de actividades? → Las 22 de §3; el catálogo crece por entregas (usuario, 2026-09-24).
- [x] ¿En qué hito? → La ficha inicial en M1, bloque J, junto con la 031 y la 033; el uso diario en M2 (usuario, 2026-09-24).
- [x] ¿Pesos de personalidad? → Estimados por ahora; se revisan con la tabla de expertos en psicología de la 009 cuando exista (usuario, 2026-09-24).
- [x] Cifras de §8 → verificadas el 2026-09-24 donde hay dato oficial (ECC, ENUT, ENPH). El resto queda como estimado.
- [ ] La ECC 2020 fue un año de pandemia. Propuesta: calibrar con 2016 (cine 0,40) hasta tener la ECC 2022 o 2024.


## Adaptación al motor funcional (MF8.1, 2026-09-28)
Según la 035 §8:
- La ficha de esparcimiento sale de lo aprendido (abrirse, aplacar, dominios vitales; 041, MF7.3).
- La frecuencia en la vida diaria es la fuerza de la respuesta `ocio.<clave>` (036), reforzada por el disfrute de cada vez.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-24 | 0.1 | Borrador inicial a petición del usuario: ficha de esparcimiento de cada persona (arte, bailar, salir con amigos, voluntariado, salir a cenar y otras), con catálogo de actividades, generación coherente con personalidad, estrato, salud y oferta de lugares, y uso en la rutina desde M2 |
| 2026-09-24 | 0.2 | Decisiones del usuario (§10) y cifras verificadas (§8): ECC 2016 y 2020 (cine, bibliotecas, lectura), ENUT 2024–2025 (participación en vida social, cultural y deportiva) y ENPH 2016–2017 (recreación y cultura, 3,1 % del gasto) |
| 2026-09-25 | 0.2 | Estado → aprobada |
| 2026-09-25 | 0.3 | Implementación del bloque J5 y J6. Calibración: `LEISURE_MAX` pasa de 6 a 8 (estimado), porque con 6 el recorte bajaba la práctica de actividades populares por debajo de su popularidad. Precisiones: la probabilidad de cada actividad se normaliza por la media de los factores personales en el mundo (conserva la popularidad del perfil); los costes van por niveles (`leisure.costByLevel`) y el gimnasio es una mensualidad; el ingreso del hogar se aproxima con sueldos formales, informales y pensión en salarios mínimos hasta la 015; las actividades solo regionales cuestan el viaje y tienen el 30 % de la frecuencia; una afición puede quedar en 0 veces al mes si no alcanzan el dinero o el tiempo. Medido en 20 mundos: 6 actividades por persona, cine 0,38 y lectura 0,48 (±0,08 de la ECC), correlaciones de 0,42 (extraversión y compañía) y 0,40 (apertura y cultura). Sin cambios en CA |
| 2026-09-25 | 0.3 | Bloque E de M2: R-006 y CA-006 con el motor de decisiones (017). `LeisureInterest.lastDone` (última vez; la generación la sitúa al azar dentro de su intervalo) regula la frecuencia; `LEISURE_DONE` se emite al elegir la actividad, con el `explain` como causa; las aficiones se registran como `exercise`, `socialize` o `leisure` y las tres suben la diversión. En una semana del mundo generado, la frecuencia es ≈ 1,3 veces la de la ficha (calibración en el bloque H). Sin cambios en CA |
| 2026-09-25 | 0.3 | Bloque MF1 (009 v1.0): los `traits` del catálogo se leen por el adaptador @deprecated y los `values` dan un valor neutro (los valores ya no son escalares), así que dejan de modular la elección de la ficha. La ficha saldrá del desarrollo (041 R-008) en MF7.3. Sin cambios en CA |
| 2026-09-28 | — | MF7.3 (041 R-008): CA-002 se comprueba con lo aprendido en lugar de los rasgos. Abrirse se correlaciona con las actividades en compañía, y valorar el conocimiento o la creatividad con la cultura y el arte (r > 0,15). El catálogo nombra respuestas y dominios vitales (`leisure_activities` 2026.10.1); la elección usa la posición de la persona en la población |
| 2026-09-28 | — | MF8.1: sección «Adaptación al motor funcional» con lo que cambió en los bloques MF1 a MF7 (o debe cambiar, si la spec sigue en borrador), según la 035 §8. Sin cambios en CA |
