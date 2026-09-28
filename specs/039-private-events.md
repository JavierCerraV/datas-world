---
id: 039
nombre: private-events
estado: implementada
hito: MF (bloque MF6)
depende_de: [035, 036, 037, 038]
version: 0.2
---

# 039 — Eventos privados, PNR, evitación experiencial y flexibilidad (capa 5)

## 1. Propósito
Cómo pensamientos y emociones funcionan como estímulos en la misma red. Cómo se forman, mantienen, intensifican y debilitan:
- el pensamiento negativo repetitivo (PNR);
- la evitación experiencial;
- la flexibilidad.

Todos son **procesos temporales**, no variables (documento rector §7, §8, §9, §11.6, §11.8; McHugh, Figura 2). No existen `rumination` ni `experiential_avoidance` como estado.

## 2. Alcance
**Incluye:**
- eventos privados activos;
- el paso de derivación;
- el bucle de PNR con su condición de parada;
- la evitación como respuesta reforzada negativamente;
- el enmarque jerárquico de los eventos privados con el deíctico "Yo" como repertorio aprendido;
- sus efectos en las métricas de la red (037 R-008).

**Fuera de alcance:** la selección de la conducta abierta (040), que recibe de aquí los aportes.

## 3. Modelo de datos (preliminar)
```ts
interface PrivateEvent {            // tope 16 activos por persona
  stimulus: StimulusId;             // un pensamiento es una estructura relacional ya en la ontología ("yo–oposición–inteligente")
  derivedFrom: StimulusId | EntityId;
  fn: StimulusFunction;             // su función en este momento (puede ser derivada o transformada)
  at: WorldMinute;
}
// Proceso de PNR en curso (si lo hay): no es un rasgo, es un episodio con inicio, pasos y fin.
interface PnrEpisode { trigger: StimulusId | EntityId; steps: number; aversiveLoad: number; startedAt: WorldMinute; }
// Repertorio de enmarque jerárquico con "Yo": fuerza de respuesta de 036 (no un rasgo), por clase de contexto.
```

## 4. Reglas
- **R-001** [T] — **Disparo.** Un evento o estímulo con función aversiva presente (directa o transformada) puede disparar derivaciones (037) que producen pensamientos nuevos. Cada pensamiento derivado es un `PrivateEvent` con su función.
- **R-002** [T] fenómeno / [M] forma — **Paso de PNR** (McHugh, Figura 2):
  - mientras la carga aversiva de los eventos privados activos supere `PNR_ENTER`, en cada paso (cadencia `tick` en nivel ≥ 2, `hour` en nivel 1) la persona deriva un pensamiento nuevo desde la subred activa;
  - la selección del camino favorece las aristas más fuertes y ya consolidadas (menos nivel de derivación, más automaticidad);
  - su función se suma a la carga;
  - el afecto negativo se prolonga (lo leen las emociones de 010).
- **R-003** [T] — **Condición de parada.** El episodio termina cuando:
  - la carga baja de `PNR_EXIT` (habituación, cambio de contexto, otra fuente de control);
  - o se emite una conducta de evitación que la reduce;
  - o se alcanza un tope de pasos por hora [M] (seguridad computacional, PA-115).
- **R-004** [T] — **Evitación experiencial** (documento rector §7):
  - una respuesta (distracción, dormir, consumir, evitar a alguien, suprimir) que reduce la carga aversiva recibe **reforzamiento negativo inmediato** (036 R-002);
  - sus costes demorados (oportunidades perdidas, deterioro de relaciones) solo cuentan si la persona los contacta o los deriva, y descontados (036 R-009);
  - así la evitación se mantiene y generaliza a estímulos parecidos (036 R-004).
- **R-005** [T] — **Efectos del bucle en la red** (McHugh):
  - cada episodio de PNR consolida aristas usadas: sube la complejidad y baja el nivel de derivación, así que el siguiente bucle es más rápido;
  - reduce la flexibilidad medida (037 R-008).

  Son consecuencias de la historia, no un parámetro.
- **R-006** [T] — **Respuesta flexible:**
  - enmarcar el evento privado en jerarquía con el deíctico "Yo" ("yo estoy teniendo el pensamiento de…") es una **respuesta relacional** con fuerza por contexto;
  - si se emite, el evento privado pierde control discriminativo, entran otras fuentes de control (valores y augmentals apetitivos, 038) y la conducta puede orientarse a reforzadores positivos jerárquicos.
- **R-007** [T] fenómeno / [M] dinámica — **Aprendizaje de la flexibilidad.** Esa respuesta se fortalece si va seguida del contacto con reforzadores de valor y se debilita si no.
  - Su adquisición inicial requiere que la comunidad verbal haya enseñado marcos deícticos (041).
  - Es un repertorio, así que puede aumentar o disminuir a lo largo de la vida.

## 4 bis. Estatus epistémico
- [T]: casi todo, porque la TMR describe el bucle y la respuesta flexible sin modelo cuantitativo estándar.
- [E]: el reforzamiento negativo de la evitación, la persistencia de la evitación sin contacto con el aversivo y la generalización.
- [M]: umbrales, cadencias, topes, la elección del camino de derivación y la medida de la carga.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas |
|---|---|---|---|
| `PNR_EPISODE` | termina un episodio de PNR con ≥ `PNR_MIN_STEPS` | citizenId, disparador, pasos, duración, cómo terminó | el disparador y las relaciones usadas |
| `THOUGHT_DERIVED` (nivel ≥ 4, observada) | cada pensamiento derivado | citizenId, estructura, función | el camino relacional |

## 6. Invariantes
- **INV-001** — Todo episodio de PNR termina (condición de parada garantizada por R-003).
- **INV-002** — Ninguna columna ni campo por persona llamado o equivalente a rumiación o evitación (prueba de esquema).

## 7. Criterios de aceptación (iniciales)
- **CA-001** — Formación, mantenimiento y debilitamiento del bucle (042 V-10):
  - tras varios disparos con evitación reforzada, los episodios son más frecuentes y más largos;
  - al extinguirse el alivio o reforzarse el enmarque jerárquico, se acortan.
- **CA-002** — Persistencia de la evitación sin contacto con la consecuencia aversiva (042 V-6).
- **CA-003** — Dos personas con igual temperamento, una con historia de enseñanza deíctica y otra sin ella, ante los mismos disparadores: la primera tiene episodios más cortos y más conducta orientada a valores (parte de 042 V-12).

## 8. Parámetros y calibración
| Parámetro | Valor | Estado |
|---|---|---|
| `PNR_ENTER` / `PNR_EXIT` | 0,5 / 0,25 de carga | [M], PA-115 |
| Tope de pasos por hora | 12 | [M] |
| Eventos privados activos | 16 | [M], PA-130 |

## 9. Decisiones del usuario (2026-09-28)
Aprobadas las 6 propuestas:
1. **PNR como episodio, no como rasgo** (R-002, R-003): entra con carga ≥ `PNR_ENTER` = 0,5 y sale con carga < `PNR_EXIT` = 0,25, con una evitación que la reduce o al llegar al tope de 12 pasos por hora (PA-115).
2. **Carga** (PA-116): suma de las funciones aversivas de los eventos privados activos, con techo 1; como mucho 16 activos a la vez.
3. **Evitación** (R-004, PA-117, PA-023): distraerse, dormir, consumir (alcohol o tabaco si la ficha de salud lo tiene, 031), evitar a alguien y suprimir. Se aprende por reforzamiento negativo inmediato (alivio), con los costes demorados descontados (036 R-009).
4. **Flexibilidad** (R-006, R-007): la respuesta de enmarque jerárquico con «Yo» empieza débil y igual para todos hasta MF7 (041), que le dará historia. Se fortalece si va seguida de contacto con reforzadores de valor.
5. **Conexión con la 044:** la intención `rumiar` deja de sumar estrés fijo por hora (`ruminationPerHour`); la creencia dispara eventos privados y, si la carga alcanza `PNR_ENTER`, un episodio de PNR real.
6. **Estrés y ánimo (MF6.4):** el estrés y el ánimo de la 010 salen de la carga aversiva y apetitiva presente; se retira del adaptador la modulación de estresores por neuroticismo y resiliencia. Cambia la dinámica del mundo: se revisa la paridad con el prototipo (`validate:parity`).

## 10. Preguntas abiertas
PA-023 a PA-026 (§11.6), PA-036 a PA-039 (§11.8), PA-115 a PA-117. Los valores de partida quedan decididos (§9); su calibración sigue abierta.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-25 | 0.1 | Borrador (Fase A, ADR-007) |
| 2026-09-28 | 0.2 | Decisiones del usuario (§9): PNR como episodio con entrada 0,5, salida 0,25, evitación o tope de 12 pasos por hora; carga con techo 1 y 16 eventos activos; catálogo de evitación; flexibilidad débil hasta MF7; el `rumiar` de la 044 pasa a PNR real; estrés y ánimo desde la carga (MF6.4) |
| 2026-09-28 | 0.2 | Estado → aprobada |
| 2026-09-28 | 0.2 | Precisiones de la implementación (MF6): (1) R-001: disparan los hechos del tick con λ < 0 en las reglas de la 036, por cada estímulo presente con función aversiva para esa persona (en un despido, «despido» y no «trabajo»), y las creencias de la charla (044) con `−preocupación`. (2) R-002: el paso deriva desde el foco (el pensamiento más aversivo) el estímulo de función transformada más aversiva (`factor × función × fuerza`); sin a dónde ir, se repite y se habitúa un 10 %. Quedarse con el pensamiento es exposición: un ensayo de extinción del disparador por paso. (3) R-004: la evitación es el paso a dormir o a distraerse durante el episodio. Suprime la mitad de la carga, y el alivio (normalizado por `PNR_ENTER`) refuerza la respuesta. Mientras sigue, lo pensado se desvanece sin extinguirse. En la selección, la fuente `alivio` (040). Consumir, evitar a alguien y suprimir quedan pendientes. (4) R-006, R-007: «Yo» se emite con probabilidad igual a su fuerza (0,1 hasta MF7). Conserva la mitad de la función y cierra el episodio; se refuerza con resultado 1 si hay un dominio vital apetitivo y se extingue con 0 si no. (5) Fuera de un episodio, los pensamientos se desvanecen con media vida de 3 h. Resultados: 042 V-10 en `docs/validaciones` y `lab/private.test.ts`; en 30 días de vida normal del mundo de la semilla 482917 no hay episodios (carga máxima 0,06): los hechos del mundo actual pesan poco. Sin cambios en CA |
| 2026-09-28 | 0.2 | Estado → implementada |
