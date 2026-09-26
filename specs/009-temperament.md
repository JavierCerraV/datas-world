---
id: 009
nombre: temperament
estado: aprobada
hito: MF (bloque MF1)
depende_de: [001, 023, 035]
version: 1.0
---

# 009 — Temperamento y predisposiciones

> Sustituye a la v0.3 "Personalidad y valores" (`specs/obsoletas/009-personality-v0.3.md`). Aprobada por el usuario el 2026-09-25; se implementa en el bloque MF1 (`tasks/MF-motor-funcional.md`).

## 1. Propósito
Diferencias individuales relativamente estables que **parametrizan cómo aprende** una persona (documento rector §13; ADR-007). El temperamento no produce conducta: fija la magnitud y la velocidad de los mecanismos de aprendizaje de las capas 2 a 5 (specs 036–039) y los **valores iniciales** de estados aprendidos (descuento temporal, variabilidad). La conducta sale solo de la capa 6 (spec 040), que no puede leer el temperamento (R-006, CA-B).

Pregunta que guía la spec: *¿dos personas con el mismo temperamento pueden terminar distintas, y dos distintas parecidas?* Sí, porque lo que decide es su historia (CA-F, spec 042).

## 2. Alcance
**Incluye:**
- descriptores Big Five (5 columnas) como fuente de generación y como descripción observable para informes;
- parámetros de temperamento (`tmp.*`), cada uno ligado a los mecanismos que modula;
- tabla de mapeo configurable Big Five → parámetros;
- cambio lento del temperamento con causas (`TRAIT_SHIFT`);
- el guardarraíl anticircularidad (quién puede leer el temperamento).

**Fuera de alcance:**
- valores: pasan a ser redes jerárquicas de reforzadores (038); los 12 valores del prototipo sobreviven como **dominios vitales** (catálogo `life_domains`, raíces posibles de esas redes);
- afrontamiento, evitación, rumiación, búsqueda de aprobación, honestidad, resiliencia: son patrones que deben **emerger** (036–040) o métricas de trayectoria (020); no son datos de entrada;
- diagnósticos y capa clínica (fuera de esta etapa).

**Qué se elimina respecto a la v0.3** (y por qué, documento rector §12):

| v0.3 | Destino en v1.0 | Motivo |
|---|---|---|
| `pers.impulsivity` | `tmp.discount0` y `tmp.variability0` (valores iniciales de estados aprendidos) | Elegir lo inmediato es una conducta; lo temperamental es la pendiente inicial del descuento |
| `pers.socialSensitivity` | `tmp.socialSalience` (saliencia inicial de estímulos sociales), pendiente de expertos (PA-102) | La sensibilidad social como patrón es aprendida |
| `pers.approvalNeed` | Se elimina | Explicación circular (§12). La aprobación es un reforzador generalizado adquirido (036 R-008) |
| `pers.honesty` | Se elimina, sin parámetro residual | Mentir es operante: su probabilidad sale de consecuencias y reglas (038); un residuo "honestidad" reintroduciría la circularidad. 025 se adapta (PA-108) |
| `pers.resilience` | Se elimina; métrica de trayectoria en 020 | La resiliencia es un resultado (recuperación tras eventos aversivos), no una causa |
| `pers.coping` y R-003 | Se eliminan | Circularidad directa (rumiación porque neuroticismo > 0,65). El afrontamiento es un repertorio (039) |
| `val.*` (12 × U(0,1)) y R-002 | Catálogo `life_domains` sin columnas | Los valores no son escalares (documento rector §5) |
| R-004 (rasgos modulan conducta) | R-004 nueva: sensibilidades modulan actualizaciones de aprendizaje | La personalidad no produce conducta (§13) |
| R-006 (similitud de valores → afinidad) | Pendiente en 012 (reforzamiento mutuo y funciones compartidas) | Suponía valores escalares |

## 3. Modelo de datos
```ts
// Descriptores (capa 1, solo generación, informes y la tabla de mapeo): columnas f32 en [0,1].
type Big5 = 'pers.openness' | 'pers.conscientiousness' | 'pers.extraversion' | 'pers.agreeableness' | 'pers.neuroticism';

// Parámetros de temperamento: columnas f32 en [0,1] normalizadas; cada mecanismo las lleva a sus unidades
// con `scale` del catálogo (p. ej. tmp.discount0 ∈ [0,1] → k ∈ [0,002, 0,2] por hora de demora).
interface TemperamentParam {
  key: string;            // 'tmp.aversiveSensitivity'
  column: string;         // columna f32
  modula: MechanismId[];  // ≥ 1; ids declarados por las specs 036–040 (registro de mecanismos, 035 §5)
  base: number;           // valor medio en [0,1]
  mapping: Partial<Record<Big5, number>>; // pesos [M] (tabla de expertos pendiente, PA-101)
  residualSd: number;     // ruido propio por persona (el temperamento no es función exacta del Big Five)
  scale: [number, number];// unidades del mecanismo
  status: 'estimado' | 'por_confirmar' | 'oficial';
}
```

**Catálogos** (ADR-006, configurables):
- `personality_traits` 2026.10.1: solo los 5 descriptores Big Five (se quitan los extras).
- `temperament_params` 2026.10.1 (nuevo): los parámetros de la tabla siguiente.
- `life_domains` 2026.10.1 (sustituye a `personal_values`): los 12 dominios del prototipo, sin columnas.

**Catálogo inicial `temperament_params`** (todos [M] en su forma y sus pesos; la base teórica se indica):

| Clave (columna) | Qué parametriza | `modula` | Mapeo inicial [M] | Base teórica |
|---|---|---|---|---|
| `tmp.aversiveSensitivity` | Magnitud de las actualizaciones con consecuencias aversivas (castigo, EC aversivos) | `respondent.aversive_update`, `operant.punishment_update` | +0,6 N | [T] sistemas de sensibilidad al castigo (Gray, RST; referencia a verificar) |
| `tmp.appetitiveSensitivity` | Magnitud de las actualizaciones con consecuencias apetitivas | `respondent.appetitive_update`, `operant.reinforcement_update` | +0,5 E, +0,1 O | [T] sensibilidad a la recompensa (RST; referencia a verificar) |
| `tmp.arousalBaseline` | Ganancia de la respuesta elicitada y nivel basal de activación | `respondent.elicitation_gain`, `motivation.arousal_baseline` | +0,4 N, +0,2 E | [T] reactividad (Rothbart; referencia a verificar) |
| `tmp.habituationRate` | Velocidad de habituación ante estimulación repetida sin consecuencia | `respondent.habituation` | −0,3 N, +0,2 O | [E] fenómeno; [M] vínculo con el Big Five |
| `tmp.noveltySensitivity` | Valor inicial asignado a estímulos y respuestas nuevos (exploración) | `operant.novel_initial_value`, `generalization.novel_prior` | +0,6 O, +0,2 E | [T] búsqueda de novedad (referencia a verificar) |
| `tmp.discount0` | Pendiente inicial del descuento hiperbólico (valor inicial del estado aprendido `hist.discountK`) | `discounting.initial_k`, `discounting.k_plasticity` | −0,5 C, +0,2 N | [E] descuento hiperbólico; [M] que su pendiente inicial sea temperamental |
| `tmp.variability0` | Variabilidad conductual inicial (valor inicial del estado aprendido `hist.variability`) | `operant.variability_initial` | +0,3 O, −0,3 C | [E] la variabilidad es operante (Neuringer; referencia a verificar); [M] su valor inicial |
| `tmp.socialSalience` | Saliencia inicial de los estímulos sociales en el aprendizaje respondiente | `respondent.social_salience` | +0,4 E, +0,3 A | [M] pendiente de expertos (PA-102) |

Coste: 5 + 8 = 13 columnas f32 → 52 B por persona (la v0.3 usaba 23 columnas, 89 B).

## 4. Reglas
- **R-001** [M] — **Generación de descriptores** (se conserva de la v0.3). Flujo `rng.fork('gen:personality').fork(citizenId)`:
  1. cada descriptor sale de `N(0,5, TRAIT_SD)` recortada a `[0,03, 0,97]`;
  2. con probabilidad `EXTREME_P`, un descriptor al azar se vuelve extremo: `U(0,03, 0,12)` o `U(0,88, 0,97)`;
  3. las correlaciones del atributo `correlations` se aplican antes del recorte por mezcla lineal con normales compartidas (por defecto, ninguna: la única de la v0.3 era con la resiliencia, que se elimina).
- **R-002** [M] — **Mapeo a temperamento** (opción (a), ADR-007 §4). Flujo `rng.fork('gen:temperament').fork(citizenId)`, después de R-001:
  `tmp_p = clamp(base_p + Σ_d w_{p,d} · (desc_d − 0,5) + N(0, residualSd_p), 0,02, 0,98)`.
  Los pesos `w` y `residualSd` (por defecto 0,12) salen del catálogo. Cambiar el catálogo cambia el mundo (INV-002). Pregunta para expertos: PA-101.
- **R-003** [T] — **Dirección de dependencias.** El temperamento solo lo leen los mecanismos que declara en `modula` (capas 2 a 5). Los descriptores Big Five solo los leen R-002, R-005 y los informes (020, CLI, web). Ninguno de los dos lo lee la selección de conducta (040) ni sistemas que eligen conducta.
- **R-004** [T] (sensibilidad) / [M] (forma) — **Sensibilidades como multiplicadores de aprendizaje.** Una actualización de fuerza con consecuencia aversiva se multiplica por `f(tmp.aversiveSensitivity) = 0,5 + tmp` (∈ [0,52, 1,48]); con consecuencia apetitiva, por `0,5 + tmp.appetitiveSensitivity`. Nunca se suman a la utilidad de una opción. Sustituye a la R-004 de la v0.3 (el neuroticismo amplificaba el impacto de los eventos negativos sobre el estrés): ahora amplifica cuánto aprende la persona de lo aversivo, y el estrés sale de las funciones aprendidas (036, 010).
- **R-005** [M] — **Cambio lento.** Descriptores y parámetros cambian como mucho ±0,05 al año, solo con eventos vitales mayores (lista de 013 §8) y con su causa registrada (`TRAIT_SHIFT`). Sin eventos mayores no cambian más de 0,02 al año.
- **R-006** [M] — **Guardarraíl anticircularidad** (verificable, CA-B):
  - una prueba de arquitectura (`packages/engine/src/architecture.test.ts`) recorre el código del motor y falla si un módulo fuera de la lista permitida contiene literales `'tmp.'` o `'pers.'` o importa el módulo `temperament`;
  - la lista permitida la fijan las specs: los mecanismos de 036–039, `temperament` y, durante la migración, `temperament/legacy.ts` (adaptador `@deprecated`, se elimina en el bloque MF7; la prueba falla si existe después, 035 §9);
  - una regla de ESLint `no-restricted-imports` impide importar `temperament` desde `decision`/`selection`;
  - las lecturas dinámicas (nombres de columna leídos de un catálogo) solo se permiten en generadores listados (`generators/src/personality`, y `generators/src/leisure` hasta MF7).
- **R-007** [M] — **Dominios vitales.** `life_domains` enumera las raíces posibles de las redes de valores (038). No tiene columnas ni valores por persona: una persona "valora la familia" solo si su historia construyó una red jerárquica de reforzadores con esa raíz (038, 041).

## 4 bis. Estatus epistémico
- [E]: que existan diferencias individuales estables en reactividad y sensibilidad a consecuencias; el descuento hiperbólico y la variabilidad operante como fenómenos.
- [T]: que esas diferencias actúen sobre el **aprendizaje** y no directamente sobre la conducta (documento rector §13; análisis funcional).
- [M]: la lista de parámetros, su forma normalizada, el mapeo desde el Big Five, el multiplicador `0,5 + tmp` y los límites de cambio. Todo es configurable en catálogo y espera la tabla de expertos (PA-101, PA-102).

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `TRAIT_SHIFT` (M3+) | cambio acumulado > 0,02 en un descriptor o parámetro | clave, delta | eventos vitales mayores |

## 6. Invariantes
- **INV-001** — Descriptores y parámetros en `[0,1]`, sin NaN.
- **INV-002** — Nombres, orden, pesos y número de descriptores y parámetros salen de los catálogos del mundo: cambiarlos crea otro mundo y otro hash.
- **INV-003** — Toda entrada de `temperament_params` declara al menos un mecanismo en `modula`, y ese mecanismo existe en el registro de mecanismos (035 §5).
- **INV-004** — Ningún sistema de selección de conducta lee `tmp.*` ni `pers.*` (R-006).

## 7. Criterios de aceptación
- **CA-A** — *Dado* el catálogo `temperament_params`, *entonces* ninguna clave, nombre ni descripción contiene términos de conducta o patrón clínico (lista `FORBIDDEN_TERMS`: evitación, evitativo, rumiación, rumia, aprobación, impulsividad, impulsivo, resiliencia, afrontamiento, ansiedad, depresión, honestidad, mentir, agresividad, aislamiento, perseverancia, cooperación), y toda entrada tiene `modula` no vacío con mecanismos registrados.
- **CA-B** — *Dado* un módulo de selección de conducta que lee `'tmp.…'` o `'pers.…'` o importa `temperament`, *entonces* la prueba de arquitectura falla (se comprueba con un archivo de prueba que viola la regla en una carpeta de fixtures).
- **CA-C** — *Dado* 500 personas, *entonces* cada descriptor Big Five tiene media 0,5 ± 0,05 y desviación típica 0,17 ± 0,03, entre el 15 % y el 30 % tiene algún descriptor extremo, y las parejas sin correlación configurada están en [−0,15, 0,15]; con una correlación configurada de prueba (r = −0,4), la medida cae en [−0,5, −0,3]. Cada parámetro `tmp.*` está en [0,02, 0,98], con desviación típica > 0,05 y correlación con sus descriptores del signo del mapeo.
- **CA-D** — *Dado* un `citizenId`, *entonces* su temperamento no cambia si se generan más personas después, ni si se añade una entrada al final del catálogo de parámetros (flujo por persona y por parámetro).
- **CA-E** — *Dado* dos personas con idéntica historia simulada y distinta `tmp.aversiveSensitivity` (0,2 y 0,8), *cuando* reciben la misma serie de 5 emparejamientos de un estímulo neutro con una consecuencia aversiva, *entonces* la fuerza de la función aversiva adquirida es mayor en cada ensayo en la más sensible. Se verifica contra el mecanismo respondiente mínimo de 036 (bloque MF2).
- **CA-F** — *Dado* temperamento igual e historias distintas, *entonces* trayectorias divergentes; *dado* temperamentos distintos y contingencias parecidas, *entonces* convergencia. Se valida en la batería (042 V-12), cuando existan las capas 2 a 6.
- **CA-G** — *Dado* un cambio en un peso del mapeo, *entonces* cambian los `tmp.*` afectados y el hash del mundo, pero no los descriptores.
- **CA-H (M3+)** — *Dado* un año sin eventos mayores, *entonces* ningún descriptor ni parámetro cambia más de 0,02.

## 8. Parámetros y calibración
| Parámetro | Valor por defecto | Rango | Fuente / justificación |
|---|---|---|---|
| `TRAIT_SD` | 0,17 | 0,1–0,25 | prototipo (`newAgent`); se conserva |
| `EXTREME_P` | 0,22 | 0–0,5 | prototipo; se conserva |
| Correlaciones entre descriptores | ninguna | [−1, 1] | a la espera de la tabla de expertos (PA-101) |
| `residualSd` | 0,12 | 0–0,3 | [M] para que el temperamento no sea función exacta del Big Five |
| Mapeo Big Five → `tmp.*` | tabla de la §3 | [−1, 1] por peso | [M], PA-101 |
| Multiplicador de sensibilidad | `0,5 + tmp` | — | [M], PA-103 |

## 9. Métricas y observabilidad
Media, desviación típica y extremos por descriptor y parámetro; matriz de correlaciones descriptores × parámetros; alerta si un parámetro tiene varianza cercana a 0 (el mapeo lo aplana). En los informes (020) el Big Five se muestra como **descriptor**, con la advertencia de que no explica la conducta.

## 10. Preguntas abiertas
- [x] ¿Big Five primero y mapeo (a) o parámetros primero (b)? → (a), con ruido residual (ADR-007 §4). Reversible.
- [ ] PA-101: ¿qué parámetros temperamentales tienen base empírica y cómo se relacionan con Big Five/HEXACO?
- [ ] PA-102: ¿existe una base temperamental para la saliencia de estímulos sociales, o es enteramente aprendida?
- [ ] PA-103: ¿qué forma y rango tiene la modulación de la tasa de aprendizaje por la sensibilidad (multiplicador, sesgo, asimetría)?
- [ ] PA-108: ¿queda algún residuo temperamental en la conducta de mentir?

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-23 | 0.1 | Borrador inicial generado desde la visión y el prototipo |
| 2026-09-24 | 0.2 | Big Five + extras, valores, afrontamiento derivado (aprobada) |
| 2026-09-24 | 0.3 | Implementación del bloque E de M1 (catálogos `personality_traits` y `personal_values`) |
| 2026-09-25 | 1.0 | Reescritura como "Temperamento y predisposiciones" (reorientación funcional-contextual, ADR-007): el Big Five queda como descriptor y fuente de generación; 8 parámetros de temperamento que solo modulan el aprendizaje, con `modula`; se eliminan impulsividad, sensibilidad social, necesidad de aprobación, honestidad, resiliencia, afrontamiento y valores escalares; guardarraíl anticircularidad verificable; criterios CA-A a CA-H. Estado `en-revision`, en `specs/propuestas/` |
| 2026-09-25 | 1.0 | Estado → aprobada |
| 2026-09-25 | 1.0 | Implementación del bloque MF1. Precisiones: (1) la prueba de arquitectura se divide en reglas puras en `packages/engine/src/architecture/` (con los fixtures de CA-B) y escaneo del repositorio en `packages/generators/src/architecture/scan.test.ts`, porque el guardarraíl de determinismo prohíbe `node:fs` en todo `packages/engine`; (2) en CA-C, la correlación configurada se mide sin el paso de extremos: con 5 descriptores y `EXTREME_P = 0,22` los extremos la atenúan ≈ 30 % (ρ = −0,4 se mide −0,27); (3) el adaptador traduce la impulsividad de la v0.3 como `tmp.discount0` y la resiliencia como 1 − `tmp.aversiveSensitivity` [M], con caducidad por bloques; (4) el mundo de ejemplo de M1 se carga sin migrar: el motor ignora las columnas que ya no usa y su hash guardado no cambia. Sin cambios en CA |
| 2026-09-26 | 1.0 | Bloque MF2: CA-E verificado (`lab/battery.test.ts`: a igual historia, más sensibilidad aversiva da una función aversiva más fuerte en cada ensayo). El adaptador deja de usarse en las emociones (MF2.5). Sin cambios en CA |
| 2026-09-26 | 1.0 | Bloque MF3 (MF3.4): la selección (`decision/`) y la rutina (`routines/system.ts`) ya no importan el adaptador; la impulsividad y la responsabilidad se sustituyen por `hist.discountK` y `hist.variability`, que el temperamento solo inicializa (`functions/history.ts`, mecanismo registrado). Sin cambios en CA |
