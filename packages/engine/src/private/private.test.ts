import { describe, expect, it } from 'vitest';
import { ACTIVITY, ACTIVITY_COLUMN } from '../activity.ts';
import { defineColumn } from '../components.ts';
import { createOntology } from '../functions/sensitivity.ts';
import { emptyStore } from '../functions/types.ts';
import type { FunctionStore } from '../functions/types.ts';
import { idNumber } from '../ids.ts';
import { networkMetrics, teach } from '../relations/network.ts';
import type { RelationalNetwork } from '../relations/types.ts';
import { createRng } from '../rng.ts';
import type { TickCtx, WorldView } from '../simulation/system.ts';
import { TEST_PROFILE, testConfig } from '../testing.ts';
import { addHousehold, addPerson, addPlace, createWorld } from '../world.ts';
import { PRIVATE_DEFAULTS, SELF_RESPONSE } from './params.ts';
import { activate, consolidate, derivationStep, loadOf } from './pnr.ts';
import { mindTick } from './system.ts';
import type { MindState } from './types.ts';

const P = PRIVATE_DEFAULTS;
const V = (key: string, features: number[]) => ({ key, kind: 'verbal_term' as const, features });
const onto = createOntology([
  V('verbal.traicion', [1, 0.2, 0.2, 0, 0, 0.8]), V('verbal.abandono', [0, 1, 0, 0, 1, 0]), V('verbal.soledad', [0, 0, 1, 0, 0, 1]),
  V('verbal.critica', [1, 0, 0, 0, 0, 0]), V('dominio.familia', [0, 0, 0, 1, 1, 1]),
]);
const storeWith = (f: [string, number][], r: [string, number][] = []): FunctionStore => ({
  ...emptyStore(),
  f: f.map(([s, v]) => ({ s, v, c: '', inh: [], hab: 0, n: 5, rs: [], o: 'direct' as const, src: [], at: 0 })),
  r: r.map(([k, w]) => ({ r: k, c: '', w, n: 5, at: 0 })),
});
/** Traición ~ abandono ~ soledad: dos pasos de derivación desde la traición. */
const chain = (): RelationalNetwork => {
  const net: RelationalNetwork = { e: [], pruned: 0 };
  teach(net, { a: 'verbal.traicion', b: 'verbal.abandono', t: 'coordination', s: 0.9, now: 0 });
  teach(net, { a: 'verbal.abandono', b: 'verbal.soledad', t: 'coordination', s: 0.9, now: 0 });
  return net;
};

/** Una persona con su almacén y su red, despierta y sin hacer nada. */
function person(store: FunctionStore, net: RelationalNetwork) {
  const { world } = createWorld(testConfig({ epoch: '2027-02-01T00:00', initialCapabilities: ['clock', 'needs', 'routines', 'learning'], profile: TEST_PROFILE, seed: 3 }));
  defineColumn(world.components, 'u8', ACTIVITY_COLUMN, ACTIVITY.idle);
  const dwelling = addPlace(world, { kind: 'vivienda.unidad', name: 'Vivienda', openingHours: null });
  const h = addHousehold(world, { template: 'single', dwellingId: dwelling });
  const id = addPerson(world, { name: { given: 'Ana', family: ['Rojas', 'Gómez'] }, sex: 'F', birthplace: 'co.cali', householdId: h });
  Object.assign(world.citizens.get(id)!, { functions: store, network: net });
  world.now = 10 * 60;
  return { world, id, row: idNumber(id) };
}
const ctx = (world: { now: number }, row: number): TickCtx => ({ now: world.now, citizens: [row], level: () => 2, events: [] });

describe('eventos privados (039 R-001 a R-005)', () => {
  it('la carga suma lo aversivo con techo 1; un pensamiento repetido queda con su función más aversiva; tope de 16', () => {
    const m: MindState = { active: [] };
    activate(m, { s: 'a', fn: -0.4, from: 'a', at: 0 }, P);
    activate(m, { s: 'a', fn: -0.2, from: 'a', at: 0 }, P);
    activate(m, { s: 'b', fn: 0.5, from: 'b', at: 0 }, P);
    expect(m.active.find((e) => e.s === 'a')!.fn).toBe(-0.4);
    expect(loadOf(m)).toBeCloseTo(0.4, 6);
    for (let i = 0; i < 30; i++) activate(m, { s: `x${String(i).padStart(2, '0')}`, fn: -0.1 - i / 100, from: 'a', at: 0 }, P);
    expect(m.active).toHaveLength(P.maxActive);
    expect(loadOf(m)).toBe(1);
  });

  it('R-002 y R-005: el paso deriva el pensamiento más aversivo por la red y consolida el camino; sin red, repite y se habitúa', () => {
    const net = chain();
    const m: MindState = { active: [{ s: 'verbal.traicion', fn: -0.8, from: 'verbal.traicion', at: 0 }] };
    const first = derivationStep(m, net, P)!;
    expect(first).toMatchObject({ kind: 'derived', from: 'verbal.traicion', to: 'verbal.abandono' });
    expect(first.fn).toBeCloseTo(-0.8 * 0.9, 6);
    // El abandono ya está activo: el paso siguiente llega a la soledad por un camino de dos aristas.
    m.active.push({ s: 'verbal.abandono', fn: first.fn, from: 'verbal.traicion', at: 0 });
    const second = derivationStep(m, net, P)!;
    expect(second.to).toBe('verbal.soledad');
    expect(second.path).toHaveLength(2);
    const before = networkMetrics(net);
    expect(consolidate(net, second, 5)).toBe(true);
    const after = networkMetrics(net);
    expect(after.derivationLevel).toBeLessThan(before.derivationLevel);
    expect(net.e.at(-1)).toMatchObject({ a: 'verbal.traicion', b: 'verbal.soledad', o: 'derived_stored' });
    // Sin red: vuelve sobre lo mismo.
    const alone = derivationStep({ active: [{ s: 'verbal.critica', fn: -0.6, from: 'verbal.critica', at: 0 }] }, undefined, P)!;
    expect(alone).toMatchObject({ kind: 'repeat', to: 'verbal.critica' });
    expect(alone.fn).toBeCloseTo(-0.6 * (1 - P.repeatHabituation), 6);
  });
});

describe('el episodio de PNR (039 R-002, R-003, R-004, R-006; INV-001)', () => {
  const run = (store: FunctionStore, net: RelationalNetwork, acts: (tick: number) => number = () => ACTIVITY.idle, maxTicks = 400) => {
    const { world, row } = person(store, net);
    const ends: string[] = [];
    let steps = 0;
    for (let t = 0; t < maxTicks; t++) {
      world.components.u8[ACTIVITY_COLUMN]![row] = acts(t);
      const r = mindTick(world as unknown as WorldView, row, ctx(world, row), onto, createRng(t), P, t === 0 ? [{ s: 'verbal.traicion', cause: 'EVT-000001' }] : []);
      if (!r) break;
      Object.assign(world.citizens.get(`CIT-${String(row).padStart(6, '0')}` as never)!, { mind: r.mind, functions: r.store, network: r.net });
      steps = r.mind.episode?.steps ?? steps;
      for (const e of r.events) if (e.type === 'PNR_EPISODE') ends.push((e.payload as { ended: string }).ended);
      world.now += 5;
    }
    return { ends, world, row, steps };
  };

  it('un hecho aversivo dispara el pensamiento; con carga ≥ 0,5 empieza un episodio que termina (INV-001) y queda registrado', () => {
    const { ends } = run(storeWith([['verbal.traicion', -0.9]]), chain());
    expect(ends).toHaveLength(1);
    expect(['bajo', 'tope', 'yo']).toContain(ends[0]); // «Yo» parte con fuerza 0,1: a veces toma distancia
  });

  it('con poca carga no hay episodio: el pensamiento se desvanece solo', () => {
    const { ends, world, row } = run(storeWith([['verbal.traicion', -0.3]]), chain(), undefined, 200);
    expect(ends).toEqual([]);
    expect(world.citizens.get(`CIT-${String(row).padStart(6, '0')}` as never)!.mind?.active ?? []).toEqual([]);
  });

  it('R-004: pasar a distraerse en pleno episodio lo corta y el alivio refuerza esa evitación', () => {
    // Sin «Yo» (fuerza 0), para que el episodio llegue a la distracción.
    const { ends, world, row } = run(storeWith([['verbal.traicion', -0.9]], [[SELF_RESPONSE, 0]]), chain(), (t) => (t >= 5 ? ACTIVITY.leisure : ACTIVITY.idle));
    expect(ends[0]).toBe('evitacion');
    const w = world.citizens.get(`CIT-${String(row).padStart(6, '0')}` as never)!.functions!.r.find((x) => x.r === 'evit.distraccion')!.w;
    expect(w).toBeGreaterThan(0.2);
  });

  it('R-006 y R-007: tomar distancia con «Yo» corta el episodio; se refuerza si hay valor y se debilita si no', () => {
    // Con «Yo» a 0,9 toma distancia enseguida (antes de los 3 pasos que registran el episodio).
    const withValue = run(storeWith([['verbal.traicion', -0.9], ['dominio.familia', 0.8]], [[SELF_RESPONSE, 0.9]]), chain());
    const noValue = run(storeWith([['verbal.traicion', -0.9]], [[SELF_RESPONSE, 0.9]]), chain());
    const c = (r: typeof withValue) => r.world.citizens.get(`CIT-${String(r.row).padStart(6, '0')}` as never)!;
    expect(c(withValue).mind?.episode).toBeUndefined();
    expect(withValue.ends.every((e) => e === 'yo')).toBe(true);
    const w = (r: typeof withValue) => c(r).functions!.r.find((x) => x.r === SELF_RESPONSE)!.w;
    expect(w(withValue)).toBeGreaterThan(0.9 - 1e-9);
    expect(w(noValue)).toBeLessThan(0.9);
  });

  it('INV-001: con redes al azar, todo episodio termina en un número acotado de ticks', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = createRng(seed);
      const stims = ['verbal.traicion', 'verbal.abandono', 'verbal.soledad', 'verbal.critica'];
      const net: RelationalNetwork = { e: [], pruned: 0 };
      for (let k = 0; k < 6; k++) {
        const a = stims[rng.int(0, 3)]!;
        const b = stims[rng.int(0, 3)]!;
        if (a !== b) teach(net, { a, b, t: rng.chance(0.3) ? 'opposition' : 'coordination', s: 0.5 + rng.next() / 2, now: 0 });
      }
      const { ends } = run(storeWith([['verbal.traicion', -1]]), net, undefined, 600);
      expect(ends.length, `semilla ${seed}`).toBeGreaterThan(0);
    }
  });
});
