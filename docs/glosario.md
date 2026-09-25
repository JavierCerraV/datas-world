# Glosario

| Término | Definición |
|---|---|
| **Mundo** | Instancia completa de simulación con su semilla, reloj, geografía, población y registro de eventos. |
| **Ciudadano / persona** | Agente simulado (`CIT-xxxxxx`). Nunca "paciente" en el núcleo. |
| **WorldMinute** | Entero de minutos transcurridos desde `world.epoch`. Unidad de tiempo del motor. |
| **Tick** | Paso de simulación (por defecto 5 minutos de mundo). |
| **Velocidad** | Relación tiempo de mundo / tiempo real (1x … 1000x). No altera los resultados, solo el ritmo. |
| **Semilla** | Número que inicializa el RNG; determina todo el azar del mundo. |
| **Flujo RNG** | Subgenerador con nombre (`"needs"`, `"social"`, `"CIT-000042"`) derivado de la semilla; evita que añadir un sistema cambie el azar de otro. |
| **WORLD_TRUTH** | Lo que realmente es/ocurrió en el mundo. |
| **PERSON_KNOWLEDGE / creencia** | Lo que una persona cree que es verdad, con fuente y confianza; puede ser falso. |
| **Evento** | Hecho inmutable con tipo, momento, participantes, payload y `causes[]`. |
| **Causa** | Referencia a un evento o estado previo que contribuye a explicar un evento. |
| **Historia** | Resumen narrativo y estructurado de la vida de una persona, derivado de eventos. |
| **Memoria** | Lo que la persona recuerda: subjetivo, con intensidad, valencia, decaimiento y distorsión. |
| **Relación asimétrica** | Vínculo A→B distinto de B→A (confianza, afecto, dependencia…). |
| **Nivel de simulación** | Resolución con que se simula a una persona (0 estadístico … 4 detallado con LLM). |
| **Acción** | Petición de cambio (`ActionRequest`) que el motor valida antes de aplicar. |
| **Parche** | Cambio atómico aplicado al estado como resultado de una acción. |
| **Instantánea** | Copia completa del estado en un momento; base de rewind/replay. |
| **Rewind / replay** | Volver a una instantánea y re-simular (con o sin cambios) de forma determinista. |
| **Experimento** | Comparación de dos o más ramas del mismo mundo que difieren en una intervención. |
| **Informe de vida** | Texto explicable de la trayectoria de una persona con sus causas. |
| **Spec** | Documento de especificación numerado con reglas y criterios de aceptación. |
| **CA-xxx / R-xxx** | Criterio de aceptación / regla dentro de una spec. |
| **Capacidad** | Bloque de comportamiento que un mundo tiene activo (`needs`, `memory`, `culture`…). Se activa por entrada externa reproducible y no se desactiva en un mundo vivo (spec 001, ADR-005). |
| **Peldaño** | Etapa de la escalera de complejidad: conjunto de capacidades, tamaño de población y puerta de validación (`docs/roadmap.md`). |
| **Componente** | Columna tipada de un valor numérico por persona, indexada por el índice denso del ciudadano (spec 001 §3.1). |
| **Sistema** | Pieza del motor registrada en una fase del tick; lee el estado y devuelve parches y eventos (spec 021). |
| **Esquema** | Generalización que una persona extrae de varios episodios ("con Laura suelo discutir por dinero"). Es una expectativa, no un hecho (spec 013). |
| **Capítulo autobiográfico** | Periodo en que la persona divide su propia vida, con tema y tono subjetivos. Se compara con el capítulo objetivo de la historia (specs 013 y 020). |
| **Consolidación** | Proceso nocturno que convierte episodios en esquemas y capítulos y libera RAM sin perder su efecto (spec 013). |
| **Temperamento** | Diferencias individuales relativamente estables que parametrizan cómo aprende una persona (sensibilidades, habituación, valores iniciales del descuento y la variabilidad). No produce conducta (spec 009 v1.0, ADR-007). |
| **Función (de un estímulo)** | Lo que un estímulo hace en la conducta de una persona: elicitar una respuesta, señalar qué respuesta será reforzada (discriminativa) o reforzar o castigar lo que lo produce. Es apetitiva o aversiva y tiene fuerza, contexto y origen (spec 036). |
| **Función derivada** | Función que un estímulo adquiere sin experiencia directa, a través de relaciones con otros estímulos (spec 037). Se distingue de la directa, la transformada, la generalizada y la discriminada. |
| **Marco relacional** | Patrón aprendido de responder a un estímulo en términos de otro según una clave arbitraria: coordinación, distinción, oposición, comparación, jerarquía, deíctico, causal o temporal (TMR; spec 037). |
| **Crel** | Clave contextual relacional: indica qué marco se aplica entre dos estímulos en un contexto (spec 037). |
| **Cfunc** | Clave contextual funcional: indica qué función se transforma a través de una relación (spec 037). |
| **Transformación de funciones** | Cambio en la función de un estímulo por sus relaciones derivadas con otros: la coordinación transfiere, la oposición invierte, la comparación escala y la jerarquía hereda (spec 037). |
| **Vinculación mutua** | Derivar la relación inversa: si A es mayor que B, B es menor que A (spec 037). |
| **Vinculación combinatoria** | Derivar la relación entre A y C a partir de A–B y B–C (spec 037). |
| **Pliance** | Seguir una regla porque históricamente lo reforzó el hablante (aprobación, evitar la crítica), no el mundo (spec 038). |
| **Tracking** | Seguir una regla porque históricamente lo que especifica ha coincidido con lo que pasa en el mundo (spec 038). |
| **Augmenting** | Seguir una regla que altera la eficacia de una consecuencia, creando una nueva (formativo) o cambiándola temporalmente (motivador) (spec 038). |
| **Augmental** | Regla o estímulo verbal que altera la eficacia reforzante de una consecuencia; los apetitivos acercan a los valores (specs 038 y 039). |
| **Operación motivadora** | Condición que altera la eficacia de un reforzador y la probabilidad de las conductas que lo producen (hambre, fatiga, soledad). En el motor, las necesidades de la 010 funcionan así (specs 036 y 040). |
| **Reforzador generalizado** | Estímulo que se volvió reforzante al emparejarse con varios reforzadores y conserva su eficacia sin una operación motivadora concreta: la aprobación, la crítica, el dinero. Se adquiere, no es innato (spec 036). |
| **PNR** | Pensamiento negativo repetitivo (preocupación y rumia) como **proceso**: una función aversiva dispara derivaciones que producen pensamientos aversivos nuevos, prolongan el afecto negativo y llevan a evitar. Tiene inicio, pasos y fin; no es un rasgo (spec 039). |
| **Evitación experiencial** | Responder para reducir pensamientos y emociones con función aversiva. Se mantiene por el alivio inmediato (reforzamiento negativo) y tiene costes demorados. Es una relación dinámica entre contexto, función, historia, repertorio y consecuencias (spec 039). |
| **Flexibilidad** | Repertorio aprendido de enmarcar los eventos privados en jerarquía con el deíctico "Yo" (discriminarlos como eventos que uno experimenta), lo que deja entrar otras fuentes de control, como los valores. Puede aumentar o disminuir (spec 039). |
| **Deíctico** | Marco relacional desde la perspectiva de quien habla: yo/tú, aquí/allí, ahora/entonces (spec 037). |
| **Valor (motor funcional)** | Red jerárquica de reforzadores positivos (valor → metas → objetivos → acciones) con su red opuesta derivada. No es un número por persona (spec 038). |
| **Dominio vital** | Raíz posible de una red de valor (familia, salud, conocimiento…): los 12 valores del prototipo en el catálogo `life_domains` (specs 009 v1.0 y 038). |
| **Fuente de control** | Lo que contribuye a que se emita una conducta: consecuencias inmediatas y demoradas, reglas, valores, hábitos, funciones aversivas presentes, operaciones motivadoras, contexto social. Cada conducta guarda su vector de aportes (spec 040). |
| **Estatus epistémico** | Etiqueta de cada regla de una spec: [E] empírico, [T] teórico o [M] supuesto de modelado (plantilla de specs §4 bis). |
