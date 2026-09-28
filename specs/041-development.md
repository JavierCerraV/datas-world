---
id: 041
nombre: development
estado: implementada
hito: MF (bloque MF7)
depende_de: [030, 035, 036, 037, 038, 039]
version: 0.2
---

# 041 — Desarrollo: historia de aprendizaje sintética (0 años → presente)

## 1. Propósito
Que las personas empiecen el mundo con funciones, relaciones, reglas, valores y repertorios que **salen de su historia**, no de un muestreo (ADR-008).
- Recorre la vida de cada persona como una secuencia de episodios de aprendizaje, a partir de la historia generada (030) y de su situación: hogar, estrato, estudios, empleo, eventos de infancia.
- Aplica los mismos mecanismos de las capas 2–5.

## 2. Alcance
**Incluye:**
- catálogo de episodios por etapa (crianza, colegio, pares, adolescencia, trabajo, pareja);
- comunidad verbal (familia, colegio, pares);
- densidad de episodios;
- reforzadores primarios iniciales;
- la construcción de los primeros reforzadores generalizados, reglas y redes de valor;
- el paso de lo relevante al `backstory`.

**Fuera de alcance:** la vida desde el 1 de enero de 2026 (mundo vivo).

## 3. Modelo de datos (preliminar)
```ts
interface EpisodeKind {              // catálogo `development_episodes` (ADR-006)
  key: string;                       // 'crianza.consuelo', 'colegio.elogio_tarea', 'pares.burla', 'familia.regla_obediencia'…
  stage: 'infancia' | 'escolar' | 'adolescencia' | 'adulto';
  when: Condition;                   // según hogar, estrato, estudios, eventos de 030 (p. ej. CHILDHOOD_EVENT)
  contingency?: { antecedent: StimulusId; response: ResponseClass; consequence: StimulusId; magnitude: number };
  verbal?: { speakerRole: 'madre' | 'padre' | 'docente' | 'par'; relation?: Relation; rule?: Partial<Rule> };
  ratePerYear: number;
}
```

## 4. Reglas
- **R-001** [M] — **Densidad:** ≈ 50 episodios por año de 0 a 18 y ≈ 12 por año después, hasta 2026, en orden temporal. Flujo `gen:development/<citizenId>`.
- **R-002** [T] — **Reforzadores primarios iniciales:** comida, contacto físico, calor (apetitivos); dolor, ruido fuerte, frío (aversivos), de la ontología (036 R-007; McHugh).
- **R-003** [T] — **Comunidad verbal:** la familia y el colegio enseñan relaciones (coordinación, oposición, comparación, jerarquía y deícticas), reglas de pliance y, con la edad, reglas de tracking. La calidad y el contenido dependen de episodios condicionados por el hogar y los eventos de 030.
- **R-004** [T] — **Reforzadores generalizados:** la aprobación y la crítica de los cuidadores se emparejan con varios primarios, y el dinero se empareja con compras; se vuelven generalizados (036 R-008).
- **R-005** [T] — **Valores:** redes jerárquicas que se construyen solo si hay episodios que ponen un dominio vital en jerarquía con reforzadores (038 R-006, R-009). Una persona puede llegar a 2026 sin ninguna red de valor fuerte.
- **R-006** [M] — **Eventos de 030 como contingencias mayores:** los `CHILDHOOD_EVENT`, muertes de familiares, migraciones, estudios y empleos se traducen en episodios de alta magnitud en su momento.
- **R-007** [M] — **Registro completo (decisión 6 del usuario):** **todos** los episodios pasan al registro de eventos como `DEVELOPMENT_EPISODE`, con su fecha (en el pasado), su etapa, quién habla o actúa (madre, padre, docente, par…), lo que aprendió la persona (el cambio en la función, la regla, la red o la respuesta) y sus causas (los eventos de 030 o episodios anteriores).
- **R-009** [M] — **Historia de vida en la ficha (decisión del usuario, 2026-09-28):** el visor (024) añade a la ficha de cada ciudadano la pestaña **Historia de vida**, con:
  - la línea de vida por etapas (infancia, escolar, adolescencia, adulto) con cada episodio: fecha y edad, qué pasó, quién intervino y qué aprendió;
  - un **familiograma extenso**: bisabuelos, abuelos, padres, tíos, hermanos, primos, pareja e hijos que se conozcan. Cada persona con su nombre, sus años de vida (o si vive fuera del mundo) y la calidad de la relación con el ciudadano (cercana, conflictiva, distante o sin datos), que sale de los episodios familiares.

  Lo sirve una ruta de solo lectura de la API (022): `GET /api/citizens/:id/life`.
- **R-008** [M] — **Salidas para 031 y 032:** los hábitos de salud y la ficha de esparcimiento iniciales salen de las fuerzas de respuesta resultantes, no de rasgos. Esto retira el adaptador de temperamento en los generadores.

## 4 bis. Estatus epistémico
- [T]: el papel de la comunidad verbal y de los reforzadores primarios, secundarios y generalizados (McHugh).
- [M]: el catálogo de episodios, sus tasas, la densidad y la traducción de 030 a episodios. Pendiente de revisión experta (PA-120, PA-121).

## 5. Eventos
Los episodios relevantes quedan como `DEVELOPMENT_EPISODE` (en el pasado, `at < 0`), con causas en los eventos de 030 o en episodios anteriores.

## 6. Invariantes
- **INV-001** — Todo estado funcional inicial (función, relación, regla) de una persona tiene origen en un episodio o en un contador de episodios.
- **INV-002** — Misma semilla, misma historia de desarrollo; añadir personas no cambia a las demás.

## 7. Criterios de aceptación (iniciales)
- **CA-001** — `world:new` de 200 personas con desarrollo en < 60 s. Con el registro completo (R-007), el tamaño adicional de la base se mide y se informa en el cierre del bloque (el tope anterior de 2 MB no aplica).
- **CA-005** — La pestaña **Historia de vida** de cualquier ciudadano muestra sus episodios por etapa, con quién intervino y qué aprendió, y cada episodio lleva a sus causas.
- **CA-006** — El familiograma de un ciudadano incluye a todos sus parientes conocidos hasta los bisabuelos, y a los hermanos, tíos y primos que existan en el mundo, con la calidad de la relación cuando hay episodios que la formen.
- **CA-002** — Para 10 personas al azar se reconstruye el origen de sus 5 funciones más fuertes hasta episodios concretos.
- **CA-003** — **Diversidad:**
  - la distribución del número de redes de valor, de reglas por tipo y de fuerzas de evitación iniciales no es degenerada (sd > umbral);
  - difiere por tipo de hogar y estrato en el sentido que fije el catálogo.
- **CA-004** — Divergencia desde la generación: dos personas con temperamento idéntico en hogares con episodios distintos llegan a 2026 con repertorios distintos (parte de 042 V-12).

## 8. Parámetros y calibración
| Parámetro | Valor | Estado |
|---|---|---|
| Episodios por año | 50 (0–18) / 12 (adulto) | [M], PA-121 |

## 9. Decisiones del usuario (2026-09-28)
1. **Densidad:** unos 50 episodios por año de los 0 a los 18 años y unos 12 por año de adulto, para esta versión (R-001).
2. **Catálogo inicial** de unos 30 tipos de episodio por etapa (crianza, colegio, pares, adolescencia, adulto), con probabilidad según el hogar, el estrato, los estudios y los hechos de la infancia de la 030. Las tasas llevan fuente colombiana cuando exista y, si falta, quedan como estimadas (ADR-006, spec 029).
3. **Lo que se aprende de la familia:** el enmarque con «Yo» (039) se aprende si la familia enseña a nombrar lo que se siente y a diferenciarse; la evitación (039 R-004), por el modelo de la familia y por el alivio; los valores (038), solo si hay episodios que los formen.
4. **Ánimo de base** (010): sale del balance de su historia, no del 0,55 igual para todos.
5. **Hábitos de salud, horas de sueño y aficiones** (031, 032, 011): salen de las fuerzas aprendidas, no de rasgos.
6. **Registro completo:** todos los episodios quedan como eventos con causas (R-007) y se ven en la pestaña **Historia de vida** de cada ciudadano, con un familiograma extenso (R-009).
7. **Se eliminan los adaptadores de rasgos** (MF7.4). Los Big Five quedan como descriptores en los reportes; el temperamento solo modula cuánto se aprende de cada episodio (036).
8. **Mundos existentes:** los mundos nuevos cambian; los existentes siguen funcionando sin historia de desarrollo. Se regeneran los mundos de ejemplo.

## 10. Preguntas abiertas
PA-015, PA-031, PA-120, PA-121.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-25 | 0.1 | Borrador (Fase A, ADR-008) |
| 2026-09-28 | 0.2 | Decisiones del usuario (§9): densidad 50/12 por año; catálogo inicial de unos 30 episodios con fuentes colombianas; «Yo», evitación y valores aprendidos en la familia; ánimo de base, hábitos, sueño y aficiones desde la historia; registro completo de los episodios (R-007) y pestaña **Historia de vida** con familiograma extenso (R-009, CA-005, CA-006); sin adaptadores de rasgos. CA-001 sin el tope de 2 MB: el tamaño se mide |
| 2026-09-28 | 0.2 | Estado → aprobada |
| 2026-09-28 | 0.2 | Precisiones de la implementación (MF7): (1) R-007 y §5: los episodios se registran **todos**, agrupados en un evento `DEVELOPMENT_YEAR` por año de vida, cada uno con fecha, tipo, quién intervino, valencia, causa y lo aprendido. Un evento por episodio (`DEVELOPMENT_EPISODE`) ocupaba ≈ 103 MB con 199 personas; agrupados, ≈ 24 MB y ≈ 7 000 eventos (CLAUDE.md regla 8). El texto de cada episodio está en el catálogo. (2) Catálogo `development_episodes` de 46 episodios: incluye episodios contrarios (castigar la expresión emocional, burlarse de una confidencia, castigar la defensa, enfrentar los problemas en casa) y los que producen los hechos de la 030. Los verbales exigen 2 años. (3) Estilo de la familia [M]: calidez, dureza y hablar de emociones, compartidos por los hermanos. Sin él todos terminaban iguales, porque la fuerza operante se acerca al resultado (036 R-002). (4) Ánimo de base `0,55 + 0,3 × (balance − 0,3)`. (5) Hábitos (031) desde lo aprendido y normalizados por la media de la población, para conservar las prevalencias del perfil; esparcimiento (032) con la posición de la persona en la población (`0,5 + 0,2 × z`); sueño sin ficha: 6,95 h. (6) Decisión 8: los mundos de ejemplo no se regeneran (política de `docs/validaciones/mundos/README.md`); la prueba de la API genera un mundo al vuelo. Mediciones: `world:new` ≈ 2 s; V-12 (a) distancia media > 0,1 y (b) menor que (a); CA-003 con más castigo físico en los estratos bajos. Sin cambios en CA |
| 2026-09-28 | 0.2 | Estado → implementada |
