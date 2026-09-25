import { describe, expect, it } from 'vitest';
import { defineColumn } from '../components.ts';
import { hire, setOccupation } from '../employment.ts';
import type { WorldEvent } from '../events.ts';
import { TILE, createGeoMap, setTile } from '../geo.ts';
import { idNumber } from '../ids.ts';
import { initMobility } from '../mobility/columns.ts';
import { mobilitySystem } from '../mobility/system.ts';
import { initNeeds } from '../needs/columns.ts';
import { sleepSystem } from '../needs/illness.ts';
import { needsSystem } from '../needs/system.ts';
import { createRng } from '../rng.ts';
import { initRoutines } from '../routines/columns.ts';
import { routinesSystem } from '../routines/system.ts';
import { Runner } from '../runner.ts';
import { createRegistry } from '../simulation/registry.ts';
import type { System } from '../simulation/system.ts';
import { TEST_PROFILE, testConfig } from '../testing.ts';
import { addHousehold, addOrganization, addPerson, addPlace, createWorld } from '../world.ts';
import { defineWorkColumns } from './jobs.ts';
import { workLateSystem, workMarketSystem } from './systems.ts';

const DAY = 1440;
const SMMLV = 1_750_905;

/** Una calle de 260 tiles: casas al oeste y una oficina a 1,5 km (20 min a pie), con un jefe y `staff` puestos base. */
function town(opts: { staff: number; seed?: number; capabilities?: ('needs' | 'routines' | 'mobility' | 'economy')[] }) {
  const { world } = createWorld(
    testConfig({ epoch: '2027-02-01T00:00', initialCapabilities: ['clock', ...(opts.capabilities ?? ['needs', 'routines', 'mobility', 'economy'])], profile: TEST_PROFILE, seed: opts.seed ?? 1 }),
  );
  const geo = createGeoMap(260, 3, 8);
  for (let x = 0; x < 260; x++) setTile(geo, x, 1, TILE.road);
  world.geo = geo;
  const c = world.components;
  defineColumn(c, 'i32', 'demo.birthMinute', 0);
  defineColumn(c, 'u8', 'demo.student', 0);
  defineColumn(c, 'u8', 'health.sleepHours', 8);
  defineWorkColumns(world);
  const office = addPlace(world, { kind: 'servicios.oficina', name: 'Oficinas', door: { x: 190, y: 1 } });
  const shift = { days: 'mon-sat' as const, start: 480, end: 1020, lunch: 60 };
  const pos = (level: number) => ({ title: level ? 'Jefe' : 'Oficinista', level, occupation: 'ciuo.4110', wage: SMMLV, wagePeriod: 'month' as const, shift });
  const org = addOrganization(world, {
    name: 'Oficinas', sector: 'ciiu.7020', placeIds: [office], culture: { strictness: 0.5, warmth: 0.5, stability: 0.5 },
    positions: [pos(1), ...Array.from({ length: opts.staff }, () => pos(0))],
  });
  let n = 0;
  const person = () => {
    const dwelling = addPlace(world, { kind: 'vivienda.unidad', name: `Vivienda ${n}`, door: { x: n++, y: 1 }, openingHours: null });
    const h = addHousehold(world, { template: 'single', dwellingId: dwelling });
    const id = addPerson(world, { name: { given: 'Ana', family: ['Rojas', 'Gómez'] }, sex: 'F', birthplace: 'co.cali', householdId: h });
    c.i32['demo.birthMinute']![idNumber(id)] = -35 * 365 * DAY;
    return id;
  };
  return { world, org, person };
}

describe('spec 006 (M2): el trabajo en la vida diaria', () => {
  it('CA-004: 3 retrasos en un mes → JOB_LOST con los 3 retrasos como causas; antes, una llamada de atención por cada uno', () => {
    const t = town({ staff: 1 });
    const boss = t.person();
    const worker = t.person();
    hire(t.world, boss, t.org, `${t.org}/P01`);
    hire(t.world, worker, t.org, `${t.org}/P02`);
    const rng = createRng(1);
    initNeeds(t.world, rng);
    initRoutines(t.world, rng);
    initMobility(t.world);
    const row = idNumber(worker);
    // Cada mañana se queda dormido hasta las 7:55 (turno a las 8:00, 20 min de camino): llega ≈ 15 min tarde.
    const oversleep: System = {
      id: 'prueba.dormido', phase: 'end_of_day', order: 9, capability: 'routines', cadence: 'day', minLevel: 0,
      run: (_v, ctx) => ({ patches: [{ op: 'set', type: 'i32', column: 'routine.wakeAt', row, value: ctx.now + 475 }] }),
    };
    const r = new Runner(t.world, createRng(1), {}, { systems: createRegistry([needsSystem, sleepSystem, routinesSystem, mobilitySystem, workLateSystem, oversleep]) });
    r.advanceDays(4);
    const events: WorldEvent[] = r.drainEvents();
    const lates = events.filter((e) => e.type === 'ARRIVED_LATE' && (e.payload as { citizenId: string }).citizenId === worker);
    const warnings = events.filter((e) => e.type === 'JOB_WARNING');
    const lost = events.find((e) => e.type === 'JOB_LOST')!;
    expect(lates.length).toBeGreaterThanOrEqual(3);
    expect(warnings.map((w) => (w.payload as { count: number }).count)).toEqual([1, 2, 3]);
    expect(lost).toBeDefined();
    expect((lost.payload as { citizenId: string; reason: string }).reason).toBe('retrasos');
    expect(lost.causes.map((c) => ('event' in c ? c.event : ''))).toEqual(lates.slice(0, 3).map((e) => e.id));
    expect(t.world.citizens.get(worker)!.occupation).toMatchObject({ kind: 'none', reason: 'unemployed' });
    expect(t.world.organizations.get(t.org)!.positions[1]!.holderId).toBeUndefined();
    expect(events.some((e) => e.type === 'JOB_WARNING' && (e.payload as { citizenId: string }).citizenId === boss)).toBe(false);
  });

  it('CA-005: una vacante con candidatos se cubre en ≤ 30 días (20 de 20 semillas)', () => {
    let filled = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const t = town({ staff: 1, seed, capabilities: ['economy'] });
      for (let k = 0; k < 5; k++) setOccupation(t.world, t.person(), { kind: 'none', reason: 'unemployed', since: 0 });
      hire(t.world, t.person(), t.org, `${t.org}/P01`);
      const r = new Runner(t.world, createRng(seed), {}, { systems: createRegistry([workMarketSystem]) });
      r.advanceDays(30);
      const hired = r.drainEvents().filter((e) => e.type === 'JOB_HIRED');
      if (t.world.organizations.get(t.org)!.positions[1]!.holderId && hired.length === 1) filled++;
    }
    expect(filled).toBe(20);
  });

  it('CA-006: una organización con la caja en negativo 2 meses reduce plantilla (JOB_LOST por crisis) y no contrata', () => {
    const t = town({ staff: 3, capabilities: ['economy'] });
    const ids = [t.person(), t.person(), t.person(), t.person()];
    ids.forEach((id, k) => hire(t.world, id, t.org, `${t.org}/P0${k + 1}`));
    setOccupation(t.world, t.person(), { kind: 'none', reason: 'unemployed', since: 0 });
    t.world.organizations.get(t.org)!.cash = -1_000_000;
    const r = new Runner(t.world, createRng(1), {}, { systems: createRegistry([workMarketSystem]) });
    r.advanceDays(59);
    expect(r.drainEvents().some((e) => e.type === 'JOB_LOST')).toBe(false);
    r.advanceDays(2);
    const events = r.drainEvents();
    const lost = events.filter((e) => e.type === 'JOB_LOST');
    expect(lost).toHaveLength(1);
    expect((lost[0]!.payload as { reason: string }).reason).toBe('crisis de la organización');
    expect(lost[0]!.causes[0]).toMatchObject({ state: 'caja_negativa', entity: t.org });
    expect(t.world.organizations.get(t.org)!.positions.filter((p) => p.holderId)).toHaveLength(3);
    expect(events.some((e) => e.type === 'JOB_HIRED')).toBe(false);
  });
});
