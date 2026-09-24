# ADR-005 — Crecimiento por capacidades, núcleo por componentes y memoria jerárquica

- **Estado:** propuesta (pendiente de revisión del usuario)
- **Fecha:** 2026-09-23

## Contexto

El mundo debe crecer en tres ejes sin rediseños: número de personas (de 100 a 10 000 en local, dentro de 1 GB), complejidad de comportamiento (de rutinas a cultura emergente) y riqueza de la vida interior de cada ciudadano (años o décadas de memoria). Todo se desarrolla y valida primero en local (ADR-004), y el motor debe seguir siendo determinista (ADR-002).

Con el diseño de las specs 0.1 había tres riesgos:

- Un bucle que crece con cada sistema nuevo y cuyo azar cambia al añadir sistemas.
- Una memoria por persona que crece sin límite o que, con el tope de 200 memorias, pierde el efecto de lo olvidado.
- Un roadmap por hitos técnicos sin una forma de cargar mundos antiguos con motores nuevos.

## Decisión

Se adoptan tres ideas complementarias:

1. **Núcleo por componentes con sistemas enchufables (idea A).**
   - Los valores numéricos por persona viven en columnas tipadas indexadas por el índice denso del ciudadano (spec 001 §3.1).
   - Los sistemas se registran en un registro ordenado por fases (spec 021).
   - Cada sistema recibe su propio flujo RNG y declara el nivel mínimo de simulación que necesita, con una variante gruesa opcional para niveles bajos.
2. **Memoria jerárquica con consolidación (idea B).**
   - La memoria tiene tres capas: episodios, esquemas y capítulos autobiográficos (spec 013).
   - Una consolidación nocturna convierte episodios repetidos en esquemas y abre y cierra capítulos.
   - La RAM por persona es constante. Lo que sale de la RAM se archiva en SQLite (spec 027) y nunca se borra.
   - El informe de vida compara los capítulos objetivos con los autobiográficos (spec 020).
3. **Escalera de complejidad por capacidades (idea C).**
   - Cada mundo declara sus capacidades activas (spec 001 R-007). Solo se añaden mediante entradas externas reproducibles (spec 023 R-006) y se pueden alternar en ramas de experimento (spec 028).
   - El roadmap se organiza en cinco peldaños con puertas de validación locales (`docs/roadmap.md`).
   - Cada peldaño debe cargar los mundos guardados del anterior (spec 027 R-011).

## Alternativas descartadas

- **Objetos por persona con todos los campos.** Es más simple al principio, pero pasar de 10 000 a más personas exigiría reescribir el estado. El hash y las instantáneas también serían más lentos.
- **Memoria plana con un tope más alto.** No escala a décadas y pierde el efecto de lo olvidado.
- **Banderas de configuración (feature flags) sin registro en el mundo.** Romperían el replay de mundos que activaron funciones a mitad de su vida.

## Consecuencias

- Se añade una abstracción (`System`, `WorldView`, componentes) desde M0. Para acotarla, M0 solo implementa el registro, la columna `active` y la capacidad `clock`.
- Cada spec nueva que añada valores por persona declara sus columnas y su capacidad.
- Hay que mantener migraciones entre peldaños consecutivos, con un mundo de ejemplo versionado por peldaño.
- Faltan specs para `lifecourse`, `reputation` y `culture` (peldaños 4 y 5).

## Specs afectadas

001 (0.2), 013 (0.2), 020 (0.2), 021 (0.2), 023 (0.2), 027 (0.2), 028 (0.2).
