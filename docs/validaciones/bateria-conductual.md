# Batería conductual del motor funcional (spec 042)

Cierre del motor funcional (bloque MF8.3, 2026-09-28). Cada escenario es una prueba determinista con semilla fija que corre en `pnpm check`. Los números son los de la última ejecución.

| Id | Fenómeno | Dónde se prueba | Resultado | Estado |
|---|---|---|---|---|
| V-1 | Adquisición y extinción | `packages/engine/src/lab/scenarios.ts` (`acquisitionExtinction`) | Adquisición negativamente acelerada; extinción monotónica por debajo del 20 % del máximo | ✔ |
| V-2 | Recuperación espontánea y renovación | `lab/scenarios.ts` (`recoveryRenewal`) | Recuperación en B mayor que el final de la extinción; renovación en A mayor que en B | ✔ |
| V-3 | Gradiente de generalización y discriminación | `lab/scenarios.ts` (`generalizationGradient`) | Gradiente unimodal decreciente; más estrecho y con el pico desplazado tras la discriminación | ✔ |
| V-4 | Ley de igualación | `lab/choice.ts` (`concurrentChoice`) | Pendiente 0,72 y R² ≈ 1 (subigualación); con programas más pobres, 0,64 | ✔ |
| V-5 | Descuento hiperbólico e inversión | `lab/choice.ts` (`delayChoice`) | Con k = 0,2: 76 % elige lo inmediato en el primer par y 48 % en el segundo (inversión), estable en 5 semillas | ✔ |
| V-6 | Persistencia de la evitación | `lab/scenarios.ts` (`avoidancePersistence`) | ≈ 52 evitaciones de 100 sin choque con sensibilidad aversiva alta y ≈ 35 con baja | ✔ justo (PA-132) |
| V-7 | Vinculación mutua y combinatoria | `lab/relational.ts` | Derivadas en coordinación, comparación y oposición, más débiles que las enseñadas | ✔ |
| V-8 | Transformación por comparación | `lab/relational.ts` | Con A = −0,5 directa: B −0,68 y C −0,30 | ✔ |
| V-9 | Insensibilidad por reglas | `lab/rules.ts` (`ruleInsensitivity`) | Pliance tarda más en ajustarse que el moldeado, y más con pliance fuerte; el tracking se ajusta como el moldeado | ✔ |
| V-10 | Bucle de PNR | `lab/private.ts` (`pnrProtocol`) | Con evitación: 4 episodios de 95 a 180 min y el disparador se conserva (≈ −0,47). Quedándose con el pensamiento: un episodio de 520 min, extinción (−0,05) y recuperación espontánea. Con «Yo» y un valor: episodios de 5 a 15 min. La red se vuelve más compleja y menos derivada | ✔ |
| V-11a | Ajedrez → «inteligente» → «soy tonto» | `lab/relational.ts` (`chessScenario`) | Jugar pasa de ≈ 50 % a ≈ 68 % con la regla; «perder» en coordinación derivada con «tonto»; sin la oposición inteligente–tonto, no | ✔ |
| V-11b | Rechazos → «no quieren pasar tiempo conmigo» | `lab/rules.ts` (`rejectionScenario`) | El pensamiento aparece al tercer rechazo, aversivo por oposición jerárquica al valor; sin la red de valor, no | ✔ |
| V-12 | Divergencia y convergencia | `packages/generators/src/development/development.test.ts` | (a) Mismo temperamento, historias distintas: distancia media entre repertorios > 0,1. (b) Temperamentos opuestos, misma historia: distancia menor que en (a) | ✔ con dos diferencias (abajo) |

## Diferencias con el protocolo de la 042
- **V-12:** se usan 20 pares de historias (no 200) y la distancia se mide al llegar al presente del mundo, tras el desarrollo (041), no tras un año de vida. La historia de desarrollo ya tiene unos 1 000 episodios por persona; un año más de mundo agrega pocos y mucho más lentos de simular.
- **V-6:** pasa justo. La teoría de dos factores sola da una persistencia moderada (PA-132).

## Criterios de la 035 que cierra MF8
| Criterio | Resultado | Dónde |
|---|---|---|
| CA-001: cadena completa para 20 conductas | Las 20 conductas elegidas al azar (199 personas × 30 días) tienen la cadena completa, desde la conducta hasta los hechos del registro o del desarrollo | `apps/cli/src/explain.test.ts`; `pnpm cli citizen:explain EVT-…` |
| CA-003: 500 personas × 1 año | Ver `MF8-bench-vida.md` | `pnpm cli bench:life --population 500 --days 365` |

## Mundo de ejemplo del motor funcional
No se guarda en `docs/validaciones/mundos/`: con la historia de desarrollo (041) un mundo de 199 personas pesa ≈ 24 MB, y el repositorio guarda fotos pequeñas de cada peldaño (ver el README de esa carpeta). Las pruebas que lo necesitan lo generan al vuelo con la semilla 482917.
