// Comparación pareada de brazos (spec 028 R-008): diferencia brazo − control por (semilla, persona), con desviación,
// tamaño del efecto `dz` e intervalo del 95 % por *bootstrap* percentil con un flujo con nombre del Rng (023).
import type { Rng } from '../rng.ts';

/** 028 §8. */
export const BOOTSTRAP_N = 1000;

export interface Pair {
  control: number;
  arm: number;
}

export interface Contrast {
  n: number;
  meanDiff: number;
  sd: number;
  /** Media / desviación de las diferencias; `null` si la desviación es 0. */
  dz: number | null;
  ci95: [number, number];
}

const mean = (xs: readonly number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;

/** `rng` debería ser `createRng(semilla).fork('experiment:bootstrap')` (o un fork por métrica y día). */
export function pairedContrast(pairs: readonly Pair[], rng: Rng, resamples = BOOTSTRAP_N): Contrast | null {
  const diffs = pairs.map((p) => p.arm - p.control).filter(Number.isFinite);
  const n = diffs.length;
  if (n === 0) return null;
  const m = mean(diffs);
  const sd = n > 1 ? Math.sqrt(diffs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)) : 0;
  const means: number[] = [];
  for (let b = 0; b < resamples; b++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += diffs[Math.floor(rng.next() * n)]!;
    means.push(s / n);
  }
  means.sort((a, c) => a - c);
  const at = (q: number) => means[Math.min(means.length - 1, Math.max(0, Math.floor(q * means.length)))]!;
  return { n, meanDiff: m, sd, dz: sd > 0 ? m / sd : null, ci95: [at(0.025), at(0.975)] };
}
