// Spec 046: corrección (CA-001), respuestas verdaderas (CA-004, CA-005), disposición (CA-008) y muestra.
import { describe, expect, it } from 'vitest';
import { createRng } from '../rng.ts';
import { dispose } from './candor.ts';
import type { Indicators } from './indicators.ts';
import { INSTRUMENTS, INSTRUMENT_IDS } from './instruments.ts';
import type { InstrumentId } from './instruments.ts';
import { truthfulResponses } from './response.ts';
import { scoreInstrument } from './scoring.ts';
import { AGE_GROUPS, selectSample } from './sample.ts';
import type { Participant } from './sample.ts';

const NEUTRAL: Indicators = {
  mood: 0.6, stress: 0.25, negAffect: 0.25, joy: 0.3, sadness: 0.1, fear: 0.1, anger: 0.1, shame: 0.05, energyLack: 0.3, funLack: 0.3, lonely: 0.3, sleepDebt: 0.1,
  coreNow: 0.3, coreBase: 0.3, avoidance: 0.2, pnrLoad: 0.05, pnrRecent: 0.1, selfFraming: 0.3, aversiveBurden: 0.2, approvalValue: 0.3, positiveContact: 0.4,
  pliance: 0.4, tracking: 0.5, sensitivity: 0.5, valueImportance: 0.6, valueContact: 0.6, valueGap: 0, jobStability: 0.7, relationshipStability: 0.7,
  socialNetwork: 0.6, stressorExposure: 0.2, economicTrajectory: 0.6, resilience: 0.6, health: 0.9,
};
const total = (id: InstrumentId, ind: Indicators, seed = 7) => scoreInstrument(id, truthfulResponses(id, ind, createRng(seed)).t).total;

describe('046 — corrección (CA-001)', () => {
  it('suma, subescalas y banda de la ficha', () => {
    expect(scoreInstrument('AAQ-II', [3, 3, 3, 3, 3, 3, 3])).toMatchObject({ total: 21, band: 'sin problema clínico (promedio 18–23)' });
    expect(scoreInstrument('AAQ-II', [5, 5, 5, 5, 5, 5, 5]).band).toBe('clínico (más de 29)');
    expect(scoreInstrument('GHQ-12', Array(12).fill(1)).band).toBe('posible trastorno emocional (12 o más)');
    expect(scoreInstrument('GHQ-12', Array(12).fill(0)).band).toBe('sin indicio de malestar (0–11)');
    expect(scoreInstrument('GPQ-9', Array(9).fill(3)).total).toBe(27);
    expect(scoreInstrument('GTQ', Array(11).fill(5)).total).toBe(55);
    expect(scoreInstrument('SWLS', [7, 7, 7, 7, 7]).band).toBe('muy alta satisfacción');
    expect(scoreInstrument('SWLS', [4, 4, 4, 4, 4]).band).toBe('promedio en satisfacción');
  });

  it('DASS-21: subescalas con los ítems de la ficha y sus cortes', () => {
    const r = Array(21).fill(0);
    for (const n of [3, 5, 10, 13, 16, 17, 21]) r[n - 1] = 2; // depresión: 14
    for (const n of [2, 4, 7, 9]) r[n - 1] = 1; // ansiedad: 4
    for (const n of [1, 6, 8]) r[n - 1] = 3; // estrés: 9
    const s = scoreInstrument('DASS-21', r);
    expect(s.subscales).toEqual({ depresion: 14, ansiedad: 4, estres: 9 });
    expect(s.bands).toEqual({ depresion: 'depresión extremadamente severa', ansiedad: 'ansiedad leve', estres: 'estrés leve' });
    expect(s.total).toBe(27);
  });

  it('rechaza respuestas fuera de la escala o incompletas (INV-003)', () => {
    expect(() => scoreInstrument('SWLS', [1, 2, 3, 4])).toThrow();
    expect(() => scoreInstrument('SWLS', [1, 2, 3, 4, 8])).toThrow();
    expect(() => scoreInstrument('DASS-21', Array(21).fill(4))).toThrow();
  });

  it('cada instrumento tiene los ítems de la ficha', () => {
    const n = Object.fromEntries(INSTRUMENT_IDS.map((id) => [id, INSTRUMENTS[id].items.length]));
    expect(n).toEqual({ 'AAQ-II': 7, 'GHQ-12': 12, 'GPQ-9': 9, GTQ: 11, 'DASS-21': 21, SWLS: 5 });
    expect(INSTRUMENTS['GHQ-12'].items.every((i) => i.options?.length === 4)).toBe(true);
  });
});

describe('046 — respuesta verdadera (CA-004, CA-005)', () => {
  it('quien perdió su empleo y acumuló deuda puntúa más en malestar y menos en satisfacción (CA-004)', () => {
    const hit: Indicators = {
      ...NEUTRAL, mood: 0.3, stress: 0.7, negAffect: 0.65, sadness: 0.5, joy: 0.1, coreNow: 0.65, jobStability: 0.2, economicTrajectory: 0.15, aversiveBurden: 0.6,
      pnrRecent: 0.5, valueGap: 0.3, relationshipStability: 0.5, health: 0.7,
    };
    for (const id of ['AAQ-II', 'GHQ-12', 'DASS-21'] as const) expect(total(id, hit)).toBeGreaterThan(total(id, NEUTRAL));
    expect(total('SWLS', hit)).toBeLessThan(total('SWLS', NEUTRAL));
  });

  it('GHQ-12: el cambio frente a lo habitual pesa (empeorar con la misma base)', () => {
    const worse = { ...NEUTRAL, coreNow: 0.6, negAffect: 0.55, stress: 0.6 };
    expect(total('GHQ-12', worse)).toBeGreaterThan(total('GHQ-12', NEUTRAL));
    // Quien siempre estuvo mal no puntúa como quien acaba de empeorar, pero puntúa más que quien está bien.
    const chronic = { ...worse, coreBase: 0.6 };
    expect(total('GHQ-12', chronic)).toBeLessThan(total('GHQ-12', worse));
    expect(total('GHQ-12', chronic)).toBeGreaterThan(total('GHQ-12', NEUTRAL));
  });

  it('más pliance y valor de la aprobación: más GPQ-9 y menos GTQ (CA-005)', () => {
    const pli = { ...NEUTRAL, pliance: 0.9, tracking: 0.1, approvalValue: 0.9, sensitivity: 0.2, lonely: 0.5 };
    expect(total('GPQ-9', pli)).toBeGreaterThan(total('GPQ-9', NEUTRAL));
    expect(total('GTQ', pli)).toBeLessThan(total('GTQ', NEUTRAL));
  });

  it('las respuestas están en la escala y el mismo flujo da lo mismo (determinismo)', () => {
    for (const id of INSTRUMENT_IDS) {
      const a = truthfulResponses(id, NEUTRAL, createRng(5));
      const b = truthfulResponses(id, NEUTRAL, createRng(5));
      expect(a).toEqual(b);
      const ins = INSTRUMENTS[id];
      expect(a.t.length).toBe(ins.items.length);
      for (const r of a.t) expect(r >= ins.min && r <= ins.max).toBe(true);
    }
  });
});

describe('046 — disposición (CA-008)', () => {
  const share = (ind: Indicators, kind: string, trust = 0) => {
    let hit = 0, all = 0;
    for (let s = 0; s < 300; s++) {
      const d = dispose('DASS-21', Array(21).fill(1), ind, createRng(s), trust);
      hit += d.disposition.filter((x) => x === kind).length;
      all += 21;
    }
    return hit / all;
  };

  it('vergüenza, aprobación y evitación elevan minimizar; carga aversiva y soledad, exagerar', () => {
    const hider = { ...NEUTRAL, shame: 0.8, approvalValue: 0.9, avoidance: 0.8, pliance: 0.8, aversiveBurden: 0, lonely: 0 };
    const shower = { ...NEUTRAL, shame: 0, approvalValue: 0, avoidance: 0, pliance: 0, aversiveBurden: 0.9, lonely: 0.9, positiveContact: 0.8, negAffect: 0.8 };
    expect(share(hider, 'minimiza') + share(hider, 'miente')).toBeGreaterThan(share(shower, 'minimiza') + share(shower, 'miente'));
    expect(share(shower, 'exagera')).toBeGreaterThan(share(hider, 'exagera'));
  });

  it('con menos confianza hay más mentira; nadie se sale de la escala', () => {
    const ind = { ...NEUTRAL, shame: 0.6, approvalValue: 0.8, avoidance: 0.7 };
    expect(share(ind, 'miente', 0)).toBeGreaterThan(share(ind, 'miente', 1));
    const d = dispose('SWLS', [4, 4, 4, 4, 4], ind, createRng(1));
    for (const r of d.r) expect(r >= 1 && r <= 7).toBe(true);
  });

  it('un ítem fiel dice lo verdadero; el flujo es estable ítem a ítem', () => {
    const d = dispose('GTQ', Array(11).fill(4), NEUTRAL, createRng(3));
    d.disposition.forEach((x, k) => x === 'fiel' && expect(d.r[k]).toBe(4));
    expect(dispose('GTQ', Array(11).fill(4), NEUTRAL, createRng(3))).toEqual(d);
  });
});

describe('046 — muestra (R-005)', () => {
  const pool: Participant[] = [];
  for (let i = 0; i < 200; i++) {
    const g = AGE_GROUPS[i % 4]!;
    const sex = Math.floor(i / 4) % 2 === 0 ? 'F' : 'M';
    pool.push({ id: `CIT-${String(i + 1).padStart(6, '0')}` as Participant['id'], sex, age: g.from, stratum: `${sex} ${g.label}` });
  }

  it('50 personas distintas, con todos los estratos, y el mismo flujo da la misma muestra', () => {
    const s = selectSample(pool, 50, createRng(9));
    expect(s.length).toBe(50);
    expect(new Set(s.map((p) => p.id)).size).toBe(50);
    expect(new Set(s.map((p) => p.stratum)).size).toBe(8);
    expect(selectSample(pool, 50, createRng(9)).map((p) => p.id)).toEqual(s.map((p) => p.id));
    expect(selectSample(pool, 50, createRng(10)).map((p) => p.id)).not.toEqual(s.map((p) => p.id));
  });

  it('falla si no hay para todos los estratos', () => {
    expect(() => selectSample(pool, 5, createRng(1))).toThrow();
  });
});
