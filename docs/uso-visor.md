# Cómo ver el mundo en el navegador

Guía para abrir el visor mínimo de Data's World (bloque V). El visor solo mira: no cambia nada del mundo, salvo cuando usas los controles de tiempo.

## 1. Arrancar

1. Abre una terminal en la carpeta del proyecto.
2. Si quieres usar los controles de tiempo (pausa, velocidad), define un usuario y una contraseña. En PowerShell:
   ```powershell
   $env:DATAS_WORLD_USER = "tu_usuario"
   $env:DATAS_WORLD_PASSWORD = "tu_contraseña"
   ```
   Sin ellos, el visor funciona igual, pero los controles aparecen desactivados.
3. Escribe:
   ```
   pnpm dev
   ```
   La primera vez crea un mundo nuevo en `data/world.db` (tarda unos segundos). Las siguientes veces continúa el mismo mundo donde lo dejaste.
4. Abre **http://127.0.0.1:5173** en el navegador.

Para detener, pulsa **Ctrl+C** en la terminal. El mundo se guarda al cerrar.

Opciones:
- `pnpm dev -- --speed 100`: arranca más rápido. Las velocidades posibles son 0, 1, 10, 100 y 1000; por defecto, 10.
- `pnpm dev -- --db data/otro.db --seed 123`: usa otro mundo, o lo crea con otra semilla.

## 2. Qué ves

- **El mapa** del pueblo: calles, casas, comercios, colegio, parque. Arrastra para moverte, usa la rueda del ratón o los botones − y + para acercar o alejar.
- **Las personas** son figuritas de colores, y cada una tiene siempre el mismo aspecto. Se mueven entre sus lugares: casa, trabajo, colegio, ocio. Si hay varias en la misma puerta, se reparten alrededor.
- **La hora** está arriba. De noche el mapa se oscurece.
- **Lo que va pasando** aparece en el panel derecho: quién se enfermó, quién consiguió empleo, quién salió a divertirse…

## 3. La ficha de una persona

Haz clic en una figurita. Se abre su ficha con tres pestañas:
- **Estado:** qué hace y dónde está, su ánimo y estrés, sus necesidades (alimentación, energía, compañía…) y sus emociones.
- **Historia:** lo último que le pasó y **por qué**. Por ejemplo: "Tiempo libre: Leer — por: reforzador: diversión".
- **Funcional:** lo que ha aprendido (qué le resulta agradable o desagradable), sus reglas (por qué las sigue y cuánto pesan) y sus relaciones verbales ("llegar tarde lleva a despido").

Cierra la ficha con ✕ o con la tecla **Esc**.

## 4. Controles y teclado

| Acción | Botón | Tecla |
|---|---|---|
| Pausar o reanudar | ⏯ Pausa | espacio |
| Avanzar un paso (en pausa) | ⏭ Paso | — |
| Más rápido / más lento | + / − Velocidad | + / − |
| Mover la cámara | arrastrar | flechas |
| Cerrar la ficha | ✕ | Esc |

La primera vez que uses un control, el navegador te pedirá el usuario y la contraseña del paso 1.

## 5. Qué revisar (te lo pido a ti)

Hay dos cosas que no puedo comprobar sin un navegador:
1. **Fluidez:** arriba aparece un contador de fps. Debería estar en 50 o más.
2. **Móvil:** con la ventana estrecha, o en el móvil, el panel pasa abajo. Comprueba que los botones se pueden usar a 375 px de ancho: en el navegador, F12 y luego la vista de dispositivo.

Si algo se ve mal, dime qué y en qué pantalla.
