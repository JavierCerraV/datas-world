// Batería 042 (bloque MF3): V-4 y V-5, criterios 040 CA-001 y CA-002.
import { describe, expect, it } from 'vitest';
import { concurrentChoice, delayChoice } from './choice.ts';

function fit(xs: number[], ys: number[]): { slope: number; r2: number } {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
    syy += (ys[i]! - my) ** 2;
  }
  return { slope: sxy / sxx, r2: (sxy * sxy) / (sxx * syy) };
}

describe('042: batería de validación conductual (MF3)', () => {
  it('V-4 (040 CA-001): igualación con subigualación, pendiente 0,7–1,0 y R² > 0,9', () => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const seed of [1, 2, 3])
      for (const ratio of [1, 2, 4, 8, 1 / 2, 1 / 4, 1 / 8]) {
        const { responses: r, reinforcers: f } = concurrentChoice(ratio, seed);
        xs.push(Math.log(Math.max(1, f[0]) / Math.max(1, f[1])));
        ys.push(Math.log(r[0] / r[1]));
      }
    const { slope, r2 } = fit(xs, ys);
    expect(slope).toBeGreaterThanOrEqual(0.7);
    expect(slope).toBeLessThanOrEqual(1);
    expect(r2).toBeGreaterThan(0.9);
  });

  it('V-5 (040 CA-002): prefiere lo inmediato y la preferencia se invierte al alejar las dos opciones', () => {
    for (const seed of [1, 2, 3, 7, 42]) {
      expect(delayChoice(10, 0, 15, 7, seed)).toBeGreaterThan(0.5);
      expect(delayChoice(10, 30, 15, 37, seed)).toBeLessThan(0.5);
    }
  });
});
