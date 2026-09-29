import { describe, expect, it } from 'vitest';
import { makeEvent } from '../events.ts';
import type { NewEvent, WorldEvent } from '../events.ts';
import type { Counters, EntityId } from '../ids.ts';
import type { Chapter } from '../memory/types.ts';
import type { WorldView } from '../simulation/system.ts';
import type { Citizen } from '../world.ts';
import { divergences, objectiveChapters } from './chapters.ts';
import { emergentProfile } from './profile.ts';
import { lifeReport } from './report.ts';
import { turningPoints } from './turning.ts';
import type { DayPoint, LifeChapter, ReportInput } from './types.ts';

const DAY = 1440;
const YEAR = 365.25 * DAY;
const A = 'CIT-000001' as EntityId;
const me = [{ id: A, role: 'persona' }];

/** Un registro en memoria, una persona de 40 años y su vista mínima. */
function world(memory: Chapter[] = []) {
  const c = { EVT: 0 } as unknown as Counters;
  const log: WorldEvent[] = [];
  const add = (at: number, e: NewEvent) => {
    const x = makeEvent(c, at, e);
    log.push(x);
    return x;
  };
  const citizen = { id: A, status: 'active', memory: { episodes: [], chapters: memory, forgotten: 0, next: 1 } } as unknown as Citizen;
  const view = {
    citizens: new Map([[A, citizen]]), households: new Map(), components: { i32: { 'demo.birthMinute': [0, -40 * YEAR] }, f32: {}, u8: {} },
  } as unknown as WorldView;
  const input = (trajectory: DayPoint[] = [], now = 200 * DAY): ReportInput => ({ view, id: A, events: log, get: (x) => log.find((e) => e.id === x), trajectory, now });
  return { add, log, view, input };
}
const flat = (days: number, mood = 0.6, from = 0): DayPoint[] => Array.from({ length: days }, (_, k) => ({ day: from + k, mood, stress: 0.3, money: 1_000_000, sleepDebt: 0 }));

describe('020 R-004, R-005: capítulos objetivos y divergencias', () => {
  it('CA-003: un despido abre un capítulo objetivo y uno recordado, y se muestran juntos sin divergencia de fechas', () => {
    const w = world();
    const lost = w.add(50 * DAY, { type: 'JOB_LOST', payload: { citizenId: A, reason: 'cierre' }, participants: me, causes: [{ state: 'caja_negativa', weight: 1 }] });
    const remembered: Chapter[] = [
      { id: 'CHP-1', from: -22 * YEAR, to: 50 * DAY, theme: 'juventud', tone: 0.3, anchors: [] },
      { id: 'CHP-2', from: 50 * DAY, theme: 'desempleo', tone: -0.6, openedBy: lost.id, anchors: [] },
    ];
    const chapters = objectiveChapters(w.input());
    const unemployed = chapters.find((c) => c.theme === 'desempleo')!;
    expect(unemployed.from).toBe(50 * DAY);
    expect(unemployed.openedBy).toBe(lost.id);
    expect(unemployed.tone).toBeLessThan(0);
    const d = divergences(chapters, remembered, 200 * DAY);
    const i = chapters.indexOf(unemployed);
    expect(d.filter((x) => x.chapter === i)).toEqual([]);
  });

  it('CA-004: un periodo recordado con un tono muy distinto del vivido se marca; lo que no se cuenta, y las fechas corridas, también', () => {
    const objective: LifeChapter[] = [
      { from: 0, to: 100 * DAY, theme: 'trabajo', tone: 0.4, events: [] },
      { from: 100 * DAY, to: 200 * DAY, theme: 'desempleo', tone: -0.5, events: [] },
      { from: 200 * DAY, theme: 'pareja', tone: 0.3, events: [] },
    ];
    const remembered: Chapter[] = [
      { id: 'CHP-1', from: 0, to: 100 * DAY, theme: 'trabajo', tone: -0.4, anchors: [] }, // la recuerda mal, fue buena
      { id: 'CHP-2', from: 150 * DAY, to: 190 * DAY, theme: 'desempleo', tone: -0.5, anchors: [] }, // corrida 50 días
    ];
    const d = divergences(objective, remembered, 150 * DAY);
    expect(d.some((x) => x.chapter === 0 && x.kind === 'tone')).toBe(true);
    expect(d.some((x) => x.chapter === 1 && x.kind === 'boundary')).toBe(true);
    expect(d.some((x) => x.chapter === 2 && x.kind === 'missing')).toBe(true);
    expect(d.find((x) => x.chapter === 0)!.note).toMatch(/Recuerda el trabajo como una etapa muy mala/);
  });
});

describe('020 R-002: puntos de inflexión', () => {
  it('CA-001: el hecho con más consecuencias en su vida y el mayor cambio de ánimo sale primero, con su «¿por qué?»', () => {
    const w = world();
    const small = w.add(10 * DAY, { type: 'FELL_ILL', payload: { citizenId: A, illness: 'gripa', days: 3 }, participants: me, causes: [{ state: 'rng', weight: 1 }] });
    const lost = w.add(20 * DAY, { type: 'JOB_LOST', payload: { citizenId: A, reason: 'cierre' }, participants: me, causes: [{ state: 'caja_negativa', weight: 1 }] });
    const debt = w.add(30 * DAY, { type: 'DEBT_TAKEN', payload: { citizenId: A, creditor: 'banco', amount: 500_000, monthlyRate: 0.02 }, participants: [{ id: A, role: 'deudor' }], causes: [{ event: lost.id, weight: 0.5 }, { state: 'deficit', weight: 0.5 }] });
    w.add(40 * DAY, { type: 'PAYMENT_MISSED', payload: { payerId: A, concept: 'banco', amount: 50_000 }, participants: [{ id: A, role: 'pagador' }], causes: [{ event: debt.id, weight: 1 }] });
    const trajectory = [...flat(21, 0.6), ...flat(40, 0.35, 21)];
    const tp = turningPoints(w.input(trajectory));
    expect(tp.length).toBeGreaterThanOrEqual(3);
    const top = tp.find((t) => t.event === lost.id)!;
    expect(top.consequences).toBe(2);
    expect(top.moodDelta).toBeLessThan(-0.2);
    expect(top.why.ref).toBe(lost.id);
    const sick = tp.find((t) => t.event === small.id);
    expect(sick === undefined || sick.consequences === 0).toBe(true);
  });
});

describe('020 R-006: perfil emergente', () => {
  it('CA-005: la resiliencia sale de cuánto tarda en volver a su ánimo, con los golpes de base; sin golpes, sin datos', () => {
    const w = world();
    expect(emergentProfile(w.input(flat(100))).values.resilience).toBeNull();
    const lost = w.add(30 * DAY + 600, { type: 'JOB_LOST', payload: { citizenId: A, reason: 'cierre' }, participants: me, causes: [{ state: 'caja_negativa', weight: 1 }] });
    const quick = [...flat(31, 0.6), ...flat(5, 0.3, 31), ...flat(64, 0.6, 36)];
    const slow = [...flat(31, 0.6), ...flat(40, 0.3, 31), ...flat(29, 0.6, 71)];
    const q = emergentProfile(w.input(quick));
    const s = emergentProfile(w.input(slow));
    expect(q.values.resilience!).toBeGreaterThan(s.values.resilience!);
    expect(q.basis.resilience).toEqual([lost.id]);
    for (const p of [q, s]) for (const [k, v] of Object.entries(p.values)) {
      if (v === null) continue;
      expect(v >= 0 && v <= 1, k).toBe(true);
      expect(p.basis[k as keyof typeof p.basis].length, k).toBeGreaterThan(0);
    }
  });

  it('INV-002: generar el informe no toca el mundo', () => {
    const w = world([{ id: 'CHP-1', from: 0, theme: 'trabajo', tone: 0.2, anchors: [] }]);
    w.add(20 * DAY, { type: 'JOB_LOST', payload: { citizenId: A, reason: 'cierre' }, participants: me, causes: [{ state: 'caja_negativa', weight: 1 }] });
    const before = JSON.stringify([...w.view.citizens.values()]);
    const r = lifeReport(w.input(flat(100)));
    expect(JSON.stringify([...w.view.citizens.values()])).toBe(before);
    expect(r.remembered).toHaveLength(1);
    r.remembered[0]!.tone = 1;
    expect(JSON.stringify([...w.view.citizens.values()])).toBe(before);
  });
});
