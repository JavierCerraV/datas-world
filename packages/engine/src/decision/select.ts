// Núcleo puro de la selección (spec 040 R-003, R-004): softmax, temperatura desde la variabilidad aprendida y
// aporte logarítmico de la fuerza de respuesta. Lo usan el sistema de decisiones y el laboratorio (042 V-4, V-5).

/**
 * Escala y referencia del aporte de la fuerza (040 §8) [M]. Con escala 1 la igualación de V-4 da pendiente 0,69;
 * con 1,5, 0,72, y por encima se satura. La referencia está calibrada para que el mundo generado haga el mismo
 * volumen de ocio que con la 017 (a menos del 2 % en 30 días y 3 semillas); no afecta a V-4 (desplaza todos los
 * valores por igual).
 */
export const STRENGTH_SCALE = 1.5;
export const STRENGTH_REF = 0.46;
const STRENGTH_FLOOR = 0.02;

/** Probabilidades de la softmax (INV-001: finitas, en [0,1] y suman 1). */
export function softmax(values: readonly number[], temperature: number): number[] {
  const max = Math.max(...values);
  const w = values.map((u) => Math.exp((u - max) / temperature));
  const total = w.reduce((s, x) => s + x, 0);
  return w.map((x) => x / total);
}

/** 040 R-004: temperatura desde la variabilidad aprendida (`hist.variability`), no desde el temperamento. */
export const temperatureOf = (variability: number): number => 0.15 + 0.4 * variability;

/**
 * 040 R-003: aporte de la fuerza `w`. Con la fuerza como única fuente, la softmax da `p ∝ w^(escala/T)`: la
 * igualación generalizada (R-004, R-005).
 */
export const strengthContribution = (w: number): number => STRENGTH_SCALE * Math.log(Math.max(STRENGTH_FLOOR, w) / STRENGTH_REF);

/** Índice elegido con un número uniforme `x` en [0,1). */
export function pickIndex(p: readonly number[], x: number): number {
  let k = 0;
  while (k < p.length - 1 && x >= p[k]!) x -= p[k++]!;
  return k;
}
