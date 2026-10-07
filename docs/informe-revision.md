# Informe para revisor técnico-científico: Data's World

**Fecha de corte:** 2026-09-29 · **Rama:** `m4/observacion` (commit base `0dd081d`) · **Base documental:** 44 specs, documentos de validación del motor funcional (MF2–MF8, M2, M3, M4), ADR-001 a ADR-008, `docs/investigacion/motor-comportamiento-humano.md`, `docs/investigacion/preguntas-abiertas.md`, `docs/investigacion/referencias.md`, `docs/validaciones/bateria-conductual.md` y las tareas de hitos (`tasks/`).

---

## 1. Identificación del artefacto y de la afirmación subyacente

**Qué es** (README.md, CLAUDE.md §1): un laboratorio de simulación social con población artificial autónoma —no un videojuego, no un chatbot, no un simulador de terapia— que sigue evolucionando aunque nadie lo observe. El objetivo declarado no es la fidelidad anecdótica sino algo más fuerte y evaluable:

> "La meta no es solamente crear agentes que parezcan humanos. La meta es crear agentes cuyo comportamiento pueda ser explicado mediante un modelo teórico explícito de cómo se desarrolla y modifica la conducta humana."
> — `docs/investigacion/motor-comportamiento-humano.md` §15

**Principio rector** (visión §2): *"No construir pacientes. Construir personas."* El sistema nunca parte de un diagnóstico: parte de una persona con historia, y solo después de vivir puede alguien convertirse en potencial paciente.

**Pregunta guía** (CLAUDE.md §1, visión §55): *¿estas personas parecen haber vivido un año, y podemos explicar por qué terminaron donde terminaron?*

Descompone en tres tesis evaluables:

| # | Tesis | Tipo |
|---|---|---|
| T1 | La conducta **emerge** de historia + contexto, no de rasgos etiquetados (no hay columnas `rumination`, `honesty`, `resilience` de fábrica) | Arquitectónica / teórica |
| T2 | Toda conducta es **trazable causalmente** hasta hechos del registro | Mecanicista, verificable por construcción |
| T3 | Los patrones conductuales producidos **reproducen fenómenos conductuales establecidos** (adquisición, igualación, PNR…) | Empírica, comparable con literatura |

La capa clínica (intervención psicológica en fase 2) es **posterior y explícitamente no condiciona el núcleo** (CLAUDE.md §1, visión §58): la spec 034 está en `borrador` v0.1. Todo lo que se reporta abajo es fase 1–4.

---

## 2. Afirmaciones principales y su estatus epistémico formal

El proyecto opera con un protocolo de etiquetado (ADR-007 §6, plantilla de specs §4 bis): **[E]** empiria, **[T]** teoría con fuente, **[M]** supuesto de diseño. El proyecto se autoetiqueta su propia deuda de validez en línea con cada regla.

### 2.1 Lo etiquetado [E]: 12 fenómenos de la batería 042 (todos en verde)

Cada escenario es una prueba determinista con semilla fija que corre en `pnpm check` (`docs/validaciones/bateria-conductual.md`):

| ID | Fenómeno | Resultado reportado | Estado |
|---|---|---|---|
| V-1 | Adquisición y extinción | Adquisición negativamente acelerada; extinción < 20 % del máximo | ✔ |
| V-2 | Recuperación espontánea y renovación | Renovación en A > B > fin de extinción (orden de Bouton) | ✔ |
| V-3 | Gradiente de generalización | Unimodal decreciente; pico desplazado tras discriminación | ✔ |
| V-4 | Ley de igualación | Pendiente **0,72**, R² ≈ 1 (subigualación; 0,64 con programas pobres) | ✔ |
| V-5 | Descuento hiperbólico e inversión | 76 % / 48 % de inversión temporal, estable en 5 semillas | ✔ |
| V-6 | Persistencia de la evitación | ≈52/100 (aversión alta) vs ≈35 (baja) | ✔ **justo** |
| V-7 | Vinculación mutua y combinatoria (TMR) | Derivadas correctas y más débiles que las enseñadas | ✔ |
| V-8 | Transformación por comparación | A=−0,5 → B=−0,68, C=−0,30 (orden correcto) | ✔ |
| V-9 | Insensibilidad por reglas | Instruido ajusta más tarde que moldeado | ✔ |
| V-10 | Bucle de PNR | Evitación: 4 episodios de 95–180 min; sin parada: 520 min + recuperación espontánea | ✔ |
| V-11a/b | Ajedrez→«tonto»; rechazos→«no me quieren» | Aparición dependiente de la red de valor/oposición | ✔ |
| V-12 | Divergencia y convergencia | Misma personalidad + historias distintas → distancia > 0,1; temperamentos opuestos + misma historia → distancia menor | ✔ (2 desviaciones de protocolo, declaradas) |

**Fortaleza:** R-002 de la 042 prohíbe que un escenario use parámetros específicos para pasar —solo los mecanismos por defecto. Anti-tuning explícito.

**Salvedades para revisor:**
- Los rangos esperados son **cualitativos y ordinales** mientras no exista calibración cuantitativa (PA-122, declarado en 042 §1).
- V-6 **pasa justo**; el propio documento admite que la teoría de dos factores sola da persistencia moderada (PA-132).
- V-12: 20 pares (no 200) y medida al final del desarrollo, no tras un año (diferencia declarada).
- V-1…V-9 son [E] *por referencia a la literatura*, pero **25 menciones "referencia a verificar" permanecen en las specs** (recuento sobre `specs/*.md`). La teoría está citada, no aún verificada contra fuente en todos los casos.

### 2.2 Lo etiquetado [T]: teoría con fuente

Rescorla-Wagner (036 R-001), extinción contextual de Bouton (036 R-003), TMR/Hayes–Barnes-Holmes–Roche (037), pliance/tracking/augmenting (038), PNR y evitación experiencial según McHugh (039; fuente primaria en `docs/investigacion/mchugh-naturaleza-verbal-gozo-sufrimiento.pdf`). `docs/investigacion/referencias.md` documenta **49 marcadores bibliográficos: 33 verificados con DOI/metadatos, 11 canónicos sin enlace verificado, 5 sin fuente localizada**.

### 2.3 Lo etiquetado [M]: supuestos de diseño sin validar

Parámetros numéricos sin contraparte empírica: escalas de fuerza (`1,5·ln(w/0,46)`, ajustada empíricamente en MF3 desde `0,5·ln(w/0,25)`), `k ∈ [0,02; 2]`, tasas de variabilidad, profundidad de derivación 3, topes de almacén, densidades del desarrollo sintético, tabla de adherencia de 034. **Hoy la conducta del mundo es verosímil con validez interna alta y validez externa no establecida.**

---

## 3. Evidencia de validación del sistema completo

### 3.1 Determinismo y reproducibilidad (prerequisito de cualquier experimento)
- Motor sin `Math.random()`/`Date.now()`; RNG por flujos nombrados (spec 023); misma semilla → mismo `stateHash` bit a bit.
- Consecuencia metodológica: los experimentos A/B de fase 2 (028 R-001: brazos desde la misma instantánea) **eliminan la varianza de muestreo**; las diferencias entre brazos solo pueden deberse a la intervención (base de 034 CA-004).

### 3.2 Paridad con referencia externa (prototipo `prototipo/index.html`)
1 año × 100 personas × 3 semillas, perfil CO-2026.09 (`M2-anio-CO.md`, `MF3-anio-CO.md`, `MF5-anio-CO.md`):

| Métrica | Objetivo | Medido | Resultado |
|---|---|---|---|
| NaN / fuera de rango | 0 | 0 | ✔ |
| Ánimo medio | 0,46–0,62 | 0,439–0,477 | ✔ |
| Estrés medio | 0,25–0,41 | 0,264–0,280 | ✔ |
| Empleo 18–64 | 55–90 % | 69,2–88,1 % (3 semillas); **96,9 % en cierre M3** | ✔ / ✗ en M3 |
| Enfermedades agudas/año | 2–4 | 2,41–2,90 (M2); **1,49 en cierre M3** | ✔ / ✗ en M3 |
| Patrimonio p10/p50/p90 | informativo | p50 desviado del prototipo | sin criterio |

**Amenaza declarada:** el cierre de M3 (`M3-cierre.md`) reconoce empleo y enfermedad fuera de rango desde antes de M3 y arrastra la deuda. Los benchmarks deben leerse **por hito**, no como serie limpia.

### 3.3 Rendimiento y presupuesto
`MF8-bench-vida.md` / `M3-bench-vida.md`: 254 personas × 365 días en **270–411 s**; estado del motor funcional **10,4–16 KB/persona (≤ 20 KB ✔)**; heap 36 MB, RSS 392 MB (< 1 GB ✔). Deuda: **71 KB totales por persona frente al objetivo de 40** (peldaño 4) y **+43 % de coste tras M3**, con plan de recorte documentado.

### 3.4 Trazabilidad causal (T2)
- Causas asignadas al crear el evento; rechazo de causas futuras **por construcción** (019 R-002, testeado).
- Antes de 019: 89 % de los eventos citaban solo estados sin hecho detrás; la spec cierra ese hueco. `citizen:explain` devuelve la cadena completa en **20 de 20 conductas al azar** (035 CA-001).
- Revisión manual de 5 informes de vida (`M3-cierre.md`): comprensibles, **6 defectos de narrativa encontrados y corregidos** — validación humana documentada, no solo automatizada.

### 3.5 Separación verdad / creencia / memoria (requisito para intervención futura)
- Rumores: creencia falsa compartida por 7 personas, 18 correcciones; la verdad solo visible en análisis (`M3-creencias.md`).
- Memoria con reconstrucción y distorsión medible (`|valence − valence0|`).
- 034 INV-002 formalizada: ningún dato de la verdad que la persona no conoce entra en el contexto del LLM; comprobable comparando `PersonView` con el estado.

---

## 4. Deuda epistémica cuantificada

| Indicador | Valor | Fuente |
|---|---|---|
| Preguntas abiertas (PA-001…PA-152) | **76**: **74 `abierta`, 0 `resuelta`, 0 `en-estudio`** | recuento `docs/investigacion/preguntas-abiertas.md` |
| "referencia a verificar" en specs | **25** | recuento `specs/*.md` |
| Specs en borrador | **2** — y son justo las de la fase experimental: **028 (experimentos)** y **034 (sesiones clínicas)** | `specs/*.md` |
| Specs obsoletas por reorientación | 017 (decisión por utilidad) y 018 (aprendizaje), sustituidas por 040/036; migración con adaptador `@deprecated` y prueba de caducidad | ADR-007, `impacto-motor-funcional.md` |
| Parámetros `estimado` / `por_confirmar` | tablas de 009 (temperamento), 034 (adherencia/alianza), 040, 042 | specs |
| Revisión experta pendiente | PA-101/102 (Big Five→temperamento), PA-120/121 (episodios de desarrollo), PA-122 (rangos cuantitativos), tabla de adherencia clínica | 009, 041, 042, 034 |

**Lectura para revisor:** el registro de preguntas está contablemente al día pero funcionalmente sin empezar. Existe además una **desconexión entre `referencias.md` (que ya aporta DOI para varias PA, p. ej. PA-104 → Odum 2011) y el registro de preguntas**, que conviene cerrar antes de presentar el proyecto externamente.

---

## 5. Estado de la segunda fase (intervención psicológica): diseño vs. implementación

| Componente | Estado real | Evidencia |
|---|---|---|
| Selección por características emergentes (INV-001) | Especificada | 034 §6 |
| Sesión con LLM y `PersonView` como única entrada (INV-002) | Especificada; mecanismo **probado en miniatura** por la charla 043/044 (clasificador de tono, postura decidida por motor, verificador de afirmaciones) | 043, 044; bloque L completado 2026-09-27 |
| Memoria de sesión, tareas, adherencia como variable del motor (INV-003) | Especificada, no implementada | 034 §3 |
| Ramas contrafactuales con y sin intervención (CA-004) | **No implementada** — 028 en borrador (M5) | 028 |
| Evaluación longitudinal (visión §59: evolución, adherencia, recaídas, calidad de vida…) | Solo diseño | visión §59 |
| Prueba de concepto del circuito intervención→consecuencia | **Funcional en 044**: frase del visitante → `CHAT_CLAIM_BELIEVED` → intención (umbral 0,2) → llamada/confrontación → tensión de vínculo → evento encadenado hasta la frase. Guion «revelación sobre la pareja»: 4 de 4 personas con pareja actúan | `tasks/L-charla.md` L5.3b, L5.5 |

**Conclusión fase 2:** la arquitectura causal que la intervención necesita (determinismo, ramas, PersonView, causalidad reversible, memoria con origen `session`) está especificada y, en el caso de la charla, parcialmente ejecutada. Falta el protocolo clínico completo (agenda, sesiones, adherencia, brazos) y, metodológicamente previo, **M5 (experimentos A/B)**. La propia 034 §2 excluye diagnósticos clínicos validados y cualquier uso con pacientes reales: el alcance declarado es simulación sobre personas artificiales.

---

## 6. Amenazas a la validez (lista para revisor)

1. **Validez externa no establecida:** rangos ordinales propios, sin comparación cuantitativa con datos humanos (PA-122).
2. **25 referencias teóricas sin verificar** en specs; en `referencias.md`, 33/49 marcadores con DOI verificado.
3. **Efectos de calibración no aislados:** la paridad M3 sigue decisiones sucesivas; empleo y enfermedad fuera de rango con deuda arrastrada.
4. **Ajuste hacia la literatura:** V-4 se calibró subiendo la escala de la fuerza hasta alcanzar la pendiente 0,7 (documentado abiertamente), pero es ajuste, no predicción a priori.
5. **Desviaciones de protocolo declaradas** en V-6 y V-12.
6. **Sin reproducción independiente por tercero:** los mundos de ejemplo (≈24 MB) no se versionan; solo se regeneran con la semilla 482917.
7. **Validación visual/operativa humana pendiente:** 024 CA-001, CA-003, CA-013.
8. **Dos diferencias de fondo con el prototipo sin resolver** (escala del mapa ×5,6; 0,7 viajes/persona/día frente al prototipo), decisión pendiente que toca specs 003, 016, 011/017.

---

## 7. Veredicto para revisor

- **Como instrumento de investigación interna (validez interna): maduro.** Determinismo verificado, anti-tuning explícito en la batería, causalidad reversible por construcción, etiquetado epistémico por regla, validación humana documentada y registro abierto de la propia deuda (76 PA).
- **Como afirmación sobre conducta humana (validez externa): fase temprana.** 12 fenómenos cualitativos reproducidos; 0 calibraciones cuantitativas; 25 referencias sin verificar; 0 preguntas resueltas formalmente.
- **Como plataforma de experimentación con intervención psicológica (fase 2): prerequisitos parciales.** El motor de consecuencias de la intervención existe en pequeño (044) y el diseño clínico está completo en borrador (034); falta la infraestructura de ramas (028/M5) que haría comparables los brazos con y sin intervención.
- **Ruta crítica sugerida antes de una validación externa:**
  1. Cerrar M4 y su revisión pendiente (O7, P7).
  2. Resolver el orden M5↔M6 declarado en `docs/roadmap.md`.
  3. Implementar 028 y ejecutar el experimento-puerta del peldaño.
  4. Pasar las 74 PA a `en-estudio` cruzando con `referencias.md`.
  5. Iniciar calibración cuantitativa con expertos (PA-122; tabla de adherencia de 034; mapeo de temperamento PA-101).

---

*Informe generado el 2026-09-29 a partir de la lectura directa del repositorio. Todas las cifras proceden de los documentos citados; los recuentos (PA, referencias, estados de specs) se reproducen con `Select-String` sobre los archivos fuente.*

