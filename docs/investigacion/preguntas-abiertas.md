# Preguntas abiertas del motor funcional-contextual

Registro vivo del protocolo de estatus epistémico (ADR-007 §6; plantilla de specs §4 bis).
- Cada pregunta dice qué **mecanismo del motor** permitiría especificar mejor (documento rector §16), qué **supuesto [M]** se usa mientras tanto y qué información la resolvería.
- **Estados:**
  - `abierta`: sin respuesta; hay supuesto [M];
  - `en-estudio`: hay documentos en revisión;
  - `resuelta`: la regla pasa a [E] o [T] con fuente;
  - `descartada`: ya no aplica.

Las preguntas PA-001 a PA-039 son **todas** las de la §11 del documento rector (`docs/investigacion/motor-comportamiento-humano.md`), en su orden. Desde PA-101 son las que surgieron al especificar.

## §11 del documento rector

| ID | Pregunta | Pregunta del documento rector (§11.x) | Mecanismo o spec afectada | Supuesto [M] actual y parámetro | Qué información académica o experta resolvería la duda | Estado |
|---|---|---|---|---|---|---|
| PA-001 | ¿Cómo se representa la adquisición de una función? | 11.1 | 036 R-001, R-002 (`respondent.*`, `operant.*`) | Función = (estímulo, tipo, valencia, fuerza, contexto, origen); actualización tipo Rescorla-Wagner | Modelos formales de adquisición respondiente y operante usados en simulación conductual; si hay alternativas mejores a RW para humanos (p. ej. modelos de atención) | abierta |
| PA-002 | ¿Qué determina su fuerza? | 11.1 | 036 R-001 (λ, α, β) y 009 R-004 | `ΔV = α·β·(λ−ΣV)`; β por valencia × (0,5 + sensibilidad) | Estudios de magnitud del EI, saliencia y diferencias individuales en tasas de condicionamiento | abierta |
| PA-003 | ¿Cómo se mantiene? | 11.1 | 036 R-002 (reforzamiento intermitente), R-011 | La fuerza solo cambia con presentaciones y consecuencias; sin decaimiento por tiempo | Datos sobre retención a largo plazo y efecto del reforzamiento intermitente (resistencia a la extinción) | abierta |
| PA-004 | ¿Cómo se debilita? | 11.1 | 036 R-003 (`extinction.context`), R-006 | Extinción como memoria inhibitoria contextual; habituación para las elicitadoras | Modelos de extinción de Bouton y colaboradores (referencia a verificar); olvido frente a extinción | abierta |
| PA-005 | ¿Cómo interactúan funciones adquiridas directamente y funciones derivadas? | 11.1 | 037 R-006 | Gana la de mayor fuerza × control contextual; ninguna se borra | Estudios que enfrenten funciones directas y derivadas del mismo estímulo | abierta |
| PA-006 | ¿Cómo se produce exactamente la transformación de funciones? | 11.2 | 037 R-003 (`relational.transformation`) | Regla por marco; fuerza = Π fuerzas × 0,7^(profundidad−1) | Estudios cuantitativos de la magnitud de la transferencia por paso de derivación | abierta |
| PA-007 | ¿Qué papel tienen las claves contextuales? | 11.2 | 037 R-004, R-005 (Crel, Cfunc) | Crel elige el marco y Cfunc habilita la transformación de una función concreta | Literatura TMR sobre control contextual separado de relación y función (referencia a verificar) | abierta |
| PA-008 | ¿Cuándo una relación produce transformación funcional y cuándo no? | 11.2 | 037 R-004 | Sin Cfunc aprendida, se transfiere con `CFUNC_DEFAULT = 0,5` | Condiciones experimentales en que no hay transformación pese a la relación derivada | abierta |
| PA-009 | ¿Cómo se pueden representar diferentes grados de transformación? | 11.2 | 037 R-003 (`COMP_FACTOR`) | Escalado continuo: comparación × 1,5 por paso | Estudios de transformación a través de comparación con varios niveles | abierta |
| PA-010 | ¿Pueden Crel y Cfunc ser el mismo estímulo, y cómo se aprende cada una? | 11.2 (derivada) | 037 R-004, R-005 | Se aprenden por separado como claves de contexto (036) | Estudios de entrenamiento de claves contextuales en TMR | abierta |
| PA-011 | ¿Cómo se generaliza una función entre situaciones? | 11.3 | 036 R-004 (`generalization.gradient`) | Gradiente gaussiano sobre rasgos de la ontología, σ = 0,35 | Qué rasgos de estímulo y de contexto usar; formas del gradiente en humanos | abierta |
| PA-012 | ¿Cómo aprende una persona que dos contextos son funcionalmente diferentes? | 11.3 | 036 R-005 (`discrimination.differential`) | Reforzamiento diferencial estrecha σ localmente | Modelos de discriminación contextual (p. ej. ocasionadores; referencia a verificar) | abierta |
| PA-013 | ¿Cómo aparecen gradientes de generalización? | 11.3 | 036 R-004 | Emergen del gaussiano y del entrenamiento | Gradientes de excitación e inhibición y su interacción | abierta |
| PA-014 | ¿Cómo una historia particular produce generalización excesiva o demasiado restringida? | 11.3 | 036 R-004, R-005; 039 R-004 | σ se ensancha con consecuencias aversivas intensas [M] y se estrecha con discriminación | Datos sobre sobregeneralización del miedo tras experiencias aversivas (referencia a verificar) | abierta |
| PA-015 | ¿Cómo una historia de contingencias produce repertorios relativamente estables? | 11.4 | 036 R-002; 041 | La estabilidad emerge de fuerzas altas con reforzamiento intermitente y de la poda | Modelos de persistencia conductual (momento conductual; referencia a verificar) | abierta |
| PA-016 | ¿Cómo se acumulan repertorios? | 11.4 | 036 (almacén de fuerzas), 041 | Hasta 256 respuestas por contexto; poda por fuerza × recencia | Evidencia sobre tamaño y organización de repertorios | abierta |
| PA-017 | ¿Cómo compiten repertorios diferentes? | 11.4 | 040 R-003, R-004 | Suma de aportes + igualación con exponente `a = 0,8` | Ley de igualación generalizada en conducta humana compleja | abierta |
| PA-018 | ¿Cómo aparece la variabilidad conductual? | 11.4 | 036 R-012; 040 R-004 | `hist.variability` aprendida, con valor inicial temperamental | Literatura de variabilidad operante (Neuringer; referencia a verificar) | abierta |
| PA-019 | ¿Cómo se adquieren reglas? | 11.5 | 038 R-002; 041 R-003 | Transmisión por la comunidad verbal y autoformulación por derivación | Estudios del desarrollo del seguimiento de reglas en niños | abierta |
| PA-020 | ¿Cómo compiten reglas y contingencias? | 11.5 | 038 R-004 | Aporte = fuerza × historia × (1 − contraste); pliance descuenta el contraste × 0,3 | Estudios de conducta gobernada por reglas con contingencias en conflicto | abierta |
| PA-021 | ¿Cuándo una persona sigue una regla aunque las consecuencias actuales indiquen otra cosa? | 11.5 | 038 R-001, R-004 | Pliance fuerte y reforzador generalizado del hablante presente | Insensibilidad a las contingencias (referencia a verificar) | abierta |
| PA-022 | ¿Cómo cambian las reglas? | 11.5 | 038 R-005 | Tracking se debilita con el contraste; pliance con la pérdida de función del hablante | Estudios de cambio de reglas y reglas autogeneradas | abierta |
| PA-023 | ¿Cómo se aprende una respuesta porque produce alivio? | 11.6 | 036 R-002; 039 R-004 | Reforzamiento negativo igual al positivo en la actualización operante | Modelos de evitación (bifactorial y alternativas; referencias a verificar) | abierta |
| PA-024 | ¿Cómo interactúan consecuencias inmediatas y demoradas? | 11.6 | 036 R-009; 040 R-003 | Descuento hiperbólico con `hist.discountK` | Descuento de pérdidas frente a ganancias; descuento de consecuencias aversivas demoradas | abierta |
| PA-025 | ¿Cómo se desarrollan patrones rígidos de evitación? | 11.6 | 039 R-004, R-005 | Evitación reforzada negativamente sin contacto con el aversivo + PNR que consolida la red | Datos sobre persistencia y extensión de la evitación | abierta |
| PA-026 | ¿Cómo se generaliza el repertorio de evitación? | 11.6 | 036 R-004; 039 R-004 | Por el mismo gradiente de estímulos y por transformación relacional (037) | Estudios de generalización de la evitación a través de relaciones derivadas (referencia a verificar) | abierta |
| PA-027 | ¿Cuántos emparejamientos hacen falta para un reforzador generalizado? | 11.1 (del paper) | 036 R-008 | Emparejado con ≥ 3 reforzadores distintos | Literatura sobre reforzadores condicionados generalizados | abierta |
| PA-028 | ¿Cuándo se activa la red opuesta de los valores? | 11.7 (del paper) | 038 R-007 | Se deriva bajo demanda cuando un evento tiene relación de oposición con un nodo de valor | Gil-Luciano et al. (2019) y trabajos del mismo grupo | abierta |
| PA-029 | ¿Qué fuerza tiene la transformación a través de jerarquías? | 11.2 (del paper) | 037 R-003; 038 R-006 | Igual a la de coordinación, con la misma atenuación | Gil et al. (2012) y replicaciones | abierta |
| PA-030 | ¿Cómo se enseñan y aprenden los marcos deícticos? | 11.7 (del paper) | 037; 039 R-007; 041 R-003 | Episodios del desarrollo con la comunidad verbal | Estudios de entrenamiento deíctico y toma de perspectiva (referencia a verificar) | abierta |
| PA-031 | ¿Cómo crecen las redes relacionales individuales? | 11.7 | 037 R-007; 041 | Enseñanza verbal + derivaciones que se consolidan por uso | Datos de desarrollo de la respuesta relacional | abierta |
| PA-032 | ¿Cómo se organizan? | 11.7 | 037 (grafo con marcos y claves) | Grafo disperso con aristas tipadas y claves contextuales | Modelos computacionales de TMR existentes (referencia a verificar) | abierta |
| PA-033 | ¿Cómo se modifican? | 11.7 | 037 R-007, R-008 | Nuevas enseñanzas, consolidación, poda por fuerza | Estudios de reorganización de redes (p. ej. tras intervención, fuera de alcance aquí) | abierta |
| PA-034 | ¿Cómo aparecen relaciones de oposición, comparación, jerarquía y deícticas? | 11.7 | 041 R-003 | Secuencia de enseñanza por edad en el catálogo de episodios | Secuencias de desarrollo de marcos en la infancia | abierta |
| PA-035 | ¿Cómo interactúan diferentes redes? | 11.7 | 037 R-002; 038 R-006, R-007 | Por nodos compartidos y derivación combinatoria acotada | Estudios de redes en conflicto y coherencia (MDML) | abierta |
| PA-036 | ¿Qué mecanismos permiten que una persona cambie de fuente de control? | 11.8 | 039 R-006; 040 R-003 | Enmarque jerárquico con "Yo" que resta control discriminativo al evento privado | Literatura TMR y ACT sobre self como contexto (referencia a verificar) | abierta |
| PA-037 | ¿Cómo aparece rigidez? | 11.8 | 039 R-005; 037 R-008 | Consolidación de aristas y evitación reforzada | Medidas de flexibilidad relacional (MDML) | abierta |
| PA-038 | ¿Cómo aparece flexibilidad? | 11.8 | 039 R-007 | La respuesta flexible se refuerza con contacto con reforzadores de valor | Estudios de desarrollo de la flexibilidad psicológica | abierta |
| PA-039 | ¿Qué papel tienen la discriminación, el contexto y los repertorios disponibles? | 11.8 | 036 R-005; 039; 040 R-002 | Solo compiten las respuestas con fuerza en el contexto discriminado | Teoría de la competencia de respuestas y control de estímulos | abierta |

## Surgidas al especificar

| ID | Pregunta | Pregunta del documento rector (§11.x) | Mecanismo o spec afectada | Supuesto [M] actual y parámetro | Qué información académica o experta resolvería la duda | Estado |
|---|---|---|---|---|---|---|
| PA-101 | ¿Qué parámetros temperamentales tienen base empírica y cómo se relacionan con Big Five/HEXACO? | 13 | 009 R-002 (tabla de mapeo) | 8 parámetros `tmp.*` con pesos de la tabla de 009 §3 y ruido residual 0,12 | Tabla de expertos; literatura de temperamento (RST, Rothbart; referencias a verificar) | abierta |
| PA-102 | ¿Existe base temperamental para la saliencia de estímulos sociales, o es enteramente aprendida? | 13 | 009 (`tmp.socialSalience`); 036 R-001 | Parámetro [M] con mapeo +0,4 E y +0,3 A | Estudios de diferencias tempranas en orientación social | abierta |
| PA-103 | ¿Qué forma tiene la modulación del aprendizaje por la sensibilidad? | 11.1 | 009 R-004; 036 R-001, R-002 | Multiplicador `0,5 + tmp` sobre β | Modelos de aprendizaje con asimetría ganancia/pérdida y diferencias individuales | abierta |
| PA-104 | ¿Cómo cambia la pendiente del descuento con la historia? | 11.6 | 036 R-009 (`discounting.k_plasticity`) | Baja con demoras reforzadas y sube con promesas incumplidas | Estudios longitudinales o experimentales de modificación del descuento (referencia a verificar) | abierta |
| PA-105 | ¿Cómo se aprende la variabilidad? | 11.4 | 036 R-012; 040 R-004 | Sube con el reforzamiento de la variación y el fracaso de la respuesta dominante | Neuringer y colaboradores (referencia a verificar) | abierta |
| PA-106 | ¿Qué rasgos de estímulo usar para la generalización en un mundo social? | 11.3 | 036 R-004 (ontología) | Rasgos por clase: rol, familiaridad, tono, contexto | Revisión experta de la ontología | abierta |
| PA-107 | ¿Qué ventana de imputación de consecuencias es razonable? | 11.6 | 036 R-011 | 60 min (1 día para demoradas) | Literatura de demora del reforzamiento en humanos | abierta |
| PA-108 | ¿Queda un residuo temperamental en mentir? | 13 | 009 (eliminación de `pers.honesty`); 025 R-003 | Ninguno: mentir es operante y gobernado por reglas | Estudios de diferencias individuales en conducta deshonesta y su origen | abierta |
| PA-110 | ¿Qué profundidad de derivación es realista y computable? | 11.7 | 035 §12; 037 R-002 | `MAX_DEPTH = 3` | Estudios de derivación de relaciones de varios nodos | abierta |
| PA-111 | ¿Cómo medir coherencia, complejidad, nivel de derivación y flexibilidad (MDML) en un grafo? | 11.7 | 037 R-008 | Definiciones operativas de 037 R-008 | Barnes-Holmes y colaboradores, MDML (referencia a verificar) | abierta |
| PA-112 | ¿Cómo se distingue en la práctica pliance de tracking para la misma regla? | 11.5 | 038 R-003 | Por la historia de qué reforzó el seguimiento (hablante o mundo) | Zettle y Hayes; estudios de medida de pliance (referencia a verificar) | abierta |
| PA-113 | ¿Cuánto pesan los valores frente a las consecuencias inmediatas? | 11.5 | 038 R-006; 040 R-003 | Aporte apetitivo por transformación jerárquica, sin peso fijo | Estudios de augmentals y conducta orientada a valores | abierta |
| PA-114 | ¿Cuántas redes de valor puede sostener una persona? | 11.7 | 038 R-009 | Tantas como dominios con red construida (≤ 12) | Revisión experta | abierta |
| PA-115 | ¿Qué condición de parada tiene el PNR? | 11.6 / 11.8 | 039 R-003 | Carga < 0,25, conducta de evitación o tope de 12 pasos por hora | Estudios de duración de episodios de preocupación y rumia | abierta |
| PA-116 | ¿Cómo se mide la "carga aversiva" de los eventos privados activos? | 11.6 | 039 R-002 | Suma de funciones aversivas de los eventos activos, con techo | Revisión experta | abierta |
| PA-117 | ¿Qué respuestas cuentan como evitación experiencial en el mundo? | 11.6 | 039 R-004; ontología 036 | Distracción, dormir, consumir, evitar contacto, suprimir (Figura 2 del paper) | Catálogo revisado por expertos | abierta |
| PA-118 | ¿Cómo integrar la rutina (011) como reglas sin perder su realismo? | 11.5 | 040 R-002; 011 | Rutina = reglas de pliance y tracking con fuerza inicial alta del desarrollo | Revisión del diseño en MF3 | abierta |
| PA-120 | ¿Qué episodios de desarrollo son imprescindibles y con qué tasas? | 11.4 / 11.7 | 041 (catálogo) | Catálogo inicial [M] por etapa | Revisión experta en desarrollo y análisis de conducta | abierta |
| PA-121 | ¿Cuántos episodios por año bastan para repertorios verosímiles? | 11.4 | 041 R-001 | 50 (0–18) y 12 (adultos) | Sensibilidad medida en MF7 y revisión experta | abierta |
| PA-122 | ¿Qué rangos cuantitativos exigir en la batería? | 16 | 042 | Rangos ordinales y de forma | Datos experimentales comparables por fenómeno | abierta |
| PA-123 | ¿Qué fenómenos faltan en la batería para cubrir §16 del documento rector? | 16 | 042 | 12 escenarios | Revisión experta de la batería | abierta |
| PA-130 | ¿Qué topes por persona conservan la conducta verosímil? | — | 035 §7 | Tabla de topes de 035 §7 | Medición de sensibilidad en MF2–MF7 | abierta |
