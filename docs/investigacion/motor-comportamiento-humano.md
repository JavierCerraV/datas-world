# Motor de comportamiento humano
## Resumen de la sesión y objetivo conceptual

### 1. Propósito del proyecto

El proyecto busca construir un mundo social simulado en el que las personas no sean personajes predefinidos ni simples agentes conversacionales, sino **individuos que desarrollen su comportamiento a partir de una historia de vida**.

El objetivo no es programar directamente comportamientos como:

- ansiedad;
- evitación;
- impulsividad;
- rumiación;
- búsqueda de aprobación;
- aislamiento;
- agresividad;
- perseverancia;
- cooperación.

En cambio, se pretende construir los **procesos que pueden producir esos patrones como resultado emergente**.

La idea central es:

> **No construir pacientes. Construir personas.**

Una persona puede posteriormente convertirse en paciente porque su historia de aprendizaje, contexto actual, relaciones, repertorios y patrones de comportamiento hacen que aparezcan determinadas dificultades. El sistema no debería comenzar sabiendo que esa persona "tiene ansiedad" o que "es evitativa".

---

# 2. Objetivo del motor de comportamiento

El objetivo es desarrollar un **motor de comportamiento humano detallado**, fundamentado principalmente en el análisis funcional de la conducta y la Teoría del Marco Relacional (TMR/RFT), capaz de simular cómo una persona:

1. nace con determinadas características y predisposiciones;
2. interactúa con su ambiente;
3. adquiere funciones mediante contingencias;
4. desarrolla repertorios conductuales;
5. aprende relaciones entre estímulos;
6. deriva nuevas relaciones;
7. transforma las funciones de estímulos mediante esas relaciones;
8. desarrolla valores y reglas;
9. generaliza o discrimina aprendizajes;
10. responde ante diferentes contextos;
11. obtiene consecuencias inmediatas y demoradas;
12. modifica progresivamente su historia de aprendizaje;
13. desarrolla patrones relativamente estables;
14. cambia nuevamente cuando cambian sus contingencias y contextos.

El motor debe permitir que el comportamiento sea una **propiedad emergente de la historia y del contexto**, y no una selección arbitraria de conductas almacenadas en la personalidad.

---

# 3. Punto de partida teórico

El documento estudiado, *La naturaleza verbal del gozo y sufrimiento humano*, presenta una conceptualización desde la TMR sobre cómo el lenguaje y las relaciones derivadas amplían enormemente las funciones que pueden adquirir los estímulos.

El texto plantea que los seres humanos parten de reforzadores primarios y que, mediante condicionamiento clásico y operante, determinados estímulos adquieren funciones secundarias y posteriormente funciones más generalizadas.

La capacidad de enmarcar relacionalmente amplía todavía más este proceso. El texto describe relaciones de coordinación, distinción, oposición, comparación, jerarquía, deícticas y causales, entre otras. La transformación de funciones constituye una propiedad fundamental de estos enmarcamientos.

Esto resulta especialmente relevante para el simulador porque significa que una persona no necesita experimentar directamente una contingencia para que un estímulo adquiera determinadas funciones.

Una función puede transformarse mediante las relaciones que la persona establece entre eventos.

---

# 4. De la experiencia directa a la conducta verbal

Un punto fundamental para el motor es que la historia de aprendizaje no debe limitarse a:

```text
estímulo → respuesta → consecuencia
```

En humanos debe poder representar procesos más complejos:

```text
experiencia
    ↓
función adquirida
    ↓
relaciones con otros estímulos
    ↓
relaciones derivadas
    ↓
transformación de funciones
    ↓
nuevas funciones
    ↓
nuevas posibilidades de comportamiento
```

Por ejemplo, una característica inicialmente neutra puede adquirir una función determinada porque se relaciona verbalmente con otra que ya posee una función.

Por tanto, el sistema debe diferenciar entre:

- función adquirida directamente;
- función derivada;
- función transformada mediante relaciones;
- función generalizada;
- función discriminada por contexto.

---

# 5. Valores y redes relacionales

El documento muestra también cómo las relaciones jerárquicas pueden permitir la construcción de reforzadores cada vez más abstractos, incluyendo valores.

Un valor puede contener múltiples objetivos y acciones concretas. Por ejemplo, una red jerárquica relacionada con una vida significativa puede incluir relaciones de amistad, confianza, literatura, aprendizaje y determinadas acciones concretas.

Esto plantea una arquitectura importante para el simulador:

```text
valor abstracto
      ↓
metas
      ↓
objetivos
      ↓
acciones
      ↓
consecuencias
```

Pero el valor no debería convertirse en una simple variable:

```text
valor_amistad = 0.8
```

Debe existir como parte de una **red funcional y relacional** que pueda influir sobre distintas conductas dependiendo del contexto.

---

# 6. El sufrimiento como patrón funcional

El texto plantea que el sufrimiento humano puede adquirir una naturaleza predominantemente verbal porque las redes relacionales pueden generar funciones aversivas sobre eventos que no son directamente aversivos.

Esto es especialmente importante para el motor.

Una persona no debería reaccionar únicamente ante:

```text
evento físico actual
```

sino también ante:

```text
evento actual
+
historia de aprendizaje
+
relaciones derivadas
+
funciones transformadas
+
contexto
```

Por eso dos personas pueden encontrarse ante el mismo acontecimiento y emitir conductas completamente diferentes.

---

# 7. Evitación experiencial y control por funciones aversivas

El documento plantea que, ante pensamientos y emociones con funciones aversivas, una persona puede responder intentando reducir esas funciones, dando lugar a formas de evitación experiencial.

Para nuestro modelo esto no debería implementarse como:

```text
experiential_avoidance = 0.8
```

Ese tipo de variable global sería demasiado pobre.

La alternativa es representar un **repertorio aprendido de respuestas ante determinadas funciones aversivas**.

Por ejemplo:

```text
contexto:
    evaluación social

función:
    rechazo / vergüenza

historia:
    experiencias previas de ridiculización

repertorio:
    evitar exposición

consecuencia inmediata:
    reducción del malestar

consecuencia demorada:
    pérdida de oportunidades

aprendizaje:
    aumenta la probabilidad de volver a evitar
```

La evitación sería entonces una propiedad dinámica de la relación entre:

**contexto + función + historia + repertorio + consecuencias.**

---

# 8. Pensamiento negativo repetitivo como proceso dinámico

El documento presenta un ciclo en el que pensamientos y funciones aversivas pueden generar pensamiento negativo repetitivo, que a su vez puede aumentar la complejidad de las redes relacionales, favorecer nuevos pensamientos y reducir progresivamente la flexibilidad relacional.

Esto es importante porque muestra que el motor no debe representar solamente estados.

Debe representar **procesos temporales**.

No basta con:

```text
rumiación = alta
```

Debe poder ocurrir:

```text
evento
 ↓
función aversiva
 ↓
derivación relacional
 ↓
pensamiento
 ↓
nuevo pensamiento
 ↓
nueva derivación
 ↓
aumento de activación
 ↓
nueva conducta
 ↓
consecuencia
 ↓
modificación de la probabilidad futura
```

El patrón debe poder **formarse, mantenerse, intensificarse, debilitarse o transformarse**.

---

# 9. Flexibilidad y múltiples fuentes de control

El documento contrasta este patrón con una respuesta más flexible en la que los eventos privados pueden ser enmarcados jerárquicamente mediante el deíctico "Yo", permitiendo que otras fuentes de control estimular entren en escena y que el comportamiento pueda orientarse hacia reforzadores positivos jerárquicos.

Esto introduce otra cuestión fundamental para el motor:

> **La conducta humana no depende necesariamente de una única fuente de control.**

En una situación pueden competir:

- funciones aversivas;
- consecuencias inmediatas;
- consecuencias demoradas;
- reglas;
- valores;
- hábitos;
- relaciones sociales;
- necesidades;
- estados internos;
- expectativas;
- historia previa;
- contexto actual.

El motor debe ser capaz de representar esta **competencia entre fuentes de control**.

---

# 10. La arquitectura conceptual que queremos investigar

A partir de esta sesión, la arquitectura conceptual comienza a tomar esta forma:

```text
                 HISTORIA DE VIDA
                       │
        ┌──────────────┼──────────────┐
        ↓              ↓              ↓
   contingencias    relaciones     contexto
        │           aprendidas        │
        ↓              ↓              │
   funciones       redes RFT           │
        │              │               │
        └──────────────┼───────────────┘
                       ↓
              FUNCIONES ACTUALES
                       ↓
              DISCRIMINACIÓN DEL
                   CONTEXTO
                       ↓
              REPERTORIOS DISPONIBLES
                       ↓
            COMPETENCIA / SELECCIÓN
                       ↓
                   CONDUCTA
                       ↓
                CONSECUENCIAS
                 ↙           ↘
          inmediatas       demoradas
                 \           /
                  ↓         ↓
                 NUEVO APRENDIZAJE
                       ↓
                HISTORIA MODIFICADA
```

Esta arquitectura todavía **no es la especificación final**.

Es el modelo conceptual que debemos investigar y refinar antes de convertirlo en código.

---

# 11. Lo que todavía necesitamos investigar

El paper proporciona una base importante, pero no resuelve todos los mecanismos necesarios para construir el motor.

Las siguientes preguntas deben guiar la búsqueda documental.

## 11.1 Adquisición de funciones

- ¿Cómo se representa la adquisición de una función?
- ¿Qué determina su fuerza?
- ¿Cómo se mantiene?
- ¿Cómo se debilita?
- ¿Cómo interactúan funciones adquiridas directamente y funciones derivadas?

## 11.2 Transformación de funciones

- ¿Cómo se produce exactamente la transformación de funciones?
- ¿Qué papel tienen las claves contextuales?
- ¿Cuándo una relación produce transformación funcional y cuándo no?
- ¿Cómo se pueden representar diferentes grados de transformación?

## 11.3 Generalización y discriminación

- ¿Cómo se generaliza una función entre situaciones?
- ¿Cómo aprende una persona que dos contextos son funcionalmente diferentes?
- ¿Cómo aparecen gradientes de generalización?
- ¿Cómo una historia particular produce generalización excesiva o demasiado restringida?

## 11.4 Historia de aprendizaje y repertorios

- ¿Cómo una historia de contingencias produce repertorios relativamente estables?
- ¿Cómo se acumulan repertorios?
- ¿Cómo compiten repertorios diferentes?
- ¿Cómo aparece la variabilidad conductual?

## 11.5 Conducta gobernada por reglas

- ¿Cómo se adquieren reglas?
- ¿Cómo compiten reglas y contingencias?
- ¿Cuándo una persona sigue una regla aunque las consecuencias actuales indiquen otra cosa?
- ¿Cómo cambian las reglas?

## 11.6 Reforzamiento negativo

- ¿Cómo se aprende una respuesta porque produce alivio?
- ¿Cómo interactúan consecuencias inmediatas y demoradas?
- ¿Cómo se desarrollan patrones rígidos de evitación?
- ¿Cómo se generaliza el repertorio de evitación?

## 11.7 Redes relacionales

- ¿Cómo crecen las redes relacionales individuales?
- ¿Cómo se organizan?
- ¿Cómo se modifican?
- ¿Cómo aparecen relaciones de oposición, comparación, jerarquía y deícticas?
- ¿Cómo interactúan diferentes redes?

## 11.8 Flexibilidad

- ¿Qué mecanismos permiten que una persona cambie de fuente de control?
- ¿Cómo aparece rigidez?
- ¿Cómo aparece flexibilidad?
- ¿Qué papel tienen la discriminación, el contexto y los repertorios disponibles?

---

# 12. Principio fundamental de diseño

El motor no debe contener explicaciones circulares.

No queremos:

```text
persona evita porque es evitativa
```

ni:

```text
persona rumia porque tiene mucha rumiación
```

ni:

```text
persona busca aprobación porque su personalidad tiene
alta necesidad de aprobación
```

Queremos poder reconstruir:

```text
¿qué ocurrió?
       ↓
¿qué función adquirió?
       ↓
¿qué relaciones aprendió?
       ↓
¿qué estímulos tienen actualmente esa función?
       ↓
¿qué repertorios tiene disponibles?
       ↓
¿qué contexto está presente?
       ↓
¿qué consecuencias anticipa?
       ↓
¿qué conducta emite?
       ↓
¿qué consecuencia recibe?
       ↓
¿cómo cambia su historia?
```

El comportamiento debe ser **explicable retrospectivamente mediante la historia funcional del individuo**.

---

# 13. Relación con personalidad

La personalidad no desaparece del modelo.

Big Five, HEXACO y otras diferencias individuales pueden mantenerse como **predisposiciones o diferencias relativamente estables**.

Pero no deben convertirse directamente en conductas.

La arquitectura conceptual buscada es:

```text
PERSONALIDAD
      ↓
predisposiciones
      ↓
interacción con ambiente
      ↓
HISTORIA DE APRENDIZAJE
      ↓
REPERTORIOS
      ↓
CONTEXTOS Y FUNCIONES
      ↓
CONDUCTA
```

Por tanto, dos personas con características de personalidad similares pueden desarrollar patrones completamente diferentes debido a sus historias de aprendizaje.

Y dos personas con personalidades diferentes pueden desarrollar conductas similares porque enfrentaron contingencias parecidas.

---

# 14. Qué queremos conseguir finalmente

El resultado no debe ser un "generador de síntomas".

Debe ser un **modelo generativo de comportamiento humano**.

Queremos poder crear una población de individuos y observar cómo, durante meses o años simulados:

- desarrollan relaciones;
- adquieren hábitos;
- aprenden funciones;
- construyen redes relacionales;
- desarrollan valores;
- crean reglas;
- enfrentan pérdidas;
- obtienen éxitos;
- fracasan;
- cambian de trabajo;
- forman familias;
- pierden relaciones;
- adquieren nuevos repertorios;
- abandonan otros;
- generalizan aprendizajes;
- discriminan contextos;
- desarrollan patrones rígidos o flexibles;
- y modifican continuamente su comportamiento.

Posteriormente, algunos individuos podrán presentar patrones relevantes para intervención psicológica.

Pero esos patrones serán **consecuencia de sus vidas**, no parámetros introducidos artificialmente para fabricar un "paciente".

---

# 15. Objetivo científico del sistema

El propósito final es convertir el mundo simulado en un:

> **laboratorio computacional para estudiar la conducta humana desde la ciencia conductual contextual.**

El sistema debería permitir:

1. observar historias individuales completas;
2. reconstruir funcionalmente cómo apareció un patrón;
3. manipular variables específicas;
4. comparar poblaciones;
5. reproducir experimentos mediante semillas controladas;
6. observar consecuencias a corto y largo plazo;
7. estudiar la aparición de patrones emergentes;
8. introducir posteriormente intervenciones;
9. observar cambios longitudinales;
10. comparar trayectorias alternativas de una misma persona o población.

La meta no es solamente crear agentes que **parezcan humanos**.

La meta es crear agentes cuyo comportamiento pueda ser **explicado mediante un modelo teórico explícito de cómo se desarrolla y modifica la conducta humana**.

---

# 16. Próxima fase de documentación

Antes de continuar desarrollando el motor, la investigación debe profundizar progresivamente en:

1. **Transformación de funciones**
2. **Control contextual de la conducta relacional**
3. **Generalización y discriminación**
4. **Conducta gobernada por reglas**
5. **Conducta moldeada por contingencias**
6. **Reforzamiento negativo**
7. **Evitación experiencial**
8. **Redes relacionales**
9. **Relaciones deícticas y self**
10. **Valores y augmentals**
11. **Flexibilidad psicológica**
12. **Variabilidad y persistencia conductual**

Cada documento encontrado debe evaluarse no solamente por lo que afirma teóricamente, sino por una pregunta concreta:

> **¿Qué mecanismo del motor de comportamiento nos permite especificar mejor?**

El objetivo de esta fase no es acumular papers, sino convertir progresivamente la teoría en una **especificación computacional suficientemente precisa como para ser implementada y posteriormente sometida a pruebas de simulación**.