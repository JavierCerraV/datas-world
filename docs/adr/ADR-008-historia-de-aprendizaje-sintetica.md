# ADR-008 — Historia de aprendizaje sintética por episodios

- **Estado:** propuesta (pendiente de revisión del usuario)
- **Fecha:** 2026-09-25
- **Relacionada:** ADR-007, spec 041 (desarrollo), spec 030 (historia generada).

## Contexto

Las personas empiezan el mundo el 1 de enero de 2026, casi todas adultas.
- Si sus funciones, relaciones, reglas y repertorios iniciales se **muestrean** al azar, volvemos a fabricarlas: su conducta no tendría historia que la explique (documento rector §12).
- Si se simula la vida entera con el bucle de 5 minutos (spec 021), el coste es inviable: 200 personas × 30 años × 105 120 ticks por año.

Ya existe una historia generada desde 1900 (030): familias, nacimientos, uniones, estudios, empleos, migraciones, muertes y eventos de infancia. Son justamente las contingencias grandes de una vida, pero sin aprendizaje.

## Opciones

| Opción | Qué es | Coste estimado | Problema |
|---|---|---|---|
| A. Infancia sintética completa | Simular 0–18 años con el bucle de ticks en nivel 1 | 200 × 18 × 105 120 ≈ 380 M pasos: horas por mundo | Inviable en 1 GB y en tiempos de `world:new` |
| B. Infancia sintética mínima | Solo unos cuantos episodios de aprendizaje por persona (p. ej. 20) | Despreciable | Repertorios pobres; poco más que muestrear |
| **C. Intermedia: historia por episodios** | Se recorre la vida de cada persona (0–18 años con densidad alta y la vida adulta hasta 2026 con densidad baja) como una **secuencia de episodios de aprendizaje**. Cada episodio es una contingencia (antecedente, conducta, consecuencia) o una transmisión verbal (una relación dicha por la comunidad verbal), aplicada con los **mismos mecanismos** de las capas 2–5 | ≈ 50 episodios por año de 0 a 18 y ≈ 12 por año después: ≈ 1 300 episodios por persona de 40 años. Estimación: < 1 ms por episodio → < 0,3 s por persona, < 60 s para 200 personas (a medir) | Hay que diseñar el catálogo de episodios por etapa |

## Decisión

**Opción C, en dos entregas:**
1. **C-mínima (bloque MF7a):**
   - catálogo de episodios por etapa (crianza, colegio, pares, trabajo), derivado de la historia generada (030) y de la situación de cada persona: hogar, estrato, estudios, empleo, eventos de infancia;
   - la familia y el colegio como **comunidad verbal** que transmite relaciones (coordinación y oposición básicas, reglas de pliance);
   - produce funciones, relaciones, reglas y repertorios iniciales.
2. **C-completa (bloque MF7b o peldaño siguiente):**
   - más densidad y variedad de episodios;
   - episodios adultos a partir de los eventos de 030 (despidos, duelos, uniones);
   - compañeros y amigos de la historia como parte de la comunidad verbal.

**Reglas comunes:**
- **Mismos mecanismos que el mundo vivo:** el desarrollo no tiene reglas propias de aprendizaje. Así una función adquirida a los 8 años se explica igual que una adquirida en 2026.
- **Nivel 0–1 (spec 021):** sin movilidad, necesidades ni ticks; solo el orden temporal de los episodios.
- **Azar:** flujo `gen:development/<citizenId>`, un flujo por persona. Añadir personas no cambia a las demás.
- **Los episodios relevantes pasan al `backstory`** con causas reales (qué episodio produjo qué función o regla). Los demás se resumen en contadores para no inflar el registro de eventos (030 CA-007: la historia debe seguir añadiendo < 2 MB a la base).

## Consecuencias

- La generación del mundo añade una fase de desarrollo después de la historia (030) y antes de la vida diaria. El tiempo de `world:new` sube; el presupuesto es < 60 s para 200 personas (hoy < 5 s) y se mide.
- La ficha de esparcimiento (032) y los hábitos de salud (031), que hoy se eligen con rasgos, pasan a salir de las funciones y repertorios que produce el desarrollo. Mientras tanto usan el adaptador `@deprecated`.
- Los criterios de divergencia y convergencia (042 V-12) se pueden probar desde la generación: dos personas con igual temperamento y distinta historia sintética.
- **Riesgo:** un catálogo de episodios pobre produce poblaciones homogéneas. Se mitiga midiendo la diversidad de repertorios iniciales (041 CA-003) y con la revisión de expertos (PA-120).
