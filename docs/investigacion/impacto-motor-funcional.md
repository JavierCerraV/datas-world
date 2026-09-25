# Impacto de la reorientación funcional-contextual (Fase A)

Informe para decidir la migración de la spec 009 v0.3 al motor funcional-contextual (ADR-007, spec 035). Se basa en el inventario del código a 2026-09-25 (`main` en `476a9f7`, M2 hasta el bloque E).

## 1. Diferencias entre el diagnóstico del encargo y el repositorio

| Diagnóstico | Realidad | Consecuencia |
|---|---|---|
| "009 v0.3, aprobada e implementada en el bloque E" | Estado `aprobada` (no `implementada`); implementada en el bloque E **de M1** (catálogos) | Su transición es aprobada → obsoleta (sustituida por la v1.0) |
| ADR-005 = columnas | Sí: es su "idea A" (ADR-005 se titula "Crecimiento por capacidades…") | Sin cambios |
| Hay un inspector en la UI con rasgos, valores y afrontamiento | `apps/web` todavía no muestra personalidad (llega en M4) y `citizen:report` de la CLI no la muestra | No hay UI que migrar; en M4 el inspector mostrará el temperamento como descriptor (§4.3) |
| Los rasgos solo se usan en R-003/R-004 | Hay **más consumidores**, en sistemas de M2 y en generadores de M1 (§2) | Todos pasan por el adaptador |
| Hashes dorados | No hay hashes fijos en las pruebas: se comparan dos ejecuciones. El único artefacto con hash guardado es el mundo de ejemplo `docs/validaciones/mundos/m1-482917.db` | La migración debe cargarlo (027 R-011) |
| Poner 009 en `en-revision` | Los guardarraíles exigen que las specs de un módulo con código estén `aprobada` o `implementada`. Cinco módulos citan 009: needs, catalogs, leisure, personality y population. Con 009 en revisión, `check.mjs` falla y bloquea commits y turnos | La v1.0 va en `specs/propuestas/009-temperament.md` (§5) |

## 2. Inventario de consumidores de `pers.*`, `val.*` y `pers.coping`

| Archivo | Qué lee o escribe | Uso | Tipo |
|---|---|---|---|
| `generators/src/personality/generate.ts` | escribe todos los `pers.*`, `val.*` y `pers.coping` | Generación (009 R-001–R-003) | Productor |
| `generators/catalogs/personality_traits.json`, `personal_values.json` | definen columnas y correlaciones | Catálogos (ADR-006) | Datos |
| `generators/src/population/generate.ts` | define columnas y llama a la generación | Orquestación | Productor |
| `generators/src/catalogs/load.ts` | nombres de catálogos | Carga | Datos |
| `generators/src/health/habits.ts` | `pers.impulsivity`, `pers.conscientiousness`, `val.health` | Hábitos de salud iniciales (031) | **Conducta desde rasgos** |
| `generators/src/leisure/select.ts` + `leisure_activities.json` (`traits`, `values`) | cualquier `pers.*`/`val.*` por nombre del catálogo | Elección de la ficha de esparcimiento (032) | **Conducta desde rasgos (lectura dinámica)** |
| `engine/src/needs/columns.ts` | `pers.neuroticism` (`stability`) | Línea base del ánimo (010 R-003) | Estado emocional desde rasgo |
| `engine/src/needs/system.ts` | `pers.extraversion`, `pers.neuroticism`, `pers.resilience` | Soledad sin compañía; modulación de estresores (010 R-002) | Estado desde rasgo |
| `engine/src/needs/emotions.ts` | `pers.neuroticism`, `pers.extraversion` | Emociones por evento (010 R-005) | Estado desde rasgo |
| `engine/src/routines/columns.ts` | `pers.impulsivity`, `pers.extraversion`, `pers.conscientiousness` | Horas de sueño sin ficha de salud (prototipo) | Conducta desde rasgos |
| `engine/src/routines/system.ts` | `pers.conscientiousness` | Quedarse dormido y su causa (010 R-004) | **Conducta desde rasgo** |
| `engine/src/decision/options.ts` | `pers.conscientiousness` | Utilidad de las obligaciones flexibles (017) | **Conducta desde rasgo** |
| `engine/src/decision/system.ts` | `pers.impulsivity` | Temperatura de la softmax (017 R-003) | **Conducta desde rasgo** |
| Pruebas: `needs.test.ts`, `routines.test.ts`, `mobility.test.ts`, `decision.test.ts`, `personality.test.ts`, `population.test.ts`, `leisure.test.ts` | definen o comprueban columnas `pers.*` | Montaje y criterios | Pruebas |
| `apps/*` | ninguno | — | — |

## 3. Specs, módulos, pruebas y artefactos afectados

- **Specs:** ver 035 §8. En resumen:
  - 009 se reescribe;
  - 017 y 018 se sustituyen;
  - 010, 011, 012, 013, 014, 019, 020, 021, 025, 031 y 032 se adaptan;
  - 023 no cambia;
  - nuevas: 035–042.
- **Módulos con `MODULE.md` que cambiarán en la Fase B:**
  - generadores: personality, population, catalogs, leisure, health;
  - motor: needs, routines, decision (pasa a selection), engine;
  - nuevos: `temperament`, `functions`, `relational`, `rules`, `private`, `lab` y `development` (en generadores).
- **Pruebas:**
  - las de 009 (CA-001–CA-004 v0.3) se sustituyen por CA-A–CA-H;
  - las de 010 que usan neuroticismo (CA-005 de 010, 009 CA-004) se reescriben contra la sensibilidad aversiva y las funciones;
  - las de 017 CA-001–CA-005 pasan a 040.
- **Mundo de ejemplo:** `m1-482917.db` tiene columnas que desaparecen. La prueba `apps/cli/src/m1.test.ts` lo carga y lo avanza, así que hace falta una migración que:
  - descarte `pers.approvalNeed`, `pers.honesty`, `pers.impulsivity`, `pers.resilience`, `pers.socialSensitivity`, `pers.coping` y `val.*`;
  - derive `tmp.*` con R-002 y el flujo por persona (la carga es determinista);
  - el hash tras la migración será otro, documentado en `docs/validaciones/mundos/README.md`.
- **Línea base de paridad:** `docs/validaciones/linea-base-prototipo.json` sigue sirviendo para mundo y economía. Las métricas de ánimo y estrés pasan a ser comprobaciones de cordura (sin NaN, rangos amplios), no paridad (ADR-007 §7).

## 4. Estrategia de migración elegida

### 4.1 Adaptador temporal frente a reescritura directa
**Elegido: adaptador temporal `@deprecated`.**
- **Qué es:**
  - `packages/engine/src/temperament/legacy.ts` y `packages/generators/src/personality/legacy.ts`;
  - concentran las lecturas de rasgos que hoy hacen needs, routines, decision, habits y leisure;
  - traducen de `tmp.*` a las magnitudes que esos módulos esperan, por ejemplo `legacyNeuroticism = f(tmp.aversiveSensitivity, tmp.arousalBaseline)`.
- **Por qué:**
  - el mundo debe seguir ejecutándose al final de cada bloque;
  - M2 tiene sistemas en marcha que dependen de esas lecturas;
  - reescribir 010, 011, 017, 031 y 032 a la vez que se construyen las capas 2–6 dejaría el mundo roto durante varios bloques.
- **Riesgo:** que el adaptador se vuelva permanente.
- **Control:**
  - la prueba de arquitectura permite leer `tmp.*`/`pers.*` solo a los mecanismos de 036–039, a `temperament/` y al adaptador;
  - una comprobación falla si el adaptador existe cuando el bloque MF7 está marcado en `tasks/MF-motor-funcional.md` (035 §9);
  - cada bloque MF retira del adaptador los usos que sustituye (MF3 retira la temperatura y la utilidad de las obligaciones; MF7 retira los generadores).
- **Alternativa descartada:** reescritura directa. Es más limpia, pero rompe M2 durante semanas y no permite validar por bloques.

### 4.2 Destino de los 12 valores del prototipo
**Elegido: dominios vitales** en el catálogo `life_domains`: raíces posibles de las redes de valor (038 R-009). Se eliminan las columnas `val.*`.
- Sus usos actuales pasan por el adaptador hasta MF7: `val.health` en hábitos y los `values` del catálogo de esparcimiento.
- **Alternativas descartadas:**
  - eliminarlos: se perdería un vocabulario útil y validado con el prototipo;
  - mantener los escalares como "pesos iniciales" de las redes: reintroduce `valor_amistad = 0,8`, prohibido por el documento rector §5.

### 4.3 UI
No existe hoy una vista de personalidad. Hasta M4:
- `citizen:report` (CLI) añadirá en MF1 una sección "Temperamento (descriptor, no explica la conducta)" con el Big Five y los `tmp.*`;
- en M4, el inspector mostrará la historia funcional (funciones más fuertes con su origen, reglas y redes de valor) en lugar de rasgos y valores.

### 4.4 Hashes dorados y fixtures
- **Cambian los mundos nuevos:** los catálogos cambian (009 INV-002).
- **Pruebas:** comparan ejecuciones entre sí, así que no hay que regenerar constantes.
- **Mundo de ejemplo:** se migra al cargar (§3).
- **Registro:** cada bloque anota el cambio de hash y su motivo en la bitácora del `MODULE.md`, en el historial de 009 y en `docs/validaciones/`.

### 4.5 Specs aprobadas o implementadas afectadas
- **009 v0.3:**
  - pasa a `obsoleta` cuando el usuario apruebe la v1.0;
  - su historial dirá "sustituida por 009 v1.0 (Temperamento y predisposiciones)";
  - el archivo de la propuesta se mueve a `specs/009-temperament.md` y los `MODULE.md` se actualizan en el mismo commit.
- **017** (aprobada, implementada en M2): pasa a `obsoleta` al cerrar MF3, sustituida por 040, con fila de historial.
- **018** (borrador): pasa a `obsoleta` al aprobar 036 y 040.
- **010, 011, 031 y 032:** cada bloque que las toque añade su fila de historial. En la Fase A no se modifican: solo se propone su destino (035 §8).

## 5. Por qué la propuesta de 009 v1.0 no sustituye todavía al archivo vigente
Regla de oro 1: los módulos con código necesitan specs aprobadas, y los guardarraíles lo comprueban (`scripts/guardrails/lib.mjs`, `SPEC_OK`).
- **El conflicto:** si `specs/009-personality.md` pasa a `en-revision`, `check.mjs` falla en needs, catalogs, leisure, personality y population, y no se puede hacer commit ni terminar un turno.
- **La solución:** la v1.0 vive en `specs/propuestas/` (que los guardarraíles no leen) con `estado: en-revision`. Así se cumple el encargo sin rodear ni editar los guardarraíles.
- **Al aprobar:**
  1. mover el archivo a `specs/009-temperament.md`;
  2. poner la v0.3 en `obsoleta`;
  3. ejecutar `node scripts/aprobar-spec.mjs 009` sobre la nueva;
  4. actualizar las listas `specs:` de los `MODULE.md`.

## 6. Memoria y rendimiento

| Concepto | Hoy | Con el motor funcional | Nota |
|---|---|---|---|
| RAM por persona viva (M1) | ≈ 16 KB | ≈ 16 KB + ≈ 15 KB (035 §7) ≈ 31 KB | Objetivo del peldaño 4: < 40 KB |
| Columnas de personalidad | 89 B | 52 B | Menos columnas |
| Ontología compartida | — | ≈ 256 KB por mundo | Independiente de la población |
| 500 personas | ≈ 8 MB | ≈ 16 MB | Muy por debajo de 1 GB |
| 10 000 personas | ≈ 160 MB | ≈ 310 MB | Dentro de 1 GB |

**Riesgos de rendimiento:**
1. **Derivación relacional por tick.** Mitigaciones:
   - caché por persona;
   - profundidad 3;
   - derivar solo la subred activa (estímulos presentes y eventos privados);
   - medirlo en MF4 (037 CA-004: ≤ 5 ms por tick con 200 personas).
2. **Instantáneas y hash.** El estado por persona se duplica. La instantánea diaria (027) y `stateHash` ya son el coste principal (M1-cierre), así que adelantar la retención de instantáneas (027 R-004) sería prudente.
3. **Generación con desarrollo (041).** Presupuesto < 60 s para 200 personas. Si no se cumple, se baja la densidad de episodios (PA-121).
4. **Número de eventos.** Los eventos de aprendizaje solo se emiten en nivel ≥ 3 o si superan umbrales, para no multiplicar la base.

## 7. Riesgos generales
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Muchos supuestos [M] sin validar | Conducta verosímil pero sin base | Batería 042 con fenómenos [E]; registro de preguntas; revisión experta antes de calibrar |
| El adaptador se queda | Circularidad oculta | Prueba de arquitectura con caducidad en MF7 |
| Poblaciones homogéneas tras el desarrollo | Pocas diferencias individuales | 041 CA-003 (diversidad) y 042 V-12 |
| El retraso de M3 (vida social) | La hoja de ruta se alarga | M2 F–H sigue en paralelo con el adaptador (roadmap) |
| Explosión de estado por persona | Memoria | Topes, poda y archivo; `pnpm bench` en cada bloque |

## 8. Aprobación
El 2026-09-25 el usuario aprobó la 009 v1.0, la 035 y el plan MF. La propuesta pasó a `specs/009-temperament.md` y la v0.3 a `specs/obsoletas/009-personality-v0.3.md` (estado `obsoleta`), fuera de la carpeta que leen los guardarraíles y el script de aprobación, para que no haya dos specs con el id 009.
