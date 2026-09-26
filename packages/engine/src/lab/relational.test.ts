// Batería 042 (bloque MF4): V-7, V-8 y V-11a, criterios 037 CA-001 a CA-003.
import { describe, expect, it } from 'vitest';
import { chessScenario, comparisonTransform, relationOf, trainedPair } from './relational.ts';

describe('042: batería de validación conductual (MF4)', () => {
  it('V-7 (037 CA-001): vinculación mutua y combinatoria, con fuerza menor que las enseñadas', () => {
    const s = 0.9;
    const coord = trainedPair('coordination', s);
    const more = trainedPair('more', s);
    const opp = trainedPair('opposition', s);
    const derived = [
      relationOf(coord, 'B', 'A', 'coordination'), // B = A (mutua)
      relationOf(coord, 'C', 'A', 'coordination'), // C = A (mutua de la combinatoria)
      relationOf(coord, 'A', 'C', 'coordination'),
      relationOf(more, 'A', 'C', 'more'), // A > C
      relationOf(more, 'C', 'A', 'less'), // C < A
      relationOf(more, 'B', 'A', 'less'),
      relationOf(opp, 'A', 'C', 'coordination'), // A = C por doble oposición
      relationOf(opp, 'B', 'A', 'opposition'),
    ];
    for (const d of derived) {
      expect(d).toBeDefined();
      expect(d!.s).toBeLessThan(s);
    }
    // Lo que no se deriva: A > C no da "A < C", y la oposición simple no da coordinación.
    expect(relationOf(more, 'A', 'C', 'less')).toBeUndefined();
    expect(relationOf(opp, 'A', 'B', 'coordination')).toBeUndefined();
  });

  it('V-8 (037 CA-002): transformación por comparación, aversiva(B) > aversiva(A) > aversiva(C)', () => {
    const { A, B, C } = comparisonTransform();
    expect(A).toBe(-0.5);
    expect(B).toBeLessThan(A);
    expect(C).toBeGreaterThan(A);
    expect(C).toBeLessThan(0);
  });

  it('V-11a (037 CA-003): la regla sube jugar; perder queda en coordinación con "tonto" y es aversivo solo con la oposición', () => {
    const r = chessScenario();
    expect(r.before).toBeGreaterThan(0.4);
    expect(r.before).toBeLessThan(0.6);
    expect(r.afterRule).toBeGreaterThan(r.before + 0.1);
    expect(r.loseIsDumb).toBeDefined();
    expect(r.lose).toBeLessThan(0);
    expect(r.dumb).toBeLessThan(0);
    const without = chessScenario(42, false);
    expect(without.loseIsDumb).toBeUndefined();
    expect(without.dumb).toBe(0);
  });
});
