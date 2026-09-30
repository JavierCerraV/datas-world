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

El visor sigue el lienzo aprobado «Visor A+» (spec 024 v0.5). A la izquierda, un **menú** con dos pantallas: **Mundo** y **Datos**. **Estudio** y **Muestra** aparecen bloqueadas: llegan con la capa de investigación y clínica. Abajo del menú, el botón de la luna cambia entre tema claro y oscuro.

Cada pantalla tiene su dirección (por ejemplo `#/expediente/CIT-000019`): se puede volver atrás con el navegador y compartir el enlace.

### Pantalla Mundo

**Cabecera**
- **Fecha y hora** grandes, con el día de la semana y el día de simulación. Es la hora de lo que se ve en el mapa, unos segundos detrás del mundo.
- **Simulando / En pausa:** el botón pausa o reanuda.
- **Velocidad**, en minutos del mundo por segundo real:
  - con «1 min/s» se ve caminar a la gente;
  - con «10 min/s» o más, los días pasan rápido, pero los trayectos duran un instante;
  - «Real» es el tiempo real.
- **«+1 día»** y el menú **«Avanzar…»** (1 semana, 1 mes, 1 año): el mundo corre tan rápido como puede sin dibujarse («Simulando sin observar»). Un año tarda unos 6 minutos.
- A la derecha, personas, hogares, organizaciones, porcentaje con empleo y ánimo medio.

**Mapa**
- **Quién se ve:** solo quien va por la calle o está en un parque o una plaza. Quien está dentro de un edificio no se ve; de noche se encienden las ventanas donde hay alguien despierto.
- **Capas** (arriba a la izquierda), que se recuerdan en este navegador:
  - **Personas:** las figuras;
  - **Lugares:** el nombre de cada edificio;
  - **Objetos:** bloqueada, porque los objetos aún no tienen sitio en el mapa (se ven en el expediente);
  - **Vínculos:** líneas de la persona elegida a las personas con quienes tiene vínculo;
  - **Ánimo:** una marca de color sobre cada figura;
  - **Día / noche:** el oscurecimiento nocturno.
- **Ahora** (arriba a la derecha): cuántas personas trabajan, están en clase, en casa, en la calle o en otro lugar.
- **Escala** en metros (abajo a la izquierda): cada casilla del mapa mide 8 m.
- **Pasar el ratón** por una persona o un edificio muestra quién es o cuánta gente hay dentro. **Un clic** la elige: encima aparece una etiqueta con su id, su nombre y lo que hace.
- **Botones del mapa:** «+», «−», «Seguir» (la cámara acompaña a la persona elegida) y «Ver todo».
- **Teclado:** espacio pausa, «+» y «−» cambian la velocidad, las flechas mueven la cámara y Esc vuelve a la población.

**Registro de eventos** (bajo el mapa)
- Una tabla con la hora, el tipo (etiqueta y código), qué pasó (con los nombres pulsables) y sus causas.
- **Filtro** por trabajo, relaciones, economía, salud e información; «Incluir menores» añade la rutina (tiempo libre, sueño, salarios…).
- **«Abrir línea de tiempo»:** un deslizador para ver cualquier día guardado; «Volver al presente» vuelve al vivo.

**Panel de la derecha**
- **Población:** todas las personas, con su ánimo en color, su edad y lo que hacen y dónde. El buscador ignora tildes y mayúsculas.
- **Ficha de un lugar:** tipo, barrio, horario, personal, residentes y quién está dentro ahora.
- **Ficha compacta de una persona:**
  - id, nombre, sexo, edad y trabajo;
  - botones **Ampliar expediente**, **Charlar** y **Seguir**;
  - actividad, lugar, hogar y dinero;
  - estado en barras, con un aviso si una necesidad está en nivel crítico;
  - **Por qué está aquí:** los hechos que explican su situación, con sus causas.

### Expediente de vida

Se abre con «Ampliar expediente» y ocupa toda la pantalla.

- **Cabecera:** Exportar JSON (descarga todo el expediente), Charlar y Reducir (vuelve al mapa con la ficha compacta).
- **Franja de identidad:** nombre, edad, nacimiento, estudios, trabajo y hogar; lo que hace ahora, su ánimo, su estrés y sus alertas.
- **Pestañas:**

| Pestaña | Qué muestra |
|---|---|
| Resumen | Identidad, por qué está donde está y el **curso de vida**: una línea por años con dónde vivió y los hitos de su historia de origen y de la simulación. Contadores de eventos, estímulos con función, reglas y charlas |
| Estado y necesidades | Ánimo, estrés y necesidades (1 = satisfecha), con la explicación si alguna está en nivel crítico. **Agenda de hoy:** su rutina en una franja de 24 h, con la marca de «ahora» y cuándo queda libre |
| Emociones | Las emociones activas y los hechos recientes que pueden haberlas disparado |
| Historia | Todos sus eventos en una tabla, con el filtro Todos, Historia de origen o Simulación, y el «¿por qué?» de cada uno. Debajo, el informe de vida completo |
| Vínculos | Familia en tabla (parentesco y situación), familiograma, vínculos desde las dos perspectivas y red relacional |
| Memoria | Lo que recuerda (no lo que pasó), con su intensidad; los recuerdos casi olvidados salen atenuados |
| Creencias | Lo que cree de otros y si coincide con la realidad; y lo que se dice de esta persona. Solo quien observa ve la verdad |
| Aprendizaje | Funciones de estímulos, reglas verbales, fuerza de respuestas, estados aprendidos, temperamento y la historia de aprendizaje por etapas |
| Salud | Régimen de salud, condiciones, enfermedades y episodios de sueño |
| Economía y objetos | Dinero, ocupación, cargo, hogar, deudas y objetos con dueño, fecha y precio |
| Charlas | Las charlas anteriores y el formulario para empezar una (modo y modo prueba), con su disponibilidad según su rutina |

### Charla

Se abre con «Charlar» y ocupa toda la pantalla; el mundo sigue en tiempo real.

- **Modos:**
  - **En el mundo:** es un encuentro real. Lo recordará y puede cambiar su ánimo, su estrés y lo que cree.
  - **Sandbox:** nada cambia.
- **Modo prueba:** permite etiquetar el tono de cada mensaje.
- **Franja superior:** modo, desde cuándo charlan y cuánto llevan, hasta cuándo está libre y dónde está.
- **Mensajes numerados**, con su hora, el tono o la postura (abrirse, poner un límite…) y el tiempo de respuesta. Bajo cada respuesta, las afirmaciones verificadas.
- **Escribir:** Enter envía; Mayúsculas+Enter salta de línea.
- **Panel lateral:**
  - por qué respondió así en el último turno, con los aportes de cada fuente y las otras posturas posibles;
  - estado de la charla (ánimo, estrés y alimentación en vivo, turnos y verificación);
  - lo que sabe la persona.
- **Al despedirse**, un resumen dice qué cambió y si la recordará. Salir de la pantalla también cierra la charla.

### Pantalla Datos

- **Periodo:** último mes, último año o desde la fundación.
- **Exportar CSV** descarga el registro de eventos.
- **Indicadores:** personas, nacidos y fallecidos del periodo con su tasa por mil, hogares con su tamaño medio y organizaciones.
- **Gráficas:**
  - pirámide por edad y sexo;
  - personas por ocupación.

  Cada una tiene «Ver como tabla» y muestra su valor al pasar el cursor.
- **El mundo en el tiempo:** ánimo, estrés, dinero y eventos por día, con los avisos si el mundo se estanca o se satura, y la descarga de trayectorias y eventos.

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
