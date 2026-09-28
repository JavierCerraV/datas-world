---
id: 038
nombre: rules-values
estado: implementada
hito: MF (bloque MF5)
depende_de: [035, 036, 037, 040]
version: 0.2
---

# 038 — Reglas, valores y augmentals (capa 4)

## 1. Propósito
- La conducta gobernada por reglas: cómo se adquieren, se siguen, compiten con las contingencias y cambian (documento rector §11.5).
- Los valores como **redes jerárquicas de reforzadores positivos** con su red opuesta (McHugh, Figura 1; documento rector §5).

## 2. Alcance
**Incluye (MF5):**
- reglas por persona con su red (037), su historia y su tipo (pliance, tracking, augmenting);
- competencia regla–contingencia en la selección (040): las reglas de la rutina dejan de ser un número fijo;
- valores como subredes jerárquicas con raíz en un dominio vital, y su red opuesta derivada bajo demanda;
- la aprobación como estímulo que se empareja con reforzadores en la vida mínima de M2.

**Fuera de alcance:**
- cómo se experimentan las funciones aversivas de la red opuesta (039, MF6);
- los augmentals motivadores, es decir, la alteración temporal de la eficacia (MF6, con los eventos privados);
- el cambio de pliance por la presencia o la aprobación del hablante (M3, con la vida social);
- la construcción de valores y reglas en el desarrollo (041, MF7). En MF5 el mundo solo tiene las reglas de la rutina.

## 3. Modelo de datos
```ts
interface Rule {                     // tope 32 por persona (Citizen.rules)
  id: number;
  ante: string;                      // contexto en que aplica (actividad de la rutina, 'lab'…)
  resp: string;                      // respuesta especificada ('rutina.job_search', 'A'…)
  cons: string;                      // consecuencia especificada (estímulo; puede ser verbal)
  src: 'speaker' | 'self';
  speaker?: string;                  // quién la dijo ('familia', 'colegio', 'comunidad', id de una persona)
  s: number;                         // fuerza [0,1]
  contrast: number;                  // discrepancia acumulada entre lo especificado y lo experimentado [0,1]
  hist: { followed: number; byContingency: number; bySpeaker: number };
  aug?: boolean;                     // augmental formativo: la consecuencia solo tiene función derivada
  at: WorldMinute;
}
// La regla vive también en la red relacional (037): arista `resp causes cons` con crel = ante (INV-001).
// Valor: subred jerárquica de la red (037) con raíz en un dominio vital (`life_domains`, p. ej. `dominio.amistad`),
// cuya raíz tiene función apetitiva aprendida (036). No hay escalar por valor (INV-002).
```

## 4. Reglas
- **R-001** [E] — **Insensibilidad.** La conducta gobernada por reglas puede mantenerse aunque las contingencias cambien, más que la conducta moldeada (Shimoff, Catania y Matthews; Hayes et al.; referencias a verificar).
- **R-002** [T] — **Adquisición.** Las reglas llegan de la comunidad verbal (padres, profesores, jefes, pares; 025, 041) o se autoformulan por derivación (037). Al adquirirse se añade su arista `resp causes cons` a la red. Una regla dicha por un hablante cuya aprobación es reforzador generalizado (036 R-008) empieza con fuerza `s × (1 + 0,5 × v(aprobación))` [M].
- **R-003** [T] idea / [M] criterio — **Tipo según la historia** (PA-112):
  - **pliance** si `bySpeaker > byContingency`;
  - **tracking** si `byContingency ≥ bySpeaker` y alguno es mayor que 0;
  - sin historia: pliance si la dijo otro y tracking si es autoformulada;
  - **augmenting** si `aug` (formativo: la consecuencia solo tiene función derivada, 037).
- **R-004** [M] — **Competencia regla–contingencia.** Aporte de una regla aplicable (su antecedente es el contexto presente) a la respuesta que especifica: fuente `regla` de la 040, `s × (1 − contraste × d)`, con `d = 0,3` para pliance y `d = 1` para tracking y augmenting (PA-020). Sustituye al número fijo de la rutina en la 040 R-003 (obligaciones y diligencias); la siesta infantil sigue fija (no es verbal).
- **R-005** [T] idea / [M] tasas — **Cambio de reglas:**
  - seguir una regla y observar la consecuencia actualiza `contraste += tasa × (discrepancia − contraste)`, con discrepancia = |especificado − experimentado| en [0,1]; `tasa` = 0,1 por ensayo en el laboratorio;
  - en el mundo, la regla de buscar empleo ("si buscas, encuentras", tracking) suma discrepancia 1 con tasa 0,004 cada vez que se sigue sin conseguir empleo, y `JOB_HIRED` la confirma (contraste a 0, `byContingency + 1`). Es el desaliento de quien busca meses sin resultado [M];
  - las reglas de pliance del mundo no cambian hasta que haya hablantes presentes y aprobación (M3; PA-022).
- **R-006** [T] — **Valores.** Un valor es la subred de relaciones `X part_of dominio.<d>` (037, jerarquía) cuya raíz tiene función apetitiva aprendida. Lo que "señala" la red recibe en la selección (040) una fuente nueva, `valor`: la función de la raíz transformada por el camino jerárquico (fuerza y Cfunc, 037 R-003), aunque el estímulo tenga una función aversiva directa. No compite con la aversión (R-006 de la 037): se suma como fuente aparte (PA-113).
- **R-007** [T] idea / [M] composición — **Red opuesta.** Se deriva bajo demanda por oposición a un miembro de la red de valor. Se añade a la tabla de composición de la 037: `opposition ∘ part_of = opposition`, es decir, lo opuesto a un miembro de un valor es opuesto al valor ("no quieren pasar tiempo conmigo" es opuesto a "quieren pasar tiempo conmigo", que es parte de la amistad). No se guarda.
- **R-008** [T] — **Augmentals formativos.** Una regla cuya consecuencia solo tiene función derivada (037; p. ej. "el ajedrez es de gente inteligente") es augmental: crea la consecuencia verbal y aporta con ella. Los motivadores pasan a MF6.
- **R-009** [M] — **Dominios vitales.** Los 12 de `life_domains` son las raíces disponibles. Cada persona empieza sin valores; el desarrollo (041, MF7) los construye.
- **R-010** [M] — **Reglas de la rutina.** Al generar, cada persona activa de 12 años o más recibe las reglas de su rutina. Juntas dan el mismo aporte inicial que el número fijo de la 040 (sin cambio de conducta al empezar):
  - buscar empleo: tracking, dicha por la comunidad, consecuencia `verbal.trabajo`, s = 0,45;
  - oficios y cuidado: pliance, dichas por la familia, consecuencia `verbal.aprobacion`, s = 0,45;
  - estudiar: pliance, dicha por el colegio, consecuencia `verbal.aprobacion`, s = 0,35;
  - diligencias: tracking, dicha por la comunidad, consecuencia `verbal.dinero`, s = 0,45.
- **R-011** [T] fuente / [M] emparejamientos — **Aprobación en la vida mínima.** `verbal.aprobacion` se empareja con el disfrute en el ocio con otros (actividades `social.*`, `baile.*` y `comunidad.*`) y con el dinero al ser contratado (`JOB_HIRED`). Con dos reforzadores distintos aún no es generalizado (036 R-008 pide 3): el tercero llega con la vida social (M3).

## 4 bis. Estatus epistémico
- [E]: insensibilidad de la conducta gobernada por reglas.
- [T]: tipos de seguimiento, augmentals, valores como redes jerárquicas y su red opuesta; la aprobación como reforzador social.
- [M]: la fórmula de competencia, el contraste y sus tasas, el criterio de tipo, la composición oposición–jerarquía, las reglas iniciales de la rutina, los topes y los emparejamientos de la aprobación.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas |
|---|---|---|---|
| `RULE_DERIVED` (nivel ≥ 3) | una regla nueva supera 0,3 | citizenId, antecedente, respuesta, consecuencia, tipo | relaciones o hablante |
| `RULE_ABANDONED` (nivel ≥ 3) | el aporte de una regla baja de 0,1 | citizenId, regla | contraste acumulado |

En nivel 2 no se emiten: la regla guarda su historia y el aporte `regla` de la decisión cita la regla (`fuente.regla:<resp>`).

## 6. Invariantes
- **INV-001** — Toda regla tiene su arista en la red relacional y un tipo según su historia (R-003).
- **INV-002** — Ningún valor se representa como escalar por persona: no hay columnas `val.*` (prueba).
- **INV-003** — Tope de 32 reglas por persona: se descarta la de menor aporte y más antigua.

## 7. Criterios de aceptación
- **CA-001** — Insensibilidad (042 V-9): 20 sujetos por grupo, dos respuestas con probabilidad de refuerzo 0,8 y 0,2 durante 100 ensayos que se invierten después. El grupo instruido por pliance tarda más en ajustarse (8 de 10 respuestas a la nueva) que el moldeado, y más con pliance fuerte (s = 1) que débil (s = 0,5). Informativo: el instruido por tracking se ajusta como el moldeado (sensibilidad del tracking).
- **CA-002** — Rechazos (042 V-11b): con la red de amistad, cada rechazo refuerza la relación del rechazo con "no quieren pasar tiempo conmigo". Tras 3 rechazos, esa relación supera el umbral de aparición (0,6) y el pensamiento tiene función aversiva por oposición jerárquica. Sin la red de valor, no la tiene.
- **CA-003** — Una acción que señala un valor recibe la fuente `valor` apetitiva en la selección aunque tenga función aversiva directa, y la pierde si la relación con el valor se debilita.
- **CA-004** — En el mundo generado, al empezar la conducta de la rutina es la misma que en MF4. A una persona desempleada que busca sin conseguir empleo le baja el aporte de la regla de buscar empleo; al ser contratada, se recupera.
- **CA-005** — INV-002: sin columnas `val.*`.

## 8. Parámetros y calibración
| Parámetro | Valor | Estado |
|---|---|---|
| Tope de reglas | 32 | [M], PA-130 |
| Peso del pliance sobre el contraste (`d`) | 0,3 | [M], PA-020 |
| Tasa del contraste | 0,1 por ensayo (laboratorio); 0,004 por seguimiento (buscar empleo) | [M], PA-022 |
| Umbral de aparición de un pensamiento | 0,6 | [M], PA-133 (nueva: ¿cuándo una relación hace aparecer un pensamiento?) |
| Bonificación por aprobación del hablante | 0,5 | [M], PA-019 |

## 10. Preguntas abiertas
PA-019 a PA-022 (§11.5), PA-112 a PA-114.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-25 | 0.1 | Borrador (Fase A, ADR-007) |
| 2026-09-26 | 0.2 | Concreción para MF5: modelo de regla con contraste e historia, criterio de tipo, fórmula de competencia sobre la fuente `regla` de la 040, reglas iniciales de la rutina (conservan la conducta), desaliento en la búsqueda de empleo, valores como subred jerárquica con la fuente `valor` en la 040, composición oposición–jerarquía (amplía la 037 R-002), aprobación emparejada en la vida mínima, CA más precisos y CA-004/CA-005. V-9 comprobado en borrador: pliance 33 ensayos frente a 24 del moldeado; pliance fuerte 34 frente a 28 del débil; tracking 23. Augmentals motivadores y cambio de pliance por el hablante pasan a MF6 y M3 |
| 2026-09-26 | 0.2 | Estado → aprobada |
| 2026-09-26 | 0.2 | Implementación del bloque MF5. Precisiones: (1) en V-9, obedecer se refuerza por el experimentador en cada ensayo en el grupo de pliance y solo por el resultado en el de tracking (así se mantiene el tipo según la historia, R-003); (2) la aversión de la selección se calcula sin las raíces de valor (`dominio.*`): con la regla de la 037 R-006 (gana la función de mayor magnitud), el valor derivado tapaba la aversión directa y además se contaba dos veces; así valor y aversión se suman sin competir, como pide R-006; (3) las reglas de tracking de la rutina empiezan con una confirmación de la contingencia, para que su tipo sea tracking aunque las dijo la comunidad; (4) en el mundo solo se sigue la historia de la regla de buscar empleo (las demás no tienen consecuencia observable hasta M3); (5) en un año del mundo generado, el aporte de la regla de buscar empleo de quien sigue desempleado baja de 0,45 a 0,23 hacia el quinto mes y a 0,11 al año. Sin cambios en CA |
| 2026-09-28 | 0.2 | Estado → implementada |
