# Cómo charlar con un ciudadano

Guía de la charla con ciudadanos (spec 043). Sirve para dos cosas: comprobar si lo que cuenta una persona casa con su historia, y ver cómo reacciona a distintos tipos de conversación (amable, grosera, victimizante…). No es una sesión clínica: es una charla casual.

## 1. Preparar la clave de Anthropic (una sola vez por terminal)

El ciudadano habla con Claude Haiku 4.5. Sin clave, la charla funciona igual, pero responde con frases de plantilla.

1. Abre PowerShell en la carpeta del proyecto.
2. Define la clave y las credenciales de los controles (la charla las usa también):
   ```powershell
   $env:ANTHROPIC_API_KEY = "sk-ant-..."
   $env:DATAS_WORLD_USER = "tu_usuario"
   $env:DATAS_WORLD_PASSWORD = "tu_contraseña"
   ```
   La clave solo vive en esa terminal: no se guarda en el proyecto ni en la base.
3. Arranca todo:
   ```
   pnpm dev
   ```
4. Abre **http://127.0.0.1:5180**.

## 2. Abrir una charla

1. Haz clic en una persona del mapa. En su ficha, pulsa **Charlar**.
2. Elige el modo:
   - **En el mundo:** la charla queda en su memoria. Aprende de ella (con topes: una charla no le cambia la vida) y su ánimo cambia un poco. Mientras charlan, el mundo avanza en **tiempo real** (1 minuto del mundo por minuto) y los demás siguen su vida. Al cerrar vuelve la velocidad anterior. Solo puede haber una charla en el mundo a la vez: si abres otra, la anterior se cierra sola (y la persona la recuerda).
   - **Sandbox:** no cambia nada del mundo. Sirve para probar sin dejar huella.
3. Si marcas **modo prueba**, puedes etiquetar el tono de cada mensaje. Si no lo etiquetas, lo clasifica Haiku.
4. Pulsa **Iniciar charla**.

La persona acepta según su situación:
- **dormida:** no puede charlar;
- **trabajando o en otra obligación:** habla solo un momento (unos 10 minutos);
- **en su tiempo libre:** hasta su próximo compromiso.

## 3. Durante la charla

- Escribe y pulsa **Enviar**. La respuesta llega poco a poco.
- Encima de cada respuesta ves:
  - el **tono** de tu mensaje (y lo que dijo el clasificador, si no coincide con tu etiqueta);
  - la **postura** que eligió la persona: abrirse, responder breve, evadir, poner un límite, contraatacar, aplacar, callar o terminar. La decide el motor según su historia de aprendizaje; Haiku solo la pone en palabras.
- Debajo aparecen, al rato, las **marcas de coherencia**:
  - ✓: lo que afirma está en su historia;
  - ✗ contradice: su historia dice otra cosa;
  - ? inventado: no hay nada en su historia;
  - ⚠: la respuesta no expresa la postura que tocaba (por ejemplo, se disculpa cuando debía poner un límite).
- El panel **Por qué respondió así** muestra los motivos de la postura y las probabilidades de las demás.
- El panel **Lo que sabe** es todo lo que Haiku recibe de la persona: su vida tal como la vivió. No sabe nada que no haya vivido.

La charla termina cuando pulsas **Despedirse**, cuando cierras la ventana de la charla (✕ o Esc) o recargas la página, o cuando la persona:
- decide irse (postura *terminar*);
- tiene que irse a un compromiso;
- se cansa de esperar tu mensaje (10 minutos sin escribir).

## 4. Lo que dices de otras personas (spec 044)

Si en una charla **en el mundo** le dices algo sobre alguien cercano (su pareja, su familia, su jefe o sus compañeros), por ejemplo «su esposa está de acuerdo con la relación abierta»:
- En la charla, el panel **Por qué respondió así** muestra qué oyó, de quién, cuánto se lo cree y cuánto le afecta. Si le afecta, la reacción es más fuerte.
- Al cerrar, si se lo cree, queda como **creencia** y le sube el estrés. Si le afectó lo suficiente, decide qué hacer: **preguntar** con calma, **confrontar** al encontrarse, **llamar** por celular o **quedarse rumiando**.
- En el mundo, la llamada o el encuentro ocurren solos. La otra persona responde según su historia (casi siempre niega, porque nunca dijo eso), la relación se tensa y la otra persona queda sabiendo que un extraño anda diciendo cosas.
- Para ver toda la historia: `pnpm cli citizen:report CIT-000002` → sección **Creencias, intenciones y vínculos**, con la cadena de cada conflicto hasta la frase de la charla.

En **sandbox** ves lo mismo en el panel, pero no cambia nada.

## 5. Batería automática

Para probar muchos ciudadanos a la vez con guiones fijos (uno por tono):
```
pnpm cli chat:battery --citizens 10
```
Por defecto usa un proveedor simulado, gratuito y siempre igual. Deja el informe en `data/bateria-charla.md` (y `.json`). Para hacerlo con Haiku (cuesta dinero):
```
pnpm cli chat:battery --citizens 5 --provider config
```

## 6. Coste y ajustes

- **Modelo:** Claude Haiku 4.5, con un presupuesto por defecto de 20 USD al mes y 2 millones de tokens al día. Al agotarse, la charla sigue con frases de plantilla.
- **Otro modelo o presupuesto:** crea `config/llm.json`. Ejemplo:
  ```json
  { "budget": { "monthlyCostCents": 1000 } }
  ```
- **Consultar charlas guardadas:** en la ficha de la persona, pestaña **Charlas**. También por la API: `GET /api/chat/sessions?citizenId=CIT-000019` y `GET /api/chat/sessions/<id>` (con usuario y contraseña).
- **Latencia y coste de tus charlas:** `pnpm cli chat:stats`. Muestra el primer token y la respuesta completa (p50 y p95) frente a los objetivos, y el coste total, por charla y por propósito. Funciona aunque `pnpm dev` esté en marcha (solo lee).
