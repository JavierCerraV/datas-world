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
