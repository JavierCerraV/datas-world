# M3 · Memoria autobiográfica (spec 013, bloque M) — validación

Fecha: 2026-09-29. Mundo de la semilla del proyecto (482917), 100 personas. Pruebas: `packages/generators/src/memory-world.test.ts` (día 0) y `relationships-world.test.ts` (1 año).

## Día 0 (memoria de partida)

| Métrica | Valor | Referencia |
|---|---|---|
| Recuerdos por persona | 15,6 (máx. 25) | tope 60 |
| Capítulos por persona | 5,4 | tope 12 |
| Recuerdos negativos | 23 % | ni todo bueno ni todo malo |
| Tamaño | 4,3 KB por persona | CA-007: < 8 KB |
| Adultos con recuerdos de antes de los 12 años | > 70 % | CA-007 |
| Recuerdos antes de los 4 años | 0 | amnesia infantil |

Tipos más frecuentes: leer en casa en la infancia, un confidente en la adolescencia, amistades, primera pareja, muertes en la familia, gritos en la crianza, logros en el trabajo, estudios, negligencia, castigo físico.

## Un año de vida

| Métrica | Valor |
|---|---|
| Recuerdos por persona | 24,3 (8,8 vividos en el año) |
| Tamaño | 6,5 KB por persona (< 8 KB, CA-007) |
| Recuerdos negativos | 38 % |
| Olvidados en el año | 0,9 por persona |
| Relaciones aprendidas por experiencia (`SCHEMA_FORMED`) | 52 (y 22 revisadas) |
| Capítulos nuevos | 4 (empleos y despidos salientes) |
| Distorsión media de lo vivido en el año | 0,007 |
| Tiempo del año | 147 s (sin memoria: 144 s) |

Lo que más se recuerda de lo vivido en el año: amistades, enfermedades, cuotas sin pagar, roces, préstamos y discusiones.

## Qué reveló la implementación

1. **Olvido en ley de potencia.** Con la vida media fija de 30 días de la spec aprobada, ningún recuerdo de la infancia llegaba a la adultez. Con `(1 + días/7)^(−β')`, un recuerdo intenso de hace 30 años conserva la mitad de su intensidad y un roce trivial se va en semanas.
2. **Lo repetido se funde.** El catálogo de desarrollo produce muchas veces los mismos episodios adultos («logro en el trabajo»): sin fundirlos, el 95 % de los recuerdos de partida eran positivos y repetidos.
3. **La memoria cambia con quién se encuentra.** Con la 013 CA-005, la elección de con quién encontrarse usa el valor de la otra persona, incluido el derivado de lo que la experiencia generalizó en la red. En el año, las discusiones bajan de 79 a 44 (la gente evita a quien le desagrada) y las amistades quedan igual (286).

## Pendiente

- La distorsión es pequeña en un año: se nota en quien rumia (039) o cambia de afecto por alguien, no en la mayoría. Calibración en PA-146 a PA-148.
- Fuentes sobre memoria autobiográfica (curva de reminiscencia, ley de Jost, sesgo del ánimo) para PA-146 y PA-147.
