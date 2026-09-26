---
id: 042
nombre: behavior-validation
estado: aprobada
hito: MF (se completa por bloques MF2–MF7)
depende_de: [035, 036, 037, 038, 039, 040, 041]
version: 0.1
---

# 042 — Batería de validación conductual

## 1. Propósito
Los criterios de aceptación del motor funcional completo (035 CA-002).
- Cada fenómeno tiene un escenario reproducible con semilla, una métrica y un rango esperado.
- Sustituye al prototipo como referencia de conducta (ADR-007 §7).
- Los rangos son cualitativos y ordinales (forma de la curva, signo, orden) mientras no tengamos datos cuantitativos comparables (PA-122).

## 2. Alcance
**Incluye:** un laboratorio determinista (`packages/engine/src/lab/`, bloque MF2):
- mundos mínimos con 1 a 4 personas, una ontología de juguete y programas de reforzamiento;
- los mismos mecanismos que el mundo vivo;
- 12 escenarios, cada uno con su prueba en `pnpm check`.

**Fuera de alcance:** calibración cuantitativa contra datos humanos (posterior, con expertos).

## 3. Escenarios
| Id | Fenómeno | Escenario (semilla 42 salvo que se diga otra) | Métrica | Rango esperado | Estatus y fuente |
|---|---|---|---|---|---|
| V-1 | Adquisición y extinción | 30 emparejamientos EC–EI, luego 30 presentaciones del EC solo | Fuerza por ensayo | Adquisición negativamente acelerada (incrementos decrecientes); extinción monotónica hasta < 20 % del máximo | [E] (referencia a verificar) |
| V-2 | Recuperación espontánea y renovación | Adquisición en contexto A, extinción en B; prueba en B tras 7 días y en A | Fuerza en la prueba | Recuperación en B > final de la extinción; renovación en A > en B | [E] Bouton (referencia a verificar) |
| V-3 | Gradiente de generalización y discriminación | Entrenar con S+ y probar 9 estímulos a distancias crecientes; repetir con S+ y S− cercano | Respuesta por distancia | Gradiente unimodal decreciente; más estrecho y con desplazamiento del pico tras la discriminación | [E] Guttman y Kalish; desplazamiento del pico (referencias a verificar) |
| V-4 | Ley de igualación | Dos respuestas concurrentes con programas de intervalo variable en proporción 1:1, 2:1, 4:1 y 8:1, 1 000 ensayos | log(razón de respuestas) frente a log(razón de reforzadores) | Pendiente 0,7–1,0 (subigualación), R² > 0,9 | [E] Herrnstein; Baum (referencias a verificar) |
| V-5 | Descuento hiperbólico e inversión | Elegir entre 10 ahora y 15 en 7 días; y entre 10 en 30 días y 15 en 37 días | Proporción de elección de la menor e inmediata | > 50 % en el primer par; < 50 % en el segundo (inversión) | [E] Ainslie; Mazur (referencias a verificar) |
| V-6 | Persistencia de la evitación | Aviso → choque evitable; tras la adquisición, se retiran los choques | Respuestas de evitación durante 100 ensayos sin choque | Persisten > 50 ensayos; más con mayor sensibilidad aversiva | [E] Solomon y Wynne (referencia a verificar) |
| V-7 | Vinculación mutua y combinatoria | Enseñar A=B y B=C, A>B y B>C, A opuesto a B y B opuesto a C | Relaciones derivadas | B=A, C=A, A>C, C<A, A=C (por doble oposición), todas con fuerza < la de las enseñadas | [E] TMR (Hayes et al., 2001, en McHugh) |
| V-8 | Transformación por comparación | A con función aversiva directa; enseñar B > A y C < A | Función derivada de B y C | aversiva(B) > aversiva(A) > aversiva(C) | [E] Dougher et al. (referencia a verificar) |
| V-9 | Insensibilidad por reglas | Dos grupos de 20: uno moldeado y otro instruido ("responde rápido"); luego cambio de programa | Ensayos hasta ajustar la tasa | Instruido > moldeado; más con pliance fuerte | [E] Shimoff, Catania y Matthews (referencia a verificar) |
| V-10 | Bucle de PNR | Una persona con red de amistad y red opuesta derivable; 10 disparos ("no puedo confiar en él") con distracción disponible | Duración y frecuencia de los episodios; complejidad y nivel de derivación de la red | Episodios más largos y frecuentes con alivio reforzado; complejidad ↑ y nivel de derivación ↓; al reforzar el enmarque jerárquico con "Yo", se acortan | [T] McHugh, Figura 2 |
| V-11a | Ajedrez → "inteligente" → "soy tonto" | "Inteligente" con función apetitiva; enseñar ajedrez = juego de la inteligencia; oposición ganar–perder e inteligente–tonto; ganar y perder | Probabilidad de jugar; función de "soy tonto" al perder | Jugar sube tras la regla; perder produce un pensamiento aversivo derivado por oposición | [T] McHugh |
| V-11b | Rechazos → "no quieren pasar tiempo conmigo" | Persona con red de valor de amistad; 3 rechazos de invitación | Función del pensamiento derivado | Aversiva por oposición jerárquica al valor; sin la red de valor, no aparece | [T] McHugh, Figura 1 |
| V-12 | Divergencia y convergencia | (a) 2 personas con temperamento idéntico, 200 semillas de historia distintas; (b) 2 personas con temperamentos distintos y la misma historia de contingencias fuertes | Distancia entre perfiles de repertorio tras 1 año de mundo | (a) distancia media > umbral; (b) distancia < la de (a) | [T] documento rector §13 (009 CA-F) |

## 4. Reglas
- **R-001** [M] — Cada escenario es una prueba determinista con semilla fija. Una prueba de estabilidad repite V-4, V-5 y V-12 con 5 semillas.
- **R-002** [M] — Un escenario no puede usar reglas específicas para "aprobar": solo los mecanismos de 036–040 con sus parámetros por defecto. Si un escenario necesita otros parámetros, se documenta como calibración.
- **R-003** [M] — Los resultados (métricas y gráficos en texto) se guardan en `docs/validaciones/bateria-conductual.md` al cerrar cada bloque MF.

## 4 bis. Estatus epistémico
- Los fenómenos V-1 a V-9 son [E].
- V-10 a V-12 son [T].
- Los rangos son [M] mientras no haya datos cuantitativos (PA-122).

## 7. Criterios de aceptación
- **CA-001** — Todos los escenarios existen como pruebas y pasan con los parámetros por defecto (035 CA-002).
- **CA-002** — Ningún escenario lee `tmp.*` ni `pers.*` fuera de los mecanismos (prueba de arquitectura).

## 10. Preguntas abiertas
PA-122 (rangos cuantitativos), PA-123 (qué escenarios faltan para cubrir el documento rector §16).

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-25 | 0.1 | Borrador (Fase A, ADR-007) |
| 2026-09-26 | 0.1 | Estado → aprobada |
| 2026-09-26 | 0.1 | Bloque MF2: V-1, V-2, V-3 y V-6 implementados en `packages/engine/src/lab/`. V-6 con protocolo clásico: adquisición hasta 5 evitaciones seguidas, exposición breve al evitar sin extinción (conservación de la ansiedad) y media de 5 sujetos. Resultado ≈ 52 evitaciones de 100 con sensibilidad aversiva alta y ≈ 35 con baja: pasa justo; la teoría de dos factores sola da persistencia moderada (PA-132). Sin cambios en CA |
| 2026-09-26 | 0.1 | Bloque MF3: V-4 (`lab/choice.ts`: intervalo variable con probabilidad total 0,2, 1 000 ensayos, 7 proporciones, 3 semillas; pendiente 0,72, R² ≈ 1, subigualación; con programas más pobres baja a 0,64) y V-5 (k = 0,2: 76 % y 48 %, estable en 5 semillas). Sin cambios en CA |
