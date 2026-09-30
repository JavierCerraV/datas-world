# Guía del visor de Data's World

Para el equipo de investigación. Explica cómo poner en marcha el mundo y qué muestra cada parte de la pantalla. Spec de referencia: 024 (visualización).

## 1. Ponerlo en marcha

1. Abre una terminal en la carpeta del proyecto.
2. Si vas a charlar con los ciudadanos con el modelo de lenguaje, define antes la clave, en la misma terminal:
   `$env:ANTHROPIC_API_KEY = "…"` (PowerShell).
   Sin clave, la charla funciona igual, pero las respuestas salen de plantillas.
3. Ejecuta `pnpm dev`. Al arrancar se muestran el usuario y la contraseña de los controles (en este equipo: `equipo` y `datasworld`).
4. Abre en el navegador la dirección que aparece: `http://127.0.0.1:5180`.
5. Para detenerlo, pulsa Ctrl+C en la terminal. El mundo se guarda y al volver a arrancarlo sigue donde estaba.

El mundo de `data/world.db` vive por su cuenta mientras `pnpm dev` está en marcha, aunque nadie lo mire.

## 2. Qué se ve

### Barra superior
- **Reloj:** hora, fecha y día de simulación. Es la hora de lo que se ve en el mapa, unos segundos detrás del mundo.
- **Pausar / Reanudar.**
- **Velocidad**, en minutos del mundo por segundo real:
  - con «1 min/s» se ve caminar a la gente;
  - con «10 min/s» o más, los días pasan rápido, pero los trayectos duran un instante;
  - «Real» es el tiempo real.
- **Avanzar 1 día, 1 semana, 1 mes o 1 año:** el mundo corre tan rápido como puede sin dibujarse. Un año tarda unos 6 minutos. Pausar lo interrumpe.
- **Indicadores:** personas, porcentaje con empleo (de 18 a 64 años, sin contar estudiantes ni pensionados), ánimo medio y eventos de hoy.
- **Panel del mundo:**
  - gráficas por día del ánimo y el estrés medios, del dinero y de los eventos más frecuentes;
  - avisos si el mundo se estanca o se satura;
  - descarga en CSV para analizar fuera.
- **Ver un día pasado:** el deslizador lleva a cualquier día guardado; «Presente» vuelve al vivo.

### Mapa
- **Quién se ve:** solo quien va por la calle o está en un parque o una plaza. Quien está dentro de un edificio no se ve; de noche se encienden las ventanas donde hay alguien despierto.
- **Trayectos reales:** lo que se ve ya pasó. Cada trayecto es el que hizo esa persona, a su hora y por la ruta más corta por las calles.
- **Pasar el ratón** por una persona o un edificio muestra quién es o cuánta gente hay dentro. **Un clic** abre su ficha.
- **Botones del mapa:** «−», «+», «Seguir» (la cámara acompaña a la persona elegida) y «Ver todo».
- **Teclado:** espacio pausa, «+» y «−» cambian la velocidad, las flechas mueven la cámara y Esc vuelve a la población.

### Registro de eventos (bajo el mapa)
- Cada hecho lleva su hora, una etiqueta de su clase y el texto con los nombres pulsables.
- Debajo, **«Por qué»**: sus causas.
- Los filtros separan trabajo, relaciones, economía, salud e información (rumores y lo que se aprende).
- «Incluir menores» añade la rutina (tiempo libre, sueño, salarios…).

### Población y fichas (a la derecha)
- **Población:** todas las personas, con su ánimo en color (rojo, naranja, ámbar, verde), su edad y lo que hacen y dónde. El buscador ignora tildes y mayúsculas.
- **Ficha de un lugar:** tipo, barrio, horario, personal, residentes y quién está dentro ahora.
- **Ficha de una persona:**

| Pestaña | Qué muestra |
|---|---|
| Estado | Necesidades, estrés y ánimo en barras; emociones; dinero, ocupación, vivienda y barrio; temperamento |
| Relaciones | Cada vínculo desde las dos perspectivas: el afecto de cada uno, el trato, la confianza y la tensión |
| Memoria | Lo que recuerda (no lo que pasó), con su intensidad; los recuerdos casi olvidados salen atenuados. Etapas de su vida como las cuenta |
| Historia | Resumen del informe de vida (dinero, ánimo y estrés al principio y ahora) y sus últimos hechos, cada uno con «¿por qué?» (el árbol de causas) |
| Creencias | Lo que cree de otros, si coincide con la realidad y quién se lo contó; y lo que se dice de esta persona, con quién lo cree. Solo quien observa ve la verdad |
| Vida | Informe (trayectoria, etapas vividas y recordadas, lo que cambió su vida, perfil), Desarrollo (lo que vivió y aprendió por etapas) y Familia (familiograma) |
| Funcional | Análisis funcional: el valor aprendido de cada cosa, las reglas que sigue y cómo relaciona unas cosas con otras |
| Charlas | Las charlas guardadas con esta persona, para revisarlas |

### Charla
Pulsa **«Charlar con …»** en la ficha. La charla se abre junto al mapa, con la figura de la persona y su ánimo y estrés en vivo.

- **Modos:**
  - **En el mundo:** es un encuentro real. Lo recordará y puede cambiar su ánimo, su estrés y lo que cree.
  - **De prueba (sandbox):** nada cambia.
- **Modo prueba:** permite elegir el tono de cada mensaje.
- **Escribir:** Enter envía; Mayúsculas+Enter salta de línea.
- **En cada respuesta**, «¿Por qué respondió así?» muestra su postura (abrirse, poner un límite…), lo que más pesó y las otras posturas posibles.
- **Al despedirse**, un resumen dice qué cambió (ánimo y estrés antes y después) y si la recordará.

## 3. Mundos

- `data/world.db` es el mundo de la demostración: semilla 482917, 199 personas, creado con el motor actual (relaciones, memoria y rumores).
- El mundo anterior, de M2, está en `data/mundo-anterior-m2.db`.
- Para crear otro mundo:

  ```
  pnpm cli world:new --seed <número> --db data/otro.db
  pnpm cli world:advance --db data/otro.db --days 60
  pnpm dev --db data/otro.db
  ```

  El segundo paso es opcional: le da historia antes de mirarlo.
