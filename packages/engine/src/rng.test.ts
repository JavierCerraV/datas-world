import { describe, expect, it } from 'vitest';
import { createRng, restoreRng } from './rng.ts';

const U32 = 4294967296;
const take = <T>(n: number, f: () => T): T[] => Array.from({ length: n }, f);

describe('Rng — determinismo', () => {
  it('misma semilla produce la misma secuencia', () => {
    const a = createRng(482917);
    const b = createRng(482917);
    expect(take(1000, () => a.next())).toEqual(take(1000, () => b.next()));
  });

  it('semillas distintas producen secuencias distintas', () => {
    const a = createRng(482917);
    const b = createRng(482918);
    expect(take(10, () => a.next())).not.toEqual(take(10, () => b.next()));
  });

  it('state/restore continúa exactamente donde se quedó', () => {
    const a = createRng(7);
    take(123, () => a.next());
    const b = restoreRng(a.state());
    expect(take(500, () => b.next())).toEqual(take(500, () => a.next()));
    expect(b.fork('x').next()).toBe(a.fork('x').next());
  });

  it('el estado es serializable como JSON sin pérdida', () => {
    const a = createRng(99);
    take(10, () => a.next());
    const b = restoreRng(JSON.parse(JSON.stringify(a.state())));
    expect(b.next()).toBe(a.next());
  });
});

describe('Rng — xoshiro128** (vectores de referencia)', () => {
  it('con estado [1,2,3,4] produce 11520, 0, 5927040', () => {
    const r = restoreRng({ key: [0, 0], s: [1, 2, 3, 4] });
    expect(take(3, () => r.next() * U32)).toEqual([11520, 0, 5927040]);
  });

  it('rechaza un estado todo ceros', () => {
    expect(() => restoreRng({ key: [0, 0], s: [0, 0, 0, 0] })).toThrow();
  });
});

describe('Rng — fork (spec 023 CA-003)', () => {
  it('CA-003: consumir del padre no cambia la secuencia de fork("a")', () => {
    const p1 = createRng(482917);
    const p2 = createRng(482917);
    take(1000, () => p2.next());
    expect(take(50, () => p1.fork('a').next())).toEqual(take(50, () => p2.fork('a').next()));
  });

  it('fork no consume del padre', () => {
    const p1 = createRng(1);
    const p2 = createRng(1);
    p2.fork('needs');
    p2.fork('social');
    expect(p2.next()).toBe(p1.next());
  });

  it('nombres distintos dan flujos distintos y los forks anidados son estables', () => {
    const r = createRng(1);
    expect(r.fork('needs').next()).not.toBe(r.fork('social').next());
    expect(r.fork('CIT-000042').fork(3).next()).toBe(createRng(1).fork('CIT-000042').fork('3').next());
    expect(r.fork('a').fork('b').next()).not.toBe(r.fork('b').fork('a').next());
  });

  it('10 000 personas × 365 días: ningún par de flujos repite su primer valor de 64 bits', () => {
    const root = createRng(482917).fork('decision');
    const seen = new Set<string>();
    for (let c = 0; c < 10_000; c += 50) {
      const citizen = root.fork(`CIT-${String(c).padStart(6, '0')}`);
      for (let d = 0; d < 365; d++) {
        const f = citizen.fork(d);
        seen.add(`${f.next()}|${f.next()}`);
      }
    }
    expect(seen.size).toBe((10_000 / 50) * 365);
  });
});

describe('Rng — distribución', () => {
  const N = 200_000;

  it('next() está en [0,1) con media ≈ 0,5 y varianza ≈ 1/12', () => {
    const r = createRng(2024);
    const xs = take(N, () => r.next());
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    const mean = xs.reduce((s, x) => s + x, 0) / N;
    const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / N;
    expect(mean).toBeCloseTo(0.5, 2);
    expect(variance).toBeCloseTo(1 / 12, 2);
  });

  it('int(0, 9) sin sesgo: chi-cuadrado por debajo del umbral p = 0,001 (27,88 con 9 gl)', () => {
    const r = createRng(31337);
    const counts = new Array<number>(10).fill(0);
    for (let i = 0; i < N; i++) counts[r.int(0, 9)]! += 1;
    const expected = N / 10;
    const chi2 = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    expect(chi2).toBeLessThan(27.88);
  });

  it('int respeta los extremos inclusivos y valida argumentos', () => {
    const r = createRng(5);
    const xs = take(10_000, () => r.int(-3, 3));
    expect(new Set(xs)).toEqual(new Set([-3, -2, -1, 0, 1, 2, 3]));
    expect(r.int(4, 4)).toBe(4);
    expect(() => r.int(2, 1)).toThrow();
    expect(() => r.int(0.5, 3)).toThrow();
    expect(() => r.int(0, U32)).toThrow();
  });

  it('chance(p) acierta con frecuencia ≈ p y respeta 0 y 1', () => {
    const r = createRng(11);
    const hits = take(N, () => r.chance(0.3)).filter(Boolean).length;
    expect(hits / N).toBeCloseTo(0.3, 2);
    expect(take(1000, () => r.chance(0)).some(Boolean)).toBe(false);
    expect(take(1000, () => r.chance(1)).every(Boolean)).toBe(true);
  });

  it('pick elige todos los elementos y falla con un arreglo vacío', () => {
    const r = createRng(3);
    const items = ['a', 'b', 'c', 'd'] as const;
    expect(new Set(take(1000, () => r.pick(items)))).toEqual(new Set(items));
    expect(() => r.pick([])).toThrow();
  });

  it('weighted respeta los pesos, ignora pesos 0 y valida entradas', () => {
    const r = createRng(8);
    const draws = take(N, () => r.weighted([['a', 1], ['b', 3], ['z', 0]] as const));
    expect(draws.includes('z')).toBe(false);
    expect(draws.filter((x) => x === 'b').length / N).toBeCloseTo(0.75, 2);
    expect(() => r.weighted([])).toThrow();
    expect(() => r.weighted([['a', 0]])).toThrow();
    expect(() => r.weighted([['a', -1], ['b', 2]])).toThrow();
  });

  it('normal(m, sd) tiene media ≈ m y desviación ≈ sd', () => {
    const r = createRng(17);
    const xs = take(N, () => r.normal(0.5, 0.17));
    const mean = xs.reduce((s, x) => s + x, 0) / N;
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / N);
    expect(mean).toBeCloseTo(0.5, 2);
    expect(sd).toBeCloseTo(0.17, 2);
    expect(xs.every(Number.isFinite)).toBe(true);
  });
});
