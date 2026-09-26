// Batería de validación conductual (spec 042), escenarios de MF2, y criterios de la 036 y de la 009 CA-E.
import { describe, expect, it } from 'vitest';
import { createOntology } from '../functions/sensitivity.ts';
import { isGeneralized, netValue, pair, reinforcingValue } from '../functions/learn.ts';
import { LEARNING_DEFAULTS, NEUTRAL, emptyStore } from '../functions/types.ts';
import type { Sensitivity } from '../functions/types.ts';
import { acquisitionExtinction, avoidancePersistence, generalizationGradient, recoveryRenewal } from './scenarios.ts';

const sens = (aversive: number): Sensitivity => ({ ...NEUTRAL, aversive: 0.5 + aversive });

describe('042: batería de validación conductual (MF2)', () => {
  it('V-1 (036 CA-001): adquisición negativamente acelerada y extinción monotónica por debajo del 20 % del máximo', () => {
    const { acquisition: a, extinction: e } = acquisitionExtinction();
    const inc = a.map((v, i) => v - (i ? a[i - 1]! : 0));
    for (let i = 1; i < inc.length; i++) expect(inc[i]!).toBeLessThanOrEqual(inc[i - 1]! + 1e-12);
    for (let i = 1; i < e.length; i++) expect(e[i]!).toBeLessThanOrEqual(e[i - 1]! + 1e-12);
    expect(e.at(-1)!).toBeLessThan(0.2 * Math.max(...a));
    expect(Math.max(...a)).toBeGreaterThan(0.8);
  });

  it('V-2 (036 CA-002): recuperación espontánea en B y renovación ABA', () => {
    const r = recoveryRenewal();
    expect(Math.abs(r.endExtinctionB)).toBeLessThan(0.2 * Math.abs(r.acquired));
    expect(Math.abs(r.laterB)).toBeGreaterThan(Math.abs(r.endExtinctionB)); // recuperación espontánea
    expect(Math.abs(r.renewalA)).toBeGreaterThan(Math.abs(r.laterB)); // renovación en el contexto de adquisición
  });

  it('V-3 (036 CA-003): gradiente unimodal decreciente; la discriminación lo estrecha del lado de S− y desplaza el pico', () => {
    const { simple, discriminative } = generalizationGradient();
    const peak = (xs: number[]) => xs.indexOf(Math.max(...xs));
    expect(peak(simple)).toBe(4);
    for (let i = 0; i < 4; i++) expect(simple[i]!).toBeLessThan(simple[i + 1]!);
    for (let i = 4; i < 8; i++) expect(simple[i]!).toBeGreaterThan(simple[i + 1]!);
    // Normalizado por su máximo: del lado de S− (tono 6) cae mucho más; el pico se aleja de S−.
    const norm = (xs: number[]) => xs.map((x) => x / Math.max(...xs));
    expect(norm(discriminative)[6]!).toBeLessThan(norm(simple)[6]! - 0.3);
    expect(peak(discriminative)).toBeLessThan(4);
  });

  it('V-6: la evitación persiste sin descargas (> 50 de 100 ensayos, media de 5 sujetos) y más con mayor sensibilidad aversiva', () => {
    const seeds = [1, 2, 3, 7, 42];
    const mean = (aversive: number) => seeds.reduce((a, seed) => a + avoidancePersistence(sens(aversive), seed).avoidedInExtinction, 0) / seeds.length;
    const low = mean(0.2);
    const high = mean(0.8);
    expect(high).toBeGreaterThan(50);
    expect(high).toBeGreaterThan(low);
    // Reproducible con semilla.
    expect(avoidancePersistence(sens(0.8), 42)).toEqual(avoidancePersistence(sens(0.8), 42));
  });
});

describe('036: criterios de los mecanismos', () => {
  const onto = createOntology([
    { key: 'campana', kind: 'verbal_term', features: [0] },
    { key: 'moneda', kind: 'verbal_term', features: [0.5] },
    { key: 'comida', kind: 'body_state', features: [1], primary: 1 },
  ]);
  const P = LEARNING_DEFAULTS;

  it('CA-004 y 009 CA-E: a igual historia, más sensibilidad aversiva da una función aversiva más fuerte en cada ensayo', () => {
    const a = emptyStore();
    const b = emptyStore();
    for (let k = 0; k < 5; k++) {
      const trial = { stim: 'campana', ctx: '', now: k, lambda: -1, us: 'comida' };
      pair(a, onto, trial, P, sens(0.2));
      pair(b, onto, trial, P, sens(0.8));
      expect(netValue(b, onto, 'campana', '', k + 1, P)).toBeLessThan(netValue(a, onto, 'campana', '', k + 1, P));
    }
  });

  it('CA-005: emparejado con ≥ 3 reforzadores distintos, un estímulo es reforzador generalizado y conserva su eficacia sin la operación motivadora', () => {
    const s = emptyStore();
    let t = 0;
    for (const us of ['comida', 'calor', 'contacto']) for (let k = 0; k < 10; k++) pair(s, onto, { stim: 'moneda', ctx: '', now: t++, lambda: 0.8, us }, P, NEUTRAL);
    for (let k = 0; k < 30; k++) pair(s, onto, { stim: 'campana', ctx: '', now: t++, lambda: 0.8, us: 'comida' }, P, NEUTRAL);
    const coin = s.f.find((f) => f.s === 'moneda')!;
    const bell = s.f.find((f) => f.s === 'campana')!;
    expect(isGeneralized(coin)).toBe(true);
    expect(isGeneralized(bell)).toBe(false);
    // Saciado (operación motivadora 0,1): la campana pierde casi toda su eficacia; la moneda, ninguna.
    expect(reinforcingValue(coin, '', t, P, 0.1)).toBeCloseTo(reinforcingValue(coin, '', t, P, 1), 10);
    expect(reinforcingValue(bell, '', t, P, 0.1)).toBeLessThan(0.2 * reinforcingValue(bell, '', t, P, 1));
  });

  it('las funciones guardan su origen (036 INV-002) y no pasan de los topes (INV-003)', () => {
    const s = emptyStore();
    pair(s, onto, { stim: 'campana', ctx: '', now: 0, lambda: 1, us: 'comida', source: 'EVT-00000000001' }, P, NEUTRAL);
    expect(s.f[0]!.src).toEqual(['EVT-00000000001']);
  });
});
