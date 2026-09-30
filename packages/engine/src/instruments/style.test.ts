import { describe, expect, it } from 'vitest';
import type { DevelopmentEpisode, WorldEvent } from '../events.ts';
import type { EntityId } from '../ids.ts';
import { createRng } from '../rng.ts';
import type { WorldView } from '../simulation/system.ts';
import { INDICATORS, indicatorValues } from './indicators.ts';
import type { IndicatorKey } from './indicators.ts';
import { NEUTRAL_STYLE, RESPONSE_NOISE, answerInstrument } from './respond.ts';
import { responseStyle } from './style.ts';
import type { Instrument } from './types.ts';

// Spec 045 R-006 (decisión del usuario del 2026-09-30): el estilo de respuesta sale de cómo vivió la persona.
const A = 'CIT-000001' as EntityId;
const DAY = 1440;
let n = 0;
const ev = (type: string, at: number, payload: unknown = {}, who: EntityId = A): WorldEvent =>
  ({ id: `EVT-${String(++n).padStart(11, '0')}`, type, at, participants: [{ id: who, role: 'persona' }], importance: 0.2, payload, causes: [], origin: 'engine' }) as unknown as WorldEvent;
const year = (age: number, kinds: string[]) =>
  ev('DEVELOPMENT_YEAR', age * 365 * DAY, { citizenId: A, age, stage: 'infancia', episodes: kinds.map((k): DevelopmentEpisode => [age * 365 * DAY, k, 'madre', '', -0.5, '', []]) });
const view = (rules: unknown[] = []) => ({ citizens: new Map([[A, { id: A, status: 'active', rules }]]), components: { f32: {}, i32: {}, u8: {} } }) as unknown as WorldView;

const ITEM = (n: number, reversed = false) => ({ n, text: `ítem ${n}`, options: [0, 1, 2, 3].map((v) => ({ label: String(v), value: v })), reversed, mapping: [{ indicator: 'tristeza', weight: 1 }], page: 1 });
const SAD: Instrument = {
  id: 'INS-0001', name: 'Prueba', acronym: 'P', construct: 'tristeza', instructions: '', recallDays: 14,
  items: [1, 2, 3, 4, 5, 6].map((k) => ITEM(k)), scoring: { method: 'sum' }, cutoffs: [], minAge: 18, status: 'revisado', version: 1,
};
const values = (sad: number) => ({ ...Object.fromEntries(INDICATORS.map((k) => [k, 0])), tristeza: sad }) as Record<IndicatorKey, number>;

describe('045 R-006: estilo de respuesta desde la historia', () => {
  it('sin historia, el estilo es neutro', () => {
    expect(responseStyle(view(), A, [], RESPONSE_NOISE)).toEqual(NEUTRAL_STYLE);
  });

  it('expresión castigada y confidencias burladas → minimiza; nombrar emociones lo compensa y baja el ruido', () => {
    const punished = [year(6, ['crianza.expresion_castigada', 'crianza.gritos']), year(15, ['adolescencia.confidencia_burlada'])];
    const s = responseStyle(view(), A, punished, RESPONSE_NOISE);
    expect(s.desirability).toBeCloseTo(0.36, 3);
    expect(s.basis).toEqual(punished.map((e) => e.id));
    const heard = responseStyle(view(), A, [...punished, year(5, ['crianza.nombrar_emocion', 'crianza.consuelo'])], RESPONSE_NOISE);
    expect(heard.desirability).toBeCloseTo(0.12, 3);
    expect(heard.noise).toBeLessThan(RESPONSE_NOISE);
  });

  it('obedecer sin premio y seguir reglas por quien las dice → asiente', () => {
    const rules = [{ hist: { followed: 10, byContingency: 2, bySpeaker: 8 } }];
    const s = responseStyle(view(rules), A, [year(8, ['crianza.regla_obediencia'])], RESPONSE_NOISE);
    expect(s.acquiescence).toBeCloseTo(0.12 + 0.3 * 0.8, 3);
  });

  it('con el mismo malestar, quien minimiza puntúa menos, y quien asiente sube también en los ítems invertidos', () => {
    const v = values(0.8);
    const neutral = answerInstrument(SAD, v, createRng(1));
    const minimizes = answerInstrument(SAD, v, createRng(1), { ...NEUTRAL_STYLE, desirability: 0.6 });
    expect(minimizes.score).toBeLessThan(neutral.score);
    const reversed = { ...SAD, items: SAD.items.map((it) => ({ ...it, reversed: true })) };
    const low = answerInstrument(reversed, values(0.95), createRng(1));
    const agrees = answerInstrument(reversed, values(0.95), createRng(1), { ...NEUTRAL_STYLE, acquiescence: 0.6 });
    expect(agrees.score).toBeGreaterThan(low.score);
    expect(agrees.style.acquiescence).toBe(0.6);
  });
});

describe('045 R-004: sucesos adversos de la ventana', () => {
  it('un despido y una ruptura esta semana valen 1; fuera de la ventana no cuentan', () => {
    const now = 100 * DAY;
    const week = [ev('JOB_LOST', now - 2 * DAY), ev('BREAKUP', now - DAY)];
    const input = (events: WorldEvent[]) => ({ view: view(), id: A, events, trajectory: [], now, recallDays: 7 });
    expect(indicatorValues(input(week)).sucesos_adversos).toBe(1);
    expect(indicatorValues(input([ev('FELL_ILL', now - DAY)])).sucesos_adversos).toBe(0.15);
    expect(indicatorValues(input([ev('JOB_LOST', now - 30 * DAY)])).sucesos_adversos).toBe(0);
  });
});
