import { describe, expect, it } from 'vitest';
import { ACTIVITY_COLUMN } from '../activity.ts';
import { defineColumn } from '../components.ts';
import { hire } from '../employment.ts';
import type { WorldEvent } from '../events.ts';
import { TILE, createGeoMap, setTile } from '../geo.ts';
import { idNumber } from '../ids.ts';
import type { EntityId } from '../ids.ts';
import { initNeeds } from '../needs/columns.ts';
import { sleepSystem } from '../needs/illness.ts';
import { needsSystem } from '../needs/system.ts';
import { addObject } from '../objects.ts';
import { createRng } from '../rng.ts';
import { initRoutines } from '../routines/columns.ts';
import { routinesSystem } from '../routines/system.ts';
import { Runner } from '../runner.ts';
import { stateHash } from '../serialize.ts';
import { createRegistry } from '../simulation/registry.ts';
import type { System } from '../simulation/system.ts';
import { TEST_PROFILE, testConfig } from '../testing.ts';
import { addHousehold, addOrganization, addPerson, addPlace, createWorld } from '../world.ts';
import type { World } from '../world.ts';
import { initMobility } from './columns.ts';
import { enterRefusal } from './enter.ts';
import { mobilityParams } from './params.ts';
import { mobilitySystem } from './system.ts';
import { planTrip, travelMinutes } from './trip.ts';

const DAY = 1440;
const EPOCH = '2027-02-01T00:00'; // lunes

/**
 * Un pueblo lineal: una calle de 260 tiles de 8 m (fila 1). Casas al oeste (x = 0..9), paradero en x = 20,
 * tienda y café en x = 30 y 32, oficina a 1,5 km (x = 190) y un lugar a 2 km (x = 250). La Capital, fuera del mapa.
 */
function town(opts: { seed?: number } = {}) {
  const { world } = createWorld(
    testConfig({ epoch: EPOCH, initialCapabilities: ['clock', 'needs', 'routines', 'mobility'], profile: TEST_PROFILE, seed: opts.seed ?? 1 }),
  );
  const geo = createGeoMap(260, 3, 8);
  for (let x = 0; x < 260; x++) setTile(geo, x, 1, TILE.road);
  world.geo = geo;
  const c = world.components;
  defineColumn(c, 'i32', 'demo.birthMinute', 0);
  defineColumn(c, 'i32', 'money', 500_000);
  defineColumn(c, 'u8', 'demo.student', 0);
  defineColumn(c, 'u8', 'health.sleepHours', 8);
  defineColumn(c, 'u8', 'health.disability', 0);
  for (const col of ['pers.neuroticism', 'pers.extraversion', 'pers.resilience', 'pers.conscientiousness', 'pers.impulsivity'])
    defineColumn(c, 'f32', col, 0.5);
  const at = (x: number) => ({ x, y: 1 });
  const stop = addPlace(world, { kind: 'transporte.paradero', name: 'Paradero', door: at(20), openingHours: { days: 'all', open: 300, close: 1200 } });
  const shop = addPlace(world, { kind: 'comercio.tienda_barrio', name: 'Tienda', door: at(30), openingHours: { days: 'all', open: 540, close: 1200 } });
  const cafe = addPlace(world, { kind: 'ocio.cafe', name: 'Café', door: at(32), capacity: 3, openingHours: { days: 'all', open: 420, close: 1260 } });
  const office = addPlace(world, { kind: 'servicios.oficina', name: 'Oficinas', door: at(190) });
  const far = addPlace(world, { kind: 'espacio_publico.parque', name: 'Parque lejano', door: at(250) });
  const city = addPlace(world, { kind: 'territorio.municipio', name: 'La Capital', travel: { minutes: 60, cost: 12_000 } });
  const cinema = addPlace(world, { kind: 'ocio.cine', name: 'Cine', parentId: city, travel: { minutes: 60, cost: 12_000 } });
  const org = addOrganization(world, {
    name: 'Oficinas',
    sector: 'ciiu.7020',
    placeIds: [office],
    positions: Array.from({ length: 10 }, () => ({
      title: 'Oficinista', level: 0, occupation: 'ciuo.4110', wage: 1_750_905, wagePeriod: 'month' as const,
      shift: { days: 'mon-fri' as const, start: 480, end: 1020, lunch: 60 },
    })),
    culture: { strictness: 0.5, warmth: 0.5, stability: 0.5 },
  });
  let pos = 0;
  /** Una persona adulta en su propia casa (x = n), opcionalmente empleada y con vehículos del hogar. */
  const person = (opts: { employed?: boolean; vehicles?: string[]; impaired?: boolean } = {}) => {
    const n = world.households.size;
    const dwelling = addPlace(world, { kind: 'vivienda.unidad', name: `Vivienda ${n}`, door: at(n), openingHours: null });
    const h = addHousehold(world, { template: 'single', dwellingId: dwelling });
    const id = addPerson(world, { name: { given: 'Ana', family: ['Rojas', 'Gómez'] }, sex: 'F', birthplace: 'co.cali', householdId: h });
    const row = idNumber(id);
    c.i32['demo.birthMinute']![row] = -35 * 365 * DAY;
    if (opts.impaired) c.u8['health.disability']![row] = 4;
    if (opts.employed) hire(world, id, org, `${org}/P${String(++pos).padStart(2, '0')}`);
    for (const kind of opts.vehicles ?? [])
      addObject(world, { kind, name: kind, ownerId: h, marketValue: 1_000_000, condition: 1, sentimental: {} });
    return { id, row, dwelling: idNumber(dwelling) };
  };
  const init = () => {
    const rng = createRng(opts.seed ?? 1);
    initNeeds(world, rng);
    initRoutines(world, rng);
    initMobility(world);
  };
  const num = (id: EntityId) => idNumber(id);
  return { world, person, init, stop: num(stop), shop: num(shop), cafe: num(cafe), office: num(office), far: num(far), cinema: num(cinema) };
}

const P = mobilityParams(TEST_PROFILE, '2027-02-01');
const runner = (world: World, extra: System[] = [], guard = false) =>
  new Runner(world, createRng(1), {}, { systems: createRegistry([needsSystem, sleepSystem, routinesSystem, mobilitySystem, ...extra]), loop: { guard } });

describe('spec 016: movilidad', () => {
  it('CA-001: 2 km a pie duran 20–30 min (4,5 km/h con ruido)', () => {
    for (let s = 0; s < 200; s++) {
      const m = travelMinutes(2000, 4.5, 0.1, createRng(s));
      expect(m).toBeGreaterThanOrEqual(20);
      expect(m).toBeLessThanOrEqual(30);
    }
    const t = town();
    const a = t.person();
    t.init();
    for (let s = 0; s < 50; s++) {
      const trip = planTrip(t.world, a.row, a.dwelling, t.far, 600, createRng(s), P)!;
      expect(trip.mode).toBe('walk');
      expect(trip.minutes).toBeGreaterThanOrEqual(20);
      expect(trip.minutes).toBeLessThanOrEqual(30);
    }
  });

  it('CA-002: salir con 5 min de margen hacia un turno a 20 min produce ARRIVED_LATE con la salida tarde (OVERSLEPT) como causa', () => {
    const t = town();
    const a = t.person({ employed: true });
    t.init();
    const i = t.world.components.i32;
    expect(i['routine.wakeW']![a.row]).toBe(395); // 85 min antes del turno de las 8:00
    i['routine.wakeAt']![a.row] = 475; // se queda dormido hasta las 7:55
    const events: WorldEvent[] = [];
    const r = runner(t.world);
    r.advanceTicks((9 * 60) / 5);
    events.push(...r.drainEvents());
    const overslept = events.find((e) => e.type === 'OVERSLEPT')!;
    const late = events.find((e) => e.type === 'ARRIVED_LATE')!;
    expect(overslept).toBeDefined();
    expect(late).toBeDefined();
    expect((late.payload as { minutes: number }).minutes).toBeGreaterThanOrEqual(10);
    expect(late.causes[0]).toEqual({ event: overslept.id, weight: 0.7 });
    expect(i['loc.place']![a.row]).toBe(t.office);

    // Al día siguiente, sin quedarse dormido, sale a tiempo y no llega tarde.
    r.advanceTicks((DAY - 9 * 60 + 9 * 60) / 5);
    const next = r.drainEvents();
    if (!next.some((e) => e.type === 'OVERSLEPT')) expect(next.some((e) => e.type === 'ARRIVED_LATE')).toBe(false);
  });

  it('CA-003 y 033 CA-006: ida y vuelta al cine de La Capital en bus: pasa por el paradero, ≥ 2 × 60 min y 2 × $12 000', () => {
    const t = town();
    const a = t.person();
    t.init();
    const go = planTrip(t.world, a.row, a.dwelling, t.cinema, 14 * 60, createRng(1), P)!;
    const back = planTrip(t.world, a.row, t.cinema, a.dwelling, 14 * 60 + go.minutes + 120, createRng(2), P)!;
    expect([go.mode, back.mode]).toEqual(['bus', 'bus']);
    expect(go.via).toBe(t.stop);
    expect(back.via).toBe(t.stop);
    expect(go.minutes + back.minutes).toBeGreaterThanOrEqual(2 * 60);
    expect(go.cost + back.cost).toBe(2 * 12_000);
    expect(go.intercity).toBe(true);
    // Sin dinero para el pasaje no hay viaje.
    t.world.components.i32.money![a.row] = 5_000;
    expect(planTrip(t.world, a.row, a.dwelling, t.cinema, 14 * 60, createRng(1), P)).toBeUndefined();
  });

  it('CA-004: sin moto ni carro en el hogar nunca se viaja en moto ni en carro; con ellos, sí', () => {
    const t = town();
    const none = t.person({ impaired: true });
    const bike = t.person({ vehicles: ['transporte.bicicleta'] });
    const moto = t.person({ vehicles: ['transporte.moto'] });
    const car = t.person({ vehicles: ['transporte.carro'], impaired: true });
    t.init();
    const modes = (p: { row: number; dwelling: number }) =>
      new Set(
        [t.far, t.cinema, t.shop].flatMap((to) =>
          Array.from({ length: 20 }, (_, s) => planTrip(t.world, p.row, p.dwelling, to, 600, createRng(s), P)?.mode),
        ),
      );
    for (const p of [none, bike]) {
      expect(modes(p).has('moto')).toBe(false);
      expect(modes(p).has('car')).toBe(false);
    }
    expect(modes(bike).has('bike')).toBe(true);
    expect(modes(moto).has('moto')).toBe(true); // a La Capital, en su moto
    expect(modes(car).has('car')).toBe(true); // con dificultad para caminar, en carro también dentro del pueblo
    expect(planTrip(t.world, none.row, none.dwelling, t.far, 600, createRng(1), P)!.minutes).toBeGreaterThan(40); // camina despacio
  });
});

describe('spec 004: horarios y capacidad de los lugares', () => {
  it('CA-004: una tienda de 9 a 20 rechaza la entrada a las 21:00', () => {
    const t = town();
    const a = t.person();
    t.init();
    expect(enterRefusal(t.world, a.row, t.shop, 21 * 60, new Map())).toBe('cerrado');
    expect(enterRefusal(t.world, a.row, t.shop, 10 * 60, new Map())).toBeNull();
    expect(enterRefusal(t.world, a.row, t.shop, DAY + 8 * 60, new Map())).toBe('cerrado'); // martes, antes de abrir
  });

  it('CA-005: un café con capacidad 3 y 3 ocupantes no admite a otro', () => {
    const t = town();
    const a = t.person();
    t.init();
    expect(enterRefusal(t.world, a.row, t.cafe, 10 * 60, new Map([[t.cafe, 3]]))).toBe('lleno');
    expect(enterRefusal(t.world, a.row, t.cafe, 10 * 60, new Map([[t.cafe, 2]]))).toBeNull();
  });

  it('R-005: el lugar de trabajo admite a quien tiene turno aunque esté cerrado al público', () => {
    const t = town();
    const a = t.person({ employed: true });
    const b = t.person();
    t.init();
    t.world.places.get(`PLC-${String(t.office).padStart(4, '0')}` as EntityId)!.openingHours = { days: 'mon-fri', open: 540, close: 1020 };
    expect(enterRefusal(t.world, a.row, t.office, 7 * 60 + 50, new Map())).toBeNull();
    expect(enterRefusal(t.world, b.row, t.office, 7 * 60 + 50, new Map())).toBe('cerrado');
  });
});

describe('016: el sistema en marcha', () => {
  it('una semana: van al trabajo y vuelven; en tránsito no están en ningún lugar (004 R-003, INV-001); mismo hash con la vista congelada', () => {
    const build = () => {
      const t = town();
      const people = [t.person({ employed: true }), t.person({ employed: true, vehicles: ['transporte.bicicleta'] }), t.person()];
      t.init();
      return { t, people };
    };
    const { t, people } = build();
    const checks: System = {
      id: 'prueba.inv', phase: 'end_of_day', order: 9, capability: 'mobility', cadence: 'tick', minLevel: 0,
      run: (view, ctx) => {
        for (const row of ctx.citizens) {
          const inTransit = view.components.i32['trip.to']![row]! > 0;
          expect(view.components.i32['loc.place']![row]! === 0).toBe(inTransit);
          if (inTransit) expect(view.components.i32['trip.arriveAt']![row]!).toBeGreaterThanOrEqual(view.components.i32['trip.departAt']![row]!);
          if (inTransit) expect(view.components.u8[ACTIVITY_COLUMN]![row]).toBe(5); // commute
        }
        return {};
      },
    };
    const where: number[][] = [];
    const probe: System = {
      id: 'prueba.donde', phase: 'end_of_day', order: 10, capability: 'mobility', cadence: 'hour', minLevel: 0,
      run: (view, ctx) => {
        where[ctx.now / 60] = people.map((p) => view.components.i32['loc.place']![p.row]!);
        return {};
      },
    };
    runner(t.world, [checks, probe]).advanceDays(5);
    for (let d = 0; d < 5; d++) {
      const noon = where[d * 24 + 10]!;
      expect(noon[0]).toBe(t.office);
      expect(noon[1]).toBe(t.office);
      expect(noon[2]).toBe(people[2]!.dwelling); // sin trabajo ni rutina fuera: en casa
      expect(where[d * 24 + 22]!).toEqual(people.map((p) => p.dwelling));
    }

    const a = build();
    const b = build();
    runner(a.t.world, [], true).advanceDays(2);
    runner(b.t.world, [], true).advanceDays(2);
    expect(stateHash(a.t.world)).toBe(stateHash(b.t.world));
  }, 60_000);
});
