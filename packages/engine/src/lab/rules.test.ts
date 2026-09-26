// Batería 042 (bloque MF5): V-9 y V-11b, y 038 CA-001 a CA-003.
import { describe, expect, it } from 'vitest';
import { rejectionScenario, ruleInsensitivity, valueSignal } from './rules.ts';
import type { RuleGroup } from './rules.ts';

const mean = (group: RuleGroup, s?: number) => Array.from({ length: 20 }, (_, i) => ruleInsensitivity(group, i + 1, s)).reduce((a, b) => a + b, 0) / 20;

describe('042: batería de validación conductual (MF5)', () => {
  it('V-9 (038 CA-001): el grupo instruido por pliance tarda más en ajustarse que el moldeado, y más con pliance fuerte', () => {
    const shaped = mean('moldeado');
    const pliance = mean('pliance');
    expect(pliance).toBeGreaterThan(shaped);
    expect(mean('pliance', 1)).toBeGreaterThan(mean('pliance', 0.5));
    // Informativo: el tracking se ajusta como la experiencia (sensibilidad del tracking).
    expect(Math.abs(mean('tracking') - shaped)).toBeLessThan(pliance - shaped);
  });

  it('V-11b (038 CA-002): tras 3 rechazos aparece "no quieren pasar tiempo conmigo", aversivo por oposición jerárquica; sin la red de valor, no', () => {
    const r = rejectionScenario();
    expect(r.map((x) => x.appears)).toEqual([false, false, true]);
    expect(r[2]!.thought).toBeLessThan(0);
    const without = rejectionScenario(false);
    expect(without[2]!.thought).toBe(0);
  });

  it('038 CA-003: una acción aversiva que señala un valor recibe la fuente valor, y la pierde si la relación se debilita', () => {
    const strong = valueSignal(0.9);
    expect(strong.aversion).toBeLessThan(0);
    expect(strong.value).toBeGreaterThan(0);
    expect(strong.value + strong.aversion * 0.5).toBeGreaterThan(0); // en la selección, la aversión pesa 0,5 (040)
    expect(valueSignal(0.2).value).toBeLessThan(strong.value / 2);
  });
});
