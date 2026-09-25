---
id: 010
nombre: needs
estado: aprobada
hito: M2 (5 necesidades, emociones, estrés, ánimo, enfermedad aguda) · M3 (seguridad, autonomía, propósito)
depende_de: [007, 009, 021, 031, 032]
version: 0.2
---

# 010 — Necesidades, emociones y salud del día a día

## 1. Propósito
El estado interno que cambia hora a hora:
- necesidades físicas y psicológicas;
- estrés, ánimo y emociones;
- energía y enfermedades pasajeras.

Tiene retroalimentaciones realistas: dormir mal → cansancio → errores → conflicto → estrés.

Es la base de lo que una persona "siente" y de por qué decide lo que decide (017). Cuando llegue la capa clínica (034), el terapeuta verá su huella: una persona con estrés sostenido llega a sesión con eso encima. Aquí **no hay diagnósticos**: el malestar psicológico del día a día se expresa como estrés, ánimo y emociones (031 §10, decisión del usuario).

## 2. Alcance
**Incluye (M2):**
- 5 necesidades: hambre, energía, higiene, compañía y diversión;
- 5 emociones con nombre;
- estrés, ánimo y deuda de sueño;
- enfermedades agudas simples;
- los efectos de la ficha de salud (031 R-007).

**M3:** las necesidades de seguridad, autonomía y propósito, que necesitan relaciones (012) y la valoración del trabajo.

**Fuera de alcance:** trastornos clínicos y diagnósticos (capa clínica, 034); la memoria de las emociones (013, M3).

## 3. Modelo de datos
Todo en columnas `f32` (ADR-005), 1 = necesidad satisfecha:

| Columna | Rango | Qué es |
|---|---|---|
| `need.hunger`, `need.energy`, `need.hygiene`, `need.social`, `need.fun` | [0,1] | necesidades de M2 (el prototipo usa hambre, energía y soledad) |
| `emo.joy`, `emo.sadness`, `emo.anger`, `emo.fear`, `emo.shame` | [0,1] | intensidad actual de cada emoción |
| `state.stress` | [0,1] | estrés |
| `state.mood` | [0,1] | ánimo: media móvil de la valencia emocional y de la satisfacción |
| `state.moodBaseline` | [0,1] | línea base personal del ánimo (de la personalidad, 009) |
| `state.sleepDebt` | minutos (`i32`) | deuda de sueño acumulada |
| `health.acute` | `u8` | 0 sana · código de enfermedad aguda del catálogo `acute_illnesses` |
| `health.acuteUntil` | `i32` | minuto en que se cura |

**Valencia y activación** (derivadas, no guardadas): `valence = joy − (sadness + anger + fear + shame)/4`, `arousal = max(joy, anger, fear)`. Sirven para la visualización y para el LLM (034).

Coste: 15 columnas ≈ 56 B por persona.

## 4. Reglas
- **R-001 (decaimiento)** — Cada necesidad decae por hora con su tasa del perfil (`needs.decay.*`). La energía cae 0,045/h despierto y 0,058/h en esfuerzo (prototipo). Las necesidades se satisfacen con acciones (comer, dormir, ducharse, socializar, esparcimiento de la 032).
- **R-002 (estrés)** — El estrés sube con necesidades insatisfechas, conflictos (012, M3), deudas (015 R-004), incertidumbre laboral y enfermedad. La modulación es:
  - × (0,5 + neuroticismo);
  - × (1,5 − resiliencia).

  Baja con descanso, apoyo social y esparcimiento (032).
- **R-003 (ánimo)** — El ánimo es una media móvil de la valencia emocional y la satisfacción de necesidades, con retorno lento a `moodBaseline` (media vida `MOOD_RETURN_DAYS`).
- **R-004 (sueño)** — Las horas de sueño de partida salen de la ficha (`health.sleepHours`, 031). Con deuda de sueño alta, aumentan:
  - la probabilidad de quedarse dormido (`OVERSLEPT`; umbral del prototipo: energía al despertar < 0,72);
  - los errores en el trabajo (006);
  - la probabilidad de enfermar.
- **R-005 (emociones)** — Los eventos disparan emociones con intensidad según su tipo y la personalidad (p. ej., `JOB_LOST` → tristeza y miedo; una discusión → rabia). Decaen con su media vida. Las intensas (> `EMOTION_MEMORY_THRESHOLD`) se vuelven recuerdos en M3 (013).
- **R-006 (ficha de salud, 031 R-007)** — Cada condición crónica multiplica la caída de energía por su efecto del catálogo (la EPOC, más). Con la salud física baja sube la probabilidad de enfermedad aguda. Una condición no controlada suma estrés leve.
- **R-007 (enfermedad aguda)** — Probabilidad diaria = base del perfil × edad × estrés × deuda de sueño × salud física, con el flujo `sys:needs/<id>`. La enfermedad dura según su catálogo (gripa, gastroenteritis, dengue en temporada…), baja la energía y puede impedir trabajar o estudiar (incapacidad, 006 y 015).
- **R-008 (sin diagnósticos)** — Ningún valor de esta spec es un diagnóstico. Un estrés alto y sostenido es un **estado**, visible para el informe de vida (020) y para la capa clínica (034), no una etiqueta.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `OVERSLEPT` | se queda dormido | citizenId, minutos de retraso | deuda de sueño, energía baja |
| `FELL_ILL` | enferma | citizenId, enfermedad, días | estrés, deuda de sueño, salud física, condición crónica, azar |
| `RECOVERED` | se cura | citizenId, enfermedad | `FELL_ILL` |
| `EMOTIONAL_OUTBURST` | estallido | citizenId, emoción | estrés alto + provocación (M3, con relaciones) |
| `STRESS_PEAK` | el estrés pasa de `STRESS_PEAK_THRESHOLD` | citizenId, valor | necesidades, deudas, pérdida del empleo |

## 6. Invariantes
- **INV-001** — Todos los valores de las columnas están en su rango y sin NaN.
- **INV-002** — Ningún cambio se aplica fuera de los parches del sistema (021 R-007) o de acciones validadas (017).
- **INV-003** — Una persona enferma tiene `health.acuteUntil` > ahora y un `FELL_ILL` sin `RECOVERED` posterior.

## 7. Criterios de aceptación
- **CA-001 (M2)** — *Dado* una persona sin dormir 2 noches, *entonces* la probabilidad de `OVERSLEPT` al día siguiente es > 50 %.
- **CA-002 (M2)** — *Dado* 100 personas × 1 año, *entonces* el ánimo medio está entre 0,46 y 0,62 con desviación entre personas > 0,05, y el estrés medio entre 0,25 y 0,41. Es la tolerancia del prototipo (`docs/prototipo-referencia.md`).
- **CA-003 (M2)** — *Dado* cualquier tick, *entonces* todos los valores están en rango y sin NaN.
- **CA-004 (M2)** — *Dado* dos personas iguales salvo EPOC en una, *cuando* pasan 7 días, *entonces* la energía media de la que tiene EPOC es menor (031 CA-006).
- **CA-005 (M2)** — *Dado* un `JOB_LOST`, *entonces* la tristeza y el miedo suben ese día, y el estrés medio de las 4 semanas siguientes es mayor que el de las 4 anteriores.
- **CA-006 (M2)** — *Dado* 1 año, *entonces* la incidencia de enfermedad aguda por persona está en el rango del perfil (≈ 2–4 episodios de enfermedad respiratoria al año en adultos; estimado).

## 8. Parámetros y calibración
Todos en el perfil (029), con fuente y estado.

| Parámetro | Valor inicial | Fuente | Estado |
|---|---|---|---|
| `needs.decay.energy` | 0,045/h despierto; 0,058/h en esfuerzo | prototipo | estimado |
| `needs.decay.hunger`, `hygiene`, `social`, `fun` | del prototipo (hambre, soledad) y estimados (higiene, diversión) | prototipo | estimado |
| umbral de `OVERSLEPT` | energía al despertar < 0,72 | prototipo | estimado |
| `MOOD_RETURN_DAYS` | 7 | estimado | estimado |
| `EMOTION_MEMORY_THRESHOLD`, `STRESS_PEAK_THRESHOLD` | 0,7 · 0,8 | estimado | estimado |
| catálogo `acute_illnesses` | gripa, gastroenteritis, dengue (según la región), migraña, lesión leve | estimado; revisar con el INS (Instituto Nacional de Salud, boletines epidemiológicos) | por_confirmar |

## 9. Métricas
Distribuciones de necesidades, emociones, estrés y ánimo en la prueba de 100 personas × 1 año; enfermedades por mes. Alertas de degeneración: varianza ≈ 0, saturación en 0 o 1 o crecimiento sin límite.

## 10. Preguntas abiertas
- [x] ¿Emociones discretas o dimensionales? → 5 emociones con nombre; valencia y activación se derivan (usuario, 2026-09-25).
- [x] ¿Cuántas necesidades en M2? → 5; seguridad, autonomía y propósito en M3 (usuario, 2026-09-25).
- [ ] Temporada de dengue: ¿depende del clima de la región (piso térmico del municipio)? Propuesta: sí, cuando el perfil del municipio tenga clima (peldaño 4).

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-25 | 0.2 | Revisión de M2 con las decisiones del usuario: 5 necesidades en M2 (seguridad, autonomía y propósito en M3); 5 emociones con nombre, con valencia y activación derivadas; efectos de la ficha de salud (031 R-007); enfermedades agudas con catálogo; CA-002 alineado con la tolerancia del prototipo; columnas (ADR-005); sin diagnósticos (R-008) |
| 2026-09-25 | 0.2 | Estado → aprobada |
| 2026-09-25 | 0.2 | Implementación del bloque B de M2. Precisiones: los parámetros de §8 van en el perfil como `needs.rates`, `needs.stress` y `needs.mood`, y las enfermedades agudas, sus pesos y su duración como `health.acute.*` (son tasas del país; no hay catálogo `acute_illnesses`); la modulación de R-002 multiplica los estresores (dinero, desempleo, hambre, agotamiento, enfermedad), no la base, así que la media coincide con el prototipo; la compañía se aproxima por la actividad hasta que existan posiciones (016); `state.sleptToday` acumula el sueño del día; `EVENT_EMOTIONS` y `emotionPatches` implementan R-005 para los sistemas que emiten cada evento. CA-001 (`OVERSLEPT`) pasa al bloque C, porque necesita la hora de despertar de la rutina. Sin cambios en CA |
