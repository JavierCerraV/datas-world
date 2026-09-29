import { describe, expect, it } from 'vitest';
import type { WorldEvent } from '../events.ts';
import type { EntityId } from '../ids.ts';
import { createOntology } from '../functions/sensitivity.ts';
import { LEARNING_DEFAULTS, emptyStore } from '../functions/types.ts';
import type { FunctionStore } from '../functions/types.ts';
import { directValue } from '../functions/learn.ts';
import { functionalValue } from '../relations/derive.ts';
import type { RelationalNetwork } from '../relations/types.ts';
import { createRng } from '../rng.ts';
import type { Patch, TickCtx, WorldView } from '../simulation/system.ts';
import type { Citizen } from '../world.ts';
import { consolidate } from './consolidate.ts';
import { addMemory, decayDay, distortion, encodeEvent, recall, rehearse, trim } from './episodes.ts';
import type { FnOf } from './episodes.ts';
import { createMemorySystem } from './system.ts';
import { MEMORY_DEFAULTS as P, emptyMemory } from './types.ts';
import type { Memory, MemoryStore } from './types.ts';

const DAY = 1440;
const A = 'CIT-000001' as EntityId;
const B = 'CIT-000002' as EntityId;
const onto = createOntology(['verbal.trabajo', 'verbal.despido', 'verbal.critica', 'verbal.aprobacion'].map((key, i) => ({
  key, kind: 'verbal_term' as const, features: [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0, i === 3 ? 1 : 0],
})));
const storeWith = (entries: [string, number][]): FunctionStore => ({
  ...emptyStore(), f: entries.map(([s, v]) => ({ s, v, c: '', inh: [], hab: 0, n: 10, rs: [], o: 'direct' as const, src: [], at: 0 })),
});
const fnFrom = (entries: [string, number][]): FnOf => (s) => entries.find(([k]) => k === s)?.[1] ?? 0;
let seq = 1;
const event = (type: string, payload: Record<string, unknown>, participants: string[], at = 0, importance = 0.5): WorldEvent =>
  ({ id: `EVT-${String(seq++).padStart(11, '0')}`, type, at, payload, participants: participants.map((id) => ({ id, role: 'persona' })), causes: [], importance, origin: 'engine' }) as unknown as WorldEvent;
/** Vista mínima: ciudadanos, lugares vacíos, configuración sin perfil y las capacidades de la memoria. */
const viewOf = (people: Record<string, Partial<Citizen>>, caps = ['memory', 'consolidation']): WorldView =>
  ({
    citizens: new Map(Object.entries(people).map(([id, c]) => [id, { id, status: 'active', ...c }])),
    places: new Map(), config: { epoch: '2027-01-01T00:00', profile: undefined }, capabilities: caps, components: { f32: {}, i32: {}, u8: {} },
  }) as unknown as WorldView;
const memoryOf = (patches: readonly Patch[]): MemoryStore => {
  const p = patches.find((x) => x.op === 'entity');
  return (p as Extract<Patch, { op: 'entity' }>).fields.memory as MemoryStore;
};
const mem = (over: Partial<Memory>): Omit<Memory, 'id'> => ({ at: 0, source: 'lived', kind: 'ARGUMENT', stims: [`cit.${B}`], lambda: -0.5, valence: -0.4, valence0: -0.4, intensity: 0.5, rehearsals: 0, ...over });

describe('013 codificación y olvido (R-001 a R-005)', () => {
  it('CA-001: un despido deja un recuerdo negativo que sigue activo al año, más intenso en quien valoraba el trabajo', () => {
    const lost = event('JOB_LOST', { citizenId: A, reason: 'cierre' }, [A], 0, 0.7);
    const view = viewOf({ [A]: {} });
    const keeps = (valued: number) => {
      const s = emptyMemory();
      const m = encodeEvent(s, lost, A, view, fnFrom([['dominio.trabajo', valued], ['verbal.trabajo', valued / 2]]), P)!;
      const first = m.intensity;
      for (let d = 1; d <= 365; d++) decayDay(m, d * DAY, P);
      trim(s, 365 * DAY, P);
      return { first, m, active: s.episodes.length === 1 };
    };
    const high = keeps(0.8);
    const low = keeps(0.1);
    expect(high.m.valence).toBeLessThan(-0.3);
    expect(high.active).toBe(true);
    expect(high.first).toBeGreaterThan(low.first);
  });

  it('CA-002: un primer encuentro trivial con un desconocido no deja recuerdo', () => {
    const met = event('MET', { a: A, b: B, placeId: 'PLC-0001' }, [A, B], 0, 0.1);
    const s = emptyMemory();
    expect(encodeEvent(s, met, A, viewOf({ [A]: {}, [B]: {} }), () => 0, P)).toBeUndefined();
    expect(s.episodes).toEqual([]);
  });

  it('lo que se repite es menos saliente (habituación) y el tope no borra las anclas de un capítulo', () => {
    const view = viewOf({ [A]: {}, [B]: {} });
    const fn = fnFrom([[`cit.${B}`, -0.3]]);
    const s = emptyMemory();
    const one = encodeEvent(s, event('ARGUMENT', { a: A, b: B, stanceA: 'x', stanceB: 'y', tension: 0.4 }, [A, B], 0), A, view, fn, P)!;
    const two = encodeEvent(s, event('ARGUMENT', { a: A, b: B, stanceA: 'x', stanceB: 'y', tension: 0.4 }, [A, B], DAY), A, view, fn, P);
    expect(one.intensity).toBeGreaterThan(two?.intensity ?? 0);
    const big = emptyMemory();
    const anchor = addMemory(big, mem({ intensity: 0.06 }));
    big.chapters.push({ id: 'CHP-900', from: 0, theme: 'duelo', tone: -0.5, anchors: [anchor.id] });
    for (let i = 0; i < P.maxEpisodes + 10; i++) addMemory(big, mem({ intensity: 0.5, at: i }));
    trim(big, 100 * DAY, P);
    expect(big.episodes.length).toBe(P.maxEpisodes);
    expect(big.episodes.some((m) => m.id === anchor.id)).toBe(true);
    expect(big.forgotten).toBe(11);
  });
});

describe('013 recuperación y reconstrucción (R-006, R-007)', () => {
  it('CA-003: repasar un recuerdo con alguien que hoy le cae peor lo recuerda peor de lo que lo vivió', () => {
    const s = emptyMemory();
    const m = addMemory(s, mem({ kind: 'FRIENDSHIP_FORMED', lambda: 0.5, valence: 0.4, valence0: 0.4 }));
    const now = fnFrom([[`cit.${B}`, -0.6]]);
    for (let i = 0; i < 10; i++) rehearse(m, now, P);
    expect(m.rehearsals).toBe(10);
    expect(m.valence).toBeLessThan(m.valence0);
    expect(distortion(m)).toBeGreaterThan(0);
  });

  it('CA-008: la misma memoria y el mismo contexto dan la misma lista en el mismo orden', () => {
    const s = emptyMemory();
    for (let i = 0; i < 20; i++) addMemory(s, mem({ at: i * DAY, intensity: 0.3 + (i % 3) * 0.1, valence: i % 2 ? 0.3 : -0.3 }));
    const ctx = { mood: 0.5, now: 30 * DAY, stims: [`cit.${B}`] };
    expect(recall(s, ctx, 8, P).map((m) => m.id)).toEqual(recall(JSON.parse(JSON.stringify(s)) as MemoryStore, ctx, 8, P).map((m) => m.id));
  });

  it('CA-009: con el ánimo bajo recuerda más lo malo', () => {
    const s = emptyMemory();
    for (let i = 0; i < 20; i++) addMemory(s, mem({ at: i * DAY, intensity: 0.5, valence: i % 2 ? 0.6 : -0.6 }));
    const negatives = (mood: number) => recall(s, { mood, now: 30 * DAY }, 10, P).filter((m) => m.valence < 0).length;
    expect(negatives(0.1)).toBeGreaterThan(negatives(0.9));
  });
});

describe('013 consolidación en la red (R-009)', () => {
  it('CA-004: 5 discusiones con la misma persona dejan en la red la relación persona → crítica, con sus episodios de origen', () => {
    const s = emptyMemory();
    for (let i = 0; i < 5; i++) addMemory(s, mem({ at: i * 12 * DAY, us: 'verbal.critica', event: `EVT-0000000010${i}` as EntityId }));
    const net: RelationalNetwork = { e: [], pruned: 0 };
    const changes = consolidate(s, net, 60 * DAY, P);
    const r = net.e.find((x) => x.a === `cit.${B}` && x.b === 'verbal.critica' && x.t === 'causes')!;
    expect(r.s).toBeGreaterThanOrEqual(0.5);
    expect(r.o).toBe('observed');
    expect(r.src.length).toBeGreaterThan(0);
    expect(changes.some((c) => c.created)).toBe(true);
    // Uno de signo contrario la debilita.
    addMemory(s, mem({ at: 61 * DAY, kind: 'FRIENDSHIP_FORMED', lambda: 0.5, us: 'verbal.aprobacion' }));
    const before = r.s;
    consolidate(s, net, 62 * DAY, P);
    expect(r.s).toBeLessThan(before);
  });

  it('CA-005: olvidados los episodios y extinguida la función directa, la relación sigue apartando de esa persona', () => {
    const store = storeWith([['verbal.critica', -0.6]]);
    const net: RelationalNetwork = { e: [{ a: `cit.${B}`, b: 'verbal.critica', t: 'causes', s: 0.6, o: 'observed', src: [], at: 0 }], pruned: 0 };
    const direct = (s: string) => directValue(store, onto, s, '', 2 * 365 * DAY, LEARNING_DEFAULTS);
    const withSchema = functionalValue(net, direct, `cit.${B}`).value;
    const without = functionalValue({ e: [], pruned: 0 }, direct, `cit.${B}`).value;
    expect(withSchema).toBeLessThan(without);
    // El peso con que el encuentro la elige (012 R-001) es menor.
    expect(Math.max(0.1, 1 + withSchema)).toBeLessThan(Math.max(0.1, 1 + without));
  });
});

describe('013 sistema de memoria', () => {
  it('CA-006: un despido saliente cierra el capítulo y abre «desempleo» con tono negativo y el despido como causa', () => {
    const lost = event('JOB_LOST', { citizenId: A, reason: 'cierre' }, [A], 5 * DAY + 600, 0.7);
    const memory = emptyMemory();
    memory.chapters.push({ id: 'CHP-1', from: -1000 * DAY, theme: 'trabajo', tone: 0.3, anchors: [] });
    memory.next = 2;
    const view = viewOf({ [A]: { memory, functions: storeWith([['verbal.trabajo', 0.7]]) } });
    const ctx: TickCtx = { now: 5 * DAY + 600, citizens: [1], level: () => 3, events: [lost] };
    const out = createMemorySystem(onto).run(view, ctx, createRng(1));
    const types = out.events!.map((e) => e.type);
    expect(types).toEqual(['CHAPTER_CLOSED', 'CHAPTER_OPENED']);
    const opened = out.events![1]!;
    expect(opened.payload).toMatchObject({ citizenId: A, theme: 'desempleo' });
    expect((opened.payload as { tone: number }).tone).toBeLessThan(0);
    expect(opened.causes).toEqual([{ event: lost.id, weight: 1 }]);
    const patched = memoryOf(out.patches!);
    expect(patched.chapters.find((c) => c.theme === 'trabajo')!.to).toBe(ctx.now);
    expect(patched.episodes[0]!.chapter).toBe(patched.chapters.at(-1)!.id);
  });

  it('la rumiación (039) repasa y reconstruye los recuerdos de su foco', () => {
    const memory = emptyMemory();
    addMemory(memory, mem({ kind: 'CONFRONTATION', stims: [`cit.${B}`, 'verbal.traicion'], lambda: -0.6, valence: -0.3, valence0: -0.3, intensity: 0.4 }));
    const view = viewOf({ [A]: { memory, functions: storeWith([[`cit.${B}`, -0.8]]) } });
    const pnr = event('PNR_EPISODE', { citizenId: A, trigger: 'verbal.traicion', steps: 4, minutes: 20, ended: 'bajo', peak: 0.8 }, [A], 100);
    const out = createMemorySystem(onto).run(view, { now: 100, citizens: [1], level: () => 3, events: [pnr] }, createRng(1));
    const m = memoryOf(out.patches!).episodes[0]!;
    expect(m.rehearsals).toBe(4);
    expect(m.intensity).toBeGreaterThan(0.4);
    expect(m.valence).toBeLessThan(-0.3);
  });
});
