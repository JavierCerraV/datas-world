// Spec 047 R-005, R-005b, R-005c: la guía del protocolo y la cuenta de lo cubierto, que lleva el motor.
import { describe, expect, it } from 'vitest';
import { ACT_PNR_3, PROTOCOLS, coverage, newProgress, recordExchange, sessionOf } from './index.ts';

describe('047 R-005: el manual es una guía estructurada', () => {
  it('tiene tres sesiones con componentes de id único, mecanismo y texto de trabajo', () => {
    expect(PROTOCOLS['act-pnr-3']).toBe(ACT_PNR_3);
    expect(ACT_PNR_3.sessions.map((s) => s.n)).toEqual([1, 2, 3]);
    const all = ACT_PNR_3.sessions.flatMap((s) => s.components.map((c) => ({ s: s.n, c })));
    expect(new Set(all.map((x) => x.c.id)).size).toBe(all.length);
    for (const { s, c } of all) {
      expect(c.id.startsWith(`s${s}.`)).toBe(true);
      expect(c.minTurns).toBeGreaterThanOrEqual(1);
      expect(c.goal.length).toBeGreaterThan(20);
      expect(c.how.length).toBeGreaterThan(40);
    }
    // Los tres mecanismos con dosis de R-004 aparecen en el protocolo.
    const mechanisms = new Set(all.map((x) => x.c.mechanism));
    for (const m of ['yo', 'extincion', 'valores'] as const) expect(mechanisms.has(m)).toBe(true);
    expect(() => sessionOf(ACT_PNR_3, 4 as 1)).toThrow();
  });
});

describe('047 R-005b, R-005c: el motor lleva la cuenta (CA-010)', () => {
  const s1 = sessionOf(ACT_PNR_3, 1);

  it('un componente se cubre al llegar a sus intercambios mínimos, no antes', () => {
    const p = newProgress();
    const c = s1.components.find((x) => x.minTurns >= 2)!;
    expect(recordExchange(p, s1, c.id)).toBe(true);
    expect(coverage(s1, p).covered).not.toContain(c.id);
    for (let i = 1; i < c.minTurns; i++) recordExchange(p, s1, c.id);
    expect(coverage(s1, p).covered).toContain(c.id);
  });

  it('un componente de otra sesión o inventado no cuenta', () => {
    const p = newProgress();
    expect(recordExchange(p, s1, 's3.jardin')).toBe(false);
    expect(recordExchange(p, s1, 'inventado')).toBe(false);
    expect(coverage(s1, p)).toMatchObject({ covered: [], fidelity: 0 });
  });

  it('la fidelidad es la proporción de obligatorios cubiertos y dice qué faltó', () => {
    const p = newProgress();
    const required = s1.components.filter((c) => c.required);
    const done = required.slice(0, 3);
    for (const c of done) for (let i = 0; i < c.minTurns; i++) recordExchange(p, s1, c.id);
    const cov = coverage(s1, p);
    expect(cov.covered).toEqual(done.map((c) => c.id));
    expect(cov.missing).toEqual(required.slice(3).map((c) => c.id));
    expect(cov.fidelity).toBeCloseTo(3 / required.length, 10);
    for (const c of required.slice(3)) for (let i = 0; i < c.minTurns; i++) recordExchange(p, s1, c.id);
    expect(coverage(s1, p)).toMatchObject({ missing: [], fidelity: 1 });
  });
});
