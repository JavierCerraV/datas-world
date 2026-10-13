# M5 · Piloto del estudio de intervención (spec 047)

Primera corrida completa del piloto, lanzada por el usuario entre el 2026-10-09 y el 2026-10-12. Los archivos están en `data/estudio/piloto/` (no versionados): `resumen.md`, `medidas.csv`, `resultados.json`, una transcripción por persona y sesión, y `llm-registro.jsonl`.

> Piloto con personas simuladas. Muestra cómo responde este mundo, no si el protocolo funciona en humanos (047 R-011). Con tres personas todo lo que sigue es descriptivo.

## Qué se corrió

| | |
|---|---|
| Mundo | copia de `data/psicometria/mundo.db` (199 personas), llevada a las 10:00 |
| Personas | Natalia Ramírez (CIT-000013), Ximena Herrera (CIT-000130), Iván Díaz (CIT-000049) |
| Calendario | tomas los días −21, −14, −7, 0, 7, 14 y 49; sesiones los días 0, 7 y 14; práctica hasta el día 42 |
| Brazos | protocolo (con LLM) y espera (las mismas personas, sin sesiones ni LLM) |
| Pruebas | AAQ-II, DASS-21, SWLS y GPQ-9, las cuatro en una llamada por persona y toma |
| Modelo | `nvidia/nemotron-3-super-120b-a12b:free` por OpenRouter, para terapeuta, persona y tono; verificación apagada |
| Nivel de intimidad | «de confianza» desde el inicio (`--min-level 2`) |
| Llamadas | 846 registradas (204 de ellas son la verificación apagada, que no llama): 642 reales. 3,0 M de tokens de entrada y 1,1 M de salida |
| Fallos | ninguna respuesta por plantilla; las 294 respuestas de ítems de cada persona vinieron del LLM |

Comando: `pnpm cli study:pilot --provider config --llm-config data/estudio/llm-nemotron.json --db data/psicometria/mundo.db --citizens CIT-000013,CIT-000130,CIT-000049 --concurrency 1 --out data/estudio/piloto`, reanudado con `--resume` al agotarse las claves.

## Resultados

### Sesiones

| Persona | Sesión | Final | Turnos | Fidelidad | Compromiso | Ensayos «Yo» / evitación / valores |
|---|---|---|---|---|---|---|
| Natalia | 1 | cierre | 22 | 78 % | 0,26 | 1 / 0 / 1 |
| Natalia | 2 | abandono | 19 | 63 % | 0,39 | 3 / 2 / 1 |
| Natalia | 3 | completa | 17 | 100 % | 0,46 | 0 / 0 / 5 |
| Iván | 1 | completa | 32 | 100 % | 0,21 | 2 / 0 / 0 |
| Iván | 2 | cierre | 32 | 75 % | 0,29 | 3 / 0 / 3 |
| Iván | 3 | abandono | 17 | 60 % | 0,29 | 0 / 0 / 2 |
| Ximena | 1 | cierre | 21 | 78 % | 0,32 | 1 / 0 / 1 |
| Ximena | 2 | cierre | 24 | 50 % | 0,25 | 3 / 0 / 0 |
| Ximena | 3 | completa | 20 | 100 % | 0,28 | 0 / 0 / 5 |

Nadie faltó a una sesión. Dos sesiones terminaron porque la persona se fue; cuatro las cerró el terapeuta antes de cubrir todo. Las personas practicaron 15, 14 y 19 días de 39 posibles.

### Mecanismos del motor (toma 1 → toma 7)

| Persona | «Yo» protocolo | «Yo» espera | Evitación protocolo | Evitación espera | Valores protocolo | Valores espera |
|---|---|---|---|---|---|---|
| Natalia | 1,00 → 1,00 | 1,00 → 1,00 | 0,39 → 0,18 | 0,39 → 0,40 | 0,39 → 0,50 | 0,39 → 0,39 |
| Ximena | 0,17 → 0,65 | 0,17 → 0,23 | 0,38 → 0,38 | 0,38 → 0,38 | 0,36 → 0,49 | 0,36 → 0,36 |
| Iván | 0,44 → 0,93 | 0,44 → 0,51 | 0,42 → 0,42 | 0,42 → 0,42 | 0,40 → 0,49 | 0,40 → 0,40 |

### Pruebas, lo verdadero en el seguimiento

| Persona | AAQ-II protocolo / espera | DASS-21 | SWLS | GPQ-9 |
|---|---|---|---|---|
| Natalia | 15 / 17 | 2 / 2 | 19 / 19 | 25 / 25 |
| Ximena | 21 / 21 | 1 / 1 | 14 / 14 | 27 / 27 |
| Iván | 19 / 22 | 3 / 3 | 20 / 20 | 26 / 26 |

### Episodios de rumia

Ninguno, en ninguna persona ni brazo, en las diez semanas.

## Hallazgos

1. **El flujo funciona de punta a punta.** Tomas, sesiones, práctica, seguimiento, dos brazos, reanudación con varias claves y coste por sesión. Los dos brazos son idénticos hasta la primera sesión.
2. **Los mecanismos se mueven; las pruebas, casi nada.** El «Yo» de Ximena e Iván subió mucho frente a la espera, y la evitación de Natalia bajó a la mitad. Pero lo verdadero solo cambia en el AAQ-II (2 y 3 puntos en dos personas), que es la prueba que lee esos mismos mecanismos. DASS-21, SWLS y GPQ-9 terminan iguales en los dos brazos. La variación del AAQ-II entre tomas de línea base (3 puntos) es del tamaño del efecto.
3. **No hubo ninguna prueba en la vida.** Sin episodios de rumia no se puede ver si lo aprendido se usa, se mantiene o se pierde (R-012). Es el límite más serio del piloto y no depende del protocolo, sino de que el mundo casi no produce rumia.
4. **La evitación casi no recibió dosis.** Solo una sesión de nueve trabajó los ejercicios de «dejar de empujar» con la persona presente. El terapeuta cerró o perdió a la persona antes de llegar a ellos.
5. **La postura de la persona apenas depende de cómo le habla el terapeuta.** De 204 turnos: aplacar 19 %, abrirse 19 %, contraatacar 18 %, responder breve 12 %, callar 12 %, poner límite 11 %, evadir 8 %. Ante un tono amable, contraataca el 11 % y se cierra el 42 %; ante uno neutro, contraataca el 24 %. Un terapeuta mejor apenas puede ganarse a la persona, y el compromiso medio se quedó entre 0,21 y 0,46. Es del motor (043), no del terapeuta.
6. **El texto no siempre sigue a la postura.** Con postura de callar o contraatacar, el LLM a veces escribe una confidencia larga («Cuota. Esa palabra me viene nomás cuando pienso en la casa…» con postura de callar). La dosis se calcula con la postura, así que esos turnos no cuentan aunque el texto sea de apertura. Con la verificación apagada no se midió cuánto ocurre; las reglas léxicas encuentran complacencia del texto en el 0 a 30 % de los turnos con postura cerrada.
7. **La brecha de informe del GPQ-9 crece tras el tratamiento.** Lo dicho menos lo verdadero pasó de −3,4 en la línea base a −6,1 durante el tratamiento y −8,3 en el seguimiento: las personas dicen seguir menos las reglas por aprobación de lo que es verdad, y cada vez más. En las otras pruebas la brecha es de un punto. Con tres personas es una señal, no un resultado; es justo lo que la medida de complacencia quería poder ver.
8. **El problema real apareció.** Con el nivel «de confianza», Natalia habló de sus deudas y puso el límite de no ser presionada sobre ellas; en la primera prueba, con el nivel «conocido», se había inventado otro problema.
9. **El terapeuta trabaja por función, con defectos.** Lee la función de cada respuesta, respeta los límites, entra por lo que a la persona le importa y no elogia. Defectos: tutea aunque se le pide tratar de usted (entre 10 y 24 veces por sesión), a veces reformula casi la misma pregunta y de vez en cuando hace dos preguntas en un turno.
10. **El «Yo» de Natalia ya estaba en el máximo antes de empezar**, con un solo episodio de rumia en su vida. Algo fuera de los episodios lo está reforzando; hay que revisarlo en el motor.

## Sensibilidad a la dosis (2026-10-12, sin LLM)

`pnpm cli study:sensitivity` volvió a aplicar las nueve sesiones guardadas sobre copias nuevas del mundo, con cada ensayo de sesión contando ×0, ×0,5, ×1 y ×2. La escala 0 deja la charla y quita ejercicios y práctica (control de atención). Todo es lo verdadero, en el seguimiento.

| Persona | Medida | Dosis ×0 | ×0,5 | ×1 | ×2 |
|---|---|---|---|---|---|
| Natalia | Evitación | 0,40 | 0,20 | 0,18 | 0,16 |
| Natalia | AAQ-II | 17 | 15 | 15 | 15 |
| Ximena | «Yo» | 0,23 | 0,60 | 0,65 | 0,74 |
| Ximena | AAQ-II | 21 | 21 | 21 | 20 |
| Iván | «Yo» | 0,51 | 0,89 | 0,93 | 0,97 |
| Iván | AAQ-II | 22 | 20 | 19 | 17 |

- **Ir a consulta sin ejercicios no cambia nada.** Con escala 0 las personas terminan como en el brazo de espera.
- **Casi todo el cambio lo pone la práctica, no la sesión.** Duplicar o reducir a la mitad la dosis de las sesiones mueve poco el resultado, porque los 14 a 19 días de práctica (que no se escalan) llevan la respuesta cerca de su techo. La sesión importa sobre todo como llave: sin ningún turno presente no hay nada que practicar.
- **DASS-21, SWLS y GPQ-9 no dependen de la dosis.** Son iguales en las cuatro columnas.
- Con escala 1 se reproduce exactamente el brazo con protocolo del piloto (comprobado en las pruebas).

## Calidad del terapeuta en esta corrida (línea de partida)

Medida con reglas léxicas antes de corregir el prompt: tuteó en 193 de 204 turnos, hizo dos preguntas en un turno 7 veces, repitió una pregunta 5 veces y elogió con fórmula 9 veces. Entre el 18 % y el 79 % de los turnos de cada sesión fueron de ejercicio. Sirve para comparar con la próxima corrida.

## Candidatas con margen de cambio

`pnpm cli study:candidates`: de las 17 personas con episodios de rumia, solo 6 tienen el «Yo» por debajo de 0,8. Natalia, con 1,00, no tenía margen en ese mecanismo; Iván (0,44) y Ximena Herrera (0,17) sí. Para la próxima corrida: Iván, Yolanda Díaz (0,25), Marta Martínez (0,01) o Ximena Herrera.

## Qué no se puede concluir

- Nada sobre el efecto del protocolo: el cambio verdadero del AAQ-II está en parte garantizado por cómo se construyó la dosis.
- Nada sobre mantenimiento o recaída: no hubo episodios.
- Nada sobre diferencias entre personas: son tres.
- El modelo fue gratuito y distinto del previsto (`claude-haiku-5-5`); la calidad del diálogo puede cambiar con otro.

## Siguiente

En `tasks/M5-experimentos.md`, apartado del estudio de intervención.
