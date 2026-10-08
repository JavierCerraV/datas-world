# Referencias verificadas de los marcadores "referencia a verificar"

Inventario de las **49 marcas** `referencia a verificar` repartidas entre los specs (`specs/009`, `035`–`038`, `040`, `042`, `043`) y `docs/investigacion/preguntas-abiertas.md`, con la fuente que respalda (o no) cada afirmación.

Nace del barrido de 2026-09-28 sobre el repositorio y se amplía con la pasada del 2026-10-07 (specs 028 y 046 y PA-153 a PA-156, al final). **No modifica los specs**: entrega la fuente, el estado y —donde falta— el plan concreto para cerrarla. Cuando el marcador se resuelve con un ajuste conceptual (p. ej. una regla que describe un mecanismo propio del motor y no una ley de la literatura), se dice explícitamente y se propone el reemplazo del texto.

## Leyenda

| Código | Significado |
|---|---|
| ✅ **E** | Resuelto con fuente empírica o revisión con metadatos comprobados contra Crossref, PubMed o el registro de publicaciones de ACBS (ISBN/DOI o ficha verificada). |
| 🟡 **T** | Cita canónica real y localizable, pero sus metadatos **no** se comprobaron en esta pasada (libro o capítulo antiguo, sin DOI): vale como anclaje teórico, hay que reconfirmarla antes de publicarla. |
| ⚠️ **M** | Sin fuente que respalde la afirmación tal como está redactada: o no se localizó, o el número concreto es decisión de diseño. Se deja plan de cierre. |

Etiquetas de tipo según la plantilla de specs: **[E]** empírico, **[T]** teórico, **[M]** supuesto del modelo.

## Resumen

| Archivo | Marcadores | ✅ | 🟡 | ⚠️ |
|---|---|---|---|---|
| `specs/009-temperament.md` | 5 | 2 | 3 | 0 |
| `specs/035-functional-engine.md` | 1 | 1 | 0 | 0 |
| `specs/036-stimulus-functions.md` | 7 | 4 | 2 | 1 |
| `specs/037-relational-network.md` | 2 | 2 | 0 | 0 |
| `specs/038-rules-values.md` | 1 | 1 | 0 | 0 |
| `specs/040-behavior-selection.md` | 2 | 2 | 0 | 0 |
| `specs/042-behavior-validation.md` | 8 | 7 | 1 | 0 |
| `specs/043-citizen-chat.md` | 2 | 0 | 2 | 0 |
| `docs/investigacion/preguntas-abiertas.md` | 21 | 14 | 3 | 4 |
| **Total** | **49** | **33** | **11** | **5** |

Los dos estados mixtos (filas 5 y 21, `✅ + ⚠️`) cuentan por su parte resuelta; la parte sin fuente aparece igualmente en §Sin fuente.

Tres notas de contexto:

- `specs/_plantilla.md:30` queda **fuera** del conteo: ahí se define la regla ("toda afirmación sin referencia va marcada"), no se pide una referencia.
- 5 marcadores ⚠️ se concentran en fenómenos donde la literatura existe pero no localizamos el artículo exacto (desplazamiento del pico, control contextual como variable independiente en RFT, modelos computacionales de RFT, señales de seguridad de Dinsmoor, celos por amenaza de estatus) o donde el número es calibración del motor.
- En `preguntas-abiertas.md`, 4 de los 21 marcadores (PA-132, PA-138, PA-139, PA-140) piden **magnitudes** (umbrales, tasas, pendientes). La literatura da la dirección del efecto, no el número: mientras no se cierren, los parámetros siguen siendo `[M]` calibrables con la batería de validación.

## Cómo leer la tabla maestra

`Fuente` usa identificadores cortos (R1…R47) desarrollados en §Referencias, donde está la cita completa con DOI o enlace. `Verif.` indica cómo se comprobó: **CR** = Crossref, **PU** = PubMed, **AC** = registro de publicaciones de ACBS, **DL** = PDF o ficha enlazada, **—** = sin comprobar en esta pasada.

---

## Tabla maestra (1/2): specs

| # | Archivo:línea | Qué pide el marcador | Estado | Fuente | Verif. |
|---|---|---|---|---|---|
| 1 | `009:74` | Sensibilidad al castigo (Gray, RST) como base de `tmp.aversiveSensitivity` | 🟡 | R14, R9 | — |
| 2 | `009:75` | Sensibilidad a la recompensa (RST) como base de `tmp.appetitiveSensitivity` | 🟡 | R14, R9 | — |
| 3 | `009:76` | Reactividad y nivel basal de activación (Rothbart) | 🟡 | R38, R14 | — |
| 4 | `009:78` | Búsqueda de novedad | ✅ | R10, R44 | CR |
| 5 | `009:80` | La variabilidad es operante **[E]**; su valor inicial **[M]** | ✅ + ⚠️ | R30; el valor inicial queda sin fuente | CR |
| 6 | `035:179` | Las necesidades como operaciones motivadoras | ✅ | R27 | PU |
| 7 | `036:46` | Actualización tipo Rescorla-Wagner (R-001) | 🟡 | R37 | — |
| 8 | `036:56` | Renovación al cambiar de contexto (Bouton) | ✅ | R42, R8 | CR, DL |
| 9 | `036:59` | `σ` inicial del gradiente (Guttman y Kalish) | ✅ | R20 | CR |
| 10 | `036:60` | Desplazamiento del pico tras discriminación diferencial (R-005) | ⚠️ | R41 (parcial) | — |
| 11 | `036:65` | Descuento hiperbólico `V = A/(1+k·D)` (Mazur) | 🟡 | R25 | — |
| 12 | `036:68` | Operaciones motivadoras (Michael) (R-010) | ✅ | R27 | PU |
| 13 | `036:75` | Variabilidad que sube y baja con sus consecuencias (R-012) | ✅ | R30, R31 | CR |
| 14 | `037:76` | Marco MDML de Barnes-Holmes y colaboradores (R-008) | ✅ | R3 | AC |
| 15 | `037:103` | Transformación de función por comparación (CA-002, Dougher) | ✅ | R15, R11, R2 | CR |
| 16 | `038:50` | Insensibilidad a las contingencias en conducta regla-gobernada | ✅ | R24, R16, R18 | CR |
| 17 | `040:46` | Igualación generalizada (Baum) (R-004) | ✅ | R7 | CR |
| 18 | `040:47` | Ley de igualación y subigualación (Herrnstein) (R-005) | ✅ | R19, R7 | CR |
| 19 | `042:29` | V-1: adquisición negativamente acelerada y extinción monotónica | 🟡 | R37 (adquisición); R8, R42 (extinción) | — |
| 20 | `042:30` | V-2: recuperación espontánea y renovación (Bouton) | ✅ | R42, R8 | CR, DL |
| 21 | `042:31` | V-3: gradiente unimodal (Guttman y Kalish) + desplazamiento del pico | ✅ + ⚠️ | R20; el pico queda abierto (R41) | CR |
| 22 | `042:32` | V-4: pendiente de subigualación 0,7–1,0 (Herrnstein, Baum) | ✅ | R19, R7 | CR |
| 23 | `042:33` | V-5: descuento hiperbólico e inversión (Ainslie, Mazur) | ✅ | R1, R25 | CR |
| 24 | `042:34` | V-6: persistencia de la evitación (Solomon y Wynne) | ✅ | R40, R43 | DL |
| 25 | `042:36` | V-8: transformación por comparación (Dougher et al.) | ✅ | R15, R11, R2 | CR |
| 26 | `042:37` | V-9: insensibilidad por reglas (Shimoff, Catania y Matthews) | ✅ | R24, R16, R18 | CR |
| 27 | `043:177` | Adquisición de función del visitante por emparejamiento (R-006) | 🟡 | R37 (por 036 R-001) | — |
| 28 | `043:178` | Reforzamiento negativo proporcional a `escape × carga` (R-007) | 🟡 | R29, R39 (fenómeno); la **forma** sigue siendo [M] | — |


## Tabla maestra (2/2): `docs/investigacion/preguntas-abiertas.md`

| # | Línea | Pregunta | Estado | Fuente | Verif. |
|---|---|---|---|---|---|
| 29 | 20 | PA-004 — extinción como memoria inhibitoria contextual | ✅ | R42, R8 | CR, DL |
| 30 | 23 | PA-007 — control contextual separado de relación y función (TMR) | ⚠️ | R3, R4 rozan el tema; no hay fuente que separe Crel de Cfunc | CR, AC |
| 31 | 28 | PA-012 — discriminación contextual / ocasionadores | ✅ | R21, R22, R28 | CR |
| 32 | 30 | PA-014 — sobregeneralización del miedo tras experiencias aversivas | ✅ | R13 (meta-análisis); R23 como antecedente | CR |
| 33 | 31 | PA-015 — momento conductual y persistencia | ✅ | R32 | CR |
| 34 | 34 | PA-018 — variabilidad operante | ✅ | R30 | CR |
| 35 | 37 | PA-021 — insensibilidad a las contingencias | ✅ | R24, R16, R18 | CR |
| 36 | 39 | PA-023 — reforzamiento negativo y evitación (bifactorial y alternativas) | 🟡 | R29 (bifactorial); R43, R40 (paradoja de la evitación) | DL |
| 37 | 42 | PA-026 — generalización de la evitación por relaciones derivadas | ✅ | R15, R18 | CR |
| 38 | 46 | PA-030 — marcos deícticos y toma de perspectiva | ✅ | R26, R6 | AC |
| 39 | 48 | PA-032 — modelos computacionales de TMR | ⚠️ | sin fuente localizada | — |
| 40 | 52 | PA-036 — self como contexto (TMR y ACT) | ✅ | R5, R4 | CR, AC |
| 41 | 61 | PA-101 — parámetros temperamentales y su relación con Big Five | ✅ | R36 (estabilidad rank-order); R14, R38, R10 como marcos | CR |
| 42 | 64 | PA-104 — cómo cambia la pendiente del descuento con la historia | ✅ | R33 (¿variable de rasgo?), R34 | CR |
| 43 | 65 | PA-105 — cómo se aprende la variabilidad | ✅ | R30, R31 | CR |
| 44 | 70 | PA-111 — medir coherencia, complejidad, derivación y flexibilidad | ✅ | R3 (dimensiones y niveles), R35 | AC, CR |
| 45 | 71 | PA-112 — distinguir pliance de tracking | ✅ | R17; R44 como origen conceptual | CR |
| 46 | 84 | PA-132 — qué sostiene la evitación cientos de ensayos (señales de seguridad) | ⚠️ | "Dinsmoor" sin resolver; R42 apunta a la alternativa (conducta orientada a señales / hábito) | CR |
| 47 | 90 | PA-138 — cuánto se cree la persona lo que le dice un desconocido | 🟡 | R46 (sesgo de verdad); magnitud sigue [M] | — |
| 48 | 91 | PA-139 — umbral de acción ante una revelación y estrés resultante | ⚠️ | sin fuente localizada; umbrales [M] | — |
| 49 | 92 | PA-140 — recuperación de la tensión tras un conflicto de pareja | 🟡 | R47 como candidato; tope 0,3 y decaimiento 0,05/día son [M] | — |

---

## Qué cambiar en los specs

Regla general: donde el texto dice `(X; referencia a verificar)`, basta con dejar la cita corta y quitar el marcador, p. ej. `(Guttman y Kalish, 1956)`. Si la fuente queda en 🟡 o ⚠️, el marcador se queda pero conviene precisar qué falta (metadatos vs. la afirmación entera).

Seis casos que no se resuelven con copiar y pegar:

| Archivo:línea | Situación | Qué hacer |
|---|---|---|
| `038:50` y `042:37` | La atribución "(Shimoff, Catania y Matthews)" no aparece con ese orden de autores en el trabajo verificable del grupo | Poner **(Matthews, Shimoff y Catania, 1987)** — es el artículo con metadatos confirmados (R24) — y citar además Hayes et al. (1986) y la revisión de Harte y colaboradores (2021) |
| `036:60` y `042:31` (desplazamiento del pico) | No se localizó el artículo con metadatos: R41 (Terrace, 1966) aparece como capítulo en el listado de referencias de Herrnstein (1970) vía Crossref, pero faltan título y datos completos | Mantener el marcador y bajar la etiqueta a **[E] fenómeno clásico, fuente pendiente**; o apoyarse en R20 para la parte del gradiente y tratar el desplazamiento del pico como predicción del motor |
| `037:76` y `PA-111` (MDML) | El marco existe y está verificado (R3), pero sus 20 unidades de análisis (4 dimensiones × 5 niveles) no vienen con métricas para un grafo | Citar R3 y dejar explícito que las definiciones operativas de `037 R-008` son **[M]** del motor (ver PA-111 en §Sin fuente) |
| `043:178` | La existencia del reforzamiento negativo es clásica (R29, R39); la forma `escape × carga` no está en ninguna parte | Dejar **[E] fenómeno / [M] forma** y decir que la forma es decisión de diseño calibrada en la batería |
| `009:80` | Que la variabilidad sea operante sí tiene respaldo (R30); el *valor inicial* temperamental no tiene literatura | Conservar las dos etiquetas: `[E]` con R30 y `[M]` para `tmp.variability0`, justificado como parámetro de calibración |
| `036:65` (Mazur) | La fórmula es correcta y estándar, pero el capítulo de 1987 no tiene DOI en Crossref | Citar como 🟡: el libro es *Quantitative Analyses of Behavior, Vol. 5* (Erlbaum); si se necesita un enlace, usar R33/R34 como literatura con DOI que usa la misma forma hiperbólica |

---

## Referencias

Formato APA simplificado. `Verif.` = cómo se comprobaron los metadatos en la pasada del 2026-09-28: **CR** Crossref, **PU** PubMed, **AC** registro de publicaciones de ACBS, **DL** documento enlazado.

### A. Igualación, elección y ley del efecto

- **R1** Ainslie, G. (1975). Specious reward: A behavioral theory of impulsiveness and impulse control. *Psychological Bulletin, 82*(4), 463–496. https://doi.org/10.1037/h0076860 — Verif. CR. Base de la inversión de preferencia (V-5).
- **R7** Baum, W. M. (1974). On two types of deviation from the matching law: Bias and undermatching. *Journal of the Experimental Analysis of Behavior, 22*(1), 231–242. https://doi.org/10.1901/jeab.1974.22-231 — Verif. CR (también PMC1333261). Sustenta la igualación generalizada con exponente < 1 (`040 R-004`, V-4).
- **R19** Herrnstein, R. J. (1970). On the law of effect. *Journal of the Experimental Analysis of Behavior, 13*(2), 243–266. https://doi.org/10.1901/jeab.1970.13-243 — Verif. CR. Ley de igualación; el resumen del propio artículo anticipa contraste y monotonicía además de igualación.

### B. Funciones respondientes, generalización, discriminación y extinción

- **R20** Guttman, N., & Kalish, H. I. (1956). Discriminability and stimulus generalization. *Journal of Experimental Psychology, 51*(1), 79–88. https://doi.org/10.1037/h0046219 — Verif. CR. Gradiente unimodal decreciente: `σ` inicial (`036:59`) y V-3.
- **R37** Rescorla, R. A., & Wagner, A. R. (1972). A theory of Pavlovian conditioning: Variations in the effectiveness of reinforcement and nonreinforcement. En A. H. Black & W. F. Prokasy (Eds.), *Classical conditioning II: Current research and theory* (pp. 64–99). Appleton-Century-Crofts. — Verif. — (capítulo de libro sin registro en Crossref). Forma de la actualización (`036 R-001`, `042 V-1`, `043:177`).
- **R41** Terrace, H. S. (1966). [Capítulo sobre control del estímulo y discriminación], en W. K. Honig (Ed.), *Operant behavior: Areas of research and application* (p. 271 y ss.). Appleton-Century-Crofts. — Verif. — (solo se confirmó la entrada: autor, año, libro y página inicial, en el listado de referencias de R19 vía Crossref). Candidato para el desplazamiento del pico.
- **R8** Bouton, M. E. (2004). Context and behavioral processes in extinction. *Learning & Memory, 11*(4), 485–494. PDF del laboratorio: https://www.boutonlab.org/ — Verif. DL. Extinción como aprendizaje inhibitoria contextual (`036:56`, `042 V-2`, PA-004).
- **R42** Thrailkill, E. A., & Bouton, M. E. (2015). Extinction of chained instrumental behaviors: Effects of consumption extinction on procurement responding. *Learning & Behavior, 44*(1), 85–96. https://doi.org/10.3758/s13420-015-0193-y — Verif. CR. Versión reciente y con DOI del programa de extinción/recuperación de Bouton.
- **R21** Holland, P. C. (1992). Occasion setting in Pavlovian conditioning. *Psychology of Learning and Motivation, 28*, 219–255. https://doi.org/10.1016/S0079-7421(08)60488-0 — Verif. CR. PA-012 (cómo dos contextos se vuelven funcionalmente distintos).
- **R22** Holland, P. C. (1998). Temporal control in Pavlovian occasion setting. *Behavioural Processes, 43*(3), 265–276. https://doi.org/10.1016/S0376-6357(98)00051-5 — Verif. CR.
- **R28** Miller, R. R., & Oberling, P. (1998). Analogies between occasion setting and Pavlovian conditioning. En S. J. Reilly & R. R. Miller (Eds.), *Occasion setting: Associative learning and cognition in animals* (pp. 3–36). Erlbaum. https://doi.org/10.1037/10298-001 — Verif. CR.

### C. Motivación, descuento y variabilidad

- **R27** Michael, J. (1993). Establishing operations. *The Behavior Analyst, 16*(2), 191–206. https://pmc.ncbi.nlm.nih.gov/articles/PMC2733648/ · https://doi.org/10.1007/BF03392623 — Verif. PU/CR. Las necesidades como operaciones establecedoras (`035:179`, `036 R-010`).
- **R25** Mazur, J. E. (1987). An adjusting procedure for studying delayed reinforcement. En M. L. Commons, J. E. Mazur, J. A. Logue & H. Rachlin (Eds.), *Quantitative analyses of behavior, Vol. 5: The effect of delay and intervening events on reinforcement value* (pp. 55–73). Erlbaum. — Verif. — (capítulo sin DOI; el volumen está digitalizado con ISBN 978-1-315-82550-2). `V = A/(1+k·D)` (`036:65`, V-5).
- **R34** Odum, A. L., & Rainaud, C. P. (2003). Discounting of delayed hypothetical money, alcohol, and food. *Behavioural Processes, 64*(3), 305–313. https://doi.org/10.1016/S0376-6357(03)00145-1 — Verif. CR. Curvas de descuento empíricas con la forma hiperbólica.
- **R33** Odum, A. L. (2011). Delay discounting: Trait variable? *Behavioural Processes, 87*(1), 1–9. https://doi.org/10.1016/j.beproc.2011.02.007 — Verif. CR. Discute si `k` es rasgo estable o modificable por historia: la referencia directa de PA-104.
- **R30** Neuringer, A. (2002). Operant variability: Evidence, functions, and theory. *Psychonomic Bulletin & Review, 9*(4), 672–705. https://doi.org/10.3758/BF03196324 — Verif. CR. La variabilidad es una propiedad de la respuesta sostenida por contingencias (`009:80`, `036:75`, PA-018, PA-105).
- **R31** Neuringer, A. (2012). Reinforcement and induction of operant variability. *The Behavior Analyst*. — Verif. — (🟡: la pasada anterior le asignó un DOI y en esta pasada salieron datos de volumen y páginas distintos; confirmar antes de citarlo).
- **R32** Nevin, J. A., & Grace, R. C. (2000). Behavioral momentum and the Law of Effect. *Behavioral and Brain Sciences, 23*(1), 73–90. https://doi.org/10.1017/S0140525X00002405 — Verif. CR. Persistencia frente a perturbación = momento conductual (PA-015).

### D. Evitación, miedo y ansiedad

- **R40** Solomon, H. C., & Wynne, L. C. (1953). Trajectory and magnitude of the avoidance response: The role of avoidance in neurotic behavior. *Psychiatry, 16*(3), 303–328 (continuación en 16(4), 403–428). — Verif. DL (número archivado en línea). Origen de la evitación que persiste sin castigo (`042 V-6`, PA-023).
- **R43** Revisión de la "paradoja neurótica": por qué la evitación se mantiene sin castigo y qué alternativas al modelo bifactorial se han propuesto. *Behaviour Research and Therapy*, PII S0005796796000665. https://www.sciencedirect.com/science/article/abs/pii/S0005796796000665 — Verif. DL (enlace confirmado; autores y año sin resolver en esta pasada).
- **R29** Mowrer, O. H. (1947/1960). Explicación bifactorial del aprendizaje de la ansiedad y la evitación; O. H. Mowrer, *Learning behavior and personality*. Ronald Press. — Verif. — (reconfirmar la cita exacta de 1947 antes de publicarla).
- **R39** Skinner, B. F. (1953). *Science and human behavior*. Macmillan. — Verif. CR indirecta (figura como referencia de R19 en el registro Crossref de ese artículo). Marco general del reforzamiento negativo y el escape (`043:178`).
- **R13** Fraunfelter, L., Gerdes, A. B. M., & Alpers, G. W. (2022). Fear one, fear them all: A systematic review and meta-analysis of fear generalization in pathological anxiety. *Neuroscience & Biobehavioral Reviews, 139*, 104707. https://doi.org/10.1016/j.neubiorev.2022.104707 — Verif. CR. Sobregeneralización del miedo (PA-014).
- **R23** Lommen, M. J. J., Panhuysen, I. M., Vuitak, E.-M., & Field, A. P. (2013). Generalization of fear and anxiety: A review and preliminary model. *Behaviour Research and Therapy*. — Verif. — (localizado por título; metadatos completos pendientes).

### E. TMR: reglas, funciones derivadas, MDML y self

- **R3** Barnes-Holmes, D., Barnes-Holmes, Y., Luciano, C., & McEnteggart, C. (2017). From the IRAP and REC model to a multi-dimensional multi-level framework for analyzing the dynamics of arbitrarily applicable relational responding. *Journal of Contextual Behavioral Science, 6*(4), 434–445. https://doi.org/10.1016/j.jcbs.2017.08.001 — Verif. AC. **El MDML**: 4 dimensiones (coherencia, complejidad, derivación, flexibilidad) × 5 niveles (implicación mutua, enmarcado relacional, redes relacionales, relacionar relaciones, relacionar redes) = 20 unidades FAARQ. Resuelve `037 R-008` y el marco de PA-111.
- **R4** Barnes-Holmes, D., Barnes-Holmes, Y., Hayes, S. C., & McHugh, L. (2004). Relational frame theory: Some implications for understanding and treating human psychopathology. *International Journal of Psychology and Psychological Therapy, 4*(3), 355–375. — Verif. AC.
- **R5** Barnes-Holmes, Y., Barnes-Holmes, D., & Hayes, S. C. (2001). Self and self-directed rules. En S. C. Hayes, D. Barnes-Holmes & Y. Roche (Eds.), *Relational frame theory: A post-Skinnerian account of human language and cognition* (pp. 119–139). Springer. https://doi.org/10.1007/0-306-47638-x_7 — Verif. CR (pasada anterior). PA-036.
- **R6** Barnes-Holmes, Y., McHugh, L., & Barnes-Holmes, D. (2004). Perspective-taking and theory of mind: A relational frame account. *The Behavior Analyst Today, 5*(1), 15–25. — Verif. AC. PA-030.
- **R26** McHugh, L., Barnes-Holmes, Y., & Barnes-Holmes, D. (2004). Perspective-taking as relational responding: A developmental profile. *The Psychological Record, 54*(1), 115–144. — Verif. AC. PA-030: entrenamiento deíctico con perfil evolutivo.
- **R24** Matthews, B. A., Shimoff, E., & Catania, A. C. (1987). Saying and doing: A contingency-space analysis. *Journal of Applied Behavior Analysis, 20*(1), 69–74. https://doi.org/10.1901/jaba.1987.20-69 — Verif. CR. Regla frente a consecuencias (`038:50`, `042 V-9`, PA-021).
- **R16** Hayes, S. C., Brownstein, A. J., Zettle, R. D., Rosenfarb, I., & Korn, Z. (1986). Rule-governed behavior and sensitivity to changing consequences of responding. *Journal of the Experimental Analysis of Behavior, 45*(2), 237–256. https://pmc.ncbi.nlm.nih.gov/articles/PMC1348236/ — Verif. PU/DL.
- **R18** Harte, C., Barnes-Holmes, D., Barnes-Holmes, Y., & Kissi, A. (2021). The study of rule-governed behavior and derived stimulus relations: Bridging the gap. *Perspectives on Behavior Science, 44*(2), 361–385. https://doi.org/10.1007/s40614-020-00256-w — Verif. CR. Revisión puente entre reglas y relaciones derivadas: sirve a PA-021 y PA-026.
- **R17** Harte, C., & Barnes-Holmes, D. (2021). The status of rule-governed behavior as pliance, tracking and augmenting within relational frame theory: Middle-level rather than technical terms. *The Psychological Record, 72*, 145–158. https://doi.org/10.1007/s40732-021-00458-x — Verif. CR (pasada anterior). PA-112.
- **R44** Zettle, R. D., & Hayes, S. C. (1982). Rule-governed behavior: A potential theoretical framework for cognitive-behavioral therapy. En P. A. Grand (Ed.), *Prevention and treatment of emotional disorders* (pp. 73–91). Plenum. — Verif. — (🟡: origen de pliance/tracking).
- **R15** Greenway, D. E., Dougher, M. J., & Wulfert, E. (1996). Transfer of consequential functions via stimulus equivalence: Generalization to different testing contexts. *The Psychological Record, 46*(1), 131–143. https://doi.org/10.1007/BF03395167 — Verif. CR. Transformación de función **y** generalización a otro contexto: encaja con `037 CA-002`, `042 V-8` y PA-026.
- **R11** Dougher, M. J. (1998). Stimulus equivalence and the untrained acquisition of stimulus functions. *Behavior Therapy, 29*(4), 577–591. https://doi.org/10.1016/S0005-7894(98)80018-X — Verif. CR.
- **R2** Augustson, E. M., Dougher, M. J., & Markham, M. R. (2000). Emergence of conditional stimulus relations and transfer of respondent eliciting functions among compound stimuli. *The Psychological Record, 50*(4), 745–770. https://doi.org/10.1007/BF03395381 — Verif. CR.
- **R12** Dougher, M. J., Augustson, E. M., Markham, M. R., Greenway, D. E., & Wulfert, E. (1995). Transfer of aversive consequential function across derived associations. *The Psychological Record*. — Verif. — (🟡: es el "Dougher et al." que citan las specs; reconfirmar volumen y páginas).
- **R35** Pérez, W. F. (2023). Skinner and relational frame theory: Integrating units of analysis on a continuum of complexity. *The Psychological Record, 74*, 349–366. https://doi.org/10.1007/s40732-023-00559-9 — Verif. CR. Complejidad como continuo: apoyo de `037 R-008` / PA-111.

### F. Temperamento y personalidad

- **R14** Gray, J. A. (1982). *The neuropsychology of anxiety*. Oxford University Press; y Gray, J. A., & McNaughton, N. (2000). *The neuropsychology of anxiety* (2.ª ed.). Oxford University Press. — Verif. — (libros sin DOI). Base del BIS/BAS que usan `009:74-75`.
- **R9** Carver, C. S., & White, T. L. (1994). Behavioral inhibition, behavioral activation, and affective response to impending reward and punishment: The BIS/BAS Scales. *Journal of Personality and Social Psychology, 66*(2), 319–333. https://doi.org/10.1037/0022-3514.66.2.319 — Verif. — (🟡: DOI escrito según la convención de APA; reconfirmar).
- **R38** Rothbart, M. K., & Bates, J. E. (1998). Temperament. En W. Damon & N. Eisenberg (Eds.), *Handbook of child psychology, Vol. 3: Social, emotional, and personality development* (5.ª ed., pp. 105–176). Wiley. — Verif. — (🟡). Reactividad y esfuerzo ejecutivo (`009:76`).
- **R10** Cloninger, C. R., Svrakic, D. M., & Przybeck, T. R. (1987). A systematic method for clinical description and classification of personality variants. *Archives of General Psychiatry, 44*(6), 573–588. https://doi.org/10.1001/archpsyc.1987.01800180093014 — Verif. CR. Búsqueda de novedad (`009:78`); distinguir de *sensation seeking* de Zuckerman (R45).
- **R45** Zuckerman, M. (1994). *Behavioral expressions and biosocial bases of sensation seeking*. Cambridge University Press. — Verif. — (🟡).
- **R36** Roberts, B. W., & DelVecchio, W. F. (2000). The rank-order consistency of personality traits from childhood to old age. *Psychological Bulletin, 126*(1), 3–25. https://doi.org/10.1037/0033-2909.126.1.3 — Verif. CR (pasada anterior). Justifica que el temperamento sea estable con ruido residual (`009`, PA-101).

### G. Credibilidad y parejas

- **R46** Jones, E. E., & McGraw, W. P. (1976). Interpersonal communication and attribution processes: An essay and introduction. En J. H. Harvey, W. Ickes & R. F. Kidd (Eds.), *New directions in attribution research, Vol. 1* (pp. 331–356). Erlbaum. — Verif. — (🟡: fuente clásica del sesgo de verdad; falta el meta-análisis moderno para la magnitud).
- **R47** Gottman, J. M., y colaboradores. Estudios sobre interacción, tensión y reparaciones en pareja (*Journal of Family Psychology* / *Journal of Consulting and Clinical Psychology*, 1992-1999). — Verif. — (candidato sin resolver en esta pasada: sirve como línea de búsqueda, no como cita).

## Sin fuente: qué falta y cómo cerrarlo

| # | Marcador | Por qué queda abierto | Plan concreto |
|---|---|---|---|
| 5 | `009:80` (valor inicial de `hist.variability`) | La literatura muestra que la variabilidad se modula por contingencias, no que nazca de un valor temperamental | Buscar en PubMed/PsycINFO "response variability" + "individual differences" + "reinforcer frequency"; si nada, documentar `tmp.variability0` como parámetro de calibración y cerrar con la batería |
| 10 / 21 | `036:60`, `042:31` (desplazamiento del pico) | El fenómeno es clásico pero no se resolvió el artículo original | La búsqueda `peak shift + generalization gradient + discrimination` en PubMed devolvió 33 registros (2026-09-28; PMIDs 32333107, 32043269, 30803341, 30216359, 29553769): leer el más reciente y retroceder por sus referencias hasta R41. Criterio de cierre: gradiente medido tras entrenamiento con S+ y S− con el pico fuera de S+ |
| 30 | PA-007 (Crel y Cfunc como controles separables) | Ni R3 ni R4 afirman la separación que usa `037 R-004/R-005` | Buscar en JOCS y *The Psychological Record*: "contextual control" + "relational frame theory", "function-al context", "contextual control of derived relations". Si no aparece, presentar la separación como **aporte del motor** ([M]) y no como respaldo de literatura |
| 39 | PA-032 (modelos computacionales de TMR) | No se localizó ningún modelo de referencia | Buscar "derived relational responding" + "computational model" / "connectionist" / "agent-based" en PsycINFO y Scopus, y revisar JOCS. Criterio: al menos un modelo público con código o especificación reutilizable |
| 46 | PA-132 (señales de seguridad de Dinsmoor) | La atribución "Dinsmoor" no se resolvió con autor-año-título | PsycINFO, autor Dinsmoor, J. A., 1977-2004, términos "avoidance", "safety", "response-produced cues". Alternativa ya verificada: la evitación se sostiene por conducta orientada a señales y hábito (R42) o por la función discriminativa del aviso (R43). Decidir en MF3 |
| 48 | PA-139 (celos y traición percibida) | Sin fuente localizada para el umbral de acción ni el estrés residual | Buscar "betrayal" + "jealousy" (Buss, Shackelford), "betrayal trauma" (Freyd), "relationship intrusion". Criterio: magnitud empírica de la reacción ante una revelación; en su defecto, revisión experta |

Parámetros que **se quedan en [M] a sabiendas** porque la literatura no da el número, solo la dirección del efecto: `tmp.variability0`; `discounting.k_plasticity` (PA-104, con R33 como discusión del tema); la base de credibilidad 0,4 (PA-138); el tope 0,3 y el decaimiento 0,05/día (PA-140); la forma `escape × carga` (`043:178`); y las métricas de grafo para el MDML (PA-111, con R3 como marco y R35 como discusión de la complejidad). Su cierre es calibración con `docs/validaciones/batería-conductual.md` y revisión experta, no más bibliografía.

## Pasada del 2026-10-07: specs 028 y 046 y PA-153 a PA-156

Las cuatro preguntas abiertas que nacieron después del barrido del 2026-09-28 (PA-153 a PA-156) y las fuentes de las specs 028 (experimentos) y 046 (batería psicométrica), con el mismo criterio: solo se escribe un DOI que se resolvió y devolvió el título esperado, y se comprobaron metadatos, no textos completos.

| Marcador | Qué pide | Estado | Fuente | Verif. |
|---|---|---|---|---|
| PA-153 — edad desde la que un menor sale solo | Normas y datos de autonomía infantil (ICBF, ENUT) y desarrollo | ⚠️ | R67 y R68 dan la dirección (la libertad de movimiento de los niños depende de la edad y de la norma de los padres y varía entre países), no los umbrales; no se localizó la fuente colombiana (ICBF, ENUT). Los umbrales 12, 20:00 y 2 h siguen [M] | CR |
| PA-154 — crecimiento de la confianza hacia un desconocido y qué se cuenta en cada nivel | Psicología social de la autorrevelación | ✅ + 🟡 | R61 (metaanálisis: lo que uno cuenta y cuánto agrada quien lo cuenta, con reciprocidad); R62 como teoría de la penetración social (🟡). Los incrementos por turno y los niveles 0,25 y 0,6 son [M] | CR |
| PA-155 — pesos de los ítems y frecuencia de respuestas no fieles | Estructura factorial en población colombiana; deseabilidad social | ✅ + ⚠️ | Las seis pruebas y sus validaciones colombianas: R48 a R58 (R56 y R52 en 🟡). Deseabilidad social y sobreinforme: R59 y R60. Los **pesos** de la 046 §4 bis y las probabilidades de minimizar, exagerar y mentir siguen sin fuente que dé el número: [M] | CR, DL |
| PA-156 — interferencia entre tratados y controles | Inferencia causal con interferencia | ✅ | R63 y R64 (marcos formales de efectos con interferencia); el MVP evita el problema con brazos en mundos separados | CR |
| 028 R-005 — azar común por semilla | Variables aleatorias comunes en simulación | ✅ | R66 | CR |
| 028 R-008 — intervalo por *bootstrap* | Remuestreo | ✅ | R65 | CR |

Para **cerrar** lo que sigue en ⚠️: PA-153, buscar la *Encuesta Nacional de Uso del Tiempo* del DANE y los lineamientos del ICBF sobre cuidado y supervisión de niños en Colombia, y compararlos con estudios de movilidad independiente por edad (criterio: una edad y una franja horaria con fuente); PA-155, datos con las seis pruebas en una misma muestra colombiana para estimar cargas factoriales y correlaciones entre ellas (criterio: poder comparar las correlaciones de la batería con las humanas; ver `docs/validaciones/bateria-psicometrica.md`).

### H. Medición psicométrica (spec 046)

- **R48** Bond, F. W., Hayes, S. C., Baer, R. A., Carpenter, K. M., Guenole, N., Orcutt, H. K., … Zettle, R. D. (2011). Preliminary psychometric properties of the Acceptance and Action Questionnaire–II: A revised measure of psychological inflexibility and experiential avoidance. *Behavior Therapy, 42*(4), 676–688. https://doi.org/10.1016/j.beth.2011.03.007 — Verif. CR, DL (ficha del ClinikLab).
- **R49** Ruiz, F. J., Langer, A. I., Luciano, C., Cangas, A. J., & Beltrán, I. (2013). Measuring experiential avoidance and psychological inflexibility: The Spanish translation of the Acceptance and Action Questionnaire – II. *Psicothema, 25*(1), 123–129. https://doi.org/10.7334/psicothema2011.239 — Verif. CR, DL.
- **R50** Ruiz, F. J., Suárez-Falcón, J. C., Cárdenas-Sierra, S., Durán, Y. A., Guerrero, K., & Riaño-Hernández, D. (2016). Psychometric properties of the Acceptance and Action Questionnaire – II in Colombia. *The Psychological Record, 66*, 429–437. https://doi.org/10.1007/s40732-016-0183-2 — Verif. CR, DL.
- **R51** Ruiz, F. J., García-Beltrán, D. M., & Suárez-Falcón, J. C. (2017). General Health Questionnaire-12 validity in Colombia and factorial equivalence between clinical and nonclinical participants. *Psychiatry Research, 256*, 53–58. https://doi.org/10.1016/j.psychres.2017.06.020 — Verif. CR, DL.
- **R52** Goldberg, D., & Williams, P. (1988). *A user's guide to the General Health Questionnaire*. NFER-Nelson. — Verif. DL (ficha) — (🟡).
- **R53** Ruiz, F. J., Suárez-Falcón, J. C., Barbero-Rubio, A., & Flórez, C. L. (2019). Development and initial validation of the Generalized Pliance Questionnaire. *Journal of Contextual Behavioral Science, 12*, 189–198. https://doi.org/10.1016/j.jcbs.2018.03.003 — Verif. CR, DL. Base del GPQ-9, el *pliance* generalizado (R17 y R44 como origen conceptual).
- **R54** Ruiz, F. J., García-Martín, M. B., Suárez-Falcón, J. C., Bedoya-Valderrama, L., Segura-Vargas, M. A., Peña-Vargas, A., … Ávila-Campos, J. E. (2020). Development and initial validation of the Generalized Tracking Questionnaire. *PLOS ONE, 15*, e0234393. https://doi.org/10.1371/journal.pone.0234393 — Verif. CR, DL.
- **R55** Antony, M. M., Bieling, P. J., Cox, B. J., Enns, M. W., & Swinson, R. P. (1998). Psychometric properties of the 42-item and 21-item versions of the Depression Anxiety Stress Scales in clinical groups and a community sample. *Psychological Assessment, 10*(2), 176–181. https://doi.org/10.1037/1040-3590.10.2.176 — Verif. CR, DL.
- **R56** Ruiz, F. J., García-Martín, M. B., Suárez-Falcón, J. C., & Odriozola-González, P. (2017). The hierarchical factor structure of the Spanish version of Depression Anxiety and Stress Scale-21. *International Journal of Psychology and Psychological Therapy, 17*, 97–105. — Verif. DL (ficha); no se localizó en Crossref (la revista no devuelve DOI) — (🟡).
- **R57** Diener, E., Emmons, R. A., Larsen, R. J., & Griffin, S. (1985). The Satisfaction With Life Scale. *Journal of Personality Assessment, 49*(1), 71–75. https://doi.org/10.1207/s15327752jpa4901_13 — Verif. CR (resolución directa del DOI), DL.
- **R58** Ruiz, F. J., Suárez-Falcón, J. C., Flórez, C. L., Odriozola-González, P., Tovar, D., López-González, S., & Baeza-Martín, R. (2019). Validity of the Satisfaction with Life Scale in Colombia and factorial equivalence with Spanish data. *Revista Latinoamericana de Psicología, 51*(2), 58–65. https://doi.org/10.14349/rlp.2019.v51.n2.1 — Verif. CR, DL.
- **R59** Paulhus, D. L. (1984). Two-component models of socially desirable responding. *Journal of Personality and Social Psychology, 46*(3), 598–609. https://doi.org/10.1037/0022-3514.46.3.598 — Verif. CR. Autoengaño frente a manejo de la impresión: la base de que la gente minimice o exagere (046 R-011).
- **R60** Krumpal, I. (2013). Determinants of social desirability bias in sensitive surveys: A literature review. *Quality & Quantity, 47*, 2025–2047. https://doi.org/10.1007/s11135-011-9640-9 — Verif. CR (publicado en línea en 2011; volumen 47 de 2013). Revisión de por qué se responde de forma socialmente deseable en temas sensibles.

### I. Autorrevelación y confianza, y autonomía infantil (PA-153, PA-154)

- **R61** Collins, N. L., & Miller, L. C. (1994). Self-disclosure and liking: A meta-analytic review. *Psychological Bulletin, 116*(3), 457–475. https://doi.org/10.1037/0033-2909.116.3.457 — Verif. CR. PA-154.
- **R62** Altman, I., & Taylor, D. A. (1973). *Social penetration: The development of interpersonal relationships*. Holt, Rinehart & Winston. — Verif. — (🟡). Teoría de que la intimidad crece por pasos de revelación recíproca.
- **R67** Rissotto, A., & Tonucci, F. (2002). Freedom of movement and environmental knowledge in elementary school children. *Journal of Environmental Psychology, 22*, 65–77. https://doi.org/10.1006/jevp.2002.0243 — Verif. CR. PA-153: apoya la dirección (la libertad de movimiento de los niños), no un umbral de edad.
- **R68** Carver, A., Watson, B., Shaw, B., y colaboradores. (2013). A comparison study of children's independent mobility in England and Australia. *Children's Geographies, 11*, 461–475. https://doi.org/10.1080/14733285.2013.812303 — Verif. CR. PA-153: movilidad independiente infantil entre países.

### J. Inferencia causal y simulación (spec 028)

- **R63** Hudgens, M. G., & Halloran, M. E. (2008). Toward causal inference with interference. *Journal of the American Statistical Association, 103*, 832–842. https://doi.org/10.1198/016214508000000292 — Verif. CR. PA-156.
- **R64** Aronow, P. M., & Samii, C. (2017). Estimating average causal effects under general interference, with application to a social network experiment. *The Annals of Applied Statistics, 11*. https://doi.org/10.1214/16-aoas1005 — Verif. CR (páginas sin comprobar). PA-156.
- **R65** Efron, B. (1979). Bootstrap methods: Another look at the jackknife. *The Annals of Statistics, 7*. https://doi.org/10.1214/aos/1176344552 — Verif. CR (páginas sin comprobar). 028 R-008.
- **R66** Glasserman, P., & Yao, D. D. (1992). Some guidelines and guarantees for common random numbers. *Management Science, 38*(6), 884–908. https://doi.org/10.1287/mnsc.38.6.884 — Verif. CR. 028 R-005.

---

## Metodología y límites

- **Barrido.** 49 marcadores en specs y en `docs/investigacion/preguntas-abiertas.md`, más `specs/_plantilla.md:30`, que se excluye porque define la regla en lugar de pedir una fuente. Se regenera con:

  ```powershell
  Select-String -Path specs\*.md, docs\investigacion\*.md -Pattern 'referencia a verificar' |
    ForEach-Object { "$($_.Filename):$($_.LineNumber)| $($_.Line.Trim())" }
  ```

- **Verificación.** Crossref (consulta bibliográfica y resolución directa de DOI), PubMed E-utilities, el registro de publicaciones de ACBS y documentos enlazados de laboratorios y editoriales. Pasada única del 2026-09-28: varias consultas a Crossref devolvieron 429, y de ahí que once marcadores se queden en 🟡.
- **Reglas.** (1) No se escribe DOI de lo no resuelto. (2) Un DOI solo se cita si se resolvió y devolvió el título esperado: así salieron correcciones reales — Ainslie (1975) se titula *Specious reward*, no "Specious present"; Guttman y Kalish (1956) van en 51(1), 79–88; y el artículo verificable del trío de reglas es **Matthews**, Shimoff y Catania (1987). (3) Libros y capítulos antiguos se citan sin DOI y quedan 🟡.
- **Límites.** Se comprobaron metadatos y resúmenes, no los textos completos: ninguna de las fuentes verificadas dice, por ejemplo, que la pendiente de subigualación caiga entre 0,7 y 1,0 o que la evitación dure más de 50 ensayos. Esos umbrales de `042 V-1…V-9` siguen siendo decisión del motor hasta que la revisión experta los coteje con los artículos.





