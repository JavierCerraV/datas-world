import { describe, expect, it } from 'vitest';
import { ACTIVITY, ACTIVITY_COLUMN } from '../activity.ts';
import { defineColumn } from '../components.ts';
import { setOccupation } from '../employment.ts';
import type { WorldEvent } from '../events.ts';
import { TILE, createGeoMap, setTile } from '../geo.ts';
import { formatId, idNumber } from '../ids.ts';
import { homeOf, initMobility } from '../mobility/columns.ts';
import { occupancy } from '../mobility/enter.ts';
import { mobilityParams } from '../mobility/params.ts';
import { mobilitySystem } from '../mobility/system.ts';
import { initNeeds } from '../needs/columns.ts';
import { sleepSystem } from '../needs/illness.ts';
import { needsSystem } from '../needs/system.ts';
import { createRng } from '../rng.ts';
import { initRoutines } from '../routines/columns.ts';
import { dayInfo } from '../routines/day.ts';
import { planAt } from '../routines/plan.ts';
import { initRules, routineResponse } from '../rules/routine.ts';
import { ruleContribution } from '../rules/rules.ts';
import { routinesSystem } from '../routines/system.ts';
import { Runner } from '../runner.ts';
import { stateHash } from '../serialize.ts';
import { createRegistry } from '../simulation/registry.ts';
import { TEST_PROFILE, testConfig } from '../testing.ts';
import { addHousehold, addPerson, addPlace, createWorld } from '../world.ts';
import type { LeisureInterest, World } from '../world.ts';
import { defineDecisionColumns } from './columns.ts';
import type { LeisureTable } from './columns.ts';
import { buildOptions, freeUntil } from './options.ts';
import { softmax, temperatureOf } from './select.ts';
import { choose, createDecisionSystem } from './system.ts';
import { createActionValidator } from './validate.ts';

const DAY = 1440;
const TABLE: LeisureTable = {
  'baile.rumba': { name: 'Bailar salsa', placeKinds: ['ocio.bar'], atHome: false, cost: 30_000, hours: 4, group: 'con_otros', physical: 1 },
  'entretenimiento.tv_series': { name: 'Ver series', placeKinds: [], atHome: true, cost: 0, hours: 2, group: 'solo', physical: 0 },
  'cultura.cine': { name: 'Ir a cine', placeKinds: ['ocio.cine'], atHome: false, cost: 30_000, hours: 3, group: 'ambos', physical: 0 },
};
const validate = createActionValidator(TABLE);
const P = mobilityParams(TEST_PROFILE, '2027-02-01');

/** Un pueblo pequeño: casas al oeste, un bar (16:00–02:00) a 400 m; La Capital con su cine, fuera del mapa. */
function town(people: { leisure: LeisureInterest[]; money?: number }[], seed = 1) {
  const { world } = createWorld(
    testConfig({ epoch: '2027-02-01T00:00', initialCapabilities: ['clock', 'needs', 'routines', 'mobility'], profile: TEST_PROFILE, seed }),
  );
  const geo = createGeoMap(80, 3, 8);
  for (let x = 0; x < 80; x++) setTile(geo, x, 1, TILE.road);
  world.geo = geo;
  const c = world.components;
  defineColumn(c, 'i32', 'demo.birthMinute', 0);
  defineColumn(c, 'i32', 'money', 0);
  defineColumn(c, 'u8', 'demo.student', 0);
  defineColumn(c, 'u8', 'health.sleepHours', 8);
  for (const col of ['pers.neuroticism', 'pers.extraversion', 'pers.resilience', 'pers.conscientiousness', 'pers.impulsivity'])
    defineColumn(c, 'f32', col, 0.5);
  addPlace(world, { kind: 'transporte.paradero', name: 'Paradero', door: { x: 20, y: 1 }, openingHours: { days: 'all', open: 300, close: 1200 } });
  const bar = addPlace(world, { kind: 'ocio.bar', name: 'Bar', door: { x: 50, y: 1 }, capacity: 40, openingHours: { days: 'all', open: 960, close: 1560 } });
  const city = addPlace(world, { kind: 'territorio.municipio', name: 'La Capital', travel: { minutes: 60, cost: 12_000 } });
  addPlace(world, { kind: 'ocio.cine', name: 'Cine', parentId: city, travel: { minutes: 60, cost: 12_000 }, openingHours: { days: 'all', open: 840, close: 1380 } });
  const rows = people.map((p, n) => {
    const dwelling = addPlace(world, { kind: 'vivienda.unidad', name: `Vivienda ${n}`, door: { x: n, y: 1 }, openingHours: null });
    const h = addHousehold(world, { template: 'single', dwellingId: dwelling });
    const id = addPerson(world, { name: { given: 'Ana', family: ['Rojas', 'Gómez'] }, sex: 'F', birthplace: 'co.cali', householdId: h });
    const row = idNumber(id);
    c.i32['demo.birthMinute']![row] = -35 * 365 * DAY;
    c.i32.money![row] = p.money ?? 1_000_000;
    setOccupation(world, id, { kind: 'none', reason: 'other_inactive', since: 0 });
    world.citizens.get(id)!.leisure = p.leisure;
    return row;
  });
  const rng = createRng(seed);
  initNeeds(world, rng);
  initRoutines(world, rng);
  initMobility(world);
  defineDecisionColumns(world);
  return { world, rows, bar: idNumber(bar) };
}

const interest = (key: string, affinity: number, perMonth = 4): LeisureInterest => ({ key, affinity, perMonth, since: -DAY });

/** Opciones y elección de una persona en el minuto `at` (sin correr el mundo). */
function decideAt(world: World, row: number, at: number, seed: number) {
  world.now = at;
  const day = (m: number) => dayInfo(world, m);
  const i = world.components.i32;
  const ctx = {
    view: world, row, now: at, here: i['loc.place']![row]!, home: i['loc.place']![row]!, cap: freeUntil(world, row, at, day),
    day, occ: occupancy(world, [row]), P, table: TABLE,
  };
  const r = createRng(seed);
  const options = buildOptions(ctx, r);
  return choose(world, options, temperatureOf(0.5), r, validate).pick;
}

describe('spec 040: selección por fuentes de control (conserva los criterios de la 017)', () => {
  it('INV-001: la softmax da probabilidades finitas en [0,1] que suman 1', () => {
    const r = createRng(3);
    for (let n = 0; n < 200; n++) {
      const us = Array.from({ length: r.int(1, 8) }, () => (r.next() - 0.5) * 10);
      const p = softmax(us, temperatureOf(r.next()));
      expect(Math.abs(p.reduce((s, x) => s + x, 0) - 1)).toBeLessThan(1e-9);
      for (const x of p) expect(x >= 0 && x <= 1 && Number.isFinite(x)).toBe(true);
    }
  });

  it('040 CA-003 (017 CA-001): con hambre crítica en un bloque libre se elige comer en más del 95 % de los casos', () => {
    const { world, rows } = town([{ leisure: [interest('baile.rumba', 1), interest('entretenimiento.tv_series', 1)] }]);
    const row = rows[0]!;
    let eat = 0;
    for (let s = 0; s < 300; s++) {
      world.components.f32['need.hunger']![row] = 0.05;
      world.components.f32['need.fun']![row] = 0.1;
      if (decideAt(world, row, 17 * 60, s)?.action.kind === 'eat') eat++;
    }
    expect(eat / 300).toBeGreaterThan(0.95);
  });

  it('040 R-008 (017 CA-003): una acción imposible (sin dinero para el cine) se rechaza y se elige otra', () => {
    const { world, rows } = town([{ leisure: [interest('cultura.cine', 1, 8)], money: 1_000 }]);
    const row = rows[0]!;
    world.components.f32['need.fun']![row] = 0;
    world.now = 15 * 60;
    const day = (m: number) => dayInfo(world, m);
    const home = world.components.i32['loc.place']![row]!;
    const options = buildOptions({ view: world, row, now: world.now, here: home, home, cap: freeUntil(world, row, world.now, day), day, occ: new Map(), P, table: TABLE }, createRng(1));
    const cine = options.find((o) => o.action.kind === 'leisure')!;
    expect(cine).toBeDefined(); // es una opción (el dinero no la filtra)…
    expect(validate(world, cine.action)).toEqual({ ok: false, rejected: 'sin dinero' }); // …pero se rechaza
    for (let s = 0; s < 100; s++) {
      const pick = decideAt(world, row, 15 * 60, s)!;
      expect(pick).toBeDefined();
      expect(pick.action.kind).not.toBe('leisure');
    }
  });

  it('CA-004 y 032 CA-006: diversión baja, dinero y el bar abierto: elige de su ficha y la de mayor afinidad es la más frecuente', () => {
    const { world, rows } = town([{ leisure: [interest('baile.rumba', 0.9), interest('entretenimiento.tv_series', 0.3)] }]);
    const row = rows[0]!;
    const count = new Map<string, number>();
    for (let s = 0; s < 300; s++) {
      world.components.f32['need.fun']![row] = 0.1;
      const pick = decideAt(world, row, 19 * 60, s)!;
      const key = (pick.action.params as { leisure?: string }).leisure ?? pick.action.kind;
      count.set(key, (count.get(key) ?? 0) + 1);
    }
    const leisure = (count.get('baile.rumba') ?? 0) + (count.get('entretenimiento.tv_series') ?? 0);
    expect(leisure / 300).toBeGreaterThan(0.5);
    expect(count.get('baile.rumba')!).toBeGreaterThan(count.get('entretenimiento.tv_series') ?? 0);
  });

  it('CA-006: a igual situación, con descuento alto se sigue menos la rutina de obligaciones', () => {
    const { world, rows } = town([{ leisure: [interest('entretenimiento.tv_series', 0.5)] }]);
    const row = rows[0]!;
    defineColumn(world.components, 'f32', 'hist.discountK', 0.2);
    setOccupation(world, formatId('CIT', row), { kind: 'none', reason: 'unemployed', since: 0 });
    // Martes 11:00: bloque de búsqueda de empleo (obligación flexible) de una persona desempleada.
    const routineShare = (k: number) => {
      world.components.f32['hist.discountK']![row] = k;
      let n = 0;
      for (let s = 0; s < 300; s++) {
        world.components.f32['need.fun']![row] = 0.3;
        if (decideAt(world, row, DAY + 11 * 60, s)?.action.kind === 'follow_routine') n++;
      }
      return n / 300;
    };
    const plan = planAt(world, row, dayInfo(world, DAY + 11 * 60), 11 * 60);
    expect(['job_search', 'chores', 'care']).toContain(plan.activity);
    expect(routineShare(0.02)).toBeGreaterThan(routineShare(2) + 0.05);
  });
});

describe('040 en marcha, con el validador en el bucle (021)', () => {
  const run = (guard: boolean, seed = 1) => {
    const t = town([{ leisure: [interest('baile.rumba', 0.9), interest('entretenimiento.tv_series', 0.3)] }, { leisure: [interest('entretenimiento.tv_series', 0.8)] }], seed);
    const runner = new Runner(t.world, createRng(seed), {}, {
      systems: createRegistry([needsSystem, sleepSystem, routinesSystem, createDecisionSystem(TABLE), mobilitySystem]),
      loop: { validate, guard },
    });
    return { ...t, runner };
  };

  it('040 CA-005 y 032 CA-006: la afición elegida produce LEISURE_DONE con sus aportes como causa, lleva al lugar y sube la diversión', () => {
    const { world, rows, bar, runner } = run(false);
    const row = rows[0]!;
    runner.advanceTicks((18 * 60) / 5); // lunes 18:00
    world.components.f32['need.fun']![row] = 0.05;
    const events: WorldEvent[] = [];
    let atBar = false;
    let funBefore = 0;
    for (let k = 0; k < 36 && !atBar; k++) {
      runner.advanceTicks(1);
      events.push(...runner.drainEvents());
      if (world.components.i32['loc.place']![row] === bar) {
        atBar = true;
        funBefore = world.components.f32['need.fun']![row]!;
      }
    }
    const done = events.filter((e) => e.type === 'LEISURE_DONE');
    expect(done.length).toBeGreaterThan(0);
    for (const e of done) {
      expect(e.causes.length).toBeGreaterThan(0);
      expect(e.causes.some((c) => 'state' in c && c.state.startsWith('fuente.'))).toBe(true);
      for (const c of e.causes) expect(('state' in c && c.state.startsWith('fuente.')) || 'event' in c).toBe(true);
    }
    expect(atBar).toBe(true);
    expect(done.some((e) => (e.payload as { activity: string }).activity === 'baile.rumba')).toBe(true);
    expect(world.components.u8[ACTIVITY_COLUMN]![row]).toBe(ACTIVITY.socialize);
    runner.advanceTicks(12);
    expect(world.components.f32['need.fun']![row]!).toBeGreaterThan(funBefore);
  });

  it('038 CA-004: buscar empleo sin conseguirlo baja el aporte de la regla (desaliento); al empezar, el aporte es el de la 040', () => {
    const t = town([{ leisure: [interest('entretenimiento.tv_series', 0.5)] }]);
    const row = t.rows[0]!;
    const id = formatId('CIT', row);
    setOccupation(t.world, id, { kind: 'none', reason: 'unemployed', since: 0 });
    initRules(t.world);
    const jobRule = () => t.world.citizens.get(id)!.rules!.find((r) => r.resp === routineResponse('job_search'))!;
    expect(ruleContribution(jobRule())).toBeCloseTo(0.45, 10);
    const runner = new Runner(t.world, createRng(1), {}, {
      systems: createRegistry([needsSystem, sleepSystem, routinesSystem, createDecisionSystem(TABLE), mobilitySystem]),
      loop: { validate },
    });
    runner.advanceDays(14);
    expect(jobRule().hist.followed).toBeGreaterThan(10);
    expect(jobRule().contrast).toBeGreaterThan(0.03);
    expect(ruleContribution(jobRule())).toBeLessThan(0.45 * 0.97);
  }, 60_000);

  it('INV-003: tres días con la vista congelada, misma semilla y mismo hash; tras una semana, todos duermen en casa', () => {
    const a = run(true);
    const b = run(true);
    a.runner.advanceDays(3);
    b.runner.advanceDays(3);
    expect(stateHash(a.world)).toBe(stateHash(b.world));
    const c = run(false, 2);
    c.runner.advanceDays(7);
    c.runner.advanceTicks((3 * 60) / 5); // 03:00 del día 8
    for (const row of c.rows) {
      expect(c.world.components.i32['loc.place']![row]).toBe(homeOf(c.world, row));
      expect(c.world.components.u8[ACTIVITY_COLUMN]![row]).toBe(ACTIVITY.sleep);
    }
  }, 60_000);
});
