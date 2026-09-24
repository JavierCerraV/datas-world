# Mundo Social Autónomo Simulado

## Documento técnico de arquitectura, alcance y diseño conceptual

**Estado:** Diseño conceptual / Pre-SDD  
**Objetivo:** Construcción progresiva de un mundo social autónomo con población simulada  
**Capa clínica:** Posterior; no forma parte del MVP del simulador  
**Metodología prevista:** Spec Driven Development (SSD) con Claude Code  
**Interfaz prevista:** Mundo visual 2D estilo pixel art  
**Prioridad:** Realismo dinámico, autonomía, causalidad y evolución temporal

---

# 1. Resumen del proyecto

El proyecto consiste en construir un mundo social simulado en el que una población de personas artificiales pueda vivir de manera autónoma durante largos períodos de tiempo.

El objetivo inicial **no es crear pacientes simulados ni un videojuego**.

El objetivo inicial es construir un **mundo autónomo poblado por individuos con vidas propias**, capaces de:

- desplazarse;
- trabajar;
- estudiar;
- descansar;
- consumir;
- relacionarse;
- formar familias;
- crear amistades;
- cambiar de trabajo;
- ganar y gastar dinero;
- adquirir y perder objetos;
- desarrollar hábitos;
- experimentar acontecimientos;
- recordar;
- olvidar;
- aprender;
- modificar sus objetivos;
- reaccionar ante otras personas;
- formar y romper relaciones;
- cambiar de vivienda;
- modificar sus rutinas;
- desarrollar problemas;
- recuperarse;
- acumular consecuencias;
- generar nuevas situaciones sociales.

El mundo debe continuar evolucionando aunque ningún usuario lo observe.

Posteriormente, una persona externa podrá entrar en este mundo como terapeuta y seleccionar individuos reales dentro de la simulación para desarrollar procesos terapéuticos longitudinales.

La capa terapéutica debe considerarse una **aplicación construida sobre el mundo**, no el fundamento del mundo.

---

# 2. Principio fundamental

## No construir pacientes. Construir personas.

El sistema no debe comenzar con:

```text
Paciente:
    diagnóstico = ansiedad
    personalidad = introvertido
    dificultad = alta
```

Debe comenzar con:

```text
Persona
    ↓
familia
    ↓
infancia
    ↓
educación
    ↓
trabajo
    ↓
relaciones
    ↓
decisiones
    ↓
experiencias
    ↓
hábitos
    ↓
consecuencias
    ↓
estado actual
```

Una persona puede convertirse en un potencial paciente como consecuencia de su historia.

Esto permite que los problemas psicológicos no sean simples etiquetas asignadas por el sistema, sino fenómenos que emergen de la interacción entre:

- predisposiciones;
- circunstancias;
- historia;
- relaciones;
- recursos;
- acontecimientos;
- aprendizaje;
- hábitos;
- decisiones;
- ambiente;
- azar;
- condiciones sociales.

---

# 3. Objetivos del proyecto

## 3.1 Objetivo principal

Crear un entorno social autónomo capaz de producir y mantener una población numerosa de individuos con historias, relaciones, necesidades, rutinas, objetos, recursos y estados dinámicos.

## 3.2 Objetivos secundarios

El sistema deberá permitir:

1. Generar población.
2. Generar familias y estructuras sociales.
3. Generar viviendas.
4. Generar lugares.
5. Generar organizaciones.
6. Generar empleos.
7. Generar objetos.
8. Crear economía básica.
9. Simular movilidad.
10. Simular rutinas.
11. Simular interacciones.
12. Simular acontecimientos.
13. Mantener memoria individual.
14. Mantener relaciones sociales.
15. Mantener estados internos.
16. Generar aprendizaje.
17. Permitir aparición de conflictos.
18. Permitir recuperación y adaptación.
19. Mantener historia de vida.
20. Avanzar el mundo en el tiempo.
21. Permitir acelerar el tiempo.
22. Observar individuos.
23. Consultar su historia.
24. Reproducir acontecimientos.
25. Comparar estados en diferentes momentos.
26. Ejecutar simulaciones experimentales.
27. Reproducir determinadas condiciones.
28. Crear poblaciones con características específicas.
29. Extraer individuos para futuros escenarios clínicos.

---

# 4. Lo que NO es el proyecto inicialmente

No es inicialmente:

- un videojuego;
- un chatbot;
- un simulador de terapia;
- un generador de personajes;
- una colección de NPCs;
- una simulación económica pura;
- una simulación psicológica exclusivamente;
- una historia narrativa preescrita.

La interfaz puede parecer un videojuego.

La arquitectura debe parecerse más a un:

> **laboratorio de simulación social.**

---

# 5. Concepto de mundo

El mundo debe tener una existencia independiente del usuario.

Debe existir:

```text
Mundo
│
├── Tiempo
├── Geografía
├── Lugares
├── Edificios
├── Organizaciones
├── Objetos
├── Economía
├── Transporte
├── Servicios
├── Instituciones
├── Familias
├── Personas
├── Relaciones
├── Eventos
├── Información
└── Historia
```

El usuario simplemente observa o interviene posteriormente.

---

# 6. Escala

El sistema debe diseñarse desde el comienzo para poder crecer.

No debe asumirse que la primera versión tendrá 10.000 o 100.000 individuos.

Debe ser posible comenzar con:

```text
100 personas
```

y posteriormente escalar hacia:

```text
1.000
10.000
100.000
1.000.000
```

sin tener que rediseñar conceptualmente todo el sistema.

La escalabilidad debe lograrse mediante diferentes niveles de simulación.

---

# 7. Niveles de simulación

No todos los individuos necesitan el mismo nivel de procesamiento permanentemente.

## Nivel 0 — Existencia

El individuo existe como registro.

## Nivel 1 — Macroestado

Se actualizan:

- edad;
- empleo;
- dinero;
- vivienda;
- relaciones;
- necesidades principales;
- acontecimientos importantes.

## Nivel 2 — Actividad

Se simulan:

- rutinas;
- desplazamientos;
- actividades;
- consumo;
- interacciones relevantes.

## Nivel 3 — Cognición

Se activan:

- memoria;
- interpretación;
- toma de decisiones;
- emociones;
- razonamiento social.

## Nivel 4 — Interacción profunda

Se utiliza un modelo generativo cuando sea necesario:

- conversaciones;
- negociación;
- conflicto;
- decisiones complejas;
- acontecimientos socialmente ambiguos.

Esto permite evitar que un LLM tenga que "pensar" permanentemente por cada ciudadano.

---

# 8. Tiempo

El tiempo es uno de los componentes centrales.

Debe existir un reloj global:

```text
world_datetime
```

El sistema debe permitir:

```text
1x
5x
10x
50x
100x
1000x
```

y también:

```text
pause
step
rewind
replay
```

El sistema debe distinguir entre:

### Tiempo del mundo

Ejemplo:

```text
2027-04-13 08:32
```

### Tiempo biográfico

Ejemplo:

```text
edad: 31 años
```

### Tiempo relativo de acontecimientos

Ejemplo:

```text
hace 4 días
hace 3 meses
hace 12 años
```

---

# 9. Persistencia histórica

El sistema debe diferenciar entre:

### Estado actual

```text
Carlos:
    dinero: 4.200.000
    trabajo: empresa X
    pareja: Laura
```

y:

### Historia

```text
Carlos:
    trabajó en empresa A
    conoció a Laura
    terminó relación anterior
    compró motocicleta
    perdió empleo
    se mudó
```

La historia no debe desaparecer cuando cambia el estado.

---

# 10. Personas

Cada ciudadano debe poseer varias capas.

## 10.1 Identidad

- nombre;
- edad;
- fecha de nacimiento;
- sexo;
- características demográficas;
- nacionalidad;
- lugar de nacimiento;
- residencia.

## 10.2 Biografía

- infancia;
- adolescencia;
- educación;
- familia;
- trabajos;
- relaciones;
- pérdidas;
- logros;
- mudanzas;
- acontecimientos importantes.

## 10.3 Personalidad

Debe utilizarse una representación multidimensional.

No limitarse a:

```text
extrovertido / introvertido
```

Debe incluir dimensiones como:

- apertura;
- responsabilidad;
- extraversión;
- amabilidad;
- estabilidad emocional;
- impulsividad;
- paciencia;
- tolerancia a la incertidumbre;
- búsqueda de aprobación;
- necesidad de control;
- sensibilidad social;
- orientación temporal;
- flexibilidad;
- persistencia.

## 10.4 Valores

Ejemplos:

- familia;
- seguridad;
- libertad;
- éxito;
- dinero;
- prestigio;
- pertenencia;
- conocimiento;
- creatividad;
- autonomía;
- altruismo.

## 10.5 Necesidades

Las necesidades deben cambiar dinámicamente.

Ejemplos:

- hambre;
- sueño;
- seguridad;
- descanso;
- interacción social;
- pertenencia;
- autonomía;
- logro;
- afecto;
- estimulación;
- sentido.

---

# 11. Estado interno

El estado interno debe ser dinámico.

Ejemplos:

```text
mood
stress
fatigue
anxiety
loneliness
motivation
frustration
satisfaction
hope
anger
sadness
energy
```

No deben ser variables aisladas.

Debe existir interacción entre ellas.

Por ejemplo:

```text
poco sueño
    ↓
fatiga
    ↓
irritabilidad
    ↓
conflicto
    ↓
estrés
    ↓
peor sueño
```

El sistema debe poder generar ciclos de retroalimentación.

---

# 12. Rutinas

Cada persona debe poseer rutinas, pero las rutinas no deben ser rígidas.

Ejemplo:

```text
06:30 despertar
07:00 desayuno
07:30 desplazamiento
08:00 trabajo
12:30 almuerzo
17:00 salida
18:00 actividad
20:00 cena
22:30 descanso
23:30 dormir
```

Pero una rutina puede romperse por:

- tráfico;
- enfermedad;
- discusión;
- llamada;
- falta de dinero;
- accidente;
- invitación;
- evento laboral;
- cansancio;
- oportunidad;
- obligación familiar.

La ruptura de rutinas debe producir consecuencias.

---

# 13. Relaciones

Las relaciones constituyen una estructura central del mundo.

Tipos posibles:

- madre;
- padre;
- hijo;
- hermano;
- pareja;
- ex pareja;
- amigo;
- conocido;
- vecino;
- compañero;
- jefe;
- subordinado;
- profesor;
- estudiante;
- médico;
- cliente;
- proveedor;
- rival;
- desconocido.

Cada relación debe tener estado propio.

Ejemplo conceptual:

```text
relationship
{
    closeness,
    trust,
    affection,
    conflict,
    dependence,
    frequency,
    reciprocity,
    history,
    expectations,
    secrets,
    unresolved_issues
}
```

Las relaciones deben poder:

- comenzar;
- fortalecerse;
- deteriorarse;
- pausarse;
- romperse;
- recuperarse;
- transformarse.

---

# 14. Relaciones asimétricas

La relación debe poder ser diferente desde cada perspectiva.

Carlos puede pensar:

> "Laura es mi mejor amiga."

Laura puede pensar:

> "Carlos es un buen conocido."

El sistema no debe obligar a que ambos tengan el mismo estado emocional.

Esto será importante posteriormente para la simulación social y clínica.

---

# 15. Memoria

La memoria no debe ser una lista perfecta de todos los acontecimientos.

Debe existir:

### Memoria episódica

Experiencias específicas.

### Memoria semántica

Conocimientos.

### Memoria social

Información sobre otras personas.

### Memoria emocional

Experiencias asociadas a emociones.

### Memoria procedimental

Hábitos y habilidades.

### Memoria autobiográfica

Narrativa sobre la propia vida.

La memoria debe tener:

- intensidad;
- importancia;
- recencia;
- frecuencia de recuperación;
- carga emocional;
- precisión;
- distorsión;
- olvido.

---

# 16. Información y conocimiento

Una de las características fundamentales del mundo será que:

> **nadie conoce toda la verdad.**

Debe existir una diferencia entre:

```text
WORLD_STATE
```

y:

```text
PERSON_KNOWLEDGE
```

Ejemplo:

El mundo sabe:

```text
Laura perdió su empleo.
```

Carlos puede saberlo.

María puede no saberlo.

Pedro puede creer que renunció.

Laura puede decir que fue despedida.

Esto permite:

- rumores;
- secretos;
- errores;
- malentendidos;
- mentiras;
- interpretaciones;
- información incompleta.

---

# 17. Objetos

El mundo debe poseer objetos reales.

No solamente objetos decorativos.

Categorías:

```text
vivienda
mobiliario
ropa
alimentos
herramientas
electrónica
vehículos
medicamentos
documentos
dinero
dispositivos
libros
material laboral
objetos personales
regalos
recuerdos
```

Cada objeto importante puede tener:

```text
owner
location
condition
value
purchase_date
acquisition_method
history
emotional_value
```

Un objeto puede tener historia.

Ejemplo:

```text
Anillo #1842

comprado:
2019

regalado por:
CIT-023

actual propietario:
CIT-091

significado:
alto valor sentimental
```

---

# 18. Economía

El mundo debe poseer una economía simplificada pero funcional.

Debe existir:

- ingresos;
- salarios;
- precios;
- gastos;
- alquiler;
- deudas;
- ahorro;
- impuestos;
- comercio;
- consumo;
- empleo;
- desempleo;
- empresas;
- quiebras;
- oportunidades.

La economía no necesita ser inicialmente macroeconómicamente perfecta.

Debe ser suficiente para que las personas tengan restricciones reales.

El dinero debe afectar decisiones.

Ejemplo:

```text
Carlos quiere ir de vacaciones.

Deseo = 0.8

Pero:

dinero disponible = insuficiente

Resultado:

pospone vacaciones
```

---

# 19. Objetos + economía + personas

Los objetos no deben existir aislados.

Ejemplo:

```text
Persona
    ↓
trabaja
    ↓
recibe dinero
    ↓
compra teléfono
    ↓
teléfono permite comunicación
    ↓
conoce persona
    ↓
se genera relación
```

Los objetos pueden formar parte de cadenas causales.

---

# 20. Lugares

El mundo necesita lugares funcionales.

Categorías:

- viviendas;
- oficinas;
- empresas;
- colegios;
- universidades;
- hospitales;
- tiendas;
- restaurantes;
- parques;
- iglesias;
- gimnasios;
- estaciones;
- transporte;
- espacios culturales;
- espacios públicos;
- espacios privados.

Cada lugar debe tener:

- capacidad;
- horarios;
- reglas;
- propietarios;
- trabajadores;
- visitantes;
- objetos;
- actividad;
- nivel socioeconómico;
- función.

---

# 21. Organizaciones

Las personas deben pertenecer a organizaciones.

Ejemplos:

- empresas;
- colegios;
- universidades;
- hospitales;
- comercios;
- clubes;
- asociaciones;
- instituciones;
- grupos informales.

Una organización debe tener:

- estructura;
- empleados;
- recursos;
- objetivos;
- reglas;
- cultura;
- relaciones internas;
- historia.

---

# 22. Clases sociales

El mundo debe permitir diversidad socioeconómica.

No debe existir una sola experiencia de vida.

Deben existir diferencias en:

- ingresos;
- patrimonio;
- educación;
- acceso a servicios;
- vivienda;
- transporte;
- redes sociales;
- oportunidades;
- estabilidad laboral;
- tiempo disponible;
- exposición a riesgos.

Estas diferencias deben afectar la simulación.

---

# 23. Acontecimientos

Los acontecimientos pueden ser:

### Programados

- cumpleaños;
- citas;
- vacaciones;
- pagos;
- clases.

### Probabilísticos

- enfermedad;
- accidente;
- oportunidad;
- pérdida;
- conflicto.

### Emergentes

Resultado de interacciones.

Ejemplo:

```text
discusión
    ↓
ruptura
    ↓
mudanza
    ↓
problemas económicos
    ↓
nuevo empleo
```

---

# 24. Motor causal

El sistema debe intentar representar:

```text
estado
    +
acción
    +
contexto
    ↓
evento
    ↓
consecuencia
    ↓
nuevo estado
```

Las consecuencias pueden ser:

- inmediatas;
- diferidas;
- indirectas;
- acumulativas;
- inesperadas.

---

# 25. Azar controlado

No todo debe ser causalmente predecible.

Debe existir ruido.

Pero el azar debe estar sujeto a reglas.

Ejemplo:

```text
P(enfermedad | edad, hábitos, exposición)
```

No:

```text
random()
```

para todo.

El sistema debe distinguir entre:

- incertidumbre;
- probabilidad;
- causalidad;
- aleatoriedad.

---

# 26. Aprendizaje

Las personas deben cambiar.

El aprendizaje puede provenir de:

- experiencia;
- consecuencias;
- observación;
- educación;
- conversación;
- fracaso;
- éxito;
- relaciones;
- repetición.

Pero las personas deben aprender de manera diferente.

Variables potenciales:

```text
learning_speed
retention
generalization
flexibility
feedback_sensitivity
practice_frequency
```

Una experiencia no necesariamente produce aprendizaje.

---

# 27. Formación de hábitos

Las acciones repetidas deben poder convertirse en hábitos.

Ejemplo:

```text
acción repetida
    ↓
automatización
    ↓
menor esfuerzo
    ↓
mayor probabilidad de repetición
```

Los hábitos pueden:

- facilitar;
- perjudicar;
- entrar en conflicto con objetivos;
- persistir aunque cambien las circunstancias.

---

# 28. Desarrollo durante toda la vida

Los ciudadanos deben envejecer.

El sistema debe permitir:

```text
nacimiento
infancia
adolescencia
adultez
vejez
muerte
```

La edad debe modificar:

- necesidades;
- capacidades;
- relaciones;
- empleo;
- economía;
- salud;
- intereses;
- responsabilidades.

La muerte también debe formar parte del mundo.

No debe ser únicamente un "game over".

Produce consecuencias para otras personas.

---

# 29. Familia

La familia debe poder evolucionar.

Ejemplos:

```text
pareja
    ↓
convivencia
    ↓
hijos
    ↓
separación
    ↓
custodia
    ↓
nueva pareja
```

Las estructuras familiares deben poder ser diversas.

---

# 30. Generaciones

Una característica avanzada del sistema será permitir que:

> los ciudadanos creen nuevos ciudadanos.

Eso permitiría que la población evolucione.

Una familia puede existir durante décadas.

Los hijos pueden crecer y convertirse en agentes autónomos.

Esto permite estudiar:

- transmisión cultural;
- transmisión económica;
- transmisión de hábitos;
- relaciones intergeneracionales.

---

# 31. Cultura

El mundo debe desarrollar patrones colectivos.

Ejemplos:

- costumbres;
- modas;
- expresiones;
- preferencias;
- actividades;
- reputaciones;
- normas sociales.

Idealmente algunas características culturales deberían emerger de la población.

---

# 32. Reputación

Las personas pueden desarrollar reputaciones diferentes según grupos.

Ejemplo:

Carlos puede tener:

```text
trabajo:
    reputación = buena

familia:
    reputación = responsable

vecindario:
    reputación = desconocido
```

La reputación debe propagarse mediante interacción social.

---

# 33. Conflicto

Debe existir conflicto cotidiano.

No solamente conflicto clínico.

Ejemplos:

- vecinos;
- pareja;
- familia;
- trabajo;
- dinero;
- tráfico;
- comercio;
- competencia;
- malentendidos.

Los conflictos deben dejar memoria y alterar relaciones.

---

# 34. Sistema de conversación

Las conversaciones pueden tener diferentes niveles.

### Nivel simple

Reglas y plantillas.

### Nivel contextual

Generación condicionada por:

- relación;
- contexto;
- estado;
- conocimiento;
- objetivo.

### Nivel profundo

LLM.

El LLM no debe ser responsable de mantener la verdad del mundo.

El mundo mantiene la verdad.

El LLM genera la expresión.

---

# 35. Separación entre realidad y narrativa

Esto es crítico.

Debe existir:

```text
WORLD_TRUTH
```

y:

```text
AGENT_INTERPRETATION
```

Ejemplo:

### Realidad

```text
El jefe está satisfecho con Carlos.
```

### Carlos cree

```text
Mi jefe está decepcionado conmigo.
```

### Compañero cree

```text
Carlos está pensando renunciar.
```

Las tres cosas pueden coexistir.

---

# 36. Generación de población

La población no debe generarse como individuos independientes.

Debe generarse jerárquicamente.

```text
ciudad
 ↓
barrios
 ↓
hogares
 ↓
familias
 ↓
personas
 ↓
organizaciones
 ↓
relaciones
```

Esto produce coherencia.

---

# 37. Generación de historias

Cada individuo debe tener una historia inicial.

Pero la historia no tiene que ser exhaustiva.

Puede existir:

```text
birth
childhood_summary
education_history
family_history
relationship_history
career_history
major_events
```

Después la simulación comienza a producir la historia detallada.

---

# 38. El mundo debe poder producir individuos interesantes

No queremos únicamente individuos estadísticamente correctos.

Queremos diversidad.

Por ejemplo:

- persona con mucho dinero pero aislamiento social;
- persona con pocos recursos y enorme red social;
- persona con trabajo excelente y familia conflictiva;
- persona sin problemas aparentes;
- persona con múltiples problemas;
- persona que funciona extraordinariamente bien bajo presión;
- persona que evita todo conflicto;
- persona impulsiva;
- persona extremadamente organizada;
- persona caótica;
- persona altamente adaptable;
- persona rígida;
- persona que aprende rápidamente;
- persona que repite constantemente los mismos patrones.

---

# 39. Perfil emergente

El sistema debe poder analizar una persona después de que haya vivido.

Por ejemplo:

```text
perfil_emergente
{
    estabilidad_laboral,
    estabilidad_relacional,
    red_social,
    resiliencia,
    flexibilidad,
    capacidad_de_aprendizaje,
    aislamiento,
    exposición_a_estresores,
    recursos,
    conflictos,
    trayectoria_económica
}
```

Estos valores no deberían ser necesariamente parámetros iniciales.

Podrían calcularse a partir de la historia.

---

# 40. Informe de vida

Cada ciudadano debe poder producir un informe histórico.

Ejemplo:

```text
LIFE REPORT

Nacimiento
↓
Educación
↓
Primer trabajo
↓
Primera relación importante
↓
Mudanza
↓
Pérdida laboral
↓
Nuevo empleo
↓
Conflicto familiar
↓
Cambio de hábitos
↓
Situación actual
```

Debe poder consultarse:

- línea temporal;
- relaciones;
- trabajos;
- viviendas;
- economía;
- acontecimientos;
- cambios psicológicos;
- objetos importantes;
- decisiones relevantes.

---

# 41. Observabilidad

El desarrollador debe poder observar el mundo sin intervenir.

Herramientas necesarias:

```text
world viewer
citizen viewer
relationship graph
event log
timeline
economic dashboard
population dashboard
simulation statistics
```

---

# 42. Reproducibilidad

Toda simulación debe utilizar semillas controlables.

Ejemplo:

```text
simulation_seed = 482917
```

Con la misma semilla y las mismas condiciones:

> el mundo debería poder reproducirse aproximadamente.

Esto es indispensable para investigación y debugging.

---

# 43. Experimentos

El sistema debe permitir crear escenarios:

```text
Experiment A
1000 citizens
high unemployment

Experiment B
1000 citizens
normal unemployment
```

y comparar resultados.

Esto convierte el proyecto en una plataforma de investigación además de una futura plataforma clínica.

---

# 44. Eventos registrados

El sistema debe registrar acontecimientos importantes.

No necesariamente cada movimiento.

Ejemplos:

```text
PERSON_MOVED
JOB_STARTED
JOB_LOST
RELATIONSHIP_STARTED
RELATIONSHIP_ENDED
CHILD_BORN
OBJECT_PURCHASED
OBJECT_LOST
ARGUMENT_OCCURRED
HOUSE_CHANGED
INCOME_CHANGED
HEALTH_EVENT
MEMORY_CREATED
MEMORY_MODIFIED
GOAL_CREATED
GOAL_COMPLETED
GOAL_ABANDONED
```

---

# 45. Arquitectura conceptual

Una arquitectura inicial podría ser:

```text
                    WORLD ENGINE
                         │
        ┌────────────────┼────────────────┐
        │                │                │
      TIME            WORLD            EVENTS
        │                │                │
        │       ┌────────┼────────┐       │
        │       │        │        │       │
     PLACES   OBJECTS  ECONOMY  ORGS    EVENTS
        │       │        │        │       │
        └───────┴────────┴────────┴───────┘
                         │
                         ▼
                  AGENT ENGINE
                         │
        ┌────────────────┼────────────────┐
        │                │                │
     STATE           MEMORY          DECISION
        │                │                │
        └────────────────┼────────────────┘
                         │
                         ▼
                    INTERACTION
                         │
                         ▼
                    CONSEQUENCE
                         │
                         └──────► WORLD
```

---

# 46. Uso de modelos de IA

El LLM no debe ser el núcleo de la simulación.

Debe ser una herramienta especializada dentro del sistema.

Utilizaciones potenciales:

- conversación;
- interpretación social;
- generación de lenguaje;
- razonamiento contextual;
- planificación compleja;
- generación de recuerdos narrativos;
- negociación;
- interpretación de acontecimientos.

El estado real debe mantenerse fuera del LLM.

El LLM recibe contexto y produce una decisión o expresión que después debe ser validada por el motor.

---

# 47. Regla de oro para la IA

El LLM no puede modificar arbitrariamente el mundo.

Debe solicitar acciones.

Ejemplo:

```text
Agent → quiero comprar un automóvil

World Engine verifica:

dinero
+
disponibilidad
+
lugar
+
reglas
```

Si las condiciones se cumplen:

```text
purchase_vehicle()
```

El motor actualiza:

```text
dinero
propiedad
inventario
comercio
historial
```

---

# 48. Objetos como agentes pasivos

Los objetos también pueden tener estado.

Ejemplo:

```text
teléfono
{
    owner,
    condition,
    battery,
    location,
    value,
    purchase_date,
    memories_associated
}
```

Esto permitirá que posteriormente los objetos tengan consecuencias.

Ejemplo:

> teléfono perdido

puede producir:

- estrés;
- gasto;
- interrupción laboral;
- pérdida de comunicación;
- conflicto.

---

# 49. Simulación por eventos

La arquitectura debería favorecer un modelo basado en eventos.

En lugar de actualizar absolutamente todo cada segundo:

```text
cada segundo:
    actualizar 10000 personas
```

se puede trabajar mediante:

```text
EVENT QUEUE

08:00 Carlos despierta
08:10 Carlos desayuna
08:30 Carlos sale
08:37 accidente en avenida
08:42 tráfico aumenta
08:50 Carlos llega tarde
09:00 jefe registra llegada tardía
```

Esto puede hacer la simulación mucho más eficiente.

---

# 50. Persistencia

El sistema debe diferenciar:

### Estado

Lo que existe ahora.

### Evento

Lo que ocurrió.

### Historia

La reconstrucción de lo ocurrido.

### Memoria

Lo que cada persona recuerda.

Estas cuatro cosas no son equivalentes.

---

# 51. Arquitectura tecnológica

La tecnología concreta deberá definirse durante la fase SSD.

No asumir todavía:

- lenguaje;
- base de datos;
- framework;
- proveedor LLM;
- motor gráfico;
- infraestructura.

La arquitectura debe decidirse después de conocer:

- escala objetivo;
- frecuencia de simulación;
- cantidad de eventos;
- requisitos de persistencia;
- costo de inferencia;
- necesidades de reproducción;
- necesidades de visualización.

---

# 52. Interfaz visual

La primera interfaz puede ser sencilla.

Debe permitir:

```text
Mapa
│
├── edificios
├── calles
├── personas
├── vehículos
├── lugares
└── objetos relevantes
```

Y permitir:

- zoom;
- velocidad;
- pausa;
- selección de ciudadano;
- seguimiento;
- inspección;
- historial.

El pixel art debe funcionar como **visualización del estado de la simulación**, no como sistema de lógica.

---

# 53. Primera versión del mundo

La primera versión no debe intentar tener todo.

Un MVP técnico razonable podría contener:

```text
100-500 ciudadanos

familias

viviendas

5-10 barrios

lugares de trabajo

comercios

dinero

empleos

objetos básicos

transporte básico

rutinas

relaciones

memoria simple

eventos

tiempo acelerado

historial

visualización 2D
```

Todavía sin terapia.

---

# 54. Criterio de éxito del primer MVP

El sistema debe ser capaz de hacer esto:

```text
GENERAR MUNDO
      ↓
GENERAR POBLACIÓN
      ↓
INICIAR SIMULACIÓN
      ↓
AVANZAR 1 DÍA
      ↓
AVANZAR 1 SEMANA
      ↓
AVANZAR 1 MES
      ↓
INSPECCIONAR CIUDADANO
      ↓
VER HISTORIA GENERADA
```

Y el resultado debe ser diferente pero coherente.

---

# 55. Prueba fundamental

Una prueba especialmente importante será:

> Crear 100 ciudadanos y simular 1 año sin intervención humana.

Después inspeccionar una muestra.

La pregunta no será:

> "¿Funcionó el código?"

Será:

> **¿Estas personas parecen haber vivido un año?**

Deberíamos poder observar:

- cambios;
- relaciones nuevas;
- relaciones terminadas;
- trabajos;
- problemas;
- compras;
- pérdidas;
- aprendizajes;
- hábitos;
- acontecimientos inesperados.

---

# 56. Segunda prueba

Crear dos mundos con la misma población inicial.

```text
WORLD A
seed = 1234

WORLD B
seed = 1234
```

Deben ser reproducibles.

Después modificar solamente:

```text
un acontecimiento inicial
```

y observar cómo divergen.

Esto permitirá comprobar si realmente existe causalidad emergente.

---

# 57. Tercera prueba

Seleccionar una persona.

Registrar:

```text
estado inicial
```

Simular:

```text
1 año
```

y generar:

```text
LIFE REPORT
```

Debe ser posible explicar razonablemente:

> por qué terminó donde terminó.

Si el sistema no puede explicar la trayectoria, probablemente está generando estados arbitrarios en lugar de simular una vida.

---

# 58. Futura capa clínica

Esta capa queda fuera del primer desarrollo.

Posteriormente se añadirá:

```text
THERAPIST
     │
     ▼
PATIENT SELECTION
     │
     ▼
AGENDA
     │
     ▼
SESSION
     │
     ▼
INTERACTION
     │
     ▼
LEARNING
     │
     ▼
WORLD CONTINUES
     │
     ▼
NEW LIFE STATE
```

El paciente continuará viviendo entre sesiones.

---

# 59. Futura evaluación terapéutica

Cuando llegue esta etapa se podrán medir:

- evolución;
- adherencia;
- transferencia;
- aprendizaje;
- generalización;
- recaídas;
- cambios conductuales;
- cambios sociales;
- cambios laborales;
- cambios en relaciones;
- calidad de vida;
- objetivos personales.

No debería limitarse a evaluar:

> "¿El terapeuta dijo la respuesta correcta?"

---

# 60. Futura selección de pacientes

El sistema podrá buscar personas mediante características emergentes.

Ejemplo:

```text
buscar ciudadanos que:

edad 25-40
+
problemas laborales
+
relación de pareja conflictiva
+
alta evitación
+
baja motivación
+
red social moderada
+
historia de tratamiento previo
```

Y devolver individuos existentes del mundo.

No serán personajes creados específicamente para esa búsqueda.

---

# 61. Concepto comercial futuro

El producto podría evolucionar hacia:

> **Plataforma de entrenamiento clínico basada en población simulada.**

El cliente podría contratar:

- número de terapeutas;
- número de pacientes;
- duración;
- escenarios;
- dificultad;
- supervisión;
- métricas;
- historial;
- experimentos.

Pero esta capa no debe condicionar la arquitectura del mundo inicial.

---

# 62. Riesgo principal del proyecto

El mayor riesgo no es generar gráficos.

Tampoco es generar personajes.

El mayor riesgo es construir una simulación que:

> **parezca compleja pero no tenga verdadera continuidad causal.**

Un ciudadano que cambia arbitrariamente de estado cada vez que se consulta no constituye una vida simulada.

El mundo debe mantener:

```text
continuidad
+
memoria
+
causalidad
+
restricciones
+
consecuencias
+
aprendizaje
+
incertidumbre
```

---

# 63. Segundo riesgo

El segundo riesgo es intentar resolver todo con LLMs.

Eso produciría:

- costos elevados;
- inconsistencias;
- dificultad para reproducir;
- problemas de estado;
- pérdida de memoria;
- personajes excesivamente complacientes;
- comportamiento difícil de depurar.

El LLM debe ser una parte del sistema, no el sistema.

---

# 64. Tercer riesgo

Intentar construir desde el inicio:

> una ciudad completa.

La estrategia debe ser construir primero un **microcosmos coherente**.

Por ejemplo:

```text
200 personas
50 hogares
20 organizaciones
1000 objetos
10 lugares principales
```

y demostrar que puede vivir autónomamente.

Después escalar.

---

# 65. Principio de desarrollo

El proyecto debe avanzar en capas.

```text
MUNDO
  ↓
TIEMPO
  ↓
LUGARES
  ↓
OBJETOS
  ↓
PERSONAS
  ↓
RUTINAS
  ↓
RELACIONES
  ↓
EVENTOS
  ↓
MEMORIA
  ↓
DECISIONES
  ↓
APRENDIZAJE
  ↓
EMERGENCIA
  ↓
OBSERVACIÓN
  ↓
TERAPIA
```

No saltar directamente a la última capa.

---

# 66. Próximo paso: convertir este documento en SSD

Este documento **no debe convertirse todavía directamente en código**.

Antes debe dividirse en especificaciones independientes.

Por ejemplo:

```text
/specs
    001-world.md
    002-time.md
    003-geography.md
    004-places.md
    005-objects.md
    006-organizations.md
    007-population.md
    008-households.md
    009-personality.md
    010-needs.md
    011-routines.md
    012-relationships.md
    013-memory.md
    014-events.md
    015-economy.md
    016-mobility.md
    017-decision-engine.md
    018-learning.md
    019-causality.md
    020-history.md
    021-simulation.md
    022-observability.md
    023-reproducibility.md
    024-visualization.md
```

Posteriormente:

```text
spec
 ↓
architecture
 ↓
implementation
 ↓
tests
 ↓
simulation
 ↓
observation
 ↓
revision
```

---

# 67. Principio final

El proyecto debe intentar responder una pregunta muy concreta:

> **¿Podemos crear un mundo artificial donde las personas no estén actuando para el usuario, sino viviendo para sí mismas?**

Si la respuesta llega a ser sí, entonces posteriormente podremos introducir al terapeuta en ese mundo.

Y en ese momento el terapeuta no estará hablando con:

> "una IA que interpreta a un paciente".

Estará interactuando con:

> **una persona artificial que llevaba viviendo su propia vida antes de que el terapeuta apareciera.**

Ese es el objetivo arquitectónico que debe guiar todo el desarrollo.